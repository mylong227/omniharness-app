/**
 * 内核对接面 · context 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
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
