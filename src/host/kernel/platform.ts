/**
 * 内核对接面 · platform 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { WasmSkillSchema } from '@omniharness/kernel/kernel/capability/schemas/wasmSkillSchema.js';
export type { WasmSkillAsset } from '@omniharness/kernel/kernel/capability/schemas/wasmSkillSchema.js';
export { PromotionHistoryService } from '@omniharness/kernel/kernel/governance/promotionHistoryService.js';
export type { PromotionHistoryView } from '@omniharness/kernel/kernel/governance/promotionHistoryService.js';
export { ProvenanceIssuer } from '@omniharness/kernel/kernel/governance/provenanceIssuer.js';
export type { ProvenanceCertificate, ProvenanceIssuerIdentity } from '@omniharness/kernel/kernel/governance/provenanceIssuer.js';
export { NativeKernel } from '@omniharness/kernel/kernel/native/nativeKernel.js';
export { Bm25Index } from '@omniharness/kernel/kernel/search/bm25Index.js';
export type { Bm25Hit, Bm25Options } from '@omniharness/kernel/kernel/search/bm25Index.js';
export { ToolDiscovery } from '@omniharness/kernel/kernel/search/toolDiscovery.js';
export { ToolIndex } from '@omniharness/kernel/kernel/search/toolIndex.js';
export type { Skill, SkillEntry } from '@omniharness/kernel/kernel/skill/skill.js';
export { SkillMdCodec } from '@omniharness/kernel/kernel/skill/skillMdCodec.js';
export { SkillRegistry } from '@omniharness/kernel/kernel/skill/skillRegistry.js';
export { SupervisorKernel } from '@omniharness/kernel/kernel/supervisor/supervisorKernel.js';
export { SimpleWorker } from '@omniharness/kernel/kernel/worker/simpleWorker.js';
export type { Worker, WorkerRequest, WorkerResult } from '@omniharness/kernel/kernel/worker/worker.js';
export { WorkerOrchestrator } from '@omniharness/kernel/kernel/worker/workerOrchestrator.js';
export type { DelegateTask } from '@omniharness/kernel/kernel/worker/workerOrchestrator.js';
export { WorkerRegistry } from '@omniharness/kernel/kernel/worker/workerRegistry.js';
export { ErrorCode, OmniError } from '@omniharness/kernel/omniError.js';
