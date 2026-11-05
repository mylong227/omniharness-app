/**
 * 内核对接面 · autonomy 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { GoalChecker } from '@omniharness/kernel/kernel/autonomy/goalChecker.js';
export type { GoalCheck } from '@omniharness/kernel/kernel/autonomy/goalChecker.js';
export { DEFAULT_GOAL_MAX_ITERATIONS, GoalRunner } from '@omniharness/kernel/kernel/autonomy/goalRunner.js';
export type { GoalResult, GoalRunnerOptions } from '@omniharness/kernel/kernel/autonomy/goalRunner.js';
export { RUN_GOAL_TOOL_NAME } from '@omniharness/kernel/kernel/autonomy/goalToolNames.js';
export { WorkflowRunLog } from '@omniharness/kernel/kernel/autonomy/workflowRunLog.js';
export { DEFAULT_WORKFLOW_CONCURRENCY, WorkflowCycleError, WorkflowRunner } from '@omniharness/kernel/kernel/autonomy/workflowRunner.js';
export type { GraphNodeStatus } from '@omniharness/kernel/kernel/autonomy/workflowRunner.js';
export { RUN_WORKFLOW_TOOL_NAME } from '@omniharness/kernel/kernel/autonomy/workflowToolNames.js';
export type { WorkflowDef, WorkflowResult, WorkflowStep, WorkflowStepResult } from '@omniharness/kernel/kernel/autonomy/workflowTypes.js';
