// 领域模型：对齐当前工作台 RPC 形体（历史 vanilla 版已删除）
// 组件层与服务层共享这些类型，确保重构后的 UI 与后端协议逐字段一致。

export type EventType =
  | 'user'
  | 'assistant'
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'system'
  | 'plan'
  | 'question'
  | 'todo'
  | 'turn_diff'
  | 'model'
  | 'session_meta';

export interface ThreadEvent {
  id: string;
  type: EventType;
  timestamp?: number;
  payload?: Record<string, unknown>;
}

export interface TurnRunResult {
  threadId: string;
  /** 回合最终总结文本（后端最后一步非 text 时可能无对应 assistant 事件，UI 兜底渲染用）。 */
  finalText?: string;
  /** 本回合实际执行的步数。 */
  steps?: number;
  [key: string]: unknown;
}

/**
 * 插话分流结果（`turns.interject`，2026-10-31「插话模式」）。
 *
 * - `action === 'steered'`：相关内容已并入当前回合（下一步边界生效），客户端只提示即可；
 * - `action === 'interrupted'`：判定为无关/打断，服务端已取消当前回合，客户端应把本条内容
 *   作为**新回合**发送（走 turns.run，附件一起带过去）；
 * - `ok === false` + `error === 'session_not_running'`：回合刚好结束，无需打断，直接发送即可。
 */
export interface InterjectResult {
  ok: boolean;
  threadId?: string;
  /** 服务端采取的动作（`ok:false` 时缺省）。 */
  action?: 'steered' | 'interrupted';
  /** steering 是否真的入队（`action==='steered'` 时有意义）。 */
  queued?: boolean;
  /** 判定依据（可在 UI 上如实说明「为什么被打断」）。 */
  reason?: string;
  /** 词面重合度（0–1，观测用）。 */
  score?: number;
  error?: string;
}

export interface ThreadGetResult {
  items: ThreadEvent[];
  /** 更早是否还有事件（分页响应）。 */
  hasMore?: boolean;
  /** 本页最早事件 id（下一页 `before`）。 */
  oldestId?: string;
  /** 分页参数错误（如 unknown_before）。 */
  error?: string;
}

export interface Config {
  modelAdapter?: string;
  model?: string;
  /** 推理强度（#B6）：none/minimal/low/medium/high/xhigh/max（内核枚举 7 档）。 */
  reasoning?: string;
  approval?: string;
  sandbox?: string;
  /** 越权动作（提权命令等）的降级沙箱档：passthrough/policy/restricted。 */
  elevatedSandbox?: string;
  escalation?: string;
  autoApprove?: boolean;
  /** 界面语言（zh/en）：设置「常规」页切换，随用户级 omniharness.json 持久化。 */
  locale?: string;
  /** 聊天模式（queue=任务中发送排队 / steer=插话；2026-10-31）。 */
  chatMode?: string;
  /** 会话存储适配器：memory/jsonl/sqlite。 */
  storageAdapter?: string;
  /** 会话存储目录（留空 = 内核默认）。 */
  storageDir?: string;
  /** 单回合最大步数（0 = 内核语义，见 ZERO_ALLOWED_FIELDS）。 */
  maxSteps?: number;
  /** 成本预算（USD，硬上限；超限行为见 costBudgetOnExceed）。 */
  costBudgetUsd?: number;
  /** 软阈值比例（相对硬预算，0<r≤1），越过后提前提醒。 */
  costBudgetSoftRatio?: number;
  /** 超预算行为：fail=中止回合 / warn=仅提示。 */
  costBudgetOnExceed?: string;
  /** 模型熔断开关（连续失败达到阈值后暂停调用一段时间）。 */
  modelCircuitBreaker?: boolean;
  /** 熔断阈值（连续失败次数）。 */
  modelCircuitBreakerThreshold?: number;
  /** 熔断打开时长（ms）。 */
  modelCircuitBreakerOpenMs?: number;
  /** 长期记忆落盘加密。 */
  longTermMemoryEncryption?: boolean;
  /** 长期记忆治理（保留/清理策略）。 */
  longTermMemoryGovernance?: boolean;
  /** 加密密钥文件路径（缺省用派生默认密钥）。 */
  longTermMemoryKeyFile?: string;
  workspace?: string;
  [key: string]: unknown;
}

/** 厂商预设（服务端 model.catalog 下发，与后端单一来源同步）。 */
export interface ProviderPreset {
  id: string;
  label: string;
  adapter: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
  models: string[];
  /**
   * 该厂商合法的 reasoning_effort 档位（#B6 扩展，2026-09-08）：
   * - undefined 或 []：UI 退回内置兜底列表（向后兼容）
   * - 非空：Composer「推理强度」下拉按此清单渲染
   * 后端单一来源：src/host/kernel/config.ts（内核 config/providerPresets 经对接面）（数据在随包发布的 defaults/providers.json，
   * 可由 omniharness.json 的 providerPresets 段按 id 整条覆盖）。
   */
  reasoningEffort?: string[];
  /**
   * 每模型推理档位（adaptive-reasoning，2026-11-14）：模型 id → 该模型实际接受的档位。
   * 与厂商级语义不同：模型级 `[]` = 确证不接收 reasoning_effort（UI 隐藏进度条），
   * 不回落兜底。缺字段（旧服务端）时 UI 回落厂商级 `reasoningEffort`。
   */
  effortsByModel?: Record<string, string[]>;
}

/** 单厂商探测结果（凭据已打码，仅状态）。 */
export interface ProviderProbeResult {
  id: string;
  label: string;
  configured: boolean;
  ok: boolean;
  models: string[];
  source: 'models-endpoint' | 'chat-probe' | 'preset' | 'none';
  error?: string;
}

/** 通用文件附件（多模态输入，#B5）：图片/视频/任意文件随用户消息送入。 */
export interface FileAttachment {
  /** 原始文件名。 */
  name: string;
  /** MIME 类型，如 'image/png' / 'video/mp4' / 'application/pdf'。 */
  mediaType: string;
  /** base64 编码（不含 data: 前缀），需配合 mediaType。 */
  data?: string;
  /** http(s) / data URI（与 data 二选一）。 */
  url?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions?: string[];
  source?: string;
  loaded?: boolean;
}

export interface PluginSearchEntry {
  manifest: PluginManifest;
  source: string;
}

export interface PluginReloadResult {
  ok?: boolean;
  loaded?: string[];
}

export interface MemoryFact {
  id: string;
  text: string;
  topic?: string;
  importance?: number;
  source?: string;
  createdAt?: string;
}

export interface MemoryListResult {
  count: number;
  facts: MemoryFact[];
}

export interface MemorySearchResult {
  count: number;
  results: MemoryFact[];
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  plugins?: string[];
}

export interface ActivePlugins {
  plugins?: string[];
}

export interface ProfileApplyResult {
  name?: string;
  id?: string;
  loaded?: string[];
  unloaded?: string[];
}

export interface BundlePackResult {
  path: string;
}

export interface BundleUnpackResult {
  installed?: string[];
  patchFile?: string;
}

export interface GraphStep {
  id: string;
  prompt: string;
  dependsOn?: string[];
}

export interface GraphDef {
  name: string;
  steps: GraphStep[];
  maxConcurrency?: number;
}

export interface GraphSummary {
  id: string;
  name: string;
  stepCount: number;
}

export interface GraphGetResult extends GraphDef {
  id: string;
}

export interface GraphRunResult {
  runId: string;
}

export type GraphNodeStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface GraphNode {
  id: string;
  status: GraphNodeStatus;
  error?: string;
  steps?: unknown;
  durationMs?: number;
}

export interface GraphProgress {
  runId: string;
  id: string;
  status: GraphNodeStatus;
  error?: string;
  steps?: unknown;
  durationMs?: number;
}

export interface GraphDone {
  runId: string;
  ok: boolean;
  blackboard?: Record<string, unknown>;
  error?: string;
}

export interface GraphStatusResult {
  runId: string;
  defName: string;
  done: boolean;
  ok?: boolean;
  nodes: GraphNode[];
  blackboard?: Record<string, unknown>;
  error?: string;
}

export interface GraphRunState {
  runId: string;
  defName: string;
  done: boolean;
  ok?: boolean;
  nodes: GraphNode[];
  blackboard?: Record<string, unknown>;
  error?: string;
}

export interface FsNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FsNode[];
}

export interface FsReadResult {
  path: string;
  content?: string;
  isBinary?: boolean;
  truncated?: boolean;
  size?: number;
}

export interface Metrics {
  sessions?: number;
  eventsByType?: Record<string, number>;
}

export interface ApprovalRequest {
  requestId: string;
  /** 审批所属会话 id（2026-11-01 起服务端随通知/恢复 RPC 下发；桌面通知深链用）。 */
  threadId?: string | null;
  toolName?: string;
  target?: string;
  args?: unknown;
}

/** 提问的一个选项（后端 `AskOption` 的线上形态）。 */
export interface AskQuestionOption {
  label: string;
  description?: string;
}

/** 一道待作答的问题（后端 `AskQuestion` 的线上形态）。 */
export interface AskQuestionItem {
  id: string;
  question: string;
  header?: string;
  options?: AskQuestionOption[];
  /** true 时渲染复选框（可多选）；缺省/ false 为单选。 */
  multiSelect?: boolean;
}

/**
 * 服务端提问上行（SSE 通知 `question.request`）的载荷。
 *
 * 这是 Web 端**唯一**的「有提问待作答」事实源：提问卡的作答入口由它驱动，
 * 而不是靠解析对话流里的 `question` 事件（后者可能因事件端口装配而缺席）。
 */
export interface QuestionRequest {
  requestId: string;
  /** 提问所属会话 id（缺省/ null 表示服务端未声明归属）。 */
  sessionId?: string | null;
  /** 同 {@link sessionId}（2026-11-01 起通知/恢复 RPC 双字段并存，通知契约统一读 threadId）。 */
  threadId?: string | null;
  questions: AskQuestionItem[];
  /** 等待上限（毫秒；0 表示不限时）；UI 据此显示倒计时，到点服务端会按「未作答」继续。 */
  timeoutMs?: number;
}

/** 提交给服务端的一道答案（后端 `AskAnswer` 的线上形态）。 */
export interface QuestionAnswerSubmission {
  id: string;
  selected: string[];
  custom?: string;
}

export interface SseEnvelope {
  method: string;
  params: unknown;
}

// ---------------- 工作台界面能力（上下文容量 / 配额 / 模式 / 权限 / 检索） ----------------
// 与后端 src/apps/server/modules/surface.ts 的 RPC 返回体逐字段对齐。

/** 上下文占用分类键（后端 CONTEXT_CATEGORIES 的键，UI 不自造）。 */
export type ContextCategoryKey =
  | 'messages'
  | 'mcpTools'
  | 'systemTools'
  | 'systemPrompt'
  | 'skills'
  | 'other';

/** 上下文占用单行。 */
export interface ContextUsageRow {
  key: ContextCategoryKey;
  label: string;
  tokens: number;
  /** 占「已用上下文」的百分比（各行之和 ≈ 100）。 */
  percent: number;
}

/** 缓存未命中的分因（与后端 `CacheMissCause` 同枚举）。 */
export type CacheMissCause =
  | 'hit'
  | 'not-reported'
  | 'cold-start'
  | 'prefix-rewrite'
  | 'ttl-expired'
  | 'unknown';

/** 最近一次上报缓存的调用的分因（token 数与信号取自同一条事件）。 */
export interface ContextCacheLastCall {
  cause: CacheMissCause;
  /** 一句话理由（含具体数字，可直接进悬停文案）。 */
  reason: string;
  /** 原始证据（JSON 安全）。 */
  evidence: Record<string, unknown>;
  promptTokens: number;
  cachedPromptTokens: number;
}

/** 提示缓存命中统计。 */
export interface ContextCacheStat {
  promptTokens: number;
  cachedPromptTokens: number;
  calls: number;
  /** 无任何调用上报缓存字段时为 undefined（UI 显示「—」）。 */
  hitRate?: number;
  /**
   * 最近一次上报调用的分因。
   * **可缺省**：旧服务端不发这个字段，前端必须按"没有分因"渲染（不得显示 `undefined` 文案）。
   */
  lastCall?: ContextCacheLastCall;
}

/** `context.usage` 返回体。 */
export interface ContextUsageReport {
  threadId: string;
  windowTokens: number;
  usedTokens: number;
  /** 已用占窗口百分比。 */
  percent: number;
  rows: ContextUsageRow[];
  mcpToolCount: number;
  systemToolCount: number;
  /** `measured`=取最近一次真实请求的实测快照；`estimated`=按事件日志重投影；`empty`=无数据。 */
  source: 'measured' | 'estimated' | 'empty';
  cache: ContextCacheStat;
  collectedAt: string;
}

/** 配额档位。 */
export interface QuotaPlanView {
  id: string;
  label: string;
  multiplier: number;
  upgraded: boolean;
  /**
   * 是否为缺省档（旧字段，服务端自 2026-10-17 起不再下发）。
   *
   * 为什么留成可选而不是删掉：档位改为**按模型自动识别**后，`QuotaPlanView` 的形状变了
   * （多了 `planReason` / `planModel`、少了 `fallback`），而服务端与前端是分开发布的。
   * 留成可选让"新前端 + 旧服务端"不至于崩（旧服务端仍会下发 fallback）。
   */
  fallback?: boolean;
}

/** 单模型配额行。 */
export interface QuotaModelRow {
  name: string;
  used: number;
  limit: number;
  remainingPercent: number;
}

/** `quota.get` / `quota.set` 返回体。 */
export interface QuotaStatus {
  plan: QuotaPlanView;
  /**
   * 档位识别依据（服务端 `QuotaPlans.reasonFor`），如「名字里带 pro ⇒ 厂商自己标注的顶配档」。
   * 面板把它显示在档位旁边——档位不再由用户选择，就必须能解释"为什么是这个档"。
   */
  planReason?: string;
  /** 用于识别档位的代表模型名（未接入厂商时为空串）。 */
  planModel?: string;
  dailyTokens: number;
  effectiveTokens: number;
  usedTokens: number;
  remainingPercent: number;
  models: QuotaModelRow[];
  dayKey: string;
  resetAt: string;
  source: 'local-budget';
}

/** 审批档位（后端 `approval.tiers` 单一来源）。 */
export interface ApprovalTier {
  value: string;
  label: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  fullAccess: boolean;
}

/** 智能体目录条目。 */
export interface AgentCatalogEntry {
  id: string;
  name: string;
  kind: 'builtin' | 'graph' | 'plugin';
  description: string;
  directive?: string;
}

/** 检索命中（文件 / 聊天标题 / 对话内容）。 */
export interface SearchHit {
  kind: 'file' | 'chat' | 'chat-text';
  id: string;
  label: string;
  hint: string;
  /** chat-text：命中行数（其余类型无此字段）。 */
  matchCount?: number;
}

/** 会话模式（目标 / 计划 / 绘图）。 */
export interface SessionModes {
  goal: string;
  planMode: boolean;
  sketchMode: boolean;
}

/**
 * `doctor.report` 的面板契约（**服务端报告的子集**，2026-10-11 Web 交付）。
 *
 * 为什么不直接复用服务端类型：Web 只经 RPC 消费 JSON，且 `web/tsconfig.json` 不跨到 `src/`；
 * 故这里只声明**面板真正会渲染的字段**。字段名与服务端
 * `src/host/extensions/contracts/ports/observability/doctorReport.ts` 逐字一致（判据 `web/test/diagnosticsTab.test.ts`
 * 会核对本类型与面板用到的字段名）。
 */
export interface DoctorReportLike {
  /** Node 版本。 */
  nodeVersion: string;
  /** 配置文件检查。 */
  config: { exists: boolean; valid: boolean; error?: string };
  /** 安全边界（实际隔离到什么程度）。 */
  security: {
    isolationLevel: 'L2' | 'L3';
    isolationBasis: string;
    sandboxProfile: string;
    kernelEnforced: boolean;
    shellEgressGuarded: boolean;
  };
  /** 插件目录是否可读。 */
  pluginsDirReadable: boolean;
  /** 权限清单是否可读。 */
  permissionsManifestReadable: boolean;
  /** 不合格项清单（面板必须逐条显示，不得折叠成一句"有问题"）。 */
  issues: string[];
}

/**
 * `audit.query` 的面板契约（服务端 `AuditEvent` 的子集，2026-10-11 Web 交付）。
 *
 * 返回体是**判别联合**：`{ok:true, events}` 或 `{ok:false, reason}`（未接线）。
 * 面板必须区分二者——空数组只能读成"审计无记录"。
 */
export interface AuditEventLike {
  ts?: string;
  type: string;
  sessionId?: string;
  actor?: string;
  seq?: number;
  hash?: string;
}

/** `audit.query` 的返回体。 */
export type AuditQueryResult =
  | { ok: true; events: AuditEventLike[] }
  | { ok: false; reason: string };

/** 一条只读 trace 条目（服务端 `TraceEntry` 同形）。 */
export interface TraceEntryLike {
  seq: number;
  at: string;
  kind: string;
  summary: string;
}

/** `trace.read` 的返回体（`error` 非空表示会话不存在 / 存档不可读）。 */
export interface TraceReadResultLike {
  session: string;
  entries: TraceEntryLike[];
  count: number;
  error?: string;
}

/**
 * `vault.list` 的返回体（2026-10-11 Web 交付）。**只含名字，绝不含值**——
 * 凭据不回读给浏览器（服务端故意没有 `vault.get`）。
 */
export type VaultListResult = { ok: true; names: string[] } | { ok: false; reason: string };

/** `vault.set` / `vault.delete` 的返回体。 */
export type VaultWriteResult =
  | { ok: true; name: string; removed?: boolean }
  | { ok: false; reason: string };

// ── 控制室（2026-11-10，与服务端 services/{fleet,context,proof} 同形） ─────────────

/** 编队车道状态（服务端 FleetStatus 同形）。 */
export type FleetStatus = 'queued' | 'running' | 'ok' | 'failed' | 'aborted' | 'truncated';

/** 一条子代理车道（`fleet.list` 的节点）。 */
export interface FleetNodeLike {
  childSessionId?: string;
  /** 工具调用 id（运行中可用于取消）。 */
  callId?: string;
  parentSessionId: string;
  task: string;
  status: FleetStatus;
  startedAt: string;
  endedAt?: string;
  steps?: number;
  durationMs?: number;
  tokens?: number;
  changedFiles?: readonly string[];
  patchPath?: string;
  patchBytes?: number;
  patchTruncated?: boolean;
  writesUnrecoverable?: boolean;
  writesForbidden?: boolean;
  isolation: 'worktree' | 'copy';
  verificationState?: 'not-run' | 'failed' | 'unverified' | 'passed';
  error?: string;
  traceAvailable?: boolean;
}

/** 编队快照（`fleet.list` 返回体）。 */
export interface FleetSnapshotLike {
  parentSessionId: string;
  nodes: readonly FleetNodeLike[];
  runningCount: number;
  collectedAt: string;
  /** 事件流不可读等快照级错误；有值时 nodes 为空，UI 必须显示错误。 */
  error?: string;
}

/** 一条压缩记录（`context.studio` 的 compactions 元素）。 */
export interface CompactionMarkLike {
  at: string;
  turnIndex: number;
  compactedUpTo: number;
  headHash: string;
  summary: string;
  auditRecorded: boolean;
}

/** 上下文工作室快照（`context.studio` 返回体；report 与 `context.usage` 同一类型）。 */
export interface ContextStudioSnapshotLike {
  threadId: string;
  report: ContextUsageReport;
  compactions: readonly CompactionMarkLike[];
  handoff: readonly HandoffNoteLike[];
  handoffAvailable: boolean;
  /** 事件流不可读等快照级错误；有值时 compactions 为空。 */
  error?: string;
  collectedAt: string;
}

/** `context.compact` 成功返回体。 */
export interface ContextCompactionViewLike {
  ok: true;
  compactedUpTo: number;
  summary: string;
  eventCount: number;
}

/** `context.compact` 判别失败。 */
export interface ContextCompactionFailureLike {
  ok: false;
  code:
    | 'no_session'
    | 'session_running'
    | 'compaction_noop'
    | 'compaction_failed'
    | 'compaction_persist_failed'
    | 'confirm_required';
  message: string;
}

/** `context.compact` 返回体。 */
export type ContextCompactionResultLike = ContextCompactionViewLike | ContextCompactionFailureLike;

/** 一条交接便签（服务端 HandoffNote 同形；v1 未接线时为空）。 */
export interface HandoffNoteLike {
  id: string;
  text: string;
  tags: readonly string[];
  createdAt: string;
  source: 'user' | 'agent';
}

/** 单项复核结论（`proof.build` 的 checks 元素）。 */
export interface ProofCheckLike {
  code: 'EVENT_COUNT' | 'EVENT_ROOT' | 'SESSION' | 'TOOL_SURFACE' | 'AUDIT_CHAIN' | 'SIGNATURE';
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  kernelCode?: string;
}

/** 执行证书（服务端 ExecutionCertificate 同形子集）。 */
export interface ExecutionCertificateLike {
  version: 1;
  sessionId: string;
  eventCount: number;
  eventRoot: string;
  toolSurfaceDigest?: string;
  issuedAt: string;
}

/** 一回合凭证视图（`proof.build` 返回体）。 */
export interface ProofBundleViewLike {
  sessionId: string;
  turnIndex: number;
  displayIndex: number;
  certificate?: ExecutionCertificateLike;
  /** 本机签名标识（kid/alg；不含签名字节）。 */
  signature?: { kid: string; alg: 'EdDSA' | 'ES256' };
  checks: readonly ProofCheckLike[];
  state: 'unverified' | 'structural' | 'signed' | 'failed';
  eventCount: number;
  auditRecords: number;
  collectedAt: string;
}

/** `fleet.patch` 成功返回体。 */
export interface FleetPatchViewLike {
  ok: true;
  path: string;
  content: string;
  bytes: number;
  truncated: boolean;
}

/** `fleet.patch` 判别失败。 */
export interface FleetPatchFailureLike {
  ok: false;
  code: 'patch_forbidden' | 'patch_unavailable' | 'patch_not_text';
  message: string;
}

/** `fleet.cancel` 返回体。 */
export type FleetCancelResultLike =
  | { ok: true; callId: string }
  | { ok: false; code: 'call_not_found'; message: string };

/** `fleet.patch` 返回体。 */
export type FleetPatchResultLike = FleetPatchViewLike | FleetPatchFailureLike;

/** `fleet.applyPatch` 返回体。 */
export type FleetPatchApplyResultLike =
  | { ok: true; path: string }
  | {
      ok: false;
      code:
        | 'confirm_required'
        | 'patch_forbidden'
        | 'patch_unavailable'
        | 'patch_not_text'
        | 'patch_truncated'
        | 'patch_conflict'
        | 'git_unavailable';
      message: string;
    };

/** 一条导入证据包的会话摘要。 */
export interface ProofVerifySessionLike {
  sessionId: string;
  eventCount: number;
  eventRoot: string;
}

/** `proof.verify` 成功返回体。 */
export interface ProofVerifyViewLike {
  ok: true;
  verdict: {
    ok: boolean;
    problems: readonly { code: string; detail: string }[];
    signatureChecked: boolean;
    commitmentChecked: boolean;
  };
  summary: {
    exportedAt: string;
    sessions: readonly ProofVerifySessionLike[];
    eventCount: number;
  };
}

/** `proof.verify` 判别失败。 */
export interface ProofVerifyFailureLike {
  ok: false;
  code: 'bundle_invalid' | 'bundle_too_large';
  message: string;
}

/** `proof.verify` 返回体。 */
export type ProofVerifyResultLike = ProofVerifyViewLike | ProofVerifyFailureLike;

/** 回合摘要（`proof.turns` 的元素）。 */
export interface ProofTurnSummaryLike {
  sessionId: string;
  turnIndex: number;
  /** 用户回合序号（1 起；系统回合为 0）。 */
  displayIndex: number;
  startedAt: string;
  endedAt: string;
  eventCount: number;
  toolCalls: number;
  changedFiles: number;
  systemTurn: boolean;
}

/** 导出结果（`proof.export` 返回体）。 */
export interface ProofExportResultLike {
  filename: string;
  content: string;
  size: number;
}

/** 凭证 RPC 的判别失败（服务端 ProofFailure 同形）。 */
export interface ProofFailureLike {
  ok: false;
  code: 'proof_empty' | 'proof_invalid' | 'export_too_large' | 'no_session';
  message: string;
}

/** `proof.turns` / `proof.build` / `proof.export` 的返回体。 */
export type ProofResult<T> = T | ProofFailureLike;

// ── 决策账本（2026-11-11，与服务端 services/decision 同形） ───────────────────

/** 决策审计设置。 */
export interface DecisionSettingsLike {
  enabled: boolean;
  principal?: string | undefined;
}

/** 审计状态。 */
export interface DecisionAuditViewLike {
  enabled: boolean;
  configuredPrincipal?: string | undefined;
  startedAt?: string | undefined;
  closed: boolean;
}

/** 覆盖范围。 */
export interface DecisionCoverageLike {
  turnsTotal: number;
  turnsRecorded: number;
  firstRecordedTurn?: number | undefined;
  partial: boolean;
}

/** 摘要计数。 */
export interface DecisionCountsLike {
  records: number;
  decisions: number;
  allow: number;
  escalate: number;
  deny: number;
  conformal: number;
}

/** 最终去向。 */
export type DecisionDispositionLike =
  | 'allowed'
  | 'allowed_by_conformal'
  | 'allowed_by_approval'
  | 'denied'
  | 'denied_after_conformal'
  | 'escalated_pending'
  | 'approved_not_executed'
  | 'unavailable';

/** 依据分类。 */
export type DecisionBasisLike = 'conformal' | 'human' | 'rule' | 'default' | 'unavailable' | 'unknown';

/** 效果类。 */
export type DecisionEffectClassLike = 'READ_ONLY' | 'STATE_MUTATING' | 'PRIVILEGED_ACTUATE';

/** 决策结果。 */
export type DecisionAuditResultLike = 'allow' | 'deny' | 'require_approval' | 'no_rule' | 'unavailable';

/** 列表行。 */
export interface DecisionRowLike {
  recordId: string;
  turnIndex: number;
  displayIndex: number;
  at: string;
  toolName: string;
  result: DecisionAuditResultLike;
  disposition: DecisionDispositionLike;
  basis: DecisionBasisLike;
  effectClass?: DecisionEffectClassLike | undefined;
  riskScore?: number | undefined;
  threshold?: number | undefined;
  authorizationId?: string | undefined;
  principal?: string | undefined;
}

/** 回合摘要。 */
export interface DecisionTurnSummaryLike {
  turnIndex: number;
  displayIndex: number;
  startedAt: string;
  endedAt: string;
  decisions: number;
}

/** 单项复核。 */
export interface DecisionCheckLike {
  code: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

/** 结构复核。 */
export interface DecisionStructuralViewLike {
  status: 'pass' | 'fail' | 'disabled' | 'empty' | 'not_run';
  checks: readonly DecisionCheckLike[];
  auditCount: number;
  aatCount: number;
  problems: readonly { code: string; detail: string }[];
}

/** 共形复核。 */
export interface DecisionConformalViewLike {
  status: 'pass' | 'fail' | 'not_applicable' | 'not_run';
  checkedDecisions: number;
  snapshots: number;
  checks: readonly DecisionCheckLike[];
  problems: readonly { code: string; detail: string }[];
}

/** 诚实边界。 */
export interface DecisionBoundaryViewLike {
  signed: false;
  trustLevel: 'L0';
  argsIncluded: false;
  draft: 'AAT-09-subset';
}

/** `decision.session` 返回体。 */
export interface DecisionSessionViewLike {
  sessionId: string;
  audit: DecisionAuditViewLike;
  coverage: DecisionCoverageLike;
  counts: DecisionCountsLike;
  turns: readonly DecisionTurnSummaryLike[];
  rows: readonly DecisionRowLike[];
  structural: DecisionStructuralViewLike;
  conformal: DecisionConformalViewLike;
  boundary: DecisionBoundaryViewLike;
  truncated: boolean;
  generatedAt: string;
}

/** 审批轨迹。 */
export interface DecisionApprovalViewLike {
  at: string;
  phase: 'request' | 'answer' | 'override';
  result: 'pending' | 'approved' | 'rejected' | 'expired' | 'override';
  by?: string | undefined;
  reason?: string | undefined;
}

/** 策略快照。 */
export interface DecisionPolicyViewLike {
  snapshotHash: string;
  rules: readonly { ruleId: string; ruleVersion: string; digest: string }[];
}

/** 共形证据。 */
export interface DecisionConformalEvidenceLike {
  alpha: number;
  threshold: number;
  riskScore: number;
  effectClass: DecisionEffectClassLike;
  calibrationDigest: string;
  classDigest: string;
  calibrationSnapshotId: string;
  unitCount: number;
  riskFeatures: {
    toolName: string;
    argKeys: number;
    intentKind: string;
    intentRisk: string;
    mutating: boolean;
  };
  riskModelDigest: string;
}

/** `decision.detail` 返回体。 */
export interface DecisionDetailViewLike {
  row: DecisionRowLike;
  decision: {
    decisionId: string;
    requestDigest: string;
    policySnapshotHash: string;
    result: DecisionAuditResultLike;
    defaultApplied: 'allow' | 'deny';
    failClosed: boolean;
    evaluatorId: string;
    authorizationId?: string | undefined;
    validUntil?: string | undefined;
    principal?: string | undefined;
  };
  policy?: DecisionPolicyViewLike | undefined;
  approvals: readonly DecisionApprovalViewLike[];
  authorization?: {
    id: string;
    validUntil?: string | undefined;
    reused: boolean;
  } | undefined;
  conformal?: DecisionConformalEvidenceLike | undefined;
  chain: {
    recordId: string;
    sequenceNumber: number;
    prevHash: string | null;
    hash: string;
  };
  toolCall?: {
    at: string;
    toolName: string;
    parametersHash: string;
  } | undefined;
  toolResult?: {
    at: string;
    ok: boolean;
    durationMs?: number | undefined;
    error?: string | undefined;
  } | undefined;
  neighbors: {
    previousRecordId?: string | undefined;
    nextRecordId?: string | undefined;
  };
}

/** `decision.export` 返回体。 */
export interface DecisionExportResultLike {
  filename: string;
  content: string;
  digest: string;
  sessionHash: string;
  size: number;
  recordCount: number;
}

/** `decision.configure` 返回体。 */
export interface DecisionConfigureResultLike {
  ok: true;
  settings: DecisionSettingsLike;
}

/** 决策账本判别失败。 */
export interface DecisionFailureLike {
  ok: false;
  code:
    | 'no_session'
    | 'aat_unavailable'
    | 'audit_chain_broken'
    | 'record_not_found'
    | 'export_too_large'
    | 'export_blocked'
    | 'confirm_required'
    | 'config_write_failed';
  message: string;
}

/** `decision.*` 返回体联合。 */
export type DecisionResultLike<T> = T | DecisionFailureLike;

