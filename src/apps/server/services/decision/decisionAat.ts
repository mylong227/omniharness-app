import { createHash } from 'node:crypto';
import type { SessionEvent } from '../../../../host/kernel/contracts.ts';
import { AatExporter, AuditRecorder, ConformalAatVerifier } from '../../../../host/kernel/util.ts';
import type { AatRecord, AuditEventPayload, AuditRecord } from '../../../../host/kernel/util.ts';

/** 原始 audit 链问题（不抛异常，供 UI 逐条展示）。 */
export interface DecisionAuditChainProblem {
  readonly code: 'AUDIT_CHAIN_SHAPE' | 'AUDIT_PREV_MISMATCH' | 'AUDIT_HASH_MISMATCH';
  readonly detail: string;
}

/** 原始 audit 链复核结论。 */
export interface DecisionAuditChainVerdict {
  readonly ok: boolean;
  readonly count: number;
  readonly problems: readonly DecisionAuditChainProblem[];
}

/** 一次决策账本投影的原始材料（AAT + 两条链的复核结论）。 */
export interface DecisionAatSnapshot {
  readonly events: readonly SessionEvent[];
  readonly auditEvents: readonly SessionEvent[];
  readonly records: readonly AatRecord[];
  readonly sessionHash: string;
  readonly rawAudit: DecisionAuditChainVerdict;
  readonly aatVerdict: ReturnType<typeof AatExporter.verify>;
  readonly conformalVerdict: ReturnType<typeof ConformalAatVerifier.verify>;
}

/**
 * 决策账本的 AAT 投影器（纯静态、无 IO）。
 *
 * 为什么单独成类：确定性投影、原始链复核、AAT/共形复核是一组不可拆的「造证据」动作；
 * 读模型只消费它，不自己拼 recordId / 时间锚 / 链校验。
 */
export class DecisionAat {
  private constructor() {}

  /**
   * 从会话事件构建确定性 AAT，并同时复核原始 audit 链与共形证据。
   * @param events 会话事件流（升序）。
   * @returns AAT 快照；AAT 构建抛错由调用方收敛为 `aat_unavailable`。
   */
  public static build(events: readonly SessionEvent[]): DecisionAatSnapshot {
    const auditEvents = events.filter((event) => event.type === 'audit');
    const sessionId = events[0]?.sessionId ?? '';
    const { records, sessionHash } = AatExporter.build(events, {
      idFactory: DecisionAat.idFactoryOf(sessionId),
      now: DecisionAat.lastTimestampOf(events),
      trustLevel: 'L0',
    });
    return {
      events,
      auditEvents,
      records,
      sessionHash,
      rawAudit: DecisionAat.verifyAuditChain(auditEvents),
      aatVerdict: AatExporter.verify(records, { requirePrincipal: false }),
      conformalVerdict: ConformalAatVerifier.verify(records),
    };
  }

  /**
   * 取单条 AAT 记录的链哈希（`sha256(JCS(record))`）。
   * @param record AAT 记录。
   * @returns 小写十六进制摘要。
   */
  public static recordHashOf(record: AatRecord): string {
    return AatExporter.hashOf(record);
  }

  /**
   * 取 AAT 记录集合的会话锚（sha256(JCS(records))）。
   * @param records AAT 记录。
   * @returns 小写十六进制摘要。
   */
  public static digestOf(records: readonly AatRecord[]): string {
    return AatExporter.hashOfRecords(records);
  }

  /**
   * 取 AAT decision 记录的 `decision_id`。
   * @param record AAT 记录。
   * @returns decision_id；非 decision 记录返回 undefined。
   */
  public static decisionIdOf(record: AatRecord): string | undefined {
    if (record.actionType !== 'decision') return undefined;
    const value = record.actionDetail['decision_id'];
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * 逐条复核原始 audit 链：`prevHash` 连续 + `hash = SHA-256(JCS({prevHash, record}))`。
   *
   * 为什么不能只验 AAT：AAT 是从 audit 事件重新投影并新生成链；改了原始事件再 build，
   * AAT 仍可能自洽。原始链必须独立复算。
   * @param auditEvents `type='audit'` 的事件（会话内升序）。
   * @returns 复核结论（不抛异常）。
   */
  private static verifyAuditChain(auditEvents: readonly SessionEvent[]): DecisionAuditChainVerdict {
    const problems: DecisionAuditChainProblem[] = [];
    let previousHash: string | null = null;
    let checked = 0;
    for (const event of auditEvents) {
      const payload = DecisionAat.auditPayloadOf(event.payload);
      if (payload === undefined) {
        problems.push({
          code: 'AUDIT_CHAIN_SHAPE',
          detail: `审计事件 ${event.id} 缺少 record / prevHash / hash。`,
        });
        break;
      }
      if (payload.prevHash !== previousHash) {
        problems.push({
          code: 'AUDIT_PREV_MISMATCH',
          detail: `审计事件 ${event.id} 的 prevHash 与上一条不连续（期望 ${DecisionAat.short(previousHash)}，实际 ${DecisionAat.short(payload.prevHash)}）。`,
        });
        break;
      }
      let expected: string;
      try {
        expected = AuditRecorder.hashOf(previousHash, payload.record);
      } catch {
        problems.push({
          code: 'AUDIT_CHAIN_SHAPE',
          detail: `审计事件 ${event.id} 的记录无法规范化（JCS 失败）。`,
        });
        break;
      }
      if (payload.hash !== expected) {
        problems.push({
          code: 'AUDIT_HASH_MISMATCH',
          detail: `审计事件 ${event.id} 的 hash 不匹配（期望 ${DecisionAat.short(expected)}，实际 ${DecisionAat.short(payload.hash)}）。`,
        });
        break;
      }
      previousHash = payload.hash;
      checked += 1;
    }
    return { ok: problems.length === 0, count: checked, problems };
  }

  /**
   * 确定性 ID 工厂（每次 build 必须新建；复用同一闭包会让 ID 漂移）。
   * @param sessionId 会话 id。
   * @returns 每次调用返回下一个稳定 id。
   */
  private static idFactoryOf(sessionId: string): () => string {
    const token = createHash('sha256').update(sessionId).digest('hex').slice(0, 8);
    let index = 0;
    return () => {
      const id = `aat_${token}_${String(index)}`;
      index += 1;
      return id;
    };
  }

  /**
   * 取最后一条事件的时间作为 `session_end` 的固定时间锚。
   * @param events 会话事件。
   * @returns 可解析则为最后一条时间，否则当前时间。
   */
  private static lastTimestampOf(events: readonly SessionEvent[]): Date {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const timestamp = events[index]?.timestamp;
      if (timestamp === undefined) continue;
      const parsed = Date.parse(timestamp);
      if (Number.isFinite(parsed)) return new Date(parsed);
    }
    return new Date();
  }

  /**
   * 收窄 audit 事件载荷形状。
   * @param payload 原始载荷。
   * @returns 合法载荷或 undefined。
   */
  private static auditPayloadOf(payload: unknown): AuditEventPayload | undefined {
    if (payload === null || typeof payload !== 'object') return undefined;
    const candidate = payload as Record<string, unknown>;
    const record = candidate['record'];
    if (record === null || typeof record !== 'object') return undefined;
    const prevHash = candidate['prevHash'];
    if (prevHash !== null && typeof prevHash !== 'string') return undefined;
    if (typeof candidate['hash'] !== 'string') return undefined;
    return {
      record: record as AuditRecord,
      prevHash,
      hash: candidate['hash'],
    };
  }

  /**
   * 短 hash（UI 文案用）。
   * @param value 完整 hash 或 null。
   * @returns 前 8 位 + …；空值写 null。
   */
  private static short(value: string | null): string {
    if (value === null) return 'null';
    return `${value.slice(0, 8)}…`;
  }
}
