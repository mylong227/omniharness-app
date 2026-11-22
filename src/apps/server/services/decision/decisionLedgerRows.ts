// 决策账本**行分类**（2026-11-21 P3 从 decisionLedgerService.ts 拆出）：
// 单行组装 + 最终去向判定表 + 依据分类——纯函数，无状态。

import type {
  AatRecord,
  AuditApprovalRecord,
  AuditContextTaintRecord,
  AuditDecisionRecord,
} from '../../../../host/kernel/util.ts';
import type { TurnSlice } from '../proof/proofTurnSlicer.ts';
import type { DecisionBasis, DecisionDisposition, DecisionRow } from './decisionTypes.ts';
import { turnOf } from './decisionLedgerAccess.ts';

/**
 * 单条决策行。
 * @param record 原始决策记录。
 * @param aat AAT 投影。
 * @param eventIndex 原始事件下标。
 * @param slices 回合区间。
 * @param approvals 审批记录。
 * @param taint CTA 记录（可选）。
 * @param executed 是否有 tool_call。
 * @returns 行。
 */
export function rowOf(
  record: AuditDecisionRecord,
  aat: AatRecord,
  eventIndex: number,
  slices: readonly TurnSlice[],
  approvals: readonly AuditApprovalRecord[],
  taint: AuditContextTaintRecord | undefined,
  executed: boolean,
): DecisionRow {
  const slice = turnOf(eventIndex, slices);
  const disposition = dispositionOf(record, approvals, executed);
  const effectClass = record.conformal?.effectClass ?? taint?.effectClass;
  return {
    recordId: aat.recordId,
    turnIndex: slice?.turnIndex ?? 0,
    displayIndex: slice?.displayIndex ?? 0,
    at: record.at,
    toolName: record.toolName,
    result: record.result,
    disposition,
    basis: basisOf(record, approvals),
    ...(effectClass !== undefined ? { effectClass } : {}),
    ...(record.conformal !== undefined
      ? { riskScore: record.conformal.riskScore, threshold: record.conformal.threshold }
      : {}),
    ...(record.authorizationId !== undefined ? { authorizationId: record.authorizationId } : {}),
    ...(record.principal !== undefined ? { principal: record.principal } : {}),
  };
}

/**
 * 最终去向（判定表；不把 require_approval 一律当「未执行」）。
 * @param record 决策记录。
 * @param approvals 审批记录。
 * @param executed 是否有 tool_call。
 * @returns 去向。
 */
function dispositionOf(
  record: AuditDecisionRecord,
  approvals: readonly AuditApprovalRecord[],
  executed: boolean,
): DecisionDisposition {
  const conformal = record.conformal !== undefined;
  const approved = approvals.some((item) => item.result === 'approved' || item.result === 'override');
  const rejected = approvals.some((item) => item.result === 'rejected' || item.result === 'expired');
  switch (record.result) {
    case 'deny':
      return conformal ? 'denied_after_conformal' : 'denied';
    case 'unavailable':
      return 'unavailable';
    case 'require_approval':
      if (rejected) return conformal ? 'denied_after_conformal' : 'denied';
      if (!approved) return 'escalated_pending';
      return executed ? 'allowed_by_approval' : 'approved_not_executed';
    case 'no_rule':
      return record.defaultApplied === 'deny' ? 'denied' : executed ? 'allowed' : 'escalated_pending';
    case 'allow':
      if (conformal) return 'allowed_by_conformal';
      return approved ? 'allowed_by_approval' : 'allowed';
    default:
      return 'unavailable';
  }
}

/**
 * 依据分类（共形 > 人工 > 规则 > 默认 > 未知）。
 * @param record 决策记录。
 * @param approvals 审批记录。
 * @returns 分类。
 */
function basisOf(
  record: AuditDecisionRecord,
  approvals: readonly AuditApprovalRecord[],
): DecisionBasis {
  if (record.conformal !== undefined) return 'conformal';
  if (
    approvals.some(
      (item) =>
        item.result === 'approved' || item.result === 'rejected' || item.result === 'override',
    )
  ) {
    return 'human';
  }
  if (record.result === 'unavailable') return 'unavailable';
  if (record.result === 'no_rule') return 'default';
  if (record.result === 'deny' && /rule/iu.test(record.evaluatorId)) return 'rule';
  return 'unknown';
}
