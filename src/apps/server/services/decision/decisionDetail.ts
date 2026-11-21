// 决策账本**详情投影**（2026-11-21 P3 从 decisionLedgerService.ts 拆出）：
// 单条决策的策略快照 / 审批轨迹 / 授权状态 / 共形证据 / tool_call·result 关联——纯函数。

import type {
  AatRecord,
  AuditDecisionRecord,
} from '../../../../host/kernel/util.ts';
import type { DecisionIndex } from './decisionLedgerAccess.ts';
import type {
  DecisionApprovalView,
  DecisionConformalEvidence,
  DecisionDetailView,
  DecisionPolicyView,
} from './decisionTypes.ts';

/**
 * 策略快照视图。
 * @param raw 原始决策。
 * @param index 派生索引。
 * @returns 策略快照或 undefined。
 */
export function policyOf(
  raw: AuditDecisionRecord,
  index: DecisionIndex,
): DecisionPolicyView | undefined {
  const record = index.policiesByHash.get(raw.policySnapshotHash);
  if (record === undefined) return undefined;
  return {
    snapshotHash: record.snapshot.snapshotHash,
    rules: record.snapshot.rules.map((rule) => ({
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      digest: rule.digest,
    })),
  };
}

/**
 * 审批轨迹。
 * @param raw 原始决策。
 * @param index 派生索引。
 * @returns 审批视图数组。
 */
export function approvalsOf(
  raw: AuditDecisionRecord,
  index: DecisionIndex,
): readonly DecisionApprovalView[] {
  return (index.approvalsByDecisionId.get(raw.decisionId) ?? []).map((record) => ({
    at: record.at,
    phase: record.phase,
    result: record.result,
    ...(record.by !== undefined ? { by: record.by } : {}),
    ...(record.reason !== undefined ? { reason: record.reason } : {}),
  }));
}

/**
 * 授权状态。
 * @param raw 原始决策。
 * @param index 派生索引。
 * @returns 授权视图或 undefined。
 */
export function authorizationOf(
  raw: AuditDecisionRecord,
  index: DecisionIndex,
): DecisionDetailView['authorization'] {
  if (raw.authorizationId === undefined) return undefined;
  return {
    id: raw.authorizationId,
    ...(raw.validUntil !== undefined ? { validUntil: raw.validUntil } : {}),
    reused: (index.authorizationCounts.get(raw.authorizationId) ?? 0) > 1,
  };
}

/**
 * 共形证据视图。
 * @param raw 原始决策。
 * @returns 共形证据或 undefined。
 */
export function conformalOfRaw(raw: AuditDecisionRecord): DecisionConformalEvidence | undefined {
  const conformal = raw.conformal;
  if (conformal === undefined) return undefined;
  return {
    alpha: conformal.alpha,
    threshold: conformal.threshold,
    riskScore: conformal.riskScore,
    effectClass: conformal.effectClass,
    calibrationDigest: conformal.calibrationDigest,
    classDigest: conformal.classDigest,
    calibrationSnapshotId: conformal.calibrationSnapshotId,
    unitCount: conformal.unitCount,
    riskFeatures: {
      toolName: conformal.riskFeatures.toolName,
      argKeys: conformal.riskFeatures.argKeys,
      intentKind: conformal.riskFeatures.intentKind,
      intentRisk: conformal.riskFeatures.intentRisk,
      mutating: conformal.riskFeatures.mutating,
    },
    riskModelDigest: conformal.riskModelDigest,
  };
}

/**
 * 关联的 tool_call 视图。
 * @param raw 原始决策。
 * @param index 派生索引。
 * @returns 调用视图或 undefined。
 */
export function toolCallOf(
  raw: AuditDecisionRecord,
  index: DecisionIndex,
): DecisionDetailView['toolCall'] {
  const event = index.toolCallsByCallId.get(raw.toolCallId);
  if (event === undefined) return undefined;
  const payload = event.payload as { name?: unknown };
  const aat = toolCallAatOf(raw, index);
  const parametersHash =
    aat !== undefined && typeof aat.actionDetail['parameters_hash'] === 'string'
      ? aat.actionDetail['parameters_hash']
      : '';
  return {
    at: event.timestamp,
    toolName: typeof payload.name === 'string' ? payload.name : raw.toolName,
    parametersHash,
  };
}

/**
 * 关联的 tool_result 视图。
 * @param raw 原始决策。
 * @param index 派生索引。
 * @returns 结果视图或 undefined。
 */
export function toolResultOf(
  raw: AuditDecisionRecord,
  index: DecisionIndex,
): DecisionDetailView['toolResult'] {
  const event = index.toolResultsByCallId.get(raw.toolCallId);
  if (event === undefined) return undefined;
  const payload = event.payload as { ok?: unknown; durationMs?: unknown; error?: unknown };
  return {
    at: event.timestamp,
    ok: payload.ok === true,
    ...(typeof payload.durationMs === 'number' ? { durationMs: payload.durationMs } : {}),
    ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
  };
}

/**
 * 找到与决策关联的 AAT tool_call 记录。
 * @param raw 原始决策。
 * @param index 派生索引。
 * @returns tool_call AAT 或 undefined。
 */
function toolCallAatOf(raw: AuditDecisionRecord, index: DecisionIndex): AatRecord | undefined {
  const decisionAat = index.decisionAatByDecisionId.get(raw.decisionId);
  if (decisionAat === undefined) return undefined;
  return index.toolCallAatByDecisionRecordId.get(decisionAat.recordId);
}
