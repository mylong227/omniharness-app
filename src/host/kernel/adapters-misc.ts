/**
 * 内核对接面 · adapters-misc 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { DenyEscalation } from '@omniharness/kernel/kernel/adapters/escalation/denyEscalation.js';
export { ConsoleEventPort } from '@omniharness/kernel/kernel/adapters/event/consoleEventPort.js';
export { SilentEventPort } from '@omniharness/kernel/kernel/adapters/event/silentEventPort.js';
export { Ed25519AgentIdentity } from '@omniharness/kernel/kernel/adapters/identity/ed25519AgentIdentity.js';
export { BuiltinWasmRunner } from '@omniharness/kernel/kernel/adapters/isolation/builtinWasmRunner.js';
export { IsolationLadder } from '@omniharness/kernel/kernel/adapters/isolation/isolationLadder.js';
export type { IsolationLadderOptions } from '@omniharness/kernel/kernel/adapters/isolation/isolationLadder.js';
export { CompositeLiveView } from '@omniharness/kernel/kernel/adapters/live/compositeLiveView.js';
export { ConsoleLiveView } from '@omniharness/kernel/kernel/adapters/live/consoleLiveView.js';
export { LspProcessAdapter } from '@omniharness/kernel/kernel/adapters/lsp/lspProcessAdapter.js';
export { LSP_FIND_REFERENCES_TOOL_NAME, LSP_GO_TO_DEFINITION_TOOL_NAME, LSP_HOVER_TOOL_NAME, LSP_STATUS_TOOL_NAME } from '@omniharness/kernel/kernel/adapters/lsp/lspToolNames.js';
export { LspUri } from '@omniharness/kernel/kernel/adapters/lsp/lspUri.js';
export { FileLongTermMemory } from '@omniharness/kernel/kernel/adapters/memory/fileLongTermMemory.js';
export { MemoryExtractor } from '@omniharness/kernel/kernel/adapters/memory/memoryExtractor.js';
export { TemporalFactGraph } from '@omniharness/kernel/kernel/adapters/memory/temporalFactGraph.js';
export type { TemporalConsolidateOptions, TemporalConsolidationReport, TemporalFactCard, TemporalFactHit } from '@omniharness/kernel/kernel/adapters/memory/temporalFactGraph.js';
export { MemoryPlan } from '@omniharness/kernel/kernel/adapters/plan/memoryPlan.js';
export { SafePolicyEvaluator } from '@omniharness/kernel/kernel/adapters/policy/safePolicyEvaluator.js';
export { Bm25MemoryIndex } from '@omniharness/kernel/kernel/adapters/retrieval/bm25MemoryIndex.js';
export { FileSpill } from '@omniharness/kernel/kernel/adapters/spill/fileSpill.js';
export { MemorySpill } from '@omniharness/kernel/kernel/adapters/spill/memorySpill.js';
export { JsonlStorage } from '@omniharness/kernel/kernel/adapters/storage/jsonlStorage.js';
export { MemoryStorage } from '@omniharness/kernel/kernel/adapters/storage/memoryStorage.js';
export { SqliteStorage } from '@omniharness/kernel/kernel/adapters/storage/sqliteStorage.js';
export { JsonlRuntimeTelemetry } from '@omniharness/kernel/kernel/adapters/telemetry/jsonlRuntimeTelemetry.js';
export type { JsonlRuntimeTelemetryOptions } from '@omniharness/kernel/kernel/adapters/telemetry/jsonlRuntimeTelemetry.js';
export { MemoryTodo } from '@omniharness/kernel/kernel/adapters/todo/memoryTodo.js';
export { ConsoleUserResponder } from '@omniharness/kernel/kernel/adapters/user/consoleUserResponder.js';
export { DefaultUserResponder } from '@omniharness/kernel/kernel/adapters/user/defaultUserResponder.js';
export { GitWorkspaceSnapshot } from '@omniharness/kernel/kernel/adapters/workspace/gitWorkspaceSnapshot.js';
export { McpServeRunner } from '@omniharness/kernel/kernel/adapters/mcp/mcpServeRunner.js';
export { SdkPreferredMcpConnector } from '@omniharness/kernel/kernel/adapters/mcp/sdkPreferredMcpConnector.js';
