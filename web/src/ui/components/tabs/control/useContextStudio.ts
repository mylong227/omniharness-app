// 上下文工作室数据钩子：打开时取一次，`sessionTick` 推进后重取；不轮询（设计 CR-06）。

import * as React from 'react';
import { useApp } from '../../../context.ts';
import type { ContextStudioSnapshotLike } from '../../../../types/models.ts';

/** 上下文工作室数据钩子的返回值。 */
export interface UseContextStudioResult {
  /** 最新快照（null = 尚未取得）。 */
  readonly snapshot: ContextStudioSnapshotLike | null;
  /** 加载中。 */
  readonly loading: boolean;
  /** 错误文案（null = 无错误）。 */
  readonly error: string | null;
  /** 手动刷新。 */
  readonly refresh: () => void;
}

/**
 * 上下文工作室数据钩子：tab 活跃或 sessionTick 推进时取一次（不轮询）。
 * @param threadId 当前会话 id（空 / null = 未选会话，不请求）。
 * @param active 上下文 tab 是否活跃。
 * @returns 快照与状态。
 */
export function useContextStudio(threadId: string | null, active: boolean): UseContextStudioResult {
  const { api, sessionTick } = useApp();
  const [snapshot, setSnapshot] = React.useState<ContextStudioSnapshotLike | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const seqRef = React.useRef(0);
  /** 上一次请求的会话（切会话时清掉旧快照，避免短暂串会话）。 */
  const lastThreadRef = React.useRef<string | null>(null);

  const load = React.useCallback((): void => {
    if (threadId === null || threadId === '') return;
    const seq = ++seqRef.current;
    setLoading(true);
    api
      .contextStudio(threadId)
      .then((snapshot) => {
        if (seq !== seqRef.current) return;
        setSnapshot(snapshot);
        setError(null);
      })
      .catch((e: unknown) => {
        if (seq !== seqRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false);
      });
  }, [api, threadId]);

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
      setSnapshot(null);
      setError(null);
    }
    // 只有上下文 tab 活跃才请求：切到编队/凭证时不在后台产生 RPC。
    if (!active) return;
    load();
  }, [load, sessionTick, active, threadId]);

  return { snapshot, loading, error, refresh: load };
}
