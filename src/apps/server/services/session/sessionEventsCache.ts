// 空闲会话事件读档缓存（2026-11-21 批次七 B1，深研 P0 项）：
// kernel `JsonlStorage.load` 是全文件读入 + 逐行 parse——「补拉 300 条」每次都付
// O(整档) IO+parse。本缓存按 threadId 持有最近解析结果（LRU 条数上限 + TTL 双保险）。
//
// 正确性边界（三处显式失效 + TTL 兜底）：
//   · 回退（sessionRewindService.rewind 截断写回后）→ invalidate；
//   · 检查点回滚（sessionCheckpoints.rollback 还原事件流后）→ invalidate；
//   · 回合结束（turnOrchestration.runTurn finally）→ invalidate——运行中的追加不进缓存语义
//     由「回合结束才失效」覆盖：缓存命中只可能发生在空闲期，回合一旦结束立即失效旧帧。
//   · TTL 30s 是任何漏网路径的最后防线（最坏 30s 陈旧，且 threadPage 的消费面是
//     「历史补拉」，旧 30s 内的增量只在运行中出现——运行中走内存不落盘）。

import type { SessionEvent } from '../../../../host/kernel/contracts.ts';

/** 缓存条目上限（LRU；大会话单条可达数 MB，条数封顶即内存封顶）。 */
const CACHE_MAX_ENTRIES = 4;

/** TTL（毫秒）：任何漏网失效路径的最坏陈旧窗口。 */
const CACHE_TTL_MS = 30_000;

const entries = new Map<string, { readonly at: number; readonly events: readonly SessionEvent[] }>();

/**
 * 带缓存的读档：命中（同 threadId 且未过 TTL）直接返回缓存数组，未命中走 loader 并写入。
 * @param threadId 会话 id。
 * @param loader 读档本体（缓存未命中时调用）。
 * @returns 事件数组（时间顺序）。
 */
export async function cachedEventsOf(
  threadId: string,
  loader: () => Promise<readonly SessionEvent[]>,
): Promise<readonly SessionEvent[]> {
  const hit = entries.get(threadId);
  if (hit !== undefined && Date.now() - hit.at < CACHE_TTL_MS) return hit.events;
  const events = await loader();
  entries.set(threadId, { at: Date.now(), events });
  if (entries.size > CACHE_MAX_ENTRIES) {
    const oldest = [...entries.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest !== undefined) entries.delete(oldest);
  }
  return events;
}

/**
 * 失效一条（会话事件流被改写：回退 / 检查点回滚 / 回合结束）。
 * @param threadId 会话 id；缺省失效全部。
 * @returns 无返回值。
 */
export function invalidateEventsCache(threadId?: string): void {
  if (threadId === undefined) {
    entries.clear();
    return;
  }
  entries.delete(threadId);
}

/** 判据辅助：清空全部（测试隔离用）。 */
export function resetEventsCacheForTests(): void {
  entries.clear();
}
