/**
 * 内核对接面 · context 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { ContextAssembler } from '@omniharness/kernel/kernel/context/contextAssembler.js';
export { ContextBreakdownEstimator } from '@omniharness/kernel/kernel/context/contextBreakdownEstimator.js';
export type { ContextBreakdown, ContextBreakdownRow } from '@omniharness/kernel/kernel/context/contextBreakdownEstimator.js';
export { ContextCompactor } from '@omniharness/kernel/kernel/context/contextCompactor.js';
export type { CompactionOptions, CompactionResult } from '@omniharness/kernel/kernel/context/contextCompactor.js';
export { ContextWindowCatalog } from '@omniharness/kernel/kernel/context/contextWindowCatalog.js';
export { PrefixStability } from '@omniharness/kernel/kernel/context/prefixStability.js';
export { SpillPolicy } from '@omniharness/kernel/kernel/context/spillPolicy.js';
export type { SpillPolicyOptions } from '@omniharness/kernel/kernel/context/spillPolicy.js';
export { TokenEstimator } from '@omniharness/kernel/kernel/context/tokenEstimator.js';
export { ToolResultSpiller } from '@omniharness/kernel/kernel/context/toolResultSpiller.js';
export type { SpillerOptions } from '@omniharness/kernel/kernel/context/toolResultSpiller.js';
