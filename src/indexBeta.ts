// 实验性公开 API（@beta）
// 本桶导出不在语义化版本合同内，可能随时增删改。稳定 API 见 ./index.ts。
// 外部消费方从 `omniharness/beta` 导入本桶。
// @beta 工具语义检索（#M1：BM25 工具 schema 检索 + 延迟加载）
export { Bm25Index } from '@omniharness/kernel/kernel/search/bm25Index.js';
export type { Bm25Hit, Bm25Options } from '@omniharness/kernel/kernel/search/bm25Index.js';
export { ToolIndex } from '@omniharness/kernel/kernel/search/toolIndex.js';
export { ToolDiscovery } from '@omniharness/kernel/kernel/search/toolDiscovery.js';
export { ToolSearchTool } from '@omniharness/kernel/kernel/adapters/tool/meta/toolSearchTool.js';

export { Bm25MemoryIndex } from '@omniharness/kernel/kernel/adapters/retrieval/bm25MemoryIndex.js';
export { MemorySearchTool } from '@omniharness/kernel/kernel/adapters/tool/memory/memorySearchTool.js';
export { FileLongTermMemory } from '@omniharness/kernel/kernel/adapters/memory/fileLongTermMemory.js';
export { TemporalFactGraph } from '@omniharness/kernel/kernel/adapters/memory/temporalFactGraph.js';
export type {
  TemporalConsolidateOptions,
  TemporalConsolidationReport,
  TemporalFactCard,
  TemporalFactHit,
} from '@omniharness/kernel/kernel/adapters/memory/temporalFactGraph.js';
export { MemoryExtractor } from '@omniharness/kernel/kernel/adapters/memory/memoryExtractor.js';
export { RememberTool, RecallTool } from '@omniharness/kernel/kernel/adapters/tool/memory/longTermMemoryTools.js';


// @beta 子智能体（#76：进程内独立 Agent 循环，深度限制 + 并发限流 + 父子关系）
export { SubagentOrchestrator } from '@omniharness/kernel/kernel/subagent/subagentOrchestrator.js';
export { SubagentRunner } from '@omniharness/kernel/kernel/subagent/subagentRunner.js';
export { subagentRuntimeFactory } from '@omniharness/kernel/kernel/subagent/subagentRuntimeFactory.js';
export { SubagentEventBridge } from '@omniharness/kernel/kernel/subagent/subagentEventBridge.js';
export { ToolSubset } from '@omniharness/kernel/kernel/subagent/toolSubset.js';
export { SubagentTool } from '@omniharness/kernel/kernel/adapters/tool/workflow/subagentTool.js';
export { ConcurrencyLimiter } from '@omniharness/kernel/kernel/util/concurrency/concurrencyLimiter.js';
export { ParallelMap } from '@omniharness/kernel/kernel/util/concurrency/parallelMap.js';
export type { SubagentOptions, SubagentRequest, SubagentResult } from '@omniharness/kernel/kernel/subagent/subagentTypes.js';

// @beta 自主目标循环（#S30：自主目标循环，多轮自主推进直到达成或达上限）
export { GoalRunner, DEFAULT_GOAL_MAX_ITERATIONS } from '@omniharness/kernel/kernel/autonomy/goalRunner.js';
export type { GoalResult, GoalRunnerOptions } from '@omniharness/kernel/kernel/autonomy/goalRunner.js';
export { GoalChecker } from '@omniharness/kernel/kernel/autonomy/goalChecker.js';
export type { GoalCheck } from '@omniharness/kernel/kernel/autonomy/goalChecker.js';
export { RunGoalTool } from '@omniharness/kernel/kernel/adapters/tool/workflow/runGoalTool.js';
export { RUN_GOAL_TOOL_NAME } from '@omniharness/kernel/kernel/autonomy/goalToolNames.js';

// @beta 工作流 DAG 编排（#S31：多步 DAG 编排，多步依赖并发 + 失败传播）
export {
  WorkflowRunner,
  WorkflowCycleError,
  DEFAULT_WORKFLOW_CONCURRENCY,
} from '@omniharness/kernel/kernel/autonomy/workflowRunner.js';
export type {
  WorkflowDef,
  WorkflowStep,
  WorkflowResult,
  WorkflowStepResult,
} from '@omniharness/kernel/kernel/autonomy/workflowTypes.js';
export { RunWorkflowTool } from '@omniharness/kernel/kernel/adapters/tool/workflow/runWorkflowTool.js';
export { RUN_WORKFLOW_TOOL_NAME } from '@omniharness/kernel/kernel/autonomy/workflowToolNames.js';

// @beta LSP 代码导航（#S32：外启语言服务器进程走 stdio JSON-RPC，无第三方依赖铁律下唯一合规接入方式）
export type {
  LspPort,
  LspLocation,
  LspPosition,
  LspRange,
  LspServerConfig,
} from '@omniharness/kernel/contracts/ports/tool/lsp.js';
export { LspProcessAdapter } from '@omniharness/kernel/kernel/adapters/lsp/lspProcessAdapter.js';
export { LspUri } from '@omniharness/kernel/kernel/adapters/lsp/lspUri.js';
export {
  LspGoToDefinitionTool,
  LspFindReferencesTool,
  LspHoverTool,
  LspStatusTool,
} from '@omniharness/kernel/kernel/adapters/tool/lsp/lspTools.js';
export {
  LSP_GO_TO_DEFINITION_TOOL_NAME,
  LSP_FIND_REFERENCES_TOOL_NAME,
  LSP_HOVER_TOOL_NAME,
  LSP_STATUS_TOOL_NAME,
} from '@omniharness/kernel/kernel/adapters/lsp/lspToolNames.js';

// @beta Agent 密码学身份（#S33：自研身份核心，Ed25519 无第三方依赖）
export type {
  AgentIdentityPort,
  AgentIdentityConfig,
  AgentIdentityClaims,
} from '@omniharness/kernel/contracts/ports/runtime/agentIdentity.js';
export { Ed25519AgentIdentity } from '@omniharness/kernel/kernel/adapters/identity/ed25519AgentIdentity.js';
export {
  AgentIdentityTool,
  AGENT_IDENTITY_TOOL_NAME,
} from '@omniharness/kernel/kernel/adapters/tool/meta/agentIdentityTool.js';

// @beta 安全策略求值（#S34：「规则 → 决策」的安全子集，安全子集无第三方依赖）
export type {
  PolicyPort,
  PolicyRule,
  PolicyFacts,
  PolicyEffect,
  PolicyDecision,
} from '@omniharness/kernel/contracts/ports/runtime/policy.js';
export { SafePolicyEvaluator } from '@omniharness/kernel/kernel/adapters/policy/safePolicyEvaluator.js';
export { PolicyEvalTool, POLICY_EVAL_TOOL_NAME } from '@omniharness/kernel/kernel/adapters/tool/meta/policyEvalTool.js';

// @beta 安全护栏：提示注入拦截（opt-in，默认关；确定性正则扫描工具结果，命中即隔离）
export { PromptInjectionGuard } from '@omniharness/kernel/kernel/security/promptInjectionGuard.js';
export type {
  InjectionHit,
  InjectionScan,
  InjectionSeverity,
} from '@omniharness/kernel/kernel/security/promptInjectionGuard.js';
// @beta 工具输出来源信任级（P4：按内容来源分级敏感——外部抓取严、本机命令宽，降误报）
export { ToolOutputTrust } from '@omniharness/kernel/kernel/security/toolOutputTrust.js';
export type { TrustTier } from '@omniharness/kernel/kernel/security/toolOutputTrust.js';

// @beta 无第三方依赖 TUI 终端 UI（#S35：/tui 的「会话事件流渲染 + 交互」概念）
export { TuiRenderer, type TuiEvent, type TuiEventKind } from './apps/tui/tuiRenderer.ts';
export { Interactive, type InteractiveOptions } from './apps/tui/interactive.ts';

// @beta 计划 / 待办 / 提问协作态（#77：plan/todo/interaction）
export { TodoWriteTool, TodoReadTool } from '@omniharness/kernel/kernel/adapters/tool/plan/todoTool.js';
export { AskUserTool } from '@omniharness/kernel/kernel/adapters/tool/plan/askUserTool.js';
export { PlanWriteTool, PlanPresentTool, PlanReadTool } from '@omniharness/kernel/kernel/adapters/tool/plan/planTool.js';
export { MemoryTodo } from '@omniharness/kernel/kernel/adapters/todo/memoryTodo.js';
export { MemoryPlan } from '@omniharness/kernel/kernel/adapters/plan/memoryPlan.js';
export { ConsoleUserResponder } from '@omniharness/kernel/kernel/adapters/user/consoleUserResponder.js';
export { DefaultUserResponder } from '@omniharness/kernel/kernel/adapters/user/defaultUserResponder.js';
export { MUTATING_TOOLS } from '@omniharness/kernel/kernel/core/toolGate.js';
export type {
  UserResponder,
  AskQuestion,
  AskAnswer,
  AskOption,
} from '@omniharness/kernel/contracts/ports/runtime/userResponder.js';
export type { TodoPort, TodoItem, TodoStatus } from '@omniharness/kernel/contracts/ports/runtime/todo.js';
export type { PlanPort, PlanDraft, PlanState, PlanStep, PlanStatus } from '@omniharness/kernel/contracts/ports/runtime/plan.js';

// @beta 运行时消费 bundle 补丁层（注入 config 四层合并，叠在 profile 之上、低于 env）
export { ConfigError } from '@omniharness/kernel/kernel/config/configError.js';

export { DEFAULT_SOFT_RATIO } from '@omniharness/kernel/kernel/adapters/model/costBudget.js';
export type { BudgetSnapshot } from '@omniharness/kernel/kernel/adapters/model/costBudget.js';
