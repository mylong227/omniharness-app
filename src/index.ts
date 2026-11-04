// @public 端口层（标准插口）
export type {
  ApprovalDecision,
  ApprovalPort,
  ApprovalRequest,
  EscalationDecision,
  EscalationDeniedBy,
  EscalationPort,
  EscalationRequest,
  EventPort,
  EventType,
  ModelMessage,
  ModelCallError,
  ModelOutput,
  ModelPort,
  ModelRequest,
  ModelToolCallRef,
  ModelToolSpec,
  SandboxAction,
  SandboxDecision,
  SandboxPort,
  SandboxDenialCategory,
  SessionEvent,
  ToolInputSink,
  SpillHandle,
  SpillPort,
  VortexRing,
  VortexRingPort,
  ResonantHit,
  ResonantMemoryPort,
  StoragePort,
  KvPort,
  VaultPort,
  ToolCall,
  ToolContext,
  ToolDefinition,
  ToolParametersSchema,
  ToolPort,
  ToolResult,
  LongTermMemoryPort,
  MemoryFact,
} from './host/kernel-compat/contracts/ports/index.ts';

// @public 核心
export { Agent } from '@omniharness/kernel/kernel/core/agent.js';
export type { AgentResult } from '@omniharness/kernel/kernel/core/agent.js';
export { AppendOnlyEventLog } from '@omniharness/kernel/kernel/core/appendOnlyEventLog.js';
export { Container } from '@omniharness/kernel/kernel/core/container.js';
export { Runtime, ServiceKeys } from './apps/composition/runtime.ts';
export type { OmniHarnessRuntime } from './apps/composition/runtime.ts';
export { SessionRecorder } from '@omniharness/kernel/kernel/core/sessionRecorder.js';
export { StepRunner } from '@omniharness/kernel/kernel/core/stepRunner.js';
export { TurnRunner } from '@omniharness/kernel/kernel/core/turnRunner.js';

// @public 配置
export { ConfigFactory } from '@omniharness/kernel/kernel/config/configFactory.js';
export type { ExtraTool, OmniHarnessConfig } from '@omniharness/kernel/kernel/config/configFactory.js';
// 配置分层（#G6：多层合并 + profile 覆盖 + key 别名归一化 + 严格校验）
export { ConfigFile } from '@omniharness/kernel/kernel/config/configFile.js';
export type { FileConfig, FileMcpServer, LayeredOptions } from '@omniharness/kernel/kernel/config/configFile.js';
export { ProfileLoader } from '@omniharness/kernel/kernel/config/profileLoader.js';
export { ConfigError } from '@omniharness/kernel/kernel/config/configError.js';

export type { OpenAiCompatibleConfig } from '@omniharness/kernel/kernel/adapters/model/openAiCompatibleModel.js';
export { LlamaCppModel } from '@omniharness/kernel/kernel/adapters/model/llamaCppModel.js';
export type { LlamaCppConfig } from '@omniharness/kernel/kernel/adapters/model/llamaCppModel.js';
export { NetworkEgressGuard, EgressBlockedError } from '@omniharness/kernel/kernel/adapters/sandbox/networkEgressGuard.js';
export { DaemonController } from './apps/daemon/daemonController.ts';
export { RoutineScheduler } from './apps/daemon/routineScheduler.ts';
export type { Routine, RoutineSchedule, RoutineModelAdapter } from './apps/daemon/routineScheduler.ts';
export { ResponsesModel } from '@omniharness/kernel/kernel/adapters/model/responsesModel.js';
export type { ResponsesConfig } from '@omniharness/kernel/kernel/adapters/model/responsesModel.js';
export { RetryingModel, DEFAULT_RETRY_POLICY } from '@omniharness/kernel/kernel/adapters/model/retryingModel.js';
export type { RetryPolicy, DelayFn } from '@omniharness/kernel/kernel/adapters/model/retryingModel.js';
export { BudgetedModel } from '@omniharness/kernel/kernel/adapters/model/budgetedModel.js';
export { CostBudget } from '@omniharness/kernel/kernel/adapters/model/costBudget.js';
export type { BudgetSnapshot } from '@omniharness/kernel/kernel/adapters/model/costBudget.js';
export {
  RoutePricing,
  DEFAULT_ROUTE_PRICING,
  DEFAULT_FALLBACK_PRICE,
} from '@omniharness/kernel/kernel/adapters/model/routePricing.js';
export type { ToolHandler } from './host/kernel/adapters/tool/toolHandler.ts';

// @public hooks 兼容层（通用 / claude-code 事件格式映射）
export { GenericHooksMapper } from './apps/hooksCompat/genericHooksMapper.ts';
export { ClaudeCodeHooksMapper } from './apps/hooksCompat/claudeCodeHooksMapper.ts';
export { HooksCompatAdapter } from './apps/hooksCompat/hooksCompatAdapter.ts';
export type { HookEventEnvelope, HookConsumer } from './apps/hooksCompat/formats.ts';

// @public 上下文 / 工具
export { ContextAssembler } from '@omniharness/kernel/kernel/context/contextAssembler.js';
export { TokenEstimator } from '@omniharness/kernel/kernel/context/tokenEstimator.js';
export { ContextCompactor } from '@omniharness/kernel/kernel/context/contextCompactor.js';
export type { CompactionOptions, CompactionResult } from '@omniharness/kernel/kernel/context/contextCompactor.js';
// Spill：超大工具输出外溢（#74）
export { SpillPolicy } from '@omniharness/kernel/kernel/context/spillPolicy.js';
export type { SpillPolicyOptions } from '@omniharness/kernel/kernel/context/spillPolicy.js';
export { ToolResultSpiller } from '@omniharness/kernel/kernel/context/toolResultSpiller.js';
export type { SpillerOptions } from '@omniharness/kernel/kernel/context/toolResultSpiller.js';
export { FileSpill } from '@omniharness/kernel/kernel/adapters/spill/fileSpill.js';
export { MemorySpill } from '@omniharness/kernel/kernel/adapters/spill/memorySpill.js';
export { SpillReadTool } from '@omniharness/kernel/kernel/adapters/tool/meta/spillReadTool.js';
export { WorkspaceGuard, PathTraversalError } from '@omniharness/kernel/kernel/util/workspaceGuard.js';
export { OutputDecoder } from '@omniharness/kernel/kernel/util/outputDecoder.js';


// @public 门禁 / PTC 代码执行
export { ToolGate } from '@omniharness/kernel/kernel/core/toolGate.js';
export { SupervisorKernel } from '@omniharness/kernel/kernel/supervisor/supervisorKernel.js';
export type {
  SupervisorPort,
  SupervisorOptions,
  SafeMode,
  HealthSnapshot,
  HealthEntry,
  AuditSinkLike,
} from '@omniharness/kernel/contracts/ports/runtime/supervisor.js';

export { EigenSpectrum } from '@omniharness/kernel/kernel/util/eigenspectrum.js';
export type { Spectrum } from '@omniharness/kernel/contracts/ports/util/spectrum.js';



// @public 进化闭环（P1：发现 → 评估 → 晋升，fail-closed）
export { FailClosedEvolutionGate } from '@omniharness/kernel/kernel/evolution/failClosedEvolutionGate.js';
export type {
  BenchmarkFn,
  SafetyCheck,
  FailClosedEvolutionGateOptions,
} from '@omniharness/kernel/kernel/evolution/failClosedEvolutionGate.js';
export { TwistDiscoveryEngine } from '@omniharness/kernel/kernel/evolution/twistDiscoveryEngine.js';
export type { TwistDiscoveryOptions } from '@omniharness/kernel/kernel/evolution/twistDiscoveryEngine.js';
export { EvolutionControllerImpl } from '@omniharness/kernel/kernel/evolution/evolutionControllerImpl.js';
export { RlvrController } from '@omniharness/kernel/kernel/evolution/rlvrController.js';
export type { RlvrEvolutionOptions, RlvrEvolutionBundle } from '@omniharness/kernel/kernel/evolution/rlvrController.js';
export type { VerifiableRewardFn } from '@omniharness/kernel/kernel/evolution/verifiableReward.js';
export { Benchmark } from '@omniharness/kernel/kernel/evolution/benchmark.js';
export type {
  Candidate,
  PromotionVerdict,
  EvolutionGate,
  DiscoveryEngine,
  EvolutionController,
  EvolutionControllerOptions,
} from '@omniharness/kernel/contracts/ports/runtime/evolution.js';
export { CodeInterpreter } from '@omniharness/kernel/kernel/adapters/tool/code/codeInterpreter.js';
export type { CodeInterpreterDeps, CodeRunResult } from '@omniharness/kernel/kernel/adapters/tool/code/codeInterpreter.js';
export { CodeExecutorTool } from '@omniharness/kernel/kernel/adapters/tool/code/codeExecutorTool.js';
export type { CodeExecutorOptions } from '@omniharness/kernel/kernel/adapters/tool/code/codeExecutorTool.js';

// @public Skills 系统
export type { Skill } from '@omniharness/kernel/kernel/skill/skill.js';
export { SkillRegistry } from '@omniharness/kernel/kernel/skill/skillRegistry.js';

export { CodeGenerator } from './host/contracts/schema/codeGenerator.ts';

// @public 跨 harness worker 编排
export type { Worker, WorkerRequest, WorkerResult } from '@omniharness/kernel/kernel/worker/worker.js';
export { SimpleWorker } from '@omniharness/kernel/kernel/worker/simpleWorker.js';
export { WorkerRegistry } from '@omniharness/kernel/kernel/worker/workerRegistry.js';
export { WorkerOrchestrator } from '@omniharness/kernel/kernel/worker/workerOrchestrator.js';
export type { DelegateTask } from '@omniharness/kernel/kernel/worker/workerOrchestrator.js';
export { DelegateTool } from '@omniharness/kernel/kernel/adapters/tool/workflow/delegateTool.js';

// @public MCP 网关（对外暴露工具 / 桥接外部 MCP 服务器）
export { McpProtocol } from '@omniharness/kernel/protocols/mcp/mcpProtocol.js';
export type {
  McpCallToolResult,
  McpCacheableResult,
  McpCapabilities,
  McpClientCapabilities,
  McpInitializeResult,
  McpInputRequestSpec,
  McpInputRequests,
  McpInputRequiredResult,
  McpInputResponses,
  McpInputSchema,
  McpResourceTemplate,
  McpServerInfo,
  McpSubscriptionFilter,
  McpTextContent,
  McpToolDescriptor,
} from '@omniharness/kernel/protocols/mcp/mcpProtocol.js';
export { McpToolMapper } from '@omniharness/kernel/protocols/mcp/mcpToolMapper.js';
export { McpServer } from '@omniharness/kernel/protocols/mcp/mcpServer.js';
export type { McpServerOptions } from '@omniharness/kernel/protocols/mcp/mcpServer.js';
export { McpClient } from '@omniharness/kernel/protocols/mcp/mcpClient.js';
export type { McpClientOptions } from '@omniharness/kernel/protocols/mcp/mcpClient.js';
export { McpStatelessClient } from '@omniharness/kernel/protocols/mcp/mcpStatelessClient.js';
export type {
  McpStatelessClientOptions,
  McpSubscription,
  McpSubscriptionHandlers,
} from '@omniharness/kernel/protocols/mcp/mcpStatelessClient.js';
export type {
  McpInputRequiredContext,
  McpInputRequiredDecision,
  McpInputRequiredPort,
} from '@omniharness/kernel/contracts/ports/mcp/mcpInputRequiredPort.js';
export { McpAskUserInputHandler } from '@omniharness/kernel/protocols/mcp/mcpAskUserInputHandler.js';
export { McpApprovalInputHandler } from '@omniharness/kernel/protocols/mcp/mcpApprovalInputHandler.js';
export { McpCompositeInputHandler } from '@omniharness/kernel/protocols/mcp/mcpCompositeInputHandler.js';
export { McpSseResponseTransport } from '@omniharness/kernel/protocols/mcp/mcpSseResponseTransport.js';
export type { McpSseFrame, McpSseWriter } from '@omniharness/kernel/protocols/mcp/mcpSseResponseTransport.js';
export { McpStdioTransport } from '@omniharness/kernel/protocols/mcp/mcpStdioTransport.js';
export type { McpStdioHandle, McpStdioServerOptions } from '@omniharness/kernel/protocols/mcp/mcpStdioTransport.js';
export { McpConnector } from '@omniharness/kernel/protocols/mcp/mcpConnector.js';
export type { McpConnection, McpConnectorOptions } from '@omniharness/kernel/protocols/mcp/mcpConnector.js';
export { McpGateway } from '@omniharness/kernel/protocols/mcp/mcpGateway.js';
export type { McpBridgeResult, McpGatewayOptions, McpServerConfig } from '@omniharness/kernel/protocols/mcp/mcpGateway.js';
export { McpServerCommand } from '@omniharness/kernel/protocols/mcp/mcpServerCommand.js';


// @public 企业管控（D2：SSO / 合规导出）
export { EnterpriseAuth, OidcClient } from './apps/enterprise/index.ts';
export type {
  OidcProviderConfig,
  OidcDiscovery,
  PkcePair,
  TokenSet,
  Jwk,
  JwtParts,
  AuthState,
} from './apps/enterprise/index.ts';
export { AuditExporter } from './apps/server/services/auditExporter.ts';
export type { ComplianceReport, ComplianceReportMeta } from './apps/server/services/auditExporter.ts';

// @public 版本契约（API 版本锚点，见 docs/API_STABILITY.md）
export { API_VERSION } from './version.ts';
export type { ApiVersion } from './version.ts';

// @public 长期运行遥测（P4, I-P4-3：回填基座 + 闭环参数收紧）
export { JsonlRuntimeTelemetry } from '@omniharness/kernel/kernel/adapters/telemetry/jsonlRuntimeTelemetry.js';
export type { JsonlRuntimeTelemetryOptions } from '@omniharness/kernel/kernel/adapters/telemetry/jsonlRuntimeTelemetry.js';
export type {
  RuntimeObservation,
  RuntimeTelemetryPort,
  TelemetryChainReport,
  TelemetryKind,
  TelemetryProvenance,
} from '@omniharness/kernel/contracts/ports/runtime/runtimeTelemetry.js';


