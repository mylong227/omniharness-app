/**
 * 内核对接面 · subagent 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { SubagentEventBridge } from '@omniharness/kernel/kernel/subagent/subagentEventBridge.js';
export { SubagentOrchestrator } from '@omniharness/kernel/kernel/subagent/subagentOrchestrator.js';
export { SubagentRunner } from '@omniharness/kernel/kernel/subagent/subagentRunner.js';
export { subagentRuntimeFactory } from '@omniharness/kernel/kernel/subagent/subagentRuntimeFactory.js';
export type { SubagentOptions, SubagentRequest, SubagentResult } from '@omniharness/kernel/kernel/subagent/subagentTypes.js';
export { ToolSubset } from '@omniharness/kernel/kernel/subagent/toolSubset.js';
