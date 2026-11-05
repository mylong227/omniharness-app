// 实验性公开 API（@beta）
// 本桶导出不在语义化版本合同内，可能随时增删改。稳定 API 见 ./index.ts。
// 外部消费方从 `omniharness/beta` 导入本桶。
// @beta 工具语义检索（#M1：BM25 工具 schema 检索 + 延迟加载）
export { Bm25Index } from './host/kernel/platform.ts';
export type { Bm25Hit, Bm25Options } from './host/kernel/platform.ts';
export { ToolIndex } from './host/kernel/platform.ts';
export { ToolDiscovery } from './host/kernel/platform.ts';
export { ToolSearchTool } from './host/kernel/adapters-tool.ts';

export { Bm25MemoryIndex } from './host/kernel/adapters-misc.ts';
export { MemorySearchTool } from './host/kernel/adapters-tool.ts';
export { FileLongTermMemory } from './host/kernel/adapters-misc.ts';
export { TemporalFactGraph } from './host/kernel/adapters-misc.ts';
export type {
  TemporalConsolidateOptions,
  TemporalConsolidationReport,
  TemporalFactCard,
  TemporalFactHit,
} from './host/kernel/adapters-misc.ts';
export { MemoryExtractor } from './host/kernel/adapters-misc.ts';
export { RememberTool, RecallTool } from './host/kernel/adapters-tool.ts';


// @beta 子智能体（#76：进程内独立 Agent 循环，深度限制 + 并发限流 + 父子关系）
export { SubagentOrchestrator } from './host/kernel/subagent.ts';
export { SubagentRunner } from './host/kernel/subagent.ts';
export { subagentRuntimeFactory } from './host/kernel/subagent.ts';
export { SubagentEventBridge } from './host/kernel/subagent.ts';
export { ToolSubset } from './host/kernel/subagent.ts';
export { SubagentTool } from './host/kernel/adapters-tool.ts';
export { ConcurrencyLimiter } from './host/kernel/util.ts';
export { ParallelMap } from './host/kernel/util.ts';
export type { SubagentOptions, SubagentRequest, SubagentResult } from './host/kernel/subagent.ts';

// @beta 自主目标循环（#S30：自主目标循环，多轮自主推进直到达成或达上限）
export { GoalRunner, DEFAULT_GOAL_MAX_ITERATIONS } from './host/kernel/autonomy.ts';
export type { GoalResult, GoalRunnerOptions } from './host/kernel/autonomy.ts';
export { GoalChecker } from './host/kernel/autonomy.ts';
export type { GoalCheck } from './host/kernel/autonomy.ts';
export { RunGoalTool } from './host/kernel/adapters-tool.ts';
export { RUN_GOAL_TOOL_NAME } from './host/kernel/autonomy.ts';

// @beta 工作流 DAG 编排（#S31：多步 DAG 编排，多步依赖并发 + 失败传播）
export {
  WorkflowRunner,
  WorkflowCycleError,
  DEFAULT_WORKFLOW_CONCURRENCY,
} from './host/kernel/autonomy.ts';
export type {
  WorkflowDef,
  WorkflowStep,
  WorkflowResult,
  WorkflowStepResult,
} from './host/kernel/autonomy.ts';
export { RunWorkflowTool } from './host/kernel/adapters-tool.ts';
export { RUN_WORKFLOW_TOOL_NAME } from './host/kernel/autonomy.ts';

// @beta LSP 代码导航（#S32：外启语言服务器进程走 stdio JSON-RPC，无第三方依赖铁律下唯一合规接入方式）
export type {
  LspPort,
  LspLocation,
  LspPosition,
  LspRange,
  LspServerConfig,
} from './host/kernel/contracts.ts';
export { LspProcessAdapter } from './host/kernel/adapters-misc.ts';
export { LspUri } from './host/kernel/adapters-misc.ts';
export {
  LspGoToDefinitionTool,
  LspFindReferencesTool,
  LspHoverTool,
  LspStatusTool,
} from './host/kernel/adapters-tool.ts';
export {
  LSP_GO_TO_DEFINITION_TOOL_NAME,
  LSP_FIND_REFERENCES_TOOL_NAME,
  LSP_HOVER_TOOL_NAME,
  LSP_STATUS_TOOL_NAME,
} from './host/kernel/adapters-misc.ts';

// @beta Agent 密码学身份（#S33：自研身份核心，Ed25519 无第三方依赖）
export type {
  AgentIdentityPort,
  AgentIdentityConfig,
  AgentIdentityClaims,
} from './host/kernel/contracts.ts';
export { Ed25519AgentIdentity } from './host/kernel/adapters-misc.ts';
export {
  AgentIdentityTool,
  AGENT_IDENTITY_TOOL_NAME,
} from './host/kernel/adapters-tool.ts';

// @beta 安全策略求值（#S34：「规则 → 决策」的安全子集，安全子集无第三方依赖）
export type {
  PolicyPort,
  PolicyRule,
  PolicyFacts,
  PolicyEffect,
  PolicyDecision,
} from './host/kernel/contracts.ts';
export { SafePolicyEvaluator } from './host/kernel/adapters-misc.ts';
export { PolicyEvalTool, POLICY_EVAL_TOOL_NAME } from './host/kernel/adapters-tool.ts';

// @beta 安全护栏：提示注入拦截（opt-in，默认关；确定性正则扫描工具结果，命中即隔离）
export { PromptInjectionGuard } from './host/kernel/security.ts';
export type {
  InjectionHit,
  InjectionScan,
  InjectionSeverity,
} from './host/kernel/security.ts';
// @beta 工具输出来源信任级（P4：按内容来源分级敏感——外部抓取严、本机命令宽，降误报）
export { ToolOutputTrust } from './host/kernel/security.ts';
export type { TrustTier } from './host/kernel/security.ts';

// @beta 无第三方依赖 TUI 终端 UI（#S35：/tui 的「会话事件流渲染 + 交互」概念）
export { TuiRenderer, type TuiEvent, type TuiEventKind } from './apps/tui/tuiRenderer.ts';
export { Interactive, type InteractiveOptions } from './apps/tui/interactive.ts';

// @beta 计划 / 待办 / 提问协作态（#77：plan/todo/interaction）
export { TodoWriteTool, TodoReadTool } from './host/kernel/adapters-tool.ts';
export { AskUserTool } from './host/kernel/adapters-tool.ts';
export { PlanWriteTool, PlanPresentTool, PlanReadTool } from './host/kernel/adapters-tool.ts';
export { MemoryTodo } from './host/kernel/adapters-misc.ts';
export { MemoryPlan } from './host/kernel/adapters-misc.ts';
export { ConsoleUserResponder } from './host/kernel/adapters-misc.ts';
export { DefaultUserResponder } from './host/kernel/adapters-misc.ts';
export { MUTATING_TOOLS } from './host/kernel/core.ts';
export type {
  UserResponder,
  AskQuestion,
  AskAnswer,
  AskOption,
} from './host/kernel/contracts.ts';
export type { TodoPort, TodoItem, TodoStatus } from './host/kernel/contracts.ts';
export type { PlanPort, PlanDraft, PlanState, PlanStep, PlanStatus } from './host/kernel/contracts.ts';

// @beta 运行时消费 bundle 补丁层（注入 config 四层合并，叠在 profile 之上、低于 env）
export { ConfigError } from './host/kernel/config.ts';

export { DEFAULT_SOFT_RATIO } from './host/kernel/adapters-model.ts';
export type { BudgetSnapshot } from './host/kernel/adapters-model.ts';
