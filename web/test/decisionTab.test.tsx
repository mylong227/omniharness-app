// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppContext, type AppContextValue } from '../src/ui/context.ts';
import { DecisionTab } from '../src/ui/components/tabs/DecisionTab.tsx';
import type {
  DecisionDetailViewLike,
  DecisionSessionViewLike,
} from '../src/types/models.ts';

const ROW = {
  recordId: 'aat_demo_2',
  turnIndex: 0,
  displayIndex: 1,
  at: '2026-11-11T10:00:01.000Z',
  toolName: 'write_file',
  result: 'allow' as const,
  disposition: 'allowed_by_conformal' as const,
  basis: 'conformal' as const,
  effectClass: 'STATE_MUTATING' as const,
  riskScore: 0.122,
  threshold: 0.18,
  authorizationId: 'auth_demo',
};

const VIEW: DecisionSessionViewLike = {
  sessionId: 'sess_demo',
  audit: { enabled: true, configuredPrincipal: 'local:test' },
  coverage: { turnsTotal: 1, turnsRecorded: 1, partial: false },
  counts: { records: 8, decisions: 1, allow: 1, escalate: 0, deny: 0, conformal: 1 },
  turns: [
    {
      turnIndex: 0,
      displayIndex: 1,
      startedAt: '2026-11-11T10:00:00.000Z',
      endedAt: '2026-11-11T10:00:05.000Z',
      decisions: 1,
    },
  ],
  rows: [ROW],
  structural: {
    status: 'pass',
    checks: [
      { code: 'AUDIT_CHAIN', status: 'pass', detail: '原始审计链 4 条连续。' },
      { code: 'AAT_CHAIN', status: 'pass', detail: 'AAT 链 8 条一致。' },
    ],
    auditCount: 4,
    aatCount: 8,
    problems: [],
  },
  conformal: {
    status: 'not_applicable',
    checkedDecisions: 0,
    snapshots: 0,
    checks: [],
    problems: [],
  },
  boundary: { signed: false, trustLevel: 'L0', argsIncluded: false, draft: 'AAT-09-subset' },
  truncated: false,
  generatedAt: '2026-11-11T10:00:06.000Z',
};

const DETAIL: DecisionDetailViewLike = {
  row: ROW,
  decision: {
    decisionId: 'dec_demo',
    requestDigest: 'c'.repeat(64),
    policySnapshotHash: 'b'.repeat(64),
    result: 'allow',
    defaultApplied: 'allow',
    failClosed: false,
    evaluatorId: 'ask+conformal',
    authorizationId: 'auth_demo',
    principal: 'local:test',
  },
  policy: {
    snapshotHash: 'b'.repeat(64),
    rules: [{ ruleId: 'approval', ruleVersion: '1', digest: 'a'.repeat(64) }],
  },
  approvals: [],
  authorization: { id: 'auth_demo', reused: false },
  conformal: {
    alpha: 0.02,
    threshold: 0.18,
    riskScore: 0.122,
    effectClass: 'STATE_MUTATING',
    calibrationDigest: 'd'.repeat(64),
    classDigest: 'e'.repeat(64),
    calibrationSnapshotId: 'f'.repeat(64),
    unitCount: 214,
    riskFeatures: {
      toolName: 'write_file',
      argKeys: 2,
      intentKind: 'write',
      intentRisk: 'medium',
      mutating: true,
    },
    riskModelDigest: '1'.repeat(64),
  },
  chain: {
    recordId: 'aat_demo_2',
    sequenceNumber: 2,
    prevHash: '2'.repeat(64),
    hash: '3'.repeat(64),
  },
  toolCall: { at: '2026-11-11T10:00:02.000Z', toolName: 'write_file', parametersHash: '4'.repeat(64) },
  toolResult: { at: '2026-11-11T10:00:02.200Z', ok: true, durationMs: 196 },
  neighbors: { previousRecordId: 'aat_demo_1', nextRecordId: 'aat_demo_3' },
};

/** 最小 App 上下文：只实现面板实际调用的 API。 */
function contextOf(): AppContextValue {
  const api = {
    decisionSession: () => Promise.resolve(VIEW),
    decisionDetail: () => Promise.resolve(DETAIL),
    decisionExport: () => Promise.resolve({ ok: false, code: 'export_blocked', message: 'test' }),
    decisionConfigure: () => Promise.resolve({ ok: false, code: 'config_write_failed', message: 'test' }),
  } as unknown as AppContextValue['api'];
  return {
    api,
    toast: () => {},
    dialog: {} as AppContextValue['dialog'],
    sessionId: 'sess_demo',
    sessionTick: 0,
  };
}

afterEach(cleanup);

describe('DecisionTab', () => {
  it('渲染摘要 + 决策行；点击行后显示「为什么」与策略快照', async () => {
    render(
      <AppContext.Provider value={contextOf()}>
        <DecisionTab threadId="sess_demo" />
      </AppContext.Provider>,
    );
    expect(await screen.findByText('write_file')).toBeTruthy();
    expect(screen.getByText('决策审计已开启')).toBeTruthy();
    expect(screen.getAllByText('共形放行').length).toBeGreaterThan(0);
    const row = screen.getByRole('button', { name: /write_file/ });
    fireEvent.click(row);
    expect(await screen.findByText('为什么')).toBeTruthy();
    expect(screen.getByText('策略快照')).toBeTruthy();
    expect(screen.getByText(/argKeys 2/)).toBeTruthy();
  });

  it('未选会话时给可读空态，不请求会话数据', () => {
    render(
      <AppContext.Provider value={contextOf()}>
        <DecisionTab threadId={null} />
      </AppContext.Provider>,
    );
    expect(screen.getByText('先选择一个会话，再打开决策账本')).toBeTruthy();
  });
});
