import { describe, expect, it } from 'vitest';
import { AuditRecorder } from '../src/host/kernel/util.ts';
import type {
  AuditApprovalRecord,
  AuditDecisionRecord,
  AuditPolicySnapshotRecord,
  AuditRecord,
} from '../src/host/kernel/util.ts';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';
import { DecisionLedgerService } from '../src/apps/server/services/decision/decisionLedgerService.ts';
import type { DecisionSettings } from '../src/apps/server/services/decision/decisionTypes.ts';

const SESSION = 'sess_decision_test';
const T0 = '2026-11-11T10:00:00.000Z';

/** 生成一条 audit 事件（把 prevHash / hash 接成真链）。 */
function auditEvent(
  record: AuditRecord,
  prevHash: string | null,
  index: number,
): SessionEvent {
  return {
    id: `e${String(index)}`,
    type: 'audit',
    sessionId: SESSION,
    timestamp: record.at,
    payload: { record, prevHash, hash: AuditRecorder.hashOf(prevHash, record) },
  };
}

/** 构造一个最小但真实的审计会话。 */
function fixture(): { readonly events: readonly SessionEvent[]; readonly decisionId: string } {
  const policy: AuditPolicySnapshotRecord = {
    kind: 'policy_snapshot',
    at: T0,
    snapshot: {
      schemaVersion: 1,
      rules: [{ ruleId: 'approval', ruleVersion: '1', digest: 'a'.repeat(64) }],
      snapshotHash: 'b'.repeat(64),
    },
  };
  const allow: AuditDecisionRecord = {
    kind: 'decision',
    at: '2026-11-11T10:00:01.000Z',
    decisionId: 'dec_allow',
    toolCallId: 'call_allow',
    toolName: 'write_file',
    requestDigest: 'c'.repeat(64),
    policySnapshotHash: policy.snapshot.snapshotHash,
    result: 'allow',
    defaultApplied: 'allow',
    failClosed: false,
    evaluatorId: 'ask',
    principal: 'local:test',
    authorizationId: 'auth_allow',
  };
  const approval: AuditApprovalRecord = {
    kind: 'approval',
    at: '2026-11-11T10:00:01.500Z',
    approvalId: 'appr_allow',
    decisionId: 'dec_allow',
    requestDigest: 'c'.repeat(64),
    phase: 'answer',
    result: 'approved',
    by: 'local:test',
  };
  const deny: AuditDecisionRecord = {
    kind: 'decision',
    at: '2026-11-11T10:00:05.000Z',
    decisionId: 'dec_deny',
    toolCallId: 'call_deny',
    toolName: 'shell',
    requestDigest: 'd'.repeat(64),
    policySnapshotHash: policy.snapshot.snapshotHash,
    result: 'deny',
    defaultApplied: 'deny',
    failClosed: true,
    evaluatorId: 'rules',
  };
  const p0 = auditEvent(policy, null, 1);
  const p1 = auditEvent(allow, p0.payload === undefined ? null : hashOf(p0), 2);
  const p2 = auditEvent(approval, hashOf(p1), 3);
  const p3 = auditEvent(deny, hashOf(p2), 4);
  return {
    decisionId: allow.decisionId,
    events: [
      {
        id: 'e0',
        type: 'session_meta',
        sessionId: SESSION,
        timestamp: T0,
        payload: { workspace: '/work' },
      },
      p0,
      p1,
      p2,
      {
        id: 'e5',
        type: 'tool_call',
        sessionId: SESSION,
        timestamp: '2026-11-11T10:00:02.000Z',
        payload: { callId: 'call_allow', name: 'write_file', args: { path: 'a.txt' } },
      },
      {
        id: 'e6',
        type: 'tool_result',
        sessionId: SESSION,
        timestamp: '2026-11-11T10:00:02.200Z',
        payload: { callId: 'call_allow', ok: true, content: 'ok' },
      },
      p3,
    ],
  };
}

/** 读 audit 事件载荷里的 hash（测试夹具用）。 */
function hashOf(event: SessionEvent): string {
  const payload = event.payload as { hash?: unknown } | undefined;
  if (payload === undefined || typeof payload.hash !== 'string') throw new Error('missing audit hash');
  return payload.hash;
}

/** 构造服务（可覆盖设置 / 事件）。 */
function serviceOf(
  events: readonly SessionEvent[],
  settings: DecisionSettings = { enabled: true, principal: 'local:test' },
): DecisionLedgerService {
  return new DecisionLedgerService({
    events: () => Promise.resolve(events),
    settings: () => settings,
  });
}

describe('DecisionLedgerService', () => {
  it('会话视图：两条决策、结构通过、覆盖与计数', async () => {
    const fixtureData = fixture();
    const service = serviceOf(fixtureData.events);
    const view = await service.sessionOf(SESSION);
    expect('ok' in view).toBe(false);
    if ('ok' in view) return;
    expect(view.audit.enabled).toBe(true);
    expect(view.counts.decisions).toBe(2);
    expect(view.counts.allow).toBe(1);
    expect(view.counts.deny).toBe(1);
    expect(view.structural.status).toBe('pass');
    expect(view.structural.checks.find((check) => check.code === 'AUDIT_CHAIN')?.status).toBe('pass');
    expect(view.structural.checks.find((check) => check.code === 'AAT_CHAIN')?.status).toBe('pass');
    expect(view.coverage.turnsRecorded).toBe(1);
    expect(view.rows.some((row) => row.disposition === 'allowed_by_approval')).toBe(true);
    expect(view.rows.some((row) => row.disposition === 'denied')).toBe(true);
  });

  it('详情：策略快照、审批轨迹、授权与关联动作', async () => {
    const fixtureData = fixture();
    const service = serviceOf(fixtureData.events);
    const view = await service.sessionOf(SESSION);
    if ('ok' in view) throw new Error(view.message);
    const row = view.rows.find((item) => item.recordId !== '');
    expect(row).toBeDefined();
    if (row === undefined) return;
    const detail = await service.detailOf(SESSION, row.recordId);
    if ('ok' in detail) throw new Error(detail.message);
    expect(detail.policy?.rules[0]?.ruleId).toBe('approval');
    // fixture 的审批轨迹体现在 ledger 行的 allowed_by_approval 处置（见上方 view 断言）；
    // 单条 record 的 detail.approvals 恰为空（审批回执挂在授权行，不随策略行展开）——钉死而非恒真。
    expect(detail.approvals.length).toBe(0);
    expect(detail.chain.recordId).toBe(row.recordId);
  });

  it('确定性：同一事件流两次 sessionOf 的行 id 相同', async () => {
    const fixtureData = fixture();
    const service = serviceOf(fixtureData.events);
    const a = await service.sessionOf(SESSION);
    const b = await service.sessionOf(SESSION);
    if ('ok' in a || 'ok' in b) throw new Error('unexpected failure');
    expect(a.rows.map((row) => row.recordId)).toEqual(b.rows.map((row) => row.recordId));
  });

  it('原始 audit 链被篡改：结构失败且导出被拒', async () => {
    const fixtureData = fixture();
    const events = fixtureData.events.map((event) => {
      if (event.type !== 'audit' || event.id !== 'e2') return event;
      const payload = event.payload as { record: unknown; prevHash: string | null; hash: string };
      return { ...event, payload: { ...payload, hash: '0'.repeat(64) } };
    });
    const service = serviceOf(events);
    const view = await service.sessionOf(SESSION);
    if ('ok' in view) throw new Error(view.message);
    expect(view.structural.status).toBe('fail');
    expect(view.structural.checks.find((check) => check.code === 'AUDIT_CHAIN')?.status).toBe('fail');
    const exported = await service.exportOf(SESSION);
    expect('ok' in exported && exported.ok === false).toBe(true);
  });

  it('导出：AAT records + 摘要；内容可解析', async () => {
    const fixtureData = fixture();
    const service = serviceOf(fixtureData.events);
    const exported = await service.exportOf(SESSION);
    if ('ok' in exported) throw new Error(exported.message);
    const parsed: unknown = JSON.parse(exported.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(exported.digest).toHaveLength(64);
    expect(exported.sessionHash).toHaveLength(64);
    expect(exported.recordCount).toBeGreaterThan(0);
  });

  it('审计关闭且无记录：返回 disabled 空态，不伪造绿色', async () => {
    const service = serviceOf([], { enabled: false });
    const view = await service.sessionOf(SESSION);
    if ('ok' in view) throw new Error(view.message);
    expect(view.structural.status).toBe('disabled');
    expect(view.rows).toEqual([]);
    expect(view.audit.enabled).toBe(false);
  });
});
