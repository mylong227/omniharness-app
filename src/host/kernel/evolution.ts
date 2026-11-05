/**
 * 内核对接面 · evolution 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { Benchmark } from '@omniharness/kernel/kernel/evolution/benchmark.js';
export { EvolutionControllerImpl } from '@omniharness/kernel/kernel/evolution/evolutionControllerImpl.js';
export { FailClosedEvolutionGate } from '@omniharness/kernel/kernel/evolution/failClosedEvolutionGate.js';
export type { BenchmarkFn, FailClosedEvolutionGateOptions, SafetyCheck } from '@omniharness/kernel/kernel/evolution/failClosedEvolutionGate.js';
export type { ImprovementProposal } from '@omniharness/kernel/kernel/evolution/failurePatternMiner.js';
export { HashChainPromotionLedger } from '@omniharness/kernel/kernel/evolution/hashChainPromotionLedger.js';
export { RlvrController } from '@omniharness/kernel/kernel/evolution/rlvrController.js';
export type { RlvrEvolutionBundle, RlvrEvolutionOptions } from '@omniharness/kernel/kernel/evolution/rlvrController.js';
export { TwistDiscoveryEngine } from '@omniharness/kernel/kernel/evolution/twistDiscoveryEngine.js';
export type { TwistDiscoveryOptions } from '@omniharness/kernel/kernel/evolution/twistDiscoveryEngine.js';
export type { VerifiableRewardFn } from '@omniharness/kernel/kernel/evolution/verifiableReward.js';
