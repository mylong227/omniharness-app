/**
 * 内核对接面 · core 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { Agent } from '@omniharness/kernel/kernel/core/agent.js';
export type { AgentResult } from '@omniharness/kernel/kernel/core/agent.js';
export { AppendOnlyEventLog } from '@omniharness/kernel/kernel/core/appendOnlyEventLog.js';
export { CheckpointManager } from '@omniharness/kernel/kernel/core/checkpointManager.js';
export { Container } from '@omniharness/kernel/kernel/core/container.js';
export { ServiceKey } from '@omniharness/kernel/kernel/core/serviceKey.js';
export { SessionRecorder } from '@omniharness/kernel/kernel/core/sessionRecorder.js';
export { StepRunner } from '@omniharness/kernel/kernel/core/stepRunner.js';
export { MUTATING_TOOLS, ToolGate } from '@omniharness/kernel/kernel/core/toolGate.js';
export { TurnRunner } from '@omniharness/kernel/kernel/core/turnRunner.js';
