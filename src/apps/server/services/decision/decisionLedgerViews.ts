// 决策账本**会话视图与复核**（2026-11-21 P3 从 decisionLedgerService.ts 拆出）：
// 回合摘要 / 覆盖范围 / 摘要计数 / 结构复核 / 共形复核 / 空态 / 审计状态 / 边界声明——纯函数。

import type { SessionEvent } from '../../../../host/kernel/contracts.ts';
import type { DecisionAatSnapshot } from './decisionAat.ts';
import type {
  DecisionAuditView,
  DecisionCheck,
  DecisionConformalView,
  DecisionCounts,
  DecisionCoverage,
  DecisionRow,
  DecisionSessionView,
  DecisionSettings,
  DecisionStructuralView,
  DecisionTurnSummary,
} from './decisionTypes.ts';
import { rawDecisionsOf } from './decisionLedgerAccess.ts';
import type { TurnSlice } from '../proof/proofTurnSlicer.ts';

/**
 * 回合摘要（只含有决策的回合）。
 * @param rows 行。
 * @param slices 回合区间。
 * @param events 会话事件（取起止时间）。
 * @returns 回合组头。
 */
export function turnsOf(
  rows: readonly DecisionRow[],
  slices: readonly TurnSlice[],
  events: readonly SessionEvent[],
): readonly DecisionTurnSummary[] {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.turnIndex, (counts.get(row.turnIndex) ?? 0) + 1);
  return slices
    .filter((slice) => (counts.get(slice.turnIndex) ?? 0) > 0)
    .map((slice) => {
      const startedAt = events[slice.from]?.timestamp ?? '';
      const endedAt = events[slice.to - 1]?.timestamp ?? startedAt;
      return {
        turnIndex: slice.turnIndex,
        displayIndex: slice.displayIndex,
        startedAt,
        endedAt,
        decisions: counts.get(slice.turnIndex) ?? 0,
      };
    });
}

/**
 * 覆盖范围。
 * @param rows 行。
 * @param slices 回合区间。
 * @returns 覆盖摘要。
 */
export function coverageOf(
  rows: readonly DecisionRow[],
  slices: readonly TurnSlice[],
): DecisionCoverage {
  const recorded = new Set(rows.map((row) => row.turnIndex));
  const first = rows.reduce<DecisionRow | undefined>(
    (best, row) => (best === undefined || row.displayIndex < best.displayIndex ? row : best),
    undefined,
  );
  return {
    turnsTotal: slices.length,
    turnsRecorded: recorded.size,
    ...(first !== undefined ? { firstRecordedTurn: first.displayIndex } : {}),
    partial: rows.length > 0 && recorded.size < slices.length,
  };
}

/**
 * 摘要计数。
 * @param rows 行。
 * @param records AAT 记录数。
 * @returns 计数。
 */
export function countsOf(rows: readonly DecisionRow[], records: number): DecisionCounts {
  let allow = 0;
  let escalate = 0;
  let deny = 0;
  let conformal = 0;
  for (const row of rows) {
    if (row.basis === 'conformal') conformal += 1;
    if (
      row.disposition === 'allowed' ||
      row.disposition === 'allowed_by_conformal' ||
      row.disposition === 'allowed_by_approval'
    ) {
      allow += 1;
    } else if (row.disposition === 'escalated_pending' || row.disposition === 'approved_not_executed') {
      escalate += 1;
    } else {
      deny += 1;
    }
  }
  return { records, decisions: rows.length, allow, escalate, deny, conformal };
}

/**
 * 结构复核（原始链 + AAT 链）。
 * @param snapshot AAT 快照。
 * @returns 结构视图。
 */
export function structuralOf(snapshot: DecisionAatSnapshot): DecisionStructuralView {
  const problems = [
    ...snapshot.rawAudit.problems.map((problem) => ({ code: problem.code, detail: problem.detail })),
    ...snapshot.aatVerdict.problems.map((problem) => ({ code: problem.code, detail: problem.detail })),
  ];
  const aatCodes = new Set(snapshot.aatVerdict.problems.map((problem) => problem.code));
  const decisions = rawDecisionsOf(snapshot.auditEvents);
  const missingPrincipal = decisions.filter((record) => record.principal === undefined).length;
  const checks: DecisionCheck[] = [
    {
      code: 'AUDIT_CHAIN',
      status: snapshot.rawAudit.ok ? 'pass' : 'fail',
      detail: snapshot.rawAudit.ok
        ? `原始审计链 ${String(snapshot.rawAudit.count)} 条连续。`
        : (snapshot.rawAudit.problems[0]?.detail ?? '原始审计链复核失败。'),
    },
    {
      code: 'AAT_CHAIN',
      status: snapshot.aatVerdict.ok ? 'pass' : 'fail',
      detail: snapshot.aatVerdict.ok
        ? `AAT 链 ${String(snapshot.records.length)} 条一致。`
        : (snapshot.aatVerdict.problems[0]?.detail ?? 'AAT 链复核失败。'),
    },
    {
      code: 'SEQUENCE',
      status: aatCodes.has('SEQUENCE_GAP') ? 'fail' : 'pass',
      detail: aatCodes.has('SEQUENCE_GAP') ? 'AAT 序号有缺口。' : '序号连续。',
    },
    {
      code: 'SESSION',
      status: aatCodes.has('SESSION_MISMATCH') ? 'fail' : 'pass',
      detail: aatCodes.has('SESSION_MISMATCH') ? 'AAT 记录跨会话。' : '记录属于同一会话。',
    },
    {
      code: 'AUTHORIZATION',
      status: aatCodes.has('AUTHORIZATION_REUSED') ? 'fail' : 'pass',
      detail: aatCodes.has('AUTHORIZATION_REUSED') ? '单次授权被复用。' : '未发现授权复用。',
    },
    {
      code: 'PRINCIPAL',
      status: missingPrincipal > 0 ? 'warn' : 'pass',
      detail:
        missingPrincipal > 0
          ? `${String(missingPrincipal)}/${String(decisions.length)} 条决策缺少授权主体；不影响链，但不能回答谁授权。`
          : '所有决策都有授权主体。',
    },
  ];
  return {
    status: snapshot.rawAudit.ok && snapshot.aatVerdict.ok ? 'pass' : 'fail',
    checks,
    auditCount: snapshot.rawAudit.count,
    aatCount: snapshot.records.length,
    problems,
  };
}

/**
 * 共形复核视图。
 * @param snapshot AAT 快照。
 * @returns 共形视图。
 */
export function conformalOf(snapshot: DecisionAatSnapshot): DecisionConformalView {
  const verdict = snapshot.conformalVerdict;
  if (verdict.checkedDecisions === 0) {
    return {
      status: 'not_applicable',
      checkedDecisions: 0,
      snapshots: verdict.snapshots,
      checks: [],
      problems: [],
    };
  }
  const codes = new Set(verdict.problems.map((problem) => problem.code));
  const checks: DecisionCheck[] = [
    {
      code: 'CONFORMAL_UNITS',
      status:
        codes.has('CONFORMAL_UNITS_MISSING') ||
        codes.has('CONFORMAL_UNITS_INVALID') ||
        codes.has('CONFORMAL_FIELD_INVALID') ||
        codes.has('CONFORMAL_SNAPSHOT_MISSING')
          ? 'fail'
          : 'pass',
      detail: '校准单元可还原（full / delta）。',
    },
    {
      code: 'CONFORMAL_DIGEST',
      status:
        codes.has('CONFORMAL_DIGEST_MISMATCH') || codes.has('CONFORMAL_SNAPSHOT_MISMATCH')
          ? 'fail'
          : 'pass',
      detail: '类摘要 / 全类摘要可按包内单元重算。',
    },
    {
      code: 'CONFORMAL_THRESHOLD',
      status: codes.has('CONFORMAL_THRESHOLD_MISMATCH') ? 'fail' : 'pass',
      detail: '阈值 τ 可由 calibration units 重算。',
    },
    {
      code: 'CONFORMAL_RISK_SCORE',
      status: codes.has('CONFORMAL_RISK_SCORE_MISMATCH') ? 'fail' : 'pass',
      detail: '风险分可由 risk features 重算。',
    },
    {
      code: 'CONFORMAL_MODEL',
      status: codes.has('CONFORMAL_RISK_MODEL_MISMATCH') ? 'fail' : 'pass',
      detail: '风险权重模型摘要一致。',
    },
    {
      code: 'CONFORMAL_ABOVE_THRESHOLD',
      status: codes.has('CONFORMAL_RISK_ABOVE_THRESHOLD') ? 'fail' : 'pass',
      detail: '每条放行都满足 riskScore < threshold。',
    },
  ];
  return {
    status: verdict.ok ? 'pass' : 'fail',
    checkedDecisions: verdict.checkedDecisions,
    snapshots: verdict.snapshots,
    checks,
    problems: verdict.problems.map((problem) => ({ code: problem.code, detail: problem.detail })),
  };
}

/**
 * 空会话视图：审计未开启 / 已开启但无记录，均不伪造绿色。
 * @param threadId 会话 id。
 * @param audit 审计状态。
 * @param slices 回合区间。
 * @param settings 当前设置。
 * @returns 空视图。
 */
export function emptySessionOf(
  threadId: string,
  audit: DecisionAuditView,
  slices: readonly TurnSlice[],
  settings: DecisionSettings,
): DecisionSessionView {
  return {
    sessionId: threadId,
    audit,
    coverage: { turnsTotal: slices.length, turnsRecorded: 0, partial: false },
    counts: { records: 0, decisions: 0, allow: 0, escalate: 0, deny: 0, conformal: 0 },
    turns: [],
    rows: [],
    structural: {
      status: settings.enabled ? 'empty' : 'disabled',
      checks: [],
      auditCount: 0,
      aatCount: 0,
      problems: [],
    },
    conformal: {
      status: 'not_run',
      checkedDecisions: 0,
      snapshots: 0,
      checks: [],
      problems: [],
    },
    boundary: boundaryOf(),
    truncated: false,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 审计状态视图。
 * @param settings 当前设置。
 * @param auditEvents 会话里的 audit 事件。
 * @returns 审计状态。
 */
export function auditViewOf(
  settings: DecisionSettings,
  auditEvents: readonly SessionEvent[],
): DecisionAuditView {
  const first = auditEvents[0];
  return {
    enabled: settings.enabled,
    ...(settings.principal !== undefined ? { configuredPrincipal: settings.principal } : {}),
    ...(first !== undefined ? { startedAt: first.timestamp } : {}),
    closed: !settings.enabled && auditEvents.length > 0,
  };
}

/**
 * 边界声明。
 * @returns 固定边界。
 */
export function boundaryOf(): DecisionSessionView['boundary'] {
  return { signed: false, trustLevel: 'L0', argsIncluded: false, draft: 'AAT-09-subset' };
}
