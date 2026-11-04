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
} from '@omniharness/kernel/contracts/ports/index.js';

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

// @public 适配器（各端口默认实现）
export {
  AutoApproval,
  ConsoleEventPort,
  DenyApproval,
  JsonlStorage,
  JsonFileKv,
  MemoryKv,
  MemoryStorage,
  MockModel,
  OpenAiCompatibleModel,
  PassthroughSandbox,
  PolicySandbox,
  RestrictedSandbox,
  WindowsNativeSandbox,
  UnsupportedSandbox,
  SandboxManager,
  SandboxDenial,
  DenyEscalation,
  AskEscalation,
  AutoEscalation,
  ReadFileTool,
  RegistryToolPort,
  ShellTool,
  SilentEventPort,
  SqliteKv,
  CryptoVault,
  EnvVault,
  ConsoleLiveView,
  CompositeLiveView,
  WebLiveView,
} from '@omniharness/kernel/kernel/adapters/index.js';
export type { LiveBroadcaster } from '@omniharness/kernel/kernel/adapters/live/webLiveView.js';
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

// @public 插件系统（cordis-lite）
export { PluginManager } from '@omniharness/kernel/kernel/plugin/pluginManager.js';
export type { Plugin, PluginApplyContext, PluginMeta } from '@omniharness/kernel/kernel/plugin/plugin.js';
export { PermissionGate, PermissionDeniedError } from '@omniharness/kernel/kernel/plugin/permissionGate.js';
export type { PermissionDecision } from '@omniharness/kernel/kernel/plugin/permissionGate.js';
export type { PluginPermission } from '@omniharness/kernel/kernel/plugin/permission.js';
export { ALL_PERMISSIONS, DANGEROUS_PERMISSIONS, Permission } from '@omniharness/kernel/kernel/plugin/permission.js';

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

// @public 燧-3 共振寻址 / 燧-4 涡环包（发明层 S+ 原语；共振寻址由 U1 统一基板 ResonantFieldEngine 承载）
export { ResonantFieldEngine } from '@omniharness/kernel/kernel/adapters/memory/resonantFieldEngine.js';
export type { ResonantFieldOptions, ResonantFieldPort } from '@omniharness/kernel/contracts/ports/memory/resonantField.js';
export {
  VortexRingPacket,
  VortexRingSpillAdapter,
} from '@omniharness/kernel/kernel/adapters/spill/vortexRingSpillAdapter.js';
export { SparkController } from '@omniharness/kernel/kernel/spark/sparkController.js';
export type { SparkCycleReport, SparkControllerOptions } from '@omniharness/kernel/kernel/spark/sparkController.js';
// @public (D) 热方程记忆重加权 / 退火调度（知识基础算子）
export { HeatEquationAnnealer } from '@omniharness/kernel/kernel/adapters/memory/heatEquationAnnealer.js';
export type { HeatAnnealerOptions } from '@omniharness/kernel/kernel/adapters/memory/heatEquationAnnealer.js';
export type { MemoryAnnealer, AnnealStepReport } from '@omniharness/kernel/contracts/ports/memory/memoryAnnealing.js';
// @public (E) 宇宙网记忆 / QEC 记忆 / 免疫异常监控（发明层 S+ 原语，I-P1-2/3/5）
export type { CosmicWebPort, WebConsolidationReport } from '@omniharness/kernel/contracts/ports/memory/cosmicWeb.js';
export { QECEncoder } from '@omniharness/kernel/kernel/adapters/memory/qecEncoder.js';
export type { QECOptions } from '@omniharness/kernel/kernel/adapters/memory/qecEncoder.js';
export type { QECEncoderPort, QECStatus, QECReport } from '@omniharness/kernel/contracts/ports/intelligence/qec.js';
export { ImmuneMonitor } from '@omniharness/kernel/kernel/adapters/monitoring/immuneMonitor.js';
export type { ImmuneMonitorOptions } from '@omniharness/kernel/kernel/adapters/monitoring/immuneMonitor.js';
export type {
  ImmuneMonitorPort,
  AnomalyAlert,
  ImmuneSelfReport,
} from '@omniharness/kernel/contracts/ports/intelligence/immune.js';
// @public (P2) 信念·组合·拓扑 — 自然梯度信念 / 粒子滤波信念（I-P2-2/3，信息几何）
export { NaturalGradientBelief } from '@omniharness/kernel/kernel/adapters/belief/naturalGradientBelief.js';
export type { NaturalGradientOptions } from '@omniharness/kernel/kernel/adapters/belief/naturalGradientBelief.js';
export { ParticleFilterBelief } from '@omniharness/kernel/kernel/adapters/belief/particleFilterBelief.js';
export type { ParticleFilterOptions } from '@omniharness/kernel/kernel/adapters/belief/particleFilterBelief.js';
export type {
  MetacognitionPort,
  BeliefSnapshot,
  BeliefUpdateReport,
  BeliefKlComponent,
} from '@omniharness/kernel/contracts/ports/intelligence/metacognition.js';
export { EigenSpectrum } from '@omniharness/kernel/kernel/util/eigenspectrum.js';
export type { Spectrum } from '@omniharness/kernel/contracts/ports/util/spectrum.js';

// @public (P2) 组合·拓扑 — CRISPR 精确技能编辑（I-P2-4）+ 相变固化（I-P2-5）
export { CRISPRSkillEditor } from '@omniharness/kernel/kernel/adapters/skill/crisprSkillEditor.js';
export type { CRISPRSkillEditorOptions } from '@omniharness/kernel/kernel/adapters/skill/crisprSkillEditor.js';
export type {
  CRISPRSkillEditorPort,
  CrisprEditSpec,
  CrisprEditReport,
} from '@omniharness/kernel/contracts/ports/runtime/skillEdit.js';
export { CapabilityCrystallizer } from '@omniharness/kernel/kernel/adapters/skill/capabilityCrystallizer.js';
export type { CapabilityCrystallizerOptions } from '@omniharness/kernel/kernel/adapters/skill/capabilityCrystallizer.js';
export type {
  CapabilityCrystallizerPort,
  CrystallizationReport,
  FrozenCapability,
} from '@omniharness/kernel/contracts/ports/intelligence/capability.js';

// @public (P3) 高原创试点 — 刻蚀记忆 / 元素组合基元 / 对称破缺 / 禁闭色荷（I-P3-1~4）
export { InsightEtchingEngine } from '@omniharness/kernel/kernel/adapters/memory/insightEtchingEngine.js';
export type { InsightEtchingOptions } from '@omniharness/kernel/kernel/adapters/memory/insightEtchingEngine.js';
export type {
  InsightEtchingPort,
  EtchEvent,
  EtchTrace,
  EtchNode,
  EtchConduction,
  EtchBranch,
} from '@omniharness/kernel/contracts/ports/memory/insightEtching.js';
export { ElementComposer } from '@omniharness/kernel/kernel/adapters/skill/elementComposer.js';
export type {
  ElementComposerPort,
  ElementDef,
  CompoundCapability,
} from '@omniharness/kernel/contracts/ports/intelligence/elementComposer.js';
export { SymmetryBreakingEngine } from '@omniharness/kernel/kernel/adapters/monitoring/symmetryBreakingEngine.js';
export type { SymmetryBreakingOptions } from '@omniharness/kernel/kernel/adapters/monitoring/symmetryBreakingEngine.js';
export type {
  SymmetryBreakingPort,
  SymmetryBreakReport,
  SymmetryState,
  UsageSample,
} from '@omniharness/kernel/contracts/ports/intelligence/symmetryBreaking.js';
export { ConfinementEngine } from '@omniharness/kernel/kernel/adapters/monitoring/confinementEngine.js';
export type { ConfinementOptions } from '@omniharness/kernel/kernel/adapters/monitoring/confinementEngine.js';
export type {
  ConfinementPort,
  CapabilityCharge,
  BoundCapability,
  ConfinementVerdict,
  Charge,
} from '@omniharness/kernel/contracts/ports/runtime/confinement.js';

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

// @public app-server / 协议
export { JsonRpc } from './apps/server/core/jsonRpc.ts';
export type {
  RpcError,
  RpcMessage,
  RpcNotification,
  RpcRequest,
  RpcResponse,
} from './apps/server/core/jsonRpc.ts';
export { LineTransport } from './apps/server/transport/lineTransport.ts';
export type { Transport } from './apps/server/transport/lineTransport.ts';
export { AppServer } from './apps/server/core/appServer.ts';
export type { AppServerOptions } from './apps/server/core/appServer.ts';

// @public 单源 schema / SDK 生成
export { protocolSchema } from '@omniharness/kernel/contracts/schema/protocolSchema.js';
export type {
  FieldSchema,
  FieldType,
  MethodSchema,
  ProtocolSchema,
} from '@omniharness/kernel/contracts/schema/protocolSchema.js';
export { CodeGenerator } from './host/contracts/schema/codeGenerator.ts';

// @public 跨 harness worker 编排
export type { Worker, WorkerRequest, WorkerResult } from '@omniharness/kernel/kernel/worker/worker.js';
export { CliWorker } from '@omniharness/kernel/kernel/worker/cliWorker.js';
export type { CliWorkerOptions } from '@omniharness/kernel/kernel/worker/cliWorker.js';
export { ExternalCliWorker } from '@omniharness/kernel/kernel/worker/externalCliWorker.js';
export type { ExternalCliWorkerSpec } from '@omniharness/kernel/kernel/worker/externalCliWorker.js';
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

// @public 原生内核（FFI 下沉 #65：Node 进程内直调 Rust 内核，N-API / .node）
export { NativeKernel, NativeKernelUnavailableError } from '@omniharness/kernel/kernel/native/index.js';
export type { NativeDecision } from '@omniharness/kernel/kernel/native/index.js';
export { NativeBackend } from '@omniharness/kernel/kernel/native/index.js';
export type { NativeToolRunner } from '@omniharness/kernel/kernel/native/index.js';

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

// @public 太初数学内核（Genesis Core）：可推演代数态射 + 多模态 + 自适应
// 统一内核——把能耗/成本建模为交换幺半群、算子的指称语义、记账不变量账本、
// 多模态函子（原生支持多模态）、按工况重配置管线的收敛型自适应控制器。
export {
  emptyCost,
  Algebra,
  costMonoid,
  JOULES_PER_TOKEN_ESTIMATE,
  Mathutil,
  type Cost,
  type Semigroup,
  type Monoid,
  ModalityPort,
  type Modality,
  type ModalityKind,
  type OperatorFn,
  operatorMonoid,
  type OperatorResult,
  Ledger,
  RegimeCost,
  fuseOperator,
  pruneOperator,
  type GenesisState,
  type Regime,
} from '@omniharness/kernel/kernel/genesis/index.js';

// @public 上下文效率层（自研 · 无第三方依赖）：确定性压缩 + 前缀稳定性治理（KV 缓存命中率根因变量）
export {
  Canonical,
  PrefixStability,
  type PromptSegment,
  type PromptBuildOptions,
  type PrefixStabilityReport,
  DeterministicCompressor,
  type SegmentKind,
  type ContextSegment,
  type CompressOptions,
  type CompressStageMetric,
  type CompressReport,
  type CompressResult,
} from '@omniharness/kernel/kernel/context/index.js';
