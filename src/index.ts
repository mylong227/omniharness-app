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
export { Agent } from './host/kernel/core.ts';
export type { AgentResult } from './host/kernel/core.ts';
export { AppendOnlyEventLog } from './host/kernel/core.ts';
export { Container } from './host/kernel/core.ts';
export { Runtime, ServiceKeys } from './apps/composition/runtime.ts';
export type { OmniHarnessRuntime } from './apps/composition/runtime.ts';
export { SessionRecorder } from './host/kernel/core.ts';
export { StepRunner } from './host/kernel/core.ts';
export { TurnRunner } from './host/kernel/core.ts';

// @public 配置
export { ConfigFactory } from './host/kernel/config.ts';
export type { ExtraTool, OmniHarnessConfig } from './host/kernel/config.ts';
// 配置分层（#G6：多层合并 + profile 覆盖 + key 别名归一化 + 严格校验）
export { ConfigFile } from './host/kernel/config.ts';
export type { FileConfig, FileMcpServer, LayeredOptions } from './host/kernel/config.ts';
export { ProfileLoader } from './host/kernel/config.ts';
export { ConfigError } from './host/kernel/config.ts';

export type { OpenAiCompatibleConfig } from './host/kernel/adapters-model.ts';
export { LlamaCppModel } from './host/kernel/adapters-model.ts';
export type { LlamaCppConfig } from './host/kernel/adapters-model.ts';
export { NetworkEgressGuard, EgressBlockedError } from './host/kernel/adapters-sandbox.ts';
export { DaemonController } from './apps/daemon/daemonController.ts';
export { RoutineScheduler } from './apps/daemon/routineScheduler.ts';
export type { Routine, RoutineSchedule, RoutineModelAdapter } from './apps/daemon/routineScheduler.ts';
export { ResponsesModel } from './host/kernel/adapters-model.ts';
export type { ResponsesConfig } from './host/kernel/adapters-model.ts';
export { RetryingModel, DEFAULT_RETRY_POLICY } from './host/kernel/adapters-model.ts';
export type { RetryPolicy, DelayFn } from './host/kernel/adapters-model.ts';
export { BudgetedModel } from './host/kernel/adapters-model.ts';
export { CostBudget } from './host/kernel/adapters-model.ts';
export type { BudgetSnapshot } from './host/kernel/adapters-model.ts';
export {
  RoutePricing,
  DEFAULT_ROUTE_PRICING,
  DEFAULT_FALLBACK_PRICE,
} from './host/kernel/adapters-model.ts';
export type { ToolHandler } from './host/kernel/adapters/tool/toolHandler.ts';

// @public hooks 兼容层（通用 / claude-code 事件格式映射）
export { GenericHooksMapper } from './apps/hooksCompat/genericHooksMapper.ts';
export { ClaudeCodeHooksMapper } from './apps/hooksCompat/claudeCodeHooksMapper.ts';
export { HooksCompatAdapter } from './apps/hooksCompat/hooksCompatAdapter.ts';
export type { HookEventEnvelope, HookConsumer } from './apps/hooksCompat/formats.ts';

// @public 上下文 / 工具
export { ContextAssembler } from './host/kernel/context.ts';
export { TokenEstimator } from './host/kernel/context.ts';
export { ContextCompactor } from './host/kernel/context.ts';
export type { CompactionOptions, CompactionResult } from './host/kernel/context.ts';
// Spill：超大工具输出外溢（#74）
export { SpillPolicy } from './host/kernel/context.ts';
export type { SpillPolicyOptions } from './host/kernel/context.ts';
export { ToolResultSpiller } from './host/kernel/context.ts';
export type { SpillerOptions } from './host/kernel/context.ts';
export { FileSpill } from './host/kernel/adapters-misc.ts';
export { MemorySpill } from './host/kernel/adapters-misc.ts';
export { SpillReadTool } from './host/kernel/adapters-tool.ts';
export { WorkspaceGuard, PathTraversalError } from './host/kernel/util.ts';
export { OutputDecoder } from './host/kernel/util.ts';


// @public 门禁 / PTC 代码执行
export { ToolGate } from './host/kernel/core.ts';
export { SupervisorKernel } from './host/kernel/platform.ts';
export type {
  SupervisorPort,
  SupervisorOptions,
  SafeMode,
  HealthSnapshot,
  HealthEntry,
  AuditSinkLike,
} from './host/kernel/contracts.ts';

export { EigenSpectrum } from './host/kernel/util.ts';
export type { Spectrum } from './host/kernel/contracts.ts';



// @public 进化闭环（P1：发现 → 评估 → 晋升，fail-closed）
export { FailClosedEvolutionGate } from './host/kernel/evolution.ts';
export type {
  BenchmarkFn,
  SafetyCheck,
  FailClosedEvolutionGateOptions,
} from './host/kernel/evolution.ts';
export { TwistDiscoveryEngine } from './host/kernel/evolution.ts';
export type { TwistDiscoveryOptions } from './host/kernel/evolution.ts';
export { EvolutionControllerImpl } from './host/kernel/evolution.ts';
export { RlvrController } from './host/kernel/evolution.ts';
export type { RlvrEvolutionOptions, RlvrEvolutionBundle } from './host/kernel/evolution.ts';
export type { VerifiableRewardFn } from './host/kernel/evolution.ts';
export { Benchmark } from './host/kernel/evolution.ts';
export type {
  Candidate,
  PromotionVerdict,
  EvolutionGate,
  DiscoveryEngine,
  EvolutionController,
  EvolutionControllerOptions,
} from './host/kernel/contracts.ts';
export { CodeInterpreter } from './host/kernel/adapters-tool.ts';
export type { CodeInterpreterDeps, CodeRunResult } from './host/kernel/adapters-tool.ts';
export { CodeExecutorTool } from './host/kernel/adapters-tool.ts';
export type { CodeExecutorOptions } from './host/kernel/adapters-tool.ts';

// @public Skills 系统
export type { Skill } from './host/kernel/platform.ts';
export { SkillRegistry } from './host/kernel/platform.ts';

export { CodeGenerator } from './host/contracts/schema/codeGenerator.ts';

// @public 跨 harness worker 编排
export type { Worker, WorkerRequest, WorkerResult } from './host/kernel/platform.ts';
export { SimpleWorker } from './host/kernel/platform.ts';
export { WorkerRegistry } from './host/kernel/platform.ts';
export { WorkerOrchestrator } from './host/kernel/platform.ts';
export type { DelegateTask } from './host/kernel/platform.ts';
export { DelegateTool } from './host/kernel/adapters-tool.ts';

// @public MCP 网关（对外暴露工具 / 桥接外部 MCP 服务器）
export { McpProtocol } from './host/kernel/protocols.ts';
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
} from './host/kernel/protocols.ts';
export { McpToolMapper } from './host/kernel/protocols.ts';
export { McpServer } from './host/kernel/protocols.ts';
export type { McpServerOptions } from './host/kernel/protocols.ts';
export { McpClient } from './host/kernel/protocols.ts';
export type { McpClientOptions } from './host/kernel/protocols.ts';
export { McpStatelessClient } from './host/kernel/protocols.ts';
export type {
  McpStatelessClientOptions,
  McpSubscription,
  McpSubscriptionHandlers,
} from './host/kernel/protocols.ts';
export type {
  McpInputRequiredContext,
  McpInputRequiredDecision,
  McpInputRequiredPort,
} from './host/kernel/contracts.ts';
export { McpAskUserInputHandler } from './host/kernel/protocols.ts';
export { McpApprovalInputHandler } from './host/kernel/protocols.ts';
export { McpCompositeInputHandler } from './host/kernel/protocols.ts';
export { McpSseResponseTransport } from './host/kernel/protocols.ts';
export type { McpSseFrame, McpSseWriter } from './host/kernel/protocols.ts';
export { McpStdioTransport } from './host/kernel/protocols.ts';
export type { McpStdioHandle, McpStdioServerOptions } from './host/kernel/protocols.ts';
export { McpConnector } from './host/kernel/protocols.ts';
export type { McpConnection, McpConnectorOptions } from './host/kernel/protocols.ts';
export { McpGateway } from './host/kernel/protocols.ts';
export type { McpBridgeResult, McpGatewayOptions, McpServerConfig } from './host/kernel/protocols.ts';
export { McpServerCommand } from './host/kernel/protocols.ts';


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
export { JsonlRuntimeTelemetry } from './host/kernel/adapters-misc.ts';
export type { JsonlRuntimeTelemetryOptions } from './host/kernel/adapters-misc.ts';
export type {
  RuntimeObservation,
  RuntimeTelemetryPort,
  TelemetryChainReport,
  TelemetryKind,
  TelemetryProvenance,
} from './host/kernel/contracts.ts';



// @public 嵌入入口（2026-11 模块化重构）：3 行起一个完整 OmniHarness 服务端
export { createOmniHarness } from './apps/embed/createOmniHarness.ts';
export type {
  OmniHarnessHandle,
  OmniHarnessInput,
} from './apps/embed/createOmniHarness.ts';
export { defineModule } from './apps/embed/createOmniHarness.ts';
export type { ServerModule } from './apps/embed/createOmniHarness.ts';
