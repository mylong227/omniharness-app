import { ContextWindowCatalog } from '../../../host/kernel/context.ts';
import type { ResolvedConfig } from '../../../host/kernel/contracts.ts';
import { ConfigFactory } from '../../../host/kernel/config.ts';
import type { DecisionEngine } from '../../../host/kernel/contracts.ts';
import { DecisionEngineResolver } from '../../../host/extensions/kernel/config/decisionEngineResolver.ts';
import { SandboxManager, type SandboxProfile } from '../../../host/kernel/adapters-sandbox.ts';
import { ConfigRebase } from '../../../host/kernel/config.ts';
import type { PluginManager } from '../../../host/kernel/plugin.js';
import type { PluginProfile, ApplyProfileResult } from '../../../host/kernel/plugin.js';
import type { AppServerOptions } from './appServerState.ts';
import { GraphRunRegistry } from './graphRunRegistry.ts';
import { ServerConfigStore } from '../services/serverConfigStore.ts';
import { FsExplorer } from '../services/fsExplorer.ts';
import { WorkspaceTree } from '../services/workspaceTree.ts';
import { SessionArchive } from '../services/session/sessionArchive.ts';
import { WorkspaceChanges } from '../services/workspaceChanges.ts';
import { ModelCatalogService } from '../services/modelCatalogService.ts';
import { PluginHost } from '../services/pluginHost.ts';
import { ServerEventBridge } from './serverEventBridge.ts';
import { AgentRuntimeHost } from './agentRuntimeHost.ts';
import { ApprovalTierCatalog } from '../services/approvalTierCatalog.ts';
import { AgentCatalogService } from '../services/agentCatalogService.ts';
import { ContextUsageService } from '../services/contextUsageService.ts';
import { SessionWorkspaceAssigner } from '../services/session/sessionWorkspaceAssigner.ts';
import { QuotaService } from '../services/quotaService.ts';
import { QuotaStore } from '../services/quotaStore.ts';
import { SessionModeStore } from '../services/session/sessionModeStore.ts';
import { TurnDirectiveComposer } from '../services/turnDirectiveComposer.ts';
import { WorkspaceSearchService } from '../services/workspaceSearchService.ts';
import { SessionTraceService } from '../services/session/sessionTraceService.ts';
import { RepoPathGuard } from '../services/repoPathGuard.ts';
import { DiffReview } from '../services/diffReview.ts';
import { DiffCommentStore } from '../services/diffCommentStore.ts';
import { SessionCheckpoints } from '../services/session/sessionCheckpoints.ts';
import { SessionRewindService } from '../services/session/sessionRewindService.ts';
import { TurnOrchestration } from './turnOrchestration.ts';
import type { ToolDefinition } from '../../../host/kernel/contracts.ts';

/**
 * AppServer 共享服务门面 —— 原 6 层继承链（Base/Handlers/Surface/Governance/Observability/Vault）
 * 构造函数里的**全部协作者装配**，按原顺序集中到这一个构造器（逐字节等价搬移，含全部历史注释）。
 *
 * 为什么是「门面 + 服务定位」而不是逐模块构造注入：原实现里协作者之间经**闭包 getter** 互相取值
 * （如 `configStore.onChanged` → `runtime.invalidateAgent()`、`quota` ← `modelCatalog.catalog()`），
 * 且存在刻意的构造顺序。模块化后若把这些闭包摊到各模块，顺序语义会散落；集中装配保住
 * 「顺序即语义」并让依赖关系在一屏内可读。
 *
 * 模块经 `ctx.services` 只读取本门面；模块自身不做装配、不做分发。
 */
export class ServerServices {
  /** 服务端选项（配置、传输、技能、指标、审计、插件目录等；switchWorkspace 会原地替换其中 config）。 */
  readonly options: AppServerOptions;

  // ── 运行态（原 AppServerBase 字段） ────────────────────────────────────────────
  /** 线程 id 自映射（存在性判定用）。 */
  readonly threads = new Map<string, string>();
  /** 正在执行回合的会话 id（runTurn 进入/退出维护）：sessions.list 据此标注真实运行态（非猜测）。 */
  readonly activeTurns = new Set<string>();
  /** 图运行台账（运行态 + 取消句柄）。 */
  readonly graphRuns = new GraphRunRegistry();
  /** 决策引擎端口（首次按需构造后复用；工作区切换重基时不能丢）。 */
  private decisionEnginePort: DecisionEngine | undefined;

  // ── 核心协作者（原 AppServerBase，装配顺序即语义） ────────────────────────────
  /** 文件对话框 RPC（浏览 / 新建 / 附件）。 */
  readonly fsExplorer: FsExplorer;
  /** 工作区内文件树与读取。 */
  readonly workspaceTree: WorkspaceTree;
  /** 模型目录与厂商探测。 */
  readonly modelCatalog: ModelCatalogService;
  /** 配置存储（UI 覆盖 + 落盘 + 工作区列表）。 */
  readonly configStore: ServerConfigStore;
  /** 会话存档读取（用量 / 列表）。 */
  readonly sessionArchive: SessionArchive;
  /** 工作区变更清单（git / 会话回退）。 */
  readonly workspaceChanges: WorkspaceChanges;
  /** 事件/审批桥。 */
  readonly events: ServerEventBridge;
  /** 插件宿主。 */
  readonly plugins: PluginHost;
  /** Agent 与图运行时宿主。 */
  readonly runtime: AgentRuntimeHost;

  // ── 工作台界面协作者（原 Surface 层） ─────────────────────────────────────────
  /** 上下文窗口目录（`context.usage` 报告内的窗口口径单一来源）。 */
  readonly windows: ContextWindowCatalog;
  /** 上下文容量报告（六类分解 + 缓存命中率）。 */
  readonly contextUsage: ContextUsageService;
  /** 本地日内预算配额。 */
  readonly quota: QuotaService;
  /** 会话模式（目标 / 计划 / 绘图）存储。 */
  readonly modes: SessionModeStore;
  /** 回合前置指令合成器（turns.run 读模式用）。 */
  readonly directives: TurnDirectiveComposer;
  /** 审批档位表（UI 权限面板单一来源）。 */
  readonly approvalTiers: ApprovalTierCatalog;
  /** 智能体目录。 */
  readonly agents: AgentCatalogService;
  /** 工作区 + 会话检索。 */
  readonly search: WorkspaceSearchService;

  // ── 只读可观测（原 Observability 层） ─────────────────────────────────────────
  /** 只读 trace 自省服务：把会话事件流投影为冻结条目（`trace.read` RPC 的后端）。 */
  readonly trace: SessionTraceService;

  // ── 领域服务（原 AppServer 叶） ───────────────────────────────────────────────
  /** git 差异审查服务：hunk/file 级 stage/revert（changes.* RPC 的后端）。 */
  readonly diffReview: DiffReview;
  /** 差异行级评论存储：评论的增删查持久化。 */
  readonly diffComments: DiffCommentStore;
  /** 会话检查点服务：检查点创建、列表与回滚。 */
  readonly checkpoints: SessionCheckpoints;
  /** 会话回退服务：把持久化事件流截断到指定事件（`threads.rewind` RPC 的后端）。 */
  readonly rewinder: SessionRewindService;

  /** 回合/线程跨域编排（线程模块与自动化模块共享的「起一个回合」事实源）。 */
  readonly turns: TurnOrchestration;

  /**
   * 内置 RPC 台账（方法 → 域模块名）。AppServer 注册完模块后赋值（模块构造期不可见，
   * 但 `rpc.list` 在请求期才读——时序安全）。空表 = 尚未装配完。
   */
  rpcOwners: ReadonlyMap<string, string> = new Map();

  /** 插件就绪闸门（serve 先监听、回合前再等插件；见 setPluginsReady）。 */
  private pluginsReady: Promise<void> = Promise.resolve();

  /**
   * 按原 6 层构造器的顺序装配全部协作者。
   * @param options 服务端选项（配置、传输、技能、指标、审计、插件目录/注册表等）
   */
  public constructor(options: AppServerOptions) {
    this.options = options;
    // ── 原 AppServerBase ──
    // 工作区根以 getter 注入各协作者：支持运行时 workspace.switch 后仍取到最新根。
    const workspaceRoot = (): string => this.configStore.workspace();
    this.fsExplorer = new FsExplorer();
    this.workspaceTree = new WorkspaceTree({ workspaceRoot });
    this.modelCatalog = new ModelCatalogService({
      fileConfig: () => this.configStore.fileConfig(),
      adapterOverride: () => this.configStore.adapterOverride(),
    });
    this.configStore = new ServerConfigStore({
      displayConfig: options.displayConfig ?? {},
      configPath: options.configPath,
      ...(options.profile !== undefined ? { profile: options.profile } : {}),
      autoApprove: options.autoApprove ?? false,
      probeProvider: (preset, key) => this.modelCatalog.cacheProbe(preset, key),
      // 档位/模型等配置变更同时失效图运行端口集：graphPorts 的审批端口按生效档位
      // 解析并随缓存烘焙，只失效 Agent 会让「切档后图运行仍用旧档位」再开一条不生效通路。
      onChanged: () => {
        this.runtime.invalidateAgent();
        this.runtime.invalidateGraph();
      },
    });
    this.sessionArchive = new SessionArchive({
      workspaceRoot,
      storageLocation: () => this.options.config.storage.location,
      configuredStorageDir: () => this.configStore.fileConfig().storageDir,
      metrics: options.metrics,
    });
    // 注入真实运行态判定：运行中的会话拒绝删除，避免截断活动事件流。
    this.sessionArchive.setRunningChecker((id) => this.activeTurns.has(id));
    this.workspaceChanges = new WorkspaceChanges({
      workspaceRoot,
      threadIds: () => this.threads.keys(),
      events: (threadId) => this.runtime.agent().eventsOf(threadId),
    });
    this.events =
      options.eventBridge ??
      new ServerEventBridge({
        transport: options.transport,
        metrics: options.metrics,
        audit: options.audit,
      });
    // 客户端全部断开 ⇒ 立即把挂起的审批按 deny、挂起的提问按「未拿到回答」收尾。
    // 为什么需要：这两种上行都是「等客户端回答」的，页面一关就再也不会有人回答；只靠超时兜底会让回合
    // 白等一整个超时窗口（审批 120s / 提问 300s）才收尾，期间 activeTurns 一直是 running
    // （2026-09-22 修审计 P2；提问沿同一口径，2026-10-08）。
    options.transport.setOnAllClientsGone?.(() => {
      this.events.denyAllPending('客户端全部断开（页面关闭 / 连接断开）');
    });
    this.plugins = new PluginHost({
      pluginsDir: options.pluginsDir,
      baseConfig: () => this.options.config,
      transport: options.transport,
      registry: options.registry,
      messageOf: (error) => this.messageOf(error),
    });
    this.runtime = new AgentRuntimeHost({
      baseConfig: () => this.options.config,
      skills: options.skills,
      eventPort: () => this.events.eventPort(),
      approvalUplink: options.approvalUplink === true,
      autoApprove: () => this.configStore.autoApprove,
      approvalOverride: () => this.configStore.approvalOverride(),
      // 启动档位（组合根注入的 args.approval）：重启后内存覆盖态为空，生效档位由它兜底
      // ——保证「UI 显示哪档、实际就是哪档」跨重启成立。不回读配置文件（单测隔离）。
      configuredApproval: () => this.options.startupApproval,
      uplink: () => this.events.approvalPort(),
      modelOverride: () =>
        options.modelOverrideEnabled === false ? undefined : this.modelCatalog.resolveOverride(),
      workspaceRoot,
    });
    // ── 原 AppServerSurfaceHandlers ──
    this.windows = new ContextWindowCatalog(this.envWindow());
    this.contextUsage = new ContextUsageService({
      events: (threadId) => this.runtime.agent().eventsOf(threadId),
      tools: () => this.visibleTools(),
      baseFragments: () => this.options.config.fragments ?? [],
      model: () => this.options.config.model.name,
    });
    this.quota = new QuotaService({
      store: new QuotaStore(workspaceRoot),
      usage: this.sessionArchive,
      models: () => this.activeModels(),
      // 档位由当前模型识别（2026-10-17）：给"正在用的那个"，识别不出来再回落到清单最高档。
      activeModel: () => this.activeConfigModel(),
    });
    this.modes = new SessionModeStore(workspaceRoot);
    this.directives = new TurnDirectiveComposer();
    this.approvalTiers = new ApprovalTierCatalog();
    this.agents = new AgentCatalogService({
      graphs: () => this.runtime.graphStore().list(),
      plugins: () => this.installedPlugins(),
    });
    this.search = new WorkspaceSearchService({
      workspaceRoot,
      chats: () => this.sessionList(),
    });
    // ── 原 AppServerObservabilityHandlers ──
    this.trace = new SessionTraceService({
      events: (sessionId) => this.runtime.agent().eventsOf(sessionId),
      exists: (sessionId) =>
        options.traceSessionExists === undefined
          ? this.sessionTraceExists(sessionId)
          : options.traceSessionExists(sessionId),
      logError: (message) => process.stderr.write(`[omniharness] ${message}\n`),
    });
    // ── 原 AppServer（叶） ──
    // 工作区根以 getter 注入：支持运行时 workspace.switch 后服务仍取到最新根。
    const effectiveRoot = (): string => this.configStore.workspace();
    const guard = new RepoPathGuard(effectiveRoot);
    this.diffReview = new DiffReview({ workspaceRoot: effectiveRoot, guard });
    this.diffComments = new DiffCommentStore({ workspaceRoot: effectiveRoot, guard });
    this.checkpoints = new SessionCheckpoints({
      storage: options.config.storage,
      workspaceRoot: options.workspaceRoot,
    });
    // 会话回退（`threads.rewind`）：读 / 写都指向**唯一事实源**（storage），
    // 运行态判定复用 runTurn 维护的 activeTurns（运行中拒绝回退，避免两处写盘互相覆盖）。
    this.rewinder = new SessionRewindService({
      events: (sessionId) => this.runtime.agent().eventsOf(sessionId),
      save: (sessionId, events) => this.options.config.storage.save(sessionId, events),
      isRunning: (sessionId) => this.activeTurns.has(sessionId),
    });
    // ── 编排（必须最后：以完整装配好的门面注入） ──
    this.turns = new TurnOrchestration(this);
  }

  // ── 跨域操作（原 AppServerBase 方法） ─────────────────────────────────────────

  /**
   * 提取错误消息。
   * @param error 任意抛出值。
   * @returns Error 取 message，其余值 String() 化。
   */
  messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /** 可读配置摘要（模块读取展示字段用）。 */
  get displayConfig(): Record<string, string> {
    return this.options.displayConfig ?? {};
  }

  /** 插件管理器（handler 复用）。 */
  get pluginManager(): PluginManager | undefined {
    return this.plugins.manager;
  }

  /** 插件安装目录（handler 复用）。 */
  get pluginsDir(): string | undefined {
    return this.plugins.dir;
  }

  /**
   * 等待插件就绪（回合入口用）。
   * @returns 就绪后 resolve。
   */
  async awaitPlugins(): Promise<void> {
    await this.pluginsReady;
  }

  /**
   * 登记插件就绪 Promise（启动优化，2026-10-25）。
   *
   * 为什么需要：插件加载/Profile 应用可能 spawn Worker / 读大量文件；此前它挡在 HTTP `listen`
   * 之前，桌面/浏览器要等它完成才拿到第一帧。现在把加载放到 listen 之后并行跑，
   * **真正需要插件的回合**（create/continue/runTurn）在开始时 await 这道闸门，语义不变。
   * @param ready 插件与 Profile 都完成的 Promise（失败应自行 catch，闸门不向回合抛错）。
   */
  setPluginsReady(ready: Promise<void>): void {
    this.pluginsReady = ready.catch(() => undefined);
  }

  /**
   * 应用插件集 Profile（CLI --plugin-profile / 编程入口复用）。
   * @param profile 插件集档案（启用的插件与来源配置）。
   * @returns 应用结果（成功 / 失败明细）。
   */
  async applyPluginProfile(profile: PluginProfile): Promise<ApplyProfileResult> {
    return this.plugins.applyProfile(profile);
  }

  /**
   * 当前生效的工作区根（#OBS-11）：HTTP /files 路由与 RPC fs.read 共用。
   * @returns 当前工作区根目录路径。
   */
  effectiveWorkspace(): string {
    return this.configStore.workspace();
  }

  /**
   * 「切换项目」是否可以走「没变」的早退分支（**必须两份根都是目标根**）。
   *
   * 为什么不能只看显示根：`configStore.workspace()` 是**显示/持久化**根（UI 用、`fs.*` RPC 用），
   * 而工具与系统提示用的是运行时根 `options.config.workspaceRoot`。两者分离时（历史 bug 家族的
   * 典型形态：UI 已显示新项目、agent 还在启动目录那棵树里干活），只比显示根就会误判「没变」，
   * 从而跳过 {@link ConfigRebase} 重基 ⇒ **工具永远留在旧根**，且症状会伪装成「打开文件 404」。
   * @param requested 目标工作区根。
   * @param displayRoot 显示/持久化根（`configStore.workspace()`）。
   * @param runtimeRoot 运行时根（`options.config.workspaceRoot`）。
   * @returns 两份根都等于目标根时为 true（只有这时才是真的没变）。
   */
  static isWorkspaceSwitchNoop(requested: string, displayRoot: string, runtimeRoot: string): boolean {
    return requested === displayRoot && requested === runtimeRoot;
  }

  /**
   * 解析决策引擎端口（工作区切换重基时复用同一实例）。
   *
   * 为什么需要它：内核 `ConfigFactory.build` 只消费 `decisionEnginePort`、不把它写回
   * `ResolvedConfig`；而 `ConfigRebase.forWorkspace` 以已解析配置为基线重基 ⇒ 直接重基会只剩
   * 声明段 `decisionEngine`（生产入口默认 `shadow`），内核据此 fail-closed 拒绝构建。
   * @param config 当前已解析配置（读 `decisionEngine` 声明段）。
   * @returns 决策引擎；`off` / 缺省时为 undefined。
   */
  private resolveDecisionEnginePort(config: ResolvedConfig): DecisionEngine | undefined {
    this.decisionEnginePort ??= new DecisionEngineResolver().resolve({
      decisionEngine: config.decisionEngine,
    });
    return this.decisionEnginePort;
  }

  /**
   * 「切换项目」：按新工作区根目录重建运行时组件（sandbox/hooks/memory/spill 等全部
   * 随 ConfigFactory.build 按新 root 重造），清 agent/graph 缓存，下回合即在新工作区执行。
   * 审批/模型覆盖沿用现有解析逻辑，UI 感知零断裂。
   *
   * **2026-09-19 修复（声明未接线）**：原实现手工只传 9 个键调 `ConfigFactory.build`，
   * 其余声明式字段（最要命的是 `fragments` —— 系统提示的唯一注入通道）**被静默丢弃**，
   * 于是「切换工作区」等于「模型从此失去全部行为准则」。
   * 现改走 {@link ConfigRebase.forWorkspace}：以旧配置为基线重基，只剔除工作区耦合端口。
   *
   * @param raw 新工作区根目录（未知类型，经 requireDirectory 校验）
   * @returns `{ ok, workspace, unchanged? }` 或 `{ ok, workspace, workspaces }`
   */
  switchWorkspace(raw: unknown): unknown {
    const root = this.configStore.requireDirectory(raw);
    const previous = this.configStore.workspace();
    // 早退判据必须**同时**看运行时根（`options.config.workspaceRoot` —— 工具与系统提示真正使用的那份）：
    // 只看「显示/持久化根」时，两者一旦分离（本仓反复出现的「显示 ≠ 实际运行根」家族），切换会被判成
    // 「没变」而**跳过重基**，工具与提示永远留在旧根上。2026-10-07 真机实测（用户报「打开文件报
    // ENOENT」）：会话里 `read_file AGENTS.md` 读回的是**启动目录那棵树**的 AGENTS.md，而 UI 的「打开」
    // 按显示根解析 ⇒ `ENOENT ... D:\Download\work_001\AGENTS.md`。判据见
    // {@link ServerServices.isWorkspaceSwitchNoop}。
    if (ServerServices.isWorkspaceSwitchNoop(root, previous, this.options.config.workspaceRoot)) {
      return { ok: true, workspace: root, unchanged: true };
    }
    const cfg = this.options.config;
    const file = this.configStore.fileConfig();
    const sandbox = new SandboxManager(root).build((file.sandbox ?? 'policy') as SandboxProfile);
    const decisionEnginePort = this.resolveDecisionEnginePort(cfg);
    const rebuilt = ConfigFactory.build({
      ...ConfigRebase.forWorkspace(cfg, root),
      // 决策引擎端口不在 `ResolvedConfig` 里（`ConfigFactory.build` 只消费它、不写回），
      // 重基时必须重新注入，否则只剩 `decisionEngine.mode=shadow` 的声明段 ⇒ 内核 fail-closed。
      ...(decisionEnginePort !== undefined ? { decisionEnginePort } : {}),
      // 切换工作区 = 新的未信任根：在用户对该根显式 `--trust-workspace` 前，绝不自动注入其项目技能
      // （否则 serve 在 A 中启动、UI 切到恶意 B 就绕过 trust 闸）。
      allowWorkspaceSkills: false,
      maxSteps: cfg.maxSteps,
      model: this.modelCatalog.resolveOverride() ?? cfg.model,
      storage: cfg.storage,
      events: this.events.eventPort(),
      approvals: this.runtime.resolveApprovals(cfg),
      sandbox,
      escalation: cfg.escalation,
      reasoning: file.reasoning ?? cfg.reasoning,
    });
    (this.options as { config: ResolvedConfig }).config = rebuilt;
    this.runtime.invalidateAgent();
    this.runtime.invalidateGraph();
    const workspaces = this.configStore.commitWorkspaceSwitch(root, previous);
    return { ok: true, workspace: root, workspaces: workspaces.workspaces };
  }

  // ── 原 AppServerObservabilityHandlers 辅助 ───────────────────────────────────

  /**
   * 会话事件是否存在于存档（jsonl 目录或 sqlite 库）。
   *
   * 为什么不用 `storage.load()` 判定：它对不存在的会话与零事件会话都返回空数组，
   * 无法区分「没有这个会话」与「这个会话还没有事件」。这里按存储后端的物理形态判定：
   * 文件后端看 `<location>/<id>.jsonl`，sqlite 看库内该会话行；内存后端无可判定处，
   * 回落到事件日志已在内存中的会话集合（`threads` 登记过的线程）。
   * 未知 / 不可判定一律返回 true（宁多报也不误判「会话不存在」）。
   * @param sessionId 会话 id
   * @returns 该会话的事件存档是否存在
   */
  async sessionTraceExists(sessionId: string): Promise<boolean> {
    if (sessionId.length === 0) {
      return false;
    }
    // 存档目录 / sqlite 库能枚举会话：以归档列表为唯一判据（file 后端读 .jsonl，sqlite 读库内行）。
    if (this.options.config.storage.location !== undefined) {
      // `'*'`：存在性判定必须看**全量**存档——会话可能属于别的工作区，按当前工作区过滤会让
      // "按 id 打开历史会话"在跨项目时 404（见 SessionArchive.list 的作用域语义）。
      const list = await this.sessionArchive.list(true, '*');
      const sessions = (list as { sessions?: readonly { sessionId: string }[] }).sessions ?? [];
      return sessions.some((entry) => entry.sessionId === sessionId);
    }
    // 内存后端无可枚举的物理存档：以已登记的线程 + 已加载的 trace 缓存为准（宁宽不误报）。
    return this.threads.has(sessionId) || this.trace.has(sessionId);
  }

  // ── 原 AppServerSurfaceHandlers 辅助（构造期闭包 + 模块共用） ─────────────────

  /**
   * `context.usage` 的目标会话：请求里给了就用它，**没给就回落到正在跑的会话**。
   *
   * 为什么必须回落（2026-10-07 用户实测「不会实时计算显示刷新容量面板上的数据」）：
   * 新会话的 `threadId` 要等 `turns.run` 返回之后客户端才知道，而容量面板在**第一回合进行中**
   * 就已经打开了（用户就是在这时候看的）——此时客户端只能传空串，服务端原样返回全零报告
   * （`source: 'empty'`），面板于是整段时间显示 `0/12.8万`。回合进行中服务端**本来就知道**
   * 真正的会话 id（`Agent.runningSessionIds()`，插入序 ⇒ 末条最新），回落即可给出真实数字。
   * @param requested 请求里的 threadId（可能为空串）。
   * @returns 用于取数的会话 id（可能仍为空串：确实没有任何在跑会话时）。
   */
  usageThreadId(requested: string): string {
    if (requested !== '') return requested;
    const running = this.runtime.agent().runningSessionIds();
    return running.length === 0 ? '' : running[running.length - 1]!;
  }

  /** 本轮可能进入模型视野的工具（直载优先，未实现 listDirect 时退回全量）。 */
  private visibleTools(): readonly ToolDefinition[] {
    const tools = this.options.config.tools;
    return tools.listDirect?.() ?? tools.list();
  }

  /** env `OMNI_CONTEXT_WINDOW` 覆盖值（非法/未设返回 undefined）。 */
  private envWindow(): number | undefined {
    const raw = Number(process.env.OMNI_CONTEXT_WINDOW);
    return Number.isFinite(raw) && raw > 0 ? raw : undefined;
  }

  /** 当前 active 厂商的可用模型清单（catalog 为 unknown，此处窄化后取 models）。 */
  private activeModels(): readonly string[] {
    const catalog = this.modelCatalog.catalog() as { active?: { models?: unknown } } | undefined;
    const models = catalog?.active?.models;
    return Array.isArray(models) ? models.filter((m): m is string => typeof m === 'string') : [];
  }

  /** 当前 active 配置里的模型名（`model.catalog` 的 `active.model`）——配额档位的识别依据。 */
  private activeConfigModel(): string | undefined {
    const catalog = this.modelCatalog.catalog() as { active?: { model?: unknown } } | undefined;
    const model = catalog?.active?.model;
    return typeof model === 'string' && model.trim() !== '' ? model : undefined;
  }

  /** 已安装插件清单（注册表未注入时为空；读取失败同样为空，不让智能体列表整体报错）。 */
  private async installedPlugins(): Promise<
    readonly { name: string; version: string; description?: string }[]
  > {
    const registry = this.options.registry;
    if (registry === undefined) return [];
    try {
      const list = await registry.list();
      return list as readonly { name: string; version: string; description?: string }[];
    } catch {
      return [];
    }
  }

  /**
   * 会话清单（`search.all` 的聊天来源；读取失败返回空表）。
   *
   * `'*'`：检索面要看**全量**会话（`search.all` 跨项目可搜），按当前工作区过滤会把搜索结果
   * 静默缩小到一个项目（见 SessionArchive.list 的作用域语义）。
   */
  private async sessionList(): Promise<
    readonly {
      sessionId: string;
      label: string;
      workspace?: string;
      updatedAt: string;
    }[]
  > {
    const listed = (await this.sessionArchive.list(true, '*')) as {
      sessions?: readonly {
        sessionId: string;
        label: string;
        workspace?: string;
        updatedAt: string;
      }[];
    };
    return listed.sessions ?? [];
  }

  /** 会话归属校验（fail-closed 目录检查），surface 模块与 rewind 共用。 */
  requireDirectory(raw: unknown): string {
    return this.configStore.requireDirectory(raw);
  }

  /** 会话归入项目（侧栏右键「归入当前项目」）：surface 模块用。 */
  assignSessionWorkspace(sessionId: string, workspace: string): unknown {
    return SessionWorkspaceAssigner.assign(
      this.options.config.storage.location ?? '',
      sessionId,
      workspace,
    );
  }
}
