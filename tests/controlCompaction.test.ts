import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';
import { ContextCompactionService } from '../src/apps/server/services/context/contextCompactionService.ts';
import { CompactionMarkerReader } from '../src/host/extensions/kernel/context/compactionMarkerReader.ts';

/** 构造一条最小事件。 */
function event(index: number, type: SessionEvent['type'], content: string): SessionEvent {
  return {
    id: `evt_${String(index)}`,
    sessionId: 'sess_compact',
    type,
    timestamp: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    seq: index + 1,
    payload: { content },
  };
}

/** 两条长回合，确保 force 压缩有可折叠历史。 */
const EVENTS: readonly SessionEvent[] = [
  event(0, 'user', '目标：实现一个很长的功能。'.repeat(30)),
  event(1, 'assistant', '已完成第一步。'.repeat(40)),
  event(2, 'user', '继续实现第二步。'.repeat(30)),
  event(3, 'assistant', '第二步完成。'.repeat(40)),
];

test('ContextCompactionService：强制压缩写回可解码的 OMNI_COMPACTION_V1 游标', async () => {
  let saved: readonly SessionEvent[] = [];
  const service = new ContextCompactionService({
    events: () => Promise.resolve(EVENTS),
    save: (_id, events) => {
      saved = events;
      return Promise.resolve();
    },
    isRunning: () => false,
    fragments: () => [],
    tools: () => [],
    windowTokens: () => 128_000,
    maxTokens: 10,
    keepRecent: 1,
  });
  const result = await service.compactOf('sess_compact');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(saved.length, EVENTS.length + 1);
  const last = saved[saved.length - 1]!;
  assert.equal(last.type, 'system');
  const content = (last.payload as { content: string }).content;
  const decoded = CompactionMarkerReader.decode(content);
  assert.ok(decoded !== undefined);
  assert.equal(decoded?.compactedUpTo, result.compactedUpTo);
  assert.ok((decoded?.summary.length ?? 0) > 0);
});

test('ContextCompactionService：运行中会话拒绝手动压缩', async () => {
  const service = new ContextCompactionService({
    events: () => Promise.resolve(EVENTS),
    save: () => Promise.resolve(),
    isRunning: () => true,
    fragments: () => [],
    tools: () => [],
    windowTokens: () => 128_000,
  });
  const result = await service.compactOf('sess_compact');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'session_running');
});
