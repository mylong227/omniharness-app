import type { SessionEvent } from '../../../../host/kernel/contracts.ts';
import type {
  AatRecord,
  AuditDecisionRecord,
  AuditPolicySnapshotRecord,
  AuditApprovalRecord,
  AuditContextTaintRecord,
} from '../../../../host/kernel/util.ts';
import { ProofTurnSlicer } from '../proof/proofTurnSlicer.ts';
import { DecisionAat, type DecisionAatSnapshot } from './decisionAat.ts';
import type {
  DecisionDetailView,
  DecisionExportResult,
  DecisionFailure,
  DecisionResult,
  DecisionRow,
  DecisionSessionView,
  DecisionSettings,
} from './decisionTypes.ts';
import { auditEntriesOf, callIdOf, type AuditEntry, type DecisionIndex } from './decisionLedgerAccess.ts';
import { rowOf } from './decisionLedgerRows.ts';
import {
  auditViewOf,
  boundaryOf,
  conformalOf,
  countsOf,
  coverageOf,
  emptySessionOf,
  structuralOf,
  turnsOf,
} from './decisionLedgerViews.ts';
import {
  approvalsOf,
  authorizationOf,
  conformalOfRaw,
  policyOf,
  toolCallOf,
  toolResultOf,
} from './decisionDetail.ts';

/** 导出上限（8 MB；超过不静默截断）。 */
const EXPORT_MAX_BYTES = 8 * 1024 * 1024;

/** 列表上限（超出仍可导出全会话）。 */
const MAX_ROWS = 500;

/** 服务依赖。 */
export interface DecisionLedgerDeps {
  /** 会话事件流（`Agent.eventsOf`）。 */
  readonly events: (threadId: string) => Promise<readonly SessionEvent[]>;
  /** 决策审计设置（用户级；实时读取）。 */
  readonly settings: () => DecisionSettings;
}

/**
 * 决策账本读模型（`decision.session` / `decision.detail` / `decision.export` 的后端）。
 *
 * 只读：不改事件、不写文件、不发网络请求。所有判别失败返回 `{ok:false}`，不抛裸异常。
 *
 * 2026-11-21 P3 拆分：账本存取（eventsOf/inspectOf/indexOf）与编排（三个 public 方法）
 * 留守本文件；行分类（decisionLedgerRows）、会话视图与复核（decisionLedgerViews）、
 * 详情投影（decisionDetail）、共享访问器（decisionLedgerAccess）各自成文件——纯函数搬家，
 * 行为零改动（判据 tests/decisionLedger 6 it 钉住）。
 */
export class DecisionLedgerService {
  /** 事件源与设置源。 */
  private readonly deps: DecisionLedgerDeps;

  /**
   * @param deps 事件流 / 设置读取器（组合根注入）。
   */
  public constructor(deps: DecisionLedgerDeps) {
    this.deps = deps;
  }

  /**
   * 会话级决策账本（列表 + 摘要 + 结构/共形复核）。
   * @param threadId 会话 id。
   * @returns 视图或判别失败。
   */
  public async sessionOf(threadId: string): Promise<DecisionResult<DecisionSessionView>> {
    const loaded = await this.eventsOf(threadId);
    if ('ok' in loaded) return loaded;
    const settings = this.deps.settings();
    const auditEvents = loaded.filter((event) => event.type === 'audit');
    const slices = ProofTurnSlicer.slice(loaded);
    const audit = auditViewOf(settings, auditEvents);
    if (auditEvents.length === 0) {
      return emptySessionOf(threadId, audit, slices, settings);
    }
    const inspected = this.inspectOf(loaded);
    if ('ok' in inspected) return inspected;
    const { snapshot, index } = inspected;
    const rows = index.rows;
    const turns = turnsOf(rows, slices, snapshot.events);
    const structural = structuralOf(snapshot);
    const conformal = conformalOf(snapshot);
    const truncated = rows.length > MAX_ROWS;
    return {
      sessionId: threadId,
      audit,
      coverage: coverageOf(rows, slices),
      counts: countsOf(rows, snapshot.records.length),
      turns,
      rows: truncated ? rows.slice(0, MAX_ROWS) : rows,
      structural,
      conformal,
      boundary: boundaryOf(),
      truncated,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 单条决策详情。
   * @param threadId 会话 id。
   * @param recordId AAT 记录 id。
   * @returns 详情或判别失败。
   */
  public async detailOf(threadId: string, recordId: string): Promise<DecisionResult<DecisionDetailView>> {
    if (recordId === '') {
      return DecisionLedgerService.failure('record_not_found', '缺少决策记录 id。');
    }
    const loaded = await this.eventsOf(threadId);
    if ('ok' in loaded) return loaded;
    if (!loaded.some((event) => event.type === 'audit')) {
      return DecisionLedgerService.failure('record_not_found', '这个会话还没有决策记录。');
    }
    const inspected = this.inspectOf(loaded);
    if ('ok' in inspected) return inspected;
    const { snapshot, index } = inspected;
    const row = index.rowsByRecordId.get(recordId);
    const aat = index.aatByRecordId.get(recordId);
    const raw = index.rawByAatId.get(recordId);
    if (row === undefined || aat === undefined || raw === undefined) {
      return DecisionLedgerService.failure('record_not_found', '这条决策已不在当前事件流里；刷新后再试。');
    }
    const policy = policyOf(raw, index);
    const approvals = approvalsOf(raw, index);
    const authorization = authorizationOf(raw, index);
    const conformal = conformalOfRaw(raw);
    const toolCall = toolCallOf(raw, index);
    const toolResult = toolResultOf(raw, index);
    const chainIndex = snapshot.records.findIndex((record) => record.recordId === recordId);
    return {
      row,
      decision: {
        decisionId: raw.decisionId,
        requestDigest: raw.requestDigest,
        policySnapshotHash: raw.policySnapshotHash,
        result: raw.result,
        defaultApplied: raw.defaultApplied,
        failClosed: raw.failClosed,
        evaluatorId: raw.evaluatorId,
        ...(raw.authorizationId !== undefined ? { authorizationId: raw.authorizationId } : {}),
        ...(raw.validUntil !== undefined ? { validUntil: raw.validUntil } : {}),
        ...(raw.principal !== undefined ? { principal: raw.principal } : {}),
      },
      ...(policy !== undefined ? { policy } : {}),
      approvals,
      ...(authorization !== undefined ? { authorization } : {}),
      ...(conformal !== undefined ? { conformal } : {}),
      chain: {
        recordId: aat.recordId,
        sequenceNumber: aat.sequenceNumber ?? 0,
        prevHash: aat.prevHash,
        hash: DecisionAat.recordHashOf(aat),
      },
      ...(toolCall !== undefined ? { toolCall } : {}),
      ...(toolResult !== undefined ? { toolResult } : {}),
      neighbors: {
        ...(chainIndex > 0 ? { previousRecordId: snapshot.records[chainIndex - 1]?.recordId } : {}),
        ...(chainIndex >= 0 && chainIndex < snapshot.records.length - 1
          ? { nextRecordId: snapshot.records[chainIndex + 1]?.recordId }
          : {}),
      },
    };
  }

  /**
   * 导出标准 AAT（records JSON + sha256 摘要）。结构 / 共形失败一律拒绝导出。
   * @param threadId 会话 id。
   * @returns 导出结果或判别失败。
   */
  public async exportOf(threadId: string): Promise<DecisionResult<DecisionExportResult>> {
    const loaded = await this.eventsOf(threadId);
    if ('ok' in loaded) return loaded;
    if (!loaded.some((event) => event.type === 'audit')) {
      return DecisionLedgerService.failure('export_blocked', '这个会话还没有决策记录；没有可导出的 AAT。');
    }
    const inspected = this.inspectOf(loaded);
    if ('ok' in inspected) return inspected;
    const { snapshot } = inspected;
    const structural = structuralOf(snapshot);
    if (structural.status !== 'pass') {
      return DecisionLedgerService.failure('export_blocked', '结构复核未通过；先处理断链/字段问题，再导出。');
    }
    const conformal = conformalOf(snapshot);
    if (conformal.status === 'fail') {
      return DecisionLedgerService.failure('export_blocked', '共形复核未通过；先处理证据问题，再导出。');
    }
    const content = JSON.stringify(snapshot.records, null, 2);
    const size = Buffer.byteLength(content, 'utf8');
    if (size > EXPORT_MAX_BYTES) {
      return DecisionLedgerService.failure(
        'export_too_large',
        `AAT 约 ${String(Math.ceil(size / 1024))} KB，超过 ${String(EXPORT_MAX_BYTES / 1024 / 1024)} MB 上限；v1 暂不支持整包导出。`,
      );
    }
    return {
      filename: DecisionLedgerService.filenameOf(threadId, snapshot),
      content,
      digest: DecisionAat.digestOf(snapshot.records),
      sessionHash: snapshot.sessionHash,
      size,
      recordCount: snapshot.records.length,
    };
  }

  /**
   * 读取事件流；空 threadId / 读取异常都收敛为判别失败。
   * @param threadId 会话 id。
   * @returns 事件数组或失败。
   */
  private async eventsOf(threadId: string): Promise<readonly SessionEvent[] | DecisionFailure> {
    if (threadId === '') {
      return DecisionLedgerService.failure('no_session', '先选择一个会话，再打开决策账本。');
    }
    try {
      return await this.deps.events(threadId);
    } catch (error) {
      return DecisionLedgerService.failure(
        'aat_unavailable',
        `决策账本读取失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 构建 AAT 快照与派生索引；AAT 构建异常收敛为 `aat_unavailable`。
   * @param events 会话事件。
   * @returns 快照 + 索引或失败。
   */
  private inspectOf(
    events: readonly SessionEvent[],
  ): { readonly snapshot: DecisionAatSnapshot; readonly index: DecisionIndex } | DecisionFailure {
    let snapshot: DecisionAatSnapshot;
    try {
      snapshot = DecisionAat.build(events);
    } catch (error) {
      return DecisionLedgerService.failure(
        'aat_unavailable',
        `AAT 构建失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return { snapshot, index: DecisionLedgerService.indexOf(snapshot) };
  }

  /**
   * 把 AAT/原始事件投影为列表行 + 各类查找表。
   * @param snapshot AAT 快照。
   * @returns 派生索引。
   */
  private static indexOf(snapshot: DecisionAatSnapshot): DecisionIndex {
    const entries = auditEntriesOf(snapshot.events);
    const slices = ProofTurnSlicer.slice(snapshot.events);
    const aatByDecisionId = new Map<string, AatRecord>();
    const toolCallAatByDecisionRecordId = new Map<string, AatRecord>();
    for (const record of snapshot.records) {
      const decisionId = DecisionAat.decisionIdOf(record);
      if (decisionId !== undefined) aatByDecisionId.set(decisionId, record);
      if (record.actionType === 'tool_call' && record.authorizationRecordId !== undefined) {
        toolCallAatByDecisionRecordId.set(record.authorizationRecordId, record);
      }
    }
    const policiesByHash = new Map<string, AuditPolicySnapshotRecord>();
    const approvalsByDecisionId = new Map<string, AuditApprovalRecord[]>();
    const taintsByCallId = new Map<string, AuditContextTaintRecord>();
    const toolCallsByCallId = new Map<string, SessionEvent>();
    const toolResultsByCallId = new Map<string, SessionEvent>();
    const authorizationCounts = new Map<string, number>();
    const rawDecisions: { readonly entry: AuditEntry; readonly record: AuditDecisionRecord }[] = [];

    for (const entry of entries) {
      const record = entry.record;
      if (record.kind === 'policy_snapshot') {
        policiesByHash.set(record.snapshot.snapshotHash, record);
      } else if (record.kind === 'approval') {
        const list = approvalsByDecisionId.get(record.decisionId) ?? [];
        list.push(record);
        approvalsByDecisionId.set(record.decisionId, list);
      } else if (record.kind === 'context_taint') {
        taintsByCallId.set(record.toolCallId, record);
      } else if (record.kind === 'decision') {
        rawDecisions.push({ entry, record });
        if (record.authorizationId !== undefined) {
          authorizationCounts.set(
            record.authorizationId,
            (authorizationCounts.get(record.authorizationId) ?? 0) + 1,
          );
        }
      }
    }
    for (const event of snapshot.events) {
      if (event.type === 'tool_call') {
        const callId = callIdOf(event);
        if (callId !== null) toolCallsByCallId.set(callId, event);
      } else if (event.type === 'tool_result') {
        const callId = callIdOf(event);
        if (callId !== null) toolResultsByCallId.set(callId, event);
      }
    }

    const rows: DecisionRow[] = [];
    const rowsByRecordId = new Map<string, DecisionRow>();
    const aatByRecordId = new Map<string, AatRecord>();
    const rawByAatId = new Map<string, AuditDecisionRecord>();
    for (const { entry, record } of rawDecisions) {
      const aat = aatByDecisionId.get(record.decisionId);
      if (aat === undefined) continue;
      const approvals = approvalsByDecisionId.get(record.decisionId) ?? [];
      const taint = taintsByCallId.get(record.toolCallId);
      const executed = toolCallsByCallId.has(record.toolCallId);
      const row = rowOf(record, aat, entry.index, slices, approvals, taint, executed);
      rows.push(row);
      rowsByRecordId.set(row.recordId, row);
      aatByRecordId.set(aat.recordId, aat);
      rawByAatId.set(aat.recordId, record);
    }
    rows.sort((left, right) => (left.at < right.at ? 1 : left.at > right.at ? -1 : 0));
    return {
      rows,
      rowsByRecordId,
      aatByRecordId,
      rawByAatId,
      policiesByHash,
      approvalsByDecisionId,
      taintsByCallId,
      toolCallsByCallId,
      toolResultsByCallId,
      toolCallAatByDecisionRecordId,
      decisionAatByDecisionId: aatByDecisionId,
      authorizationCounts,
    };
  }

  /**
   * 文件名（会话 + 最后事件时间；去掉路径不友好字符）。
   * @param threadId 会话 id。
   * @param snapshot AAT 快照。
   * @returns 建议文件名。
   */
  private static filenameOf(threadId: string, snapshot: DecisionAatSnapshot): string {
    const safe = threadId.replace(/[^a-zA-Z0-9_-]/gu, '_').slice(0, 48);
    const last = snapshot.events[snapshot.events.length - 1]?.timestamp ?? new Date().toISOString();
    const stamp = last.replace(/[-:]/gu, '').replace(/\..+$/u, '').replace('T', '-');
    return `aat-${safe}-${stamp}.json`;
  }

  /**
   * 组装判别失败。
   * @param code 错误码。
   * @param message 可读原因。
   * @returns 失败。
   */
  private static failure(code: DecisionFailure['code'], message: string): DecisionFailure {
    return { ok: false, code, message };
  }
}