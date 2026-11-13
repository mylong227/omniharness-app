import * as React from 'react';
import { useApp } from '../../../context.ts';
import type {
  DecisionDetailViewLike,
  DecisionExportResultLike,
  DecisionFailureLike,
  DecisionResultLike,
  DecisionSessionViewLike,
  DecisionSettingsLike,
} from '../../../../types/models.ts';

/** 判别失败守卫（`ok:false`）。 */
function isFailure<T>(result: DecisionResultLike<T>): result is DecisionFailureLike {
  return (result as { ok?: unknown }).ok === false;
}

/** 决策账本 hook 的返回值。 */
export interface UseDecisionLedgerResult {
  /** 会话视图（null = 尚未取得）。 */
  readonly view: DecisionSessionViewLike | null;
  /** 首次加载中。 */
  readonly loading: boolean;
  /** 刷新中（保留旧数据）。 */
  readonly refreshing: boolean;
  /** 视图错误。 */
  readonly error: string | null;
  /** 当前选中记录 id。 */
  readonly selectedRecordId: string | null;
  /** 选中记录详情。 */
  readonly detail: DecisionDetailViewLike | null;
  /** 详情加载中。 */
  readonly detailLoading: boolean;
  /** 详情错误。 */
  readonly detailError: string | null;
  /** 选择记录（空串清空）。 */
  readonly selectRecord: (recordId: string) => void;
  /** 刷新会话视图。 */
  readonly refresh: () => void;
  /** 导出 AAT（返回结果或失败文案）。 */
  readonly exportEvidence: () => Promise<DecisionExportResultLike | string>;
  /** 保存审计设置（返回设置或失败文案）。 */
  readonly configure: (enabled: boolean, principal: string | undefined) => Promise<DecisionSettingsLike | string>;
}

/**
 * 决策账本数据钩子：会话视图 + 按需详情。
 * @param threadId 当前会话 id（null / 空 = 未选会话）。
 * @returns 视图、详情与动作。
 */
export function useDecisionLedger(threadId: string | null): UseDecisionLedgerResult {
  const { api, sessionTick } = useApp();
  const [view, setView] = React.useState<DecisionSessionViewLike | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<DecisionDetailViewLike | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const seqRef = React.useRef(0);
  const detailSeqRef = React.useRef(0);
  const lastThreadRef = React.useRef<string | null>(null);

  const load = React.useCallback(
    (quiet: boolean): void => {
      if (threadId === null || threadId === '') return;
      const seq = ++seqRef.current;
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError(null);
      api
        .decisionSession(threadId)
        .then((result) => {
          if (seq !== seqRef.current) return;
          if (isFailure(result)) {
            setError(result.message);
            setView(null);
            return;
          }
          setView(result);
          setSelectedRecordId((current) => {
            if (current === null) return null;
            return result.rows.some((row) => row.recordId === current) ? current : null;
          });
        })
        .catch((e: unknown) => {
          if (seq !== seqRef.current) return;
          setError(e instanceof Error ? e.message : String(e));
          setView(null);
        })
        .finally(() => {
          if (seq !== seqRef.current) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [api, threadId],
  );

  React.useEffect(() => {
    if (threadId === null || threadId === '') {
      lastThreadRef.current = null;
      setView(null);
      setError(null);
      setSelectedRecordId(null);
      setDetail(null);
      setDetailError(null);
      setLoading(false);
      return;
    }
    if (lastThreadRef.current !== threadId) {
      lastThreadRef.current = threadId;
      setView(null);
      setSelectedRecordId(null);
      setDetail(null);
      setDetailError(null);
      setError(null);
    }
    load(false);
  }, [load, sessionTick, threadId]);

  const selectRecord = React.useCallback(
    (recordId: string): void => {
      if (threadId === null || threadId === '') return;
      if (recordId === '') {
        setSelectedRecordId(null);
        setDetail(null);
        setDetailError(null);
        return;
      }
      setSelectedRecordId(recordId);
      setDetail(null);
      setDetailError(null);
      const seq = ++detailSeqRef.current;
      setDetailLoading(true);
      api
        .decisionDetail(threadId, recordId)
        .then((result) => {
          if (seq !== detailSeqRef.current) return;
          if (isFailure(result)) {
            setDetailError(result.message);
            return;
          }
          setDetail(result);
        })
        .catch((e: unknown) => {
          if (seq !== detailSeqRef.current) return;
          setDetailError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (seq === detailSeqRef.current) setDetailLoading(false);
        });
    },
    [api, threadId],
  );

  const exportEvidence = React.useCallback(async (): Promise<DecisionExportResultLike | string> => {
    if (threadId === null || threadId === '') return '先选择一个会话，再导出 AAT。';
    try {
      const result = await api.decisionExport(threadId);
      return isFailure(result) ? result.message : result;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [api, threadId]);

  const configure = React.useCallback(
    async (enabled: boolean, principal: string | undefined): Promise<DecisionSettingsLike | string> => {
      try {
        const result = await api.decisionConfigure(enabled, principal);
        if ('ok' in result && result.ok === false) return result.message;
        if (!('settings' in result)) return '保存失败：服务端未返回设置。';
        load(true);
        return result.settings;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [api, load],
  );

  return {
    view,
    loading,
    refreshing,
    error,
    selectedRecordId,
    detail,
    detailLoading,
    detailError,
    selectRecord,
    refresh: () => load(true),
    exportEvidence,
    configure,
  };
}
