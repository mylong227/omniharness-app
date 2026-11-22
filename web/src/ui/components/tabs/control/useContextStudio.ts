// 上下文工作室数据钩子：tab 活跃时取一次，`sessionTick` 推进后重取；不轮询（设计 CR-06）。
//
// 2026-11-22 W5：取数骨架收编进 useSessionResource（票号守卫 / 失败保留旧数据 / 切会话复位
// 全部由核心负责）。本文件只保留业务映射：活跃门控 + RPC 方法。

import * as React from 'react';
import { useApp } from '../../../context.ts';
import { useSessionResource } from '../../../hooks/useSessionResource.ts';
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
  const { api } = useApp();
  const enabled = active && threadId !== null && threadId !== '';
  const load = React.useCallback((): Promise<ContextStudioSnapshotLike> => {
    // enabled 已挡住空会话；这里只是把「调用处必须给 threadId」表达成类型安全的分支。
    if (threadId === null || threadId === '') return Promise.reject(new Error('no-session'));
    return api.context.contextStudio(threadId);
  }, [api, threadId]);
  const { data, loading, error, refresh } = useSessionResource({
    enabled,
    load,
    resetKey: threadId,
  });
  return {
    snapshot: data,
    loading,
    error,
    refresh: () => {
      void refresh();
    },
  };
}
