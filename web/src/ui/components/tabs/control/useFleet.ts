import { UI_TUNABLES } from '../../../../config/RuntimeConfig.ts';
// 编队数据钩子：2s 轮询（仅 tab 活跃时）+ 迟到响应守卫（设计 CR-05/CR-06）。
//
// 轮询口径（设计 §7.2）：编队允许活跃 tab 下 2s 轮询 `fleet.list`；`document.hidden`
// 或 tab 不活跃时停止。用「请求票号守卫」而不是 AbortController：ApiClient.rpc 不支持
// abort，票号守卫同样保证「迟到响应不覆盖新状态」。
//
// 2026-11-22 W5：取数骨架收编进 useSessionResource（pollMs/cacheTtlMs/resetKey +
// keepDataWhenDisabled 覆盖了「活跃轮询 / 30s 缓存 / 切会话复位 / 不活跃保留旧快照」）。
// 本文件只保留业务映射与「已过期」读数。

import * as React from 'react';
import { useApp } from '../../../context.ts';
import { useNow } from '../../../hooks/useNow.ts';
import { useSessionResource } from '../../../hooks/useSessionResource.ts';
import type { FleetSnapshotLike } from '../../../../types/models.ts';

/** 轮询间隔（毫秒）。 */
const POLL_MS = UI_TUNABLES.fleetPollMs;

/** 同会话快照缓存有效期（毫秒；过期才重发请求）。 */
const CACHE_TTL_MS = UI_TUNABLES.fleetCacheTtlMs;

/** 「已过期」读数刷新间隔（毫秒；不驱动 RPC）。 */
const STALE_TICK_MS = UI_TUNABLES.fleetStaleTickMs;

/** 编队数据钩子的返回值。 */
export interface UseFleetResult {
  /** 最新快照（null = 尚未取得）。 */
  readonly snapshot: FleetSnapshotLike | null;
  /** 加载中（首个请求未返回）。 */
  readonly loading: boolean;
  /** 错误文案（null = 无错误）。 */
  readonly error: string | null;
  /** 快照采集时刻距现在的毫秒数（供「已过期」标注）。 */
  readonly staleMs: number;
  /** 手动刷新。 */
  readonly refresh: () => void;
}

/**
 * 编队数据钩子：活跃时轮询，不活跃时静默保留旧快照。
 * @param threadId 当前会话 id（空 / null = 未选会话，不请求）。
 * @param active 编队 tab 是否活跃。
 * @returns 快照与状态。
 */
export function useFleet(threadId: string | null, active: boolean): UseFleetResult {
  const { api } = useApp();
  const enabled = threadId !== null && threadId !== '' && active;
  const load = React.useCallback((): Promise<FleetSnapshotLike> => {
    // enabled 已挡住空会话；这里只是把「调用处必须给 threadId」表达成类型安全的分支。
    if (threadId === null || threadId === '') return Promise.reject(new Error('no-session'));
    return api.fleet.fleetList(threadId);
  }, [api, threadId]);
  const { data, loading, error, updatedAt, refresh } = useSessionResource({
    enabled,
    load,
    resetKey: threadId,
    pollMs: POLL_MS,
    cacheTtlMs: CACHE_TTL_MS,
    // tab 不活跃 ≠ 没有会话：切走再切回先显示旧快照（原实现的「静默保留」口径）。
    keepDataWhenDisabled: true,
  });

  /** 「已过期」标注用的当前时刻（低频跳动，不驱动轮询）：useNow 收编（2026-11-17 review）。 */
  const tick = useNow(active, STALE_TICK_MS);
  /**
   * 新快照落地时 updatedAt 即当前时刻，用它把时钟顶到当前——
   * 否则 collectedAt 缺失的快照会立刻被标成最长 30s 的「已过期」。
   */
  const nowTick = Math.max(tick, updatedAt);
  const staleMs =
    data === null
      ? 0
      : Math.max(0, nowTick - Date.parse(data.collectedAt || String(updatedAt)));

  return {
    snapshot: data,
    loading,
    error,
    staleMs,
    refresh: () => {
      void refresh();
    },
  };
}
