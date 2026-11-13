import type { SessionEvent } from '../../../../host/kernel/contracts.ts';
import type {
  AatRecord,
  AuditApprovalRecord,
  AuditContextTaintRecord,
  AuditDecisionRecord,
  AuditPolicySnapshotRecord,
  AuditRecord,
} from '../../../../host/kernel/util.ts';
import { ProofTurnSlicer, type TurnSlice } from '../proof/proofTurnSlicer.ts';
import { DecisionAat, type DecisionAatSnapshot } from './decisionAat.ts';
import type {
  DecisionApprovalView,
  DecisionAuditView,
  DecisionBasis,
  DecisionCheck,
  DecisionConformalEvidence,
  DecisionConformalView,
  DecisionCounts,
  DecisionCoverage,
  DecisionDetailView,
  DecisionDisposition,
  DecisionExportResult,
  DecisionFailure,
  DecisionPolicyView,
  DecisionResult,
  DecisionRow,
  DecisionSessionView,
  DecisionSettings,
  DecisionStructuralView,
  DecisionTurnSummary,
} from './decisionTypes.ts';

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

/** 一次投影的原始材料 + 派生索引。 */
interface DecisionIndex {
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
interface AuditEntry {
  readonly event: SessionEvent;
  readonly index: number;
  readonly record: AuditRecord;
}

/**
 * 决策账本读模型（`decision.session` / `decision.detail` / `decision.export` 的后端）。
 *
 * 只读：不改事件、不写文件、不发网络请求。所有判别失败返回 `{ok:false}`，不抛裸异常。
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
    const audit = DecisionLedgerService.auditViewOf(settings, auditEvents);
    if (auditEvents.length === 0) {
      return DecisionLedgerService.emptySessionOf(threadId, audit, slices, settings);
    }
    const inspected = this.inspectOf(loaded);
    if ('ok' in inspected) return inspected;
    const { snapshot, index } = inspected;
    const rows = index.rows;
    const turns = DecisionLedgerService.turnsOf(rows, slices, snapshot.events);
    const structural = DecisionLedgerService.structuralOf(snapshot);
    const conformal = DecisionLedgerService.conformalOf(snapshot);
    const truncated = rows.length > MAX_ROWS;
    return {
      sessionId: threadId,
      audit,
      coverage: DecisionLedgerService.coverageOf(rows, slices),
      counts: DecisionLedgerService.countsOf(rows, snapshot.records.length),
      turns,
      rows: truncated ? rows.slice(0, MAX_ROWS) : rows,
      structural,
      conformal,
      boundary: DecisionLedgerService.boundaryOf(),
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
    const policy = DecisionLedgerService.policyOf(raw, index);
    const approvals = DecisionLedgerService.approvalsOf(raw, index);
    const authorization = DecisionLedgerService.authorizationOf(raw, index);
    const conformal = DecisionLedgerService.conformalOfRaw(raw);
    const toolCall = DecisionLedgerService.toolCallOf(raw, index);
    const toolResult = DecisionLedgerService.toolResultOf(raw, index);
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
    const structural = DecisionLedgerService.structuralOf(snapshot);
    if (structural.status !== 'pass') {
      return DecisionLedgerService.failure('export_blocked', '结构复核未通过；先处理断链/字段问题，再导出。');
    }
    const conformal = DecisionLedgerService.conformalOf(snapshot);
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
    const entries = DecisionLedgerService.auditEntriesOf(snapshot.events);
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
        const callId = DecisionLedgerService.callIdOf(event);
        if (callId !== null) toolCallsByCallId.set(callId, event);
      } else if (event.type === 'tool_result') {
        const callId = DecisionLedgerService.callIdOf(event);
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
      const row = DecisionLedgerService.rowOf(record, aat, entry.index, slices, approvals, taint, executed);
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
  private static rowOf(
    record: AuditDecisionRecord,
    aat: AatRecord,
    eventIndex: number,
    slices: readonly TurnSlice[],
    approvals: readonly AuditApprovalRecord[],
    taint: AuditContextTaintRecord | undefined,
    executed: boolean,
  ): DecisionRow {
    const slice = DecisionLedgerService.turnOf(eventIndex, slices);
    const disposition = DecisionLedgerService.dispositionOf(record, approvals, executed);
    const effectClass = record.conformal?.effectClass ?? taint?.effectClass;
    return {
      recordId: aat.recordId,
      turnIndex: slice?.turnIndex ?? 0,
      displayIndex: slice?.displayIndex ?? 0,
      at: record.at,
      toolName: record.toolName,
      result: record.result,
      disposition,
      basis: DecisionLedgerService.basisOf(record, approvals),
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
  private static dispositionOf(
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
  private static basisOf(
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

  /**
   * 回合摘要（只含有决策的回合）。
   * @param rows 行。
   * @param slices 回合区间。
   * @param events 会话事件（取起止时间）。
   * @returns 回合组头。
   */
  private static turnsOf(
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
  private static coverageOf(
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
  private static countsOf(rows: readonly DecisionRow[], records: number): DecisionCounts {
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
  private static structuralOf(snapshot: DecisionAatSnapshot): DecisionStructuralView {
    const problems = [
      ...snapshot.rawAudit.problems.map((problem) => ({ code: problem.code, detail: problem.detail })),
      ...snapshot.aatVerdict.problems.map((problem) => ({ code: problem.code, detail: problem.detail })),
    ];
    const aatCodes = new Set(snapshot.aatVerdict.problems.map((problem) => problem.code));
    const decisions = DecisionLedgerService.rawDecisionsOf(snapshot.auditEvents);
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
  private static conformalOf(snapshot: DecisionAatSnapshot): DecisionConformalView {
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
  private static emptySessionOf(
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
      boundary: DecisionLedgerService.boundaryOf(),
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
  private static auditViewOf(
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
   * 策略快照视图。
   * @param raw 原始决策。
   * @param index 派生索引。
   * @returns 策略快照或 undefined。
   */
  private static policyOf(
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
  private static approvalsOf(
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
  private static authorizationOf(
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
  private static conformalOfRaw(raw: AuditDecisionRecord): DecisionConformalEvidence | undefined {
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
  private static toolCallOf(
    raw: AuditDecisionRecord,
    index: DecisionIndex,
  ): DecisionDetailView['toolCall'] {
    const event = index.toolCallsByCallId.get(raw.toolCallId);
    if (event === undefined) return undefined;
    const payload = event.payload as { name?: unknown };
    const aat = DecisionLedgerService.toolCallAatOf(raw, index);
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
  private static toolResultOf(
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
  private static toolCallAatOf(
    raw: AuditDecisionRecord,
    index: DecisionIndex,
  ): AatRecord | undefined {
    const decisionAat = index.decisionAatByDecisionId.get(raw.decisionId);
    if (decisionAat === undefined) return undefined;
    return index.toolCallAatByDecisionRecordId.get(decisionAat.recordId);
  }

  /**
   * audit 事件 → 记录 + 原下标。
   * @param events 会话事件。
   * @returns audit 条目。
   */
  private static auditEntriesOf(events: readonly SessionEvent[]): readonly AuditEntry[] {
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
  private static rawDecisionsOf(events: readonly SessionEvent[]): readonly AuditDecisionRecord[] {
    return DecisionLedgerService.auditEntriesOf(events)
      .map((entry) => entry.record)
      .filter((record): record is AuditDecisionRecord => record.kind === 'decision');
  }

  /**
   * 事件下标 → 回合区间。
   * @param index 事件下标。
   * @param slices 回合区间。
   * @returns 回合区间或 undefined。
   */
  private static turnOf(index: number, slices: readonly TurnSlice[]): TurnSlice | undefined {
    return slices.find((slice) => index >= slice.from && index < slice.to);
  }

  /**
   * tool_call / tool_result 的 callId。
   * @param event 事件。
   * @returns callId 或 null。
   */
  private static callIdOf(event: SessionEvent): string | null {
    const payload = event.payload as { callId?: unknown };
    return typeof payload.callId === 'string' && payload.callId !== '' ? payload.callId : null;
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
   * 边界声明。
   * @returns 固定边界。
   */
  private static boundaryOf(): DecisionSessionView['boundary'] {
    return { signed: false, trustLevel: 'L0', argsIncluded: false, draft: 'AAT-09-subset' };
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
