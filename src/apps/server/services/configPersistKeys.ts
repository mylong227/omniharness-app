/**
 * config.update 的**持久化白名单与结构化段清单**（2026-11-20 从 core/appServerState.ts
 * 下沉到 services 侧：唯一消费者是 serverConfigStore——core 反向依赖 services 的概念
 * 回环就此消除；判据 tests/settingsPersistKeys 直接钉本文件）。
 */
/**
 * 结构化配置段：`config.update` 提交整段，落盘按段**替换**而不是深合并。
 *
 * 为什么单独列：`ConfigError.mergeConfigs` 对普通对象做递归合并，逐字段补丁无法表达
 * 「删除嵌套键」（例如把 `contextPolicy.cacheGuard.hitRateFloor` 清空——null 会被
 * 段校验器拒绝）。UI 每次都提交由当前配置合并出的**完整段**，故按段替换即可让
 * 「留空=关闭」真正落到文件；未列入此表的键仍是既有的深合并语义（向后兼容）。
 *
 * 只收 alpha.19 新增的这三段：更早的结构化键（permission 等）已有消费者按深合并工作，
 * 不在此轮改变其语义。
 */
export const SECTION_REPLACE_KEYS: readonly string[] = [
  'retrievalContext',
  'semanticRecall',
  'contextPolicy',
  // alpha.21：读缓存 / 能力防火墙（内核文件面补齐；UI 整段提交、按段替换）。
  'toolCache',
  'capflow',
  // 2026-11-19 模型角色路由卡（内核 #B4）：strategy/entries/roles 必须整段一致提交——
  // roles 指到的模型名要在 entries 里（内核 by-role fail-closed），深合并会把旧条目
  // 残留在段里造成「roles 指到已删条目」的静默坏配置；停用 = 整段发 null。
  'modelRouter',
  // 2026-11-20 Skill Lab v1（docs/design/skill-lab）：skills 数组的增删改都是「按名整段」
  // 操作（skills.apply/delete 服务端整段提交）——数组深合并无法表达删除；同名覆盖编辑
  // 依赖「显式配置同名优先」内核语义，段替换保证旧值不残留。
  'skills',
  // 2026-11-20 settings-completion v2 专家面（四结构段，运行时栏「专家能力」卡）：
  // 进化闭环 / 决策引擎 / 校准自主性 / 角色门禁。内核各自有严格校验器（未知子键 /
  // 类型不符 fail-closed），UI 整段提交、按段替换。
  'evolutionRlvr',
  'decisionEngine',
  'calibratedAutonomy',
  'rbac',
];

/**
 * config.update 允许持久化到配置文件的字段。
 * 写路径**恒为用户级** ~/.omniharness/omniharness.json（2026-10-13 用户口径："都固定保存到该目录下"
 * ——曾因落项目级、重启换工作区而「设置被重置」），与手改用户级文件等价；
 * config.get 回传对 apiKey/providerKeys 一律打码——凭据原文永不返回 UI，防泄露。
 * workspace/mcpServers 仍不由此通道写入（防篡改工作区与 MCP 面）。
 */
export const PERSISTABLE_KEYS: readonly string[] = [
  'modelAdapter',
  'model',
  'baseUrl',
  'apiKey',
  'providerKeys',
  'storageAdapter',
  'storageDir',
  'approval',
  'reasoning',
  'sandbox',
  'escalation',
  'elevatedSandbox',
  'maxSteps',
  // A2：参数级权限规则（permission.rules / defaultDecision）。与手改 omniharness.json 等价，
  // 经 configFile.save → normalizeConfig 严格校验落盘；规则只能收紧（deny）或改默认裁决，
  // 不放宽 sandbox / approval 轴，故纳管风险与既有的 approval/sandbox 同量级。
  'permission',
  // 界面语言（Web UI 设置「外观」栏）：经 config.update 落用户级 omniharness.json，
  // 枚举校验（zh/en）见 configError.ts 的 ENUM_VALUES.locale。
  'locale',
  // 聊天模式（Web UI 设置「常规」栏，2026-10-31）：queue=任务中发送排队 / steer=插话。
  // 枚举校验（queue/steer）见 configError.ts 的 ENUM_VALUES.chatMode。
  'chatMode',
  // 设置页内核能力补全（2026-11-14，docs/design/settings-completion §2）：成本预算三键 +
  // 模型熔断三键 + 长期记忆三键。类型/枚举/范围校验全部由内核 normalizeConfig 承担
  // （NUMBER_FIELDS / BOOLEAN_FIELDS / ENUM_VALUES，costBudgetSoftRatio ∈ (0,1]），
  // 这里只开白名单；写非法值会被 persist() fail-closed 拒绝并回传错误。
  'costBudgetUsd',
  'costBudgetSoftRatio',
  'costBudgetOnExceed',
  'modelCircuitBreaker',
  'modelCircuitBreakerThreshold',
  'modelCircuitBreakerOpenMs',
  'longTermMemoryEncryption',
  'longTermMemoryGovernance',
  'longTermMemoryKeyFile',
  // 内核 alpha.19 上下文三段的 UI 入口（2026-11-15，settings-completion §1.3 扩展）：
  // 检索供给 / 语义召回 / 上下文工程策略。三段都是**结构化对象**，落盘语义见
  // {@link SECTION_REPLACE_KEYS}；类型/枚举/区间校验仍由内核 normalizeConfig 承担。
  // 2026-11-20 Skill Lab：skills 数组随 SECTION_REPLACE 按段替换（设计稿 §2）。
  ...SECTION_REPLACE_KEYS,
];
