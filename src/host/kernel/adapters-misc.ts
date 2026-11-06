/**
 * 内核对接面 · adapters-misc 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
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
