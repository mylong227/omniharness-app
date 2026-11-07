/**
 * 内核对接面 · autonomy 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { GoalChecker } from '@omniharness/kernel/kernel/autonomy/goalChecker.js';
export { GoalRunner } from '@omniharness/kernel/kernel/autonomy/goalRunner.js';
export { WorkflowRunLog } from '@omniharness/kernel/kernel/autonomy/workflowRunLog.js';
export { WorkflowRunner } from '@omniharness/kernel/kernel/autonomy/workflowRunner.js';
export type { GraphNodeStatus } from '@omniharness/kernel/kernel/autonomy/workflowRunner.js';
export type { WorkflowDef } from '@omniharness/kernel/kernel/autonomy/workflowTypes.js';
