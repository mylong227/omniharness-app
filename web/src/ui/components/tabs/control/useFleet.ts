// 编队数据钩子：2s 轮询（仅 tab 活跃时）+ 迟到响应守卫（设计 CR-05/CR-06）。
//
// 轮询口径（设计 §7.2）：编队允许活跃 tab 下 2s 轮询 `fleet.list`；`document.hidden`
// 或 tab 不活跃时停止。用「请求序号守卫」而不是 AbortController：ApiClient.rpc 不支持
// abort，序号守卫同样保证「迟到响应不覆盖新状态」。

import * as React from 'react';
import { useApp } from '../../../context.ts';
import type { FleetSnapshotLike } from '../../../../types/models.ts';

/** 轮询间隔（毫秒）。 */
const POLL_MS = 2_000;

/** 同会话快照缓存有效期（毫秒；过期才重发请求）。 */
const CACHE_TTL_MS = 30_000;

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
  const { api, sessionTick } = useApp();
  const [snapshot, setSnapshot] = React.useState<FleetSnapshotLike | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** 请求序号守卫：只让最新请求的结果落地。 */
  const seqRef = React.useRef(0);
  /** 上次成功请求的时刻（缓存窗口起点）。 */
  const fetchedAtRef = React.useRef(0);
  /** 上一次请求的会话（切会话时清空旧快照与缓存窗口）。 */
  const lastThreadRef = React.useRef<string | null>(null);
  /** 「已过期」标注用的当前时刻（低频跳动，不驱动轮询）。 */
  const [nowTick, setNowTick] = React.useState(() => Date.now());

  const load = React.useCallback((): void => {
    if (threadId === null || threadId === '') return;
    const seq = ++seqRef.current;
    setLoading(true);
    api
      .fleetList(threadId)
      .then((snapshot) => {
        if (seq !== seqRef.current) return;
        fetchedAtRef.current = Date.now();
        setSnapshot(snapshot);
        setError(null);
        setNowTick(Date.now());
      })
      .catch((e: unknown) => {
        if (seq !== seqRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false);
      });
  }, [api, threadId]);

  // 首次进入 / 会话切换 / 版本号推进：超过缓存窗口才真正发请求。
  React.useEffect(() => {
    if (threadId === null || threadId === '') {
      lastThreadRef.current = null;
      setSnapshot(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (lastThreadRef.current !== threadId) {
      lastThreadRef.current = threadId;
      fetchedAtRef.current = 0;
      setSnapshot(null);
      setError(null);
    }
    if (!active) return;
    if (Date.now() - fetchedAtRef.current > CACHE_TTL_MS) load();
  }, [active, load, sessionTick, threadId]);

  // 活跃时 2s 轮询；不活跃 / 页面隐藏时停（CR-06：后台不产生持续 RPC）。
  React.useEffect(() => {
    if (!active || threadId === null || threadId === '') return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, load, threadId]);

  // 「已过期」标注的低频时钟：30s 一次，避免高频重渲染。
  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [active]);

  const staleMs =
    snapshot === null ? 0 : Math.max(0, nowTick - Date.parse(snapshot.collectedAt || String(fetchedAtRef.current)));

  return { snapshot, loading, error, staleMs, refresh: load };
}
