/**
 * 内核对接面 · util 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { ArrayAt } from '@omniharness/kernel/kernel/util/arrayAt.js';
export { AsyncChildProcess } from '@omniharness/kernel/kernel/util/asyncChildProcess.js';
export { BuiltinDefaults, builtinDefaults } from '@omniharness/kernel/kernel/util/builtinDefaults.js';
export { FileLock } from '@omniharness/kernel/kernel/util/concurrency/fileLock.js';
export { PendingRequests } from '@omniharness/kernel/kernel/util/concurrency/pendingRequests.js';
export type { PendingTimeout } from '@omniharness/kernel/kernel/util/concurrency/pendingRequests.js';
export { Ed25519PublicKey } from '@omniharness/kernel/kernel/util/ed25519PublicKey.js';
export { EigenSpectrum } from '@omniharness/kernel/kernel/util/eigenspectrum.js';
export { endpointDefaults } from '@omniharness/kernel/kernel/util/endpointDefaults.js';
export type { ResolvedAdapterDefaults } from '@omniharness/kernel/kernel/util/endpointDefaults.js';
export { HashChain } from '@omniharness/kernel/kernel/util/hashChain.js';
export { Id } from '@omniharness/kernel/kernel/util/id.js';
export { Logger, log } from '@omniharness/kernel/kernel/util/logger.js';
export { OmniHome } from '@omniharness/kernel/kernel/util/omniHome.js';
export { OutputDecoder } from '@omniharness/kernel/kernel/util/outputDecoder.js';
export { runtimeLimits } from '@omniharness/kernel/kernel/util/runtimeLimits.js';
export { SessionArchiveLayout } from '@omniharness/kernel/kernel/util/sessionArchiveLayout.js';
export { SessionSummaryBuilder } from '@omniharness/kernel/kernel/util/sessionSummaryBuilder.js';
export type { SessionSummary } from '@omniharness/kernel/kernel/util/sessionSummaryBuilder.js';
export { SessionSummarySidecar } from '@omniharness/kernel/kernel/util/sessionSummarySidecar.js';
export { PathTraversalError, WorkspaceGuard } from '@omniharness/kernel/kernel/util/workspaceGuard.js';
export { WorkspaceIdentity } from '@omniharness/kernel/kernel/util/workspaceIdentity.js';
export { Retry } from '@omniharness/kernel/kernel/util/concurrency/retry.js';
export { JsonObjectFile } from '@omniharness/kernel/kernel/util/jsonObjectFile.js';
export { LocalDay } from '@omniharness/kernel/kernel/util/localDay.js';
export { MimeType } from '@omniharness/kernel/kernel/util/mimeType.js';
export { PortablePath } from '@omniharness/kernel/kernel/util/portablePath.js';
export { QuantileSketch } from '@omniharness/kernel/kernel/util/quantileSketch.js';
export { SecretRedactor } from '@omniharness/kernel/kernel/util/secretRedactor.js';
export { Jcs } from '@omniharness/kernel/kernel/receipts/jcs.js';
export { AuditBundles, EventMerkle, ExecutionCertificates } from '@omniharness/kernel/receipts';
export type { ExecutionCertificate } from '@omniharness/kernel/receipts';
