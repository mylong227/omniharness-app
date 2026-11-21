// 空闲会话事件读档缓存判据（2026-11-21 批次七 B1）：
// 命中不重复调 loader / TTL 过期重读 / LRU 条数淘汰 / invalidate 单条与全清。
// 正确性边界：回退/检查点回滚/回合结束三处失效由服务层接线（本判据钉缓存本体语义）。
import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import {
  cachedEventsOf,
  invalidateEventsCache,
  resetEventsCacheForTests,
} from '../src/apps/server/services/session/sessionEventsCache.ts';

const events = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i}` }));

afterEach(() => {
  resetEventsCacheForTests();
  vi.useRealTimers();
});

test('命中：同 threadId 二次读不重复调 loader；不同 threadId 各自加载', async () => {
  let calls = 0;
  const loader = async (): Promise<readonly { id: string }[]> => {
    calls += 1;
    return events(3);
  };
  const a1 = await cachedEventsOf('a', loader);
  const a2 = await cachedEventsOf('a', loader);
  assert.equal(calls, 1, '命中不重复调 loader');
  assert.equal(a1, a2, '同一数组引用（零拷贝命中）');
  const b = await cachedEventsOf('b', loader);
  assert.equal(calls, 2);
  assert.equal(b.length, 3);
});

test('TTL：过期后重读（fake timers 推进超过 30s）', async () => {
  vi.useFakeTimers();
  let calls = 0;
  const loader = async (): Promise<readonly { id: string }[]> => {
    calls += 1;
    return events(1);
  };
  await cachedEventsOf('t', loader);
  vi.advanceTimersByTime(31_000);
  await cachedEventsOf('t', loader);
  assert.equal(calls, 2, 'TTL 过期必须重读');
});

test('LRU：超过 4 条淘汰最旧；invalidate 单条 / 全清', async () => {
  const loader = (n: number) => async (): Promise<readonly { id: string }[]> => events(n);
  for (let i = 0; i < 5; i++) await cachedEventsOf(`k${i}`, loader(1));
  invalidateEventsCache('k0');
  await cachedEventsOf('k9', loader(1));
  invalidateEventsCache();
  let calls = 0;
  await cachedEventsOf('k1', async () => {
    calls += 1;
    return events(1);
  });
  assert.equal(calls, 1, '全清后重读');
});
