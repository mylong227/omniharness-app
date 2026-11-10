import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';
import { ContextStudioService } from '../src/apps/server/services/context/contextStudioService.ts';
import type { ContextUsageReport } from '../src/apps/server/services/contextUsageService.ts';

/** 构造一条最小事件。 */
function event(index: number, type: SessionEvent['type'], payload: unknown = {}): SessionEvent {
  return {
    id: `evt_${String(index)}`,
    sessionId: 'sess_test',
    type,
    timestamp: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    payload,
  };
}

/** 一份最小、形状完整的用量报告。 */
const REPORT: ContextUsageReport = {
  threadId: 'sess_test',
  windowTokens: 128_000,
  usedTokens: 41_000,
  percent: 32,
  rows: [],
  mcpToolCount: 0,
  systemToolCount: 0,
  source: 'measured',
  cache: {
    promptTokens: 0,
    cachedPromptTokens: 0,
    calls: 0,
    lastCall: {
      cause: 'not-reported',
      reason: 'not reported',
      evidence: {},
      promptTokens: 0,
      cachedPromptTokens: 0,
    },
  },
  collectedAt: new Date(0).toISOString(),
};

/** 构造服务（事件与用量固定）。 */
function serviceOf(events: readonly SessionEvent[]): ContextStudioService {
  return new ContextStudioService({
    usage: () => Promise.resolve(REPORT),
    events: () => Promise.resolve(events),
  });
}

test('ContextStudioService：解码 OMNI_COMPACTION_V1 游标并如实标记未记录审计', async () => {
  const marker = 'OMNI_COMPACTION_V1 upTo=155 hash=abc123\n## 摘要\n已改文件：a.ts';
  const snapshot = await serviceOf([
    event(0, 'user', { content: 'first' }),
    event(1, 'system', { content: marker }),
  ]).snapshotOf('sess_test');
  assert.equal(snapshot.compactions.length, 1);
  assert.equal(snapshot.compactions[0]?.compactedUpTo, 155);
  assert.equal(snapshot.compactions[0]?.headHash, 'abc123');
  assert.match(snapshot.compactions[0]?.summary ?? '', /已改文件/u);
  assert.equal(snapshot.compactions[0]?.turnIndex, 0);
  assert.equal(snapshot.compactions[0]?.auditRecorded, false);
  assert.equal(snapshot.handoffAvailable, false);
});

test('ContextStudioService：坏 marker 不当作压缩记录，避免“坏数据=无压缩”混淆', async () => {
  const snapshot = await serviceOf([
    event(0, 'system', { content: 'OMNI_COMPACTION_V1 upTo=bad hash=zzz\n摘要' }),
  ]).snapshotOf('sess_test');
  assert.equal(snapshot.compactions.length, 0);
});

test('ContextStudioService：事件流不可读返回快照级错误，不伪装成「尚未压缩」', async () => {
  const service = new ContextStudioService({
    usage: () => Promise.resolve(REPORT),
    events: () => Promise.reject(new Error('archive broken')),
  });
  const snapshot = await service.snapshotOf('sess_test');
  assert.match(snapshot.error ?? '', /archive broken/u);
  assert.deepEqual(snapshot.compactions, []);
});

test('ContextStudioService：空会话不触发事件回放，返回空压缩记录', async () => {
  let read = 0;
  const service = new ContextStudioService({
    usage: () => Promise.resolve(REPORT),
    events: () => {
      read += 1;
      return Promise.resolve([]);
    },
  });
  const snapshot = await service.snapshotOf('');
  assert.equal(read, 0);
  assert.deepEqual(snapshot.compactions, []);
});
