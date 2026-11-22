// 决策账本数据钩子：会话视图 + 按需详情（两流各自「后发必胜」）。
//
// 2026-11-22 W5：两条流收编进 useSessionResource——视图跟 sessionTick + 切会话复位；
// 详情 followTick=false、按选中记录取数、切记录/切会话即复位。原实现的两套 seq ref
// 与两段 effect 复位逻辑删除，静默刷新（refreshing）由核心提供。

import * as React from 'react';
import { useApp } from '../../../context.ts';
import { t } from '../../../i18n/i18n.ts';
import { useSessionResource } from '../../../hooks/useSessionResource.ts';
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
  const { api } = useApp();
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);
  const enabled = threadId !== null && threadId !== '';

  /** 视图取数：失败结果统一转异常，交给核心的 error 通道。 */
  const loadView = React.useCallback(async (): Promise<DecisionSessionViewLike> => {
    if (threadId === null || threadId === '') throw new Error('no-session');
    const result = await api.decision.decisionSession(threadId);
    if (isFailure(result)) throw new Error(result.message);
    return result;
  }, [api, threadId]);
  const view = useSessionResource({
    enabled,
    load: loadView,
    resetKey: threadId,
  });

  // 会话切换：选中记录属于上一个会话，必须清掉（详情流随之禁用）。
  React.useEffect(() => {
    setSelectedRecordId(null);
  }, [threadId]);

  // 视图刷新后选中记录可能已不在账本里：主动清空，避免详情指向消失的行。
  React.useEffect(() => {
    const data = view.data;
    if (data === null) return;
    setSelectedRecordId((current) => {
      if (current === null) return null;
      return data.rows.some((row) => row.recordId === current) ? current : null;
    });
  }, [view.data]);

  /** 详情取数：同样把失败结果转异常。 */
  const loadDetail = React.useCallback(async (): Promise<DecisionDetailViewLike> => {
    if (threadId === null || threadId === '' || selectedRecordId === null) {
      throw new Error('no-record');
    }
    const result = await api.decision.decisionDetail(threadId, selectedRecordId);
    if (isFailure(result)) throw new Error(result.message);
    return result;
  }, [api, threadId, selectedRecordId]);
  const detail = useSessionResource({
    enabled: enabled && selectedRecordId !== null,
    load: loadDetail,
    followTick: false,
    // 记录或会话一变就复位：旧详情不得挂在新选择上。
    resetKey: selectedRecordId === null ? null : `${threadId ?? ''}:${selectedRecordId}`,
  });

  const selectRecord = React.useCallback((recordId: string): void => {
    setSelectedRecordId(recordId === '' ? null : recordId);
  }, []);

  const exportEvidence = React.useCallback(async (): Promise<DecisionExportResultLike | string> => {
    if (threadId === null || threadId === '') return t('先选择一个会话，再导出 AAT。');
    try {
      const result = await api.decision.decisionExport(threadId);
      return isFailure(result) ? result.message : result;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [api, threadId]);

  const configure = React.useCallback(
    async (enabledFlag: boolean, principal: string | undefined): Promise<DecisionSettingsLike | string> => {
      try {
        const result = await api.decision.decisionConfigure(enabledFlag, principal);
        if ('ok' in result && result.ok === false) return result.message;
        if (!('settings' in result)) return t('保存失败：服务端未返回设置。');
        void view.refresh();
        return result.settings;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [api, view],
  );

  return {
    view: view.data,
    loading: view.loading,
    refreshing: view.refreshing,
    error: view.error,
    selectedRecordId,
    detail: detail.data,
    detailLoading: detail.loading,
    detailError: detail.error,
    selectRecord,
    refresh: () => {
      void view.refresh();
    },
    exportEvidence,
    configure,
  };
}
