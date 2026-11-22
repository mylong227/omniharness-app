// threads.get 缺省封顶判据（2026-11-20 兼容洞闭合）：无 limit 不再返回全部——
// 大会话全量序列化是 O(N) IO+传输，前端分页本以 300 为页；缺省 500 + hasMore 让
// 「不传 limit」的调用方也走分页语义。
import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';
import { TurnOrchestration } from '../src/apps/server/core/turnOrchestration.ts';
import { resetEventsCacheForTests } from '../src/apps/server/services/session/sessionEventsCache.ts';
import type { ServerServices } from '../src/apps/server/core/serverServices.ts';

/** 造 N 条事件。 */
function eventsOf(n: number): { id: string }[] {
  return Array.from({ length: n }, (_, i) => ({ id: `e${i}` }));
}

beforeEach(() => {
  // 缓存按 threadId 键控，本文件跨用例共用 't'——先清避免上一用例的缓存帧串场。
  resetEventsCacheForTests();
});

/** 最小 services 桩（getThread 只消费 runtime.agent().eventsOf）。 */
function orchOf(events: readonly { id: string }[]): TurnOrchestration {
  return new TurnOrchestration({
    runtime: { agent: () => ({ eventsOf: async () => events }) },
  } as unknown as ServerServices);
}

test('threads.get：无 limit ⇒ 缺省封顶 500 + hasMore（不再无界返回全部）', async () => {
  const r = (await orchOf(eventsOf(1200)).getThread({ threadId: 't' })) as {
    items: { id: string }[];
    hasMore: boolean;
    oldestId?: string;
  };
  assert.equal(r.items.length, 500);
  assert.equal(r.hasMore, true);
  assert.equal(r.items[0]?.id, 'e700', '取最新的 500 条');
  assert.equal(r.oldestId, 'e700');
});

test('threads.get：显式 limit 仍生效；少量事件 hasMore=false', async () => {
  const orch = orchOf(eventsOf(10));
  const r = (await orch.getThread({ threadId: 't', limit: 3 })) as {
    items: { id: string }[];
    hasMore: boolean;
  };
  assert.equal(r.items.length, 3);
  assert.equal(r.hasMore, true);
  const r2 = (await orch.getThread({ threadId: 't' })) as { items: unknown[]; hasMore: boolean };
  assert.equal(r2.items.length, 10);
  assert.equal(r2.hasMore, false, '事件数 < 缺省页大小 ⇒ 无更早页');
});
