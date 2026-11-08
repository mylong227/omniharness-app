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
export { CompositeLiveView } from '@omniharness/kernel/kernel/adapters/live/compositeLiveView.js';
export { ConsoleLiveView } from '@omniharness/kernel/kernel/adapters/live/consoleLiveView.js';
export { FileSpill } from '@omniharness/kernel/kernel/adapters/spill/fileSpill.js';
export { MemorySpill } from '@omniharness/kernel/kernel/adapters/spill/memorySpill.js';
export { JsonlStorage } from '@omniharness/kernel/kernel/adapters/storage/jsonlStorage.js';
export { MemoryStorage } from '@omniharness/kernel/kernel/adapters/storage/memoryStorage.js';
export { SqliteStorage } from '@omniharness/kernel/kernel/adapters/storage/sqliteStorage.js';
export { JsonlRuntimeTelemetry } from '@omniharness/kernel/kernel/adapters/telemetry/jsonlRuntimeTelemetry.js';
export type { JsonlRuntimeTelemetryOptions } from '@omniharness/kernel/kernel/adapters/telemetry/jsonlRuntimeTelemetry.js';
export { DefaultUserResponder } from '@omniharness/kernel/kernel/adapters/user/defaultUserResponder.js';
export { GitWorkspaceSnapshot } from '@omniharness/kernel/kernel/adapters/workspace/gitWorkspaceSnapshot.js';
export { McpServeRunner } from '@omniharness/kernel/kernel/adapters/mcp/mcpServeRunner.js';
export { SkillManifestSigner } from '@omniharness/kernel/kernel/skill/skillManifestSigner.js';
export { AskEscalation } from '@omniharness/kernel/kernel/adapters/escalation/askEscalation.js';
export { AutoEscalation } from '@omniharness/kernel/kernel/adapters/escalation/autoEscalation.js';
export { CompositeEventPort } from '@omniharness/kernel/kernel/adapters/event/compositeEventPort.js';
export { JsonFileKv } from '@omniharness/kernel/kernel/adapters/kv/jsonFileKv.js';
export { MemoryKv } from '@omniharness/kernel/kernel/adapters/kv/memoryKv.js';
export { SqliteKv } from '@omniharness/kernel/kernel/adapters/kv/sqliteKv.js';
export { ReadonlyTraceReader } from '@omniharness/kernel/kernel/adapters/telemetry/readonlyTraceReader.js';
export { SessionEventReader } from '@omniharness/kernel/kernel/adapters/telemetry/sessionEventReader.js';
export { CacheHitRateWatch } from '@omniharness/kernel/kernel/observability/cacheHitRateWatch.js';
export { CacheMissAttributionAnalyst } from '@omniharness/kernel/kernel/observability/cacheMissAttributionAnalyst.js';
export type { CacheMissAttribution, CacheMissCause } from '@omniharness/kernel/kernel/observability/cacheMissAttributionAnalyst.js';
export { CryptoVault } from '@omniharness/kernel/kernel/adapters/vault/cryptoVault.js';
export { EnvVault } from '@omniharness/kernel/kernel/adapters/vault/envVault.js';
export { SdkPreferredMcpConnector } from '@omniharness/kernel/mcp';
