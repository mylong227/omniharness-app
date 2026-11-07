/**
 * 内核对接面 · core 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { Agent } from '@omniharness/kernel/kernel/core/agent.js';
export type { AgentResult } from '@omniharness/kernel/kernel/core/agent.js';
export { AppendOnlyEventLog } from '@omniharness/kernel/kernel/core/appendOnlyEventLog.js';
export { CheckpointManager } from '@omniharness/kernel/kernel/core/checkpointManager.js';
export { Container } from '@omniharness/kernel/kernel/core/container.js';
export { SessionRecorder } from '@omniharness/kernel/kernel/core/sessionRecorder.js';
export { StepRunner } from '@omniharness/kernel/kernel/core/stepRunner.js';
export { ToolGate } from '@omniharness/kernel/kernel/core/toolGate.js';
export { TurnRunner } from '@omniharness/kernel/kernel/core/turnRunner.js';
export { InterjectionClassifier } from '@omniharness/kernel/kernel/core/steering/interjectionClassifier.js';
