/**
 * 内核对接面 · adapters-approval 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export type { ApprovalRule, ApprovalRuleDecision } from '@omniharness/kernel/kernel/adapters/approval/approvalRule.js';
export { AskApproval } from '@omniharness/kernel/kernel/adapters/approval/askApproval.js';
export { AutoApproval } from '@omniharness/kernel/kernel/adapters/approval/autoApproval.js';
export { BUILTIN_APPROVAL_RULES } from '@omniharness/kernel/kernel/adapters/approval/builtinApprovalRules.js';
export { DenyApproval } from '@omniharness/kernel/kernel/adapters/approval/denyApproval.js';
export { GuardianApproval } from '@omniharness/kernel/kernel/adapters/approval/guardianApproval.js';
export type { GuardianApprovalOptions } from '@omniharness/kernel/kernel/adapters/approval/guardianApproval.js';
export { GuardianPrompt } from '@omniharness/kernel/kernel/adapters/approval/guardianPrompt.js';
export { PlanApproval } from '@omniharness/kernel/kernel/adapters/approval/planApproval.js';
export { RuleApproval } from '@omniharness/kernel/kernel/adapters/approval/ruleApproval.js';
export type { RuleApprovalOptions } from '@omniharness/kernel/kernel/adapters/approval/ruleApproval.js';
