/**
 * 内核对接面 · contracts 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export type { AssetPackManifest, AssetPackPort, PackAssetEntry, RegistryMetadata } from '@omniharness/kernel/contracts/ports/asset.js';
export type { CapabilityRecord } from '@omniharness/kernel/contracts/ports/capability.js';
export type { OmniHarnessRuntime } from '@omniharness/kernel/contracts/ports/composition/omniHarnessRuntime.js';
export type { CapabilityConfig } from '@omniharness/kernel/contracts/ports/config/capabilityConfig.js';
export type { CapabilityStack } from '@omniharness/kernel/contracts/ports/config/capabilityStack.js';
export type { DecisionEngineConfig } from '@omniharness/kernel/contracts/ports/config/decisionEngineConfig.js';
export type { FileConfig } from '@omniharness/kernel/contracts/ports/config/fileConfig.js';
export type { OmniHarnessConfig } from '@omniharness/kernel/contracts/ports/config/omniHarnessConfig.js';
export type { RbacConfig } from '@omniharness/kernel/contracts/ports/config/rbacConfig.js';
export type { ResolvedConfig } from '@omniharness/kernel/contracts/ports/config/resolvedConfig.js';
export type { MaintenanceLimits, PreviewLimits, ResolvedRuntimeLimits, RuntimeLimitsConfig } from '@omniharness/kernel/contracts/ports/config/runtimeLimits.js';
export type { DecisionEngine } from '@omniharness/kernel/contracts/ports/decision/decisionEngine.js';
export type { McpInputRequiredContext, McpInputRequiredDecision, McpInputRequiredPort } from '@omniharness/kernel/contracts/ports/mcp/mcpInputRequiredPort.js';
export type { KvPort } from '@omniharness/kernel/contracts/ports/memory/kv.js';
export type { LongTermMemoryPort, MemoryFact, MemoryFactPatch } from '@omniharness/kernel/contracts/ports/memory/longTermMemory.js';
export type { SpillHandle, SpillPort } from '@omniharness/kernel/contracts/ports/memory/spill.js';
export type { StoragePort } from '@omniharness/kernel/contracts/ports/memory/storage.js';
export type { BudgetDegradeSignal } from '@omniharness/kernel/contracts/ports/model/budgetDegrade.js';
export { BudgetExceededError, ModelCallError } from '@omniharness/kernel/contracts/ports/model/model.js';
export type { FileAttachment, ImageContent, ModelContextSnapshot, ModelMessage, ModelOutput, ModelPort, ModelRequest, ModelToolCallRef, ModelToolSpec, ModelUsage, RoutePrice, ToolInputDelta } from '@omniharness/kernel/contracts/ports/model/model.js';
export { MODEL_ADAPTER_IDS } from '@omniharness/kernel/contracts/ports/model/modelAdapterId.js';
export type { ModelAdapterId } from '@omniharness/kernel/contracts/ports/model/modelAdapterId.js';
export type { AgentIdentityClaims, AgentIdentityConfig, AgentIdentityPort } from '@omniharness/kernel/contracts/ports/runtime/agentIdentity.js';
export type { ApprovalDecision, ApprovalPort, ApprovalRequest } from '@omniharness/kernel/contracts/ports/runtime/approval.js';
export type { EscalationDecision, EscalationDeniedBy, EscalationPort, EscalationRequest } from '@omniharness/kernel/contracts/ports/runtime/escalation.js';
export type { EventType, SessionEvent } from '@omniharness/kernel/contracts/ports/runtime/event.js';
export type { EventPort } from '@omniharness/kernel/contracts/ports/runtime/eventPort.js';
export type { Candidate, DiscoveryEngine, EvolutionController, EvolutionControllerOptions, EvolutionGate, PromotionLedgerEntry, PromotionVerdict, SkillRestorePlan } from '@omniharness/kernel/contracts/ports/runtime/evolution.js';
export type { IsolationPayload } from '@omniharness/kernel/contracts/ports/runtime/isolation.js';
export type { PlanDraft, PlanPort, PlanState, PlanStatus, PlanStep } from '@omniharness/kernel/contracts/ports/runtime/plan.js';
export type { PolicyDecision, PolicyEffect, PolicyFacts, PolicyPort, PolicyRule } from '@omniharness/kernel/contracts/ports/runtime/policy.js';
export type { RuntimeObservation, RuntimeTelemetryPort, TelemetryChainReport, TelemetryKind, TelemetryProvenance } from '@omniharness/kernel/contracts/ports/runtime/runtimeTelemetry.js';
export type { SandboxAction, SandboxDecision, SandboxDenialCategory, SandboxPort } from '@omniharness/kernel/contracts/ports/runtime/sandbox.js';
export type { SandboxCapabilityEntry } from '@omniharness/kernel/contracts/ports/runtime/sandbox/sandboxCapabilityEntry.js';
export type { RuntimeFailure } from '@omniharness/kernel/contracts/ports/runtime/sandboxDenial.js';
export type { MoireOptions, SkillPort } from '@omniharness/kernel/contracts/ports/runtime/skill.js';
export type { AuditSinkLike, HealthEntry, HealthSnapshot, SafeMode, SupervisorOptions, SupervisorPort } from '@omniharness/kernel/contracts/ports/runtime/supervisor.js';
export type { TodoItem, TodoPort, TodoStatus } from '@omniharness/kernel/contracts/ports/runtime/todo.js';
export type { ToolGatePort } from '@omniharness/kernel/contracts/ports/runtime/toolGatePort.js';
export type { AskAnswer, AskContext, AskOption, AskQuestion, UserResponder } from '@omniharness/kernel/contracts/ports/runtime/userResponder.js';
export type { AuditEvent } from '@omniharness/kernel/contracts/ports/server/auditEvent.js';
export type { SubagentPortsShape } from '@omniharness/kernel/contracts/ports/subagent/subagentPortsShape.js';
export type { ExtraTool } from '@omniharness/kernel/contracts/ports/tool/extraTool.js';
export type { LspLocation, LspPort, LspPosition, LspRange, LspServerConfig } from '@omniharness/kernel/contracts/ports/tool/lsp.js';
export type { ToolCall, ToolContext, ToolDefinition, ToolParametersSchema, ToolPort, ToolResult } from '@omniharness/kernel/contracts/ports/tool/tool.js';
export type { ToolHandler } from '@omniharness/kernel/contracts/ports/tool/toolHandler.js';
export type { ToolInputSink } from '@omniharness/kernel/contracts/ports/tool/toolInputSink.js';
export type { Spectrum } from '@omniharness/kernel/contracts/ports/util/spectrum.js';
export type { DecisionAnswer } from '@omniharness/kernel/contracts/ports/decision/decisionEngine/decisionAnswer.js';
export type { DecisionQuestion } from '@omniharness/kernel/contracts/ports/decision/decisionEngine/decisionQuestion.js';
export type { DecisionRequest } from '@omniharness/kernel/contracts/ports/decision/decisionEngine/decisionRequest.js';
export type { DecisionResponse } from '@omniharness/kernel/contracts/ports/decision/decisionEngine/decisionResponse.js';
export type { McpConnectionHandle, McpConnectorPort } from '@omniharness/kernel/contracts/ports/mcp/mcpConnectorPort.js';
export type { McpServerConfig } from '@omniharness/kernel/protocols/mcp/mcpGateway.js';
export type { VaultPort } from '@omniharness/kernel/contracts/ports/memory/vault.js';
export type { TraceEntry } from '@omniharness/kernel/contracts/ports/telemetry/traceIntrospection/traceEntry.js';
export type { TraceFilter } from '@omniharness/kernel/contracts/ports/telemetry/traceIntrospection/traceFilter.js';
export type { TraceReadRequest } from '@omniharness/kernel/contracts/ports/telemetry/traceIntrospection/traceReadRequest.js';
export type { TraceReadResult } from '@omniharness/kernel/contracts/ports/telemetry/traceIntrospection/traceReadResult.js';
