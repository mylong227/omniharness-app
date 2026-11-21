// 决策账本**共享访问器**（2026-11-21 P3 从 decisionLedgerService.ts 拆出）：
// audit 事件 → 记录的取数、事件下标 → 回合区间、callId 提取——行分类 / 视图 / 门面三方共用。

import type { SessionEvent } from '../../../../host/kernel/contracts.ts';
import type {
  AatRecord,
  AuditApprovalRecord,
  AuditContextTaintRecord,
  AuditDecisionRecord,
  AuditPolicySnapshotRecord,
  AuditRecord,
} from '../../../../host/kernel/util.ts';
import type { TurnSlice } from '../proof/proofTurnSlicer.ts';
import type { DecisionRow } from './decisionTypes.ts';

/**
 * 一次投影的原始材料 + 派生索引（service.indexOf 的产物形状；详情投影按它取邻接记录）。
 */
export interface DecisionIndex {
  readonly rows: readonly DecisionRow[];
  readonly rowsByRecordId: ReadonlyMap<string, DecisionRow>;
  readonly aatByRecordId: ReadonlyMap<string, AatRecord>;
  readonly rawByAatId: ReadonlyMap<string, AuditDecisionRecord>;
  readonly policiesByHash: ReadonlyMap<string, AuditPolicySnapshotRecord>;
  readonly approvalsByDecisionId: ReadonlyMap<string, readonly AuditApprovalRecord[]>;
  readonly taintsByCallId: ReadonlyMap<string, AuditContextTaintRecord>;
  readonly toolCallsByCallId: ReadonlyMap<string, SessionEvent>;
  readonly toolResultsByCallId: ReadonlyMap<string, SessionEvent>;
  readonly toolCallAatByDecisionRecordId: ReadonlyMap<string, AatRecord>;
  readonly decisionAatByDecisionId: ReadonlyMap<string, AatRecord>;
  readonly authorizationCounts: ReadonlyMap<string, number>;
}

/** 一个 audit 事件及其原下标。 */
export interface AuditEntry {
  readonly event: SessionEvent;
  readonly index: number;
  readonly record: AuditRecord;
}

/**
 * audit 事件 → 记录 + 原下标。
 * @param events 会话事件。
 * @returns audit 条目。
 */
export function auditEntriesOf(events: readonly SessionEvent[]): readonly AuditEntry[] {
  const out: AuditEntry[] = [];
  events.forEach((event, index) => {
    if (event.type !== 'audit') return;
    if (event.payload === null || typeof event.payload !== 'object') return;
    const payload = event.payload as { record?: unknown };
    if (payload.record === null || typeof payload.record !== 'object') return;
    out.push({ event, index, record: payload.record as AuditRecord });
  });
  return out;
}

/**
 * 原始决策记录（仅 kind=decision）。
 * @param events audit 事件。
 * @returns 决策记录。
 */
export function rawDecisionsOf(events: readonly SessionEvent[]): readonly AuditDecisionRecord[] {
  return auditEntriesOf(events)
    .map((entry) => entry.record)
    .filter((record): record is AuditDecisionRecord => record.kind === 'decision');
}

/**
 * 事件下标 → 回合区间。
 * @param index 事件下标。
 * @param slices 回合区间。
 * @returns 回合区间或 undefined。
 */
export function turnOf(index: number, slices: readonly TurnSlice[]): TurnSlice | undefined {
  return slices.find((slice) => index >= slice.from && index < slice.to);
}

/**
 * tool_call / tool_result 的 callId。
 * @param event 事件。
 * @returns callId 或 null。
 */
export function callIdOf(event: SessionEvent): string | null {
  const payload = event.payload as { callId?: unknown };
  return typeof payload.callId === 'string' && payload.callId !== '' ? payload.callId : null;
}
