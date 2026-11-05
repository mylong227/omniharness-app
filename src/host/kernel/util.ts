/**
 * 内核对接面 · util 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { ArrayAt } from '@omniharness/kernel/kernel/util/arrayAt.js';
export { AsyncChildProcess } from '@omniharness/kernel/kernel/util/asyncChildProcess.js';
export { BuiltinDefaults, builtinDefaults } from '@omniharness/kernel/kernel/util/builtinDefaults.js';
export { ConcurrencyLimiter } from '@omniharness/kernel/kernel/util/concurrency/concurrencyLimiter.js';
export { FileLock } from '@omniharness/kernel/kernel/util/concurrency/fileLock.js';
export { ParallelMap } from '@omniharness/kernel/kernel/util/concurrency/parallelMap.js';
export { PendingRequests } from '@omniharness/kernel/kernel/util/concurrency/pendingRequests.js';
export type { PendingTimeout } from '@omniharness/kernel/kernel/util/concurrency/pendingRequests.js';
export { Ed25519PublicKey } from '@omniharness/kernel/kernel/util/ed25519PublicKey.js';
export { EigenSpectrum } from '@omniharness/kernel/kernel/util/eigenspectrum.js';
export { endpointDefaults } from '@omniharness/kernel/kernel/util/endpointDefaults.js';
export type { ResolvedAdapterDefaults } from '@omniharness/kernel/kernel/util/endpointDefaults.js';
export { HashChain } from '@omniharness/kernel/kernel/util/hashChain.js';
export { Id } from '@omniharness/kernel/kernel/util/id.js';
export { LimitEnv } from '@omniharness/kernel/kernel/util/limitEnv.js';
export { Logger, log } from '@omniharness/kernel/kernel/util/logger.js';
export { OmniHome } from '@omniharness/kernel/kernel/util/omniHome.js';
export { OutputDecoder } from '@omniharness/kernel/kernel/util/outputDecoder.js';
export { runtimeLimits } from '@omniharness/kernel/kernel/util/runtimeLimits.js';
export { SessionArchiveLayout } from '@omniharness/kernel/kernel/util/sessionArchiveLayout.js';
export { SessionSummaryBuilder } from '@omniharness/kernel/kernel/util/sessionSummaryBuilder.js';
export type { SessionSummary } from '@omniharness/kernel/kernel/util/sessionSummaryBuilder.js';
export { readSessionSummary, sessionSummaryPath, writeSessionSummary } from '@omniharness/kernel/kernel/util/sessionSummarySidecar.js';
export { PathTraversalError, WorkspaceGuard } from '@omniharness/kernel/kernel/util/workspaceGuard.js';
export { WorkspaceIdentity } from '@omniharness/kernel/kernel/util/workspaceIdentity.js';
