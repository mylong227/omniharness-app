/**
 * 内核对接面 · platform 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { WasmSkillSchema } from '@omniharness/kernel/kernel/capability/schemas/wasmSkillSchema.js';
export type { WasmSkillAsset } from '@omniharness/kernel/kernel/capability/schemas/wasmSkillSchema.js';
export { PromotionHistoryService } from '@omniharness/kernel/kernel/governance/promotionHistoryService.js';
export type { PromotionHistoryView } from '@omniharness/kernel/kernel/governance/promotionHistoryService.js';
export { ProvenanceIssuer } from '@omniharness/kernel/kernel/governance/provenanceIssuer.js';
export type { ProvenanceCertificate, ProvenanceIssuerIdentity } from '@omniharness/kernel/kernel/governance/provenanceIssuer.js';
export { NativeKernel } from '@omniharness/kernel/kernel/native/nativeKernel.js';
export type { Skill, SkillEntry } from '@omniharness/kernel/kernel/skill/skill.js';
export { SkillMdCodec } from '@omniharness/kernel/kernel/skill/skillMdCodec.js';
export { SkillRegistry } from '@omniharness/kernel/kernel/skill/skillRegistry.js';
export { SupervisorKernel } from '@omniharness/kernel/kernel/supervisor/supervisorKernel.js';
export { SimpleWorker } from '@omniharness/kernel/kernel/worker/simpleWorker.js';
export type { Worker, WorkerRequest, WorkerResult } from '@omniharness/kernel/kernel/worker/worker.js';
export { WorkerOrchestrator } from '@omniharness/kernel/kernel/worker/workerOrchestrator.js';
export type { DelegateTask } from '@omniharness/kernel/kernel/worker/workerOrchestrator.js';
export { WorkerRegistry } from '@omniharness/kernel/kernel/worker/workerRegistry.js';
