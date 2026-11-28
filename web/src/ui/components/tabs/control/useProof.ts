// 凭证数据钩子：打开取回合列表；选中回合后显式构造证书（复核/导出由用户触发，不自动生成大包）。

import { errorMessageOf } from '../../../../core/errorText.ts';
import * as React from 'react';
import { useApp } from '../../../context.ts';
import { t } from '../../../i18n/i18n.ts';
import type {
  ProofBundleViewLike,
  ProofExportResultLike,
  ProofResult,
  ProofTurnSummaryLike,
} from '../../../../types/models.ts';

/** 判别失败守卫：`ok:false` 的返回值收敛为服务端判别失败。 */
function isFailure<T>(result: ProofResult<T>): result is import('../../../../types/models.ts').ProofFailureLike {
  return (result as { ok?: unknown }).ok === false;
}

/** 凭证数据钩子的返回值。 */
export interface UseProofResult {
  /** 回合列表（null = 尚未取得）。 */
  readonly turns: readonly ProofTurnSummaryLike[] | null;
  /** 当前选中回合下标（null = 未选）。 */
  readonly selectedTurn: number | null;
  /** 选中回合的凭证视图（null = 未构造 / 失败）。 */
  readonly bundle: ProofBundleViewLike | null;
  /** 回合列表加载中。 */
  readonly loadingTurns: boolean;
  /** 证书构造中。 */
  readonly building: boolean;
  /** 回合列表错误文案。 */
  readonly turnsError: string | null;
  /** 证书构造失败文案（含判别失败的 code 语义）。 */
  readonly buildError: string | null;
  /** 选择回合（触发证书构造）。 */
  readonly selectTurn: (turnIndex: number) => void;
  /** 导出当前回合证据包（返回导出结果或失败文案）。 */
  readonly exportTurn: () => Promise<ProofExportResultLike | string>;
  /** 刷新回合列表。 */
  readonly refreshTurns: () => void;
}

/**
 * 凭证数据钩子：回合列表 + 按需证书构造。
 * @param threadId 当前会话 id（空 / null = 未选会话）。
 * @param active 凭证 tab 是否活跃。
 * @returns 回合与凭证状态。
 */
export function useProof(threadId: string | null, active: boolean): UseProofResult {
  const { api, sessionTick } = useApp();
  const [turns, setTurns] = React.useState<readonly ProofTurnSummaryLike[] | null>(null);
  const [selectedTurn, setSelectedTurn] = React.useState<number | null>(null);
  const [bundle, setBundle] = React.useState<ProofBundleViewLike | null>(null);
  const [loadingTurns, setLoadingTurns] = React.useState(false);
  const [building, setBuilding] = React.useState(false);
  const [turnsError, setTurnsError] = React.useState<string | null>(null);
  const [buildError, setBuildError] = React.useState<string | null>(null);
  // 两条异步流各用一本序号账（与 useDecisionLedger 的 seqRef/detailSeqRef 同形）：
  // 此前共用一个 seqRef，活跃回合里 sessionTick 每 300ms 触发 loadTurns 重跑，用户此刻点回合行
  // 触发 build 会把序号顶掉——loadTurns 的 then/finally 全部被守卫短路，loadingTurns 永久卡在
  // true（骨架屏挂死到下一次 tick 重拉才自愈）。2026-11-17 全面 review 修复。
  const seqRef = React.useRef(0);
  const buildSeqRef = React.useRef(0);
  /** 上一次请求的会话（切会话时清掉旧回合 / 选中 / 证书）。 */
  const lastThreadRef = React.useRef<string | null>(null);

  const loadTurns = React.useCallback((): void => {
    if (threadId === null || threadId === '') return;
    const seq = ++seqRef.current;
    setLoadingTurns(true);
    api
      .proof.proofTurns(threadId)
      .then((result) => {
        if (seq !== seqRef.current) return;
        if (isFailure(result)) {
          setTurnsError(result.message);
          setTurns(null);
        } else {
          setTurnsError(null);
          setTurns(result);
        }
      })
      .catch((e: unknown) => {
        if (seq !== seqRef.current) return;
        setTurnsError(errorMessageOf(e));
        setTurns(null);
      })
      .finally(() => {
        if (seq === seqRef.current) setLoadingTurns(false);
      });
  }, [api, threadId]);

  React.useEffect(() => {
    if (threadId === null || threadId === '') {
      lastThreadRef.current = null;
      setTurns(null);
      setBundle(null);
      setSelectedTurn(null);
      setTurnsError(null);
      setBuildError(null);
      setLoadingTurns(false);
      return;
    }
    if (lastThreadRef.current !== threadId) {
      lastThreadRef.current = threadId;
      setTurns(null);
      setBundle(null);
      setSelectedTurn(null);
      setTurnsError(null);
      setBuildError(null);
    }
    if (!active) return;
    loadTurns();
  }, [loadTurns, sessionTick, active, threadId]);

  const build = React.useCallback(
    (turnIndex: number): void => {
      if (threadId === null || threadId === '') return;
      const seq = ++buildSeqRef.current;
      setBuilding(true);
      setBuildError(null);
      api
        .proof.proofBuild(threadId, turnIndex)
        .then((result) => {
          if (seq !== buildSeqRef.current) return;
          if (isFailure(result)) {
            setBuildError(result.message);
            setBundle(null);
          } else {
            setBundle(result);
          }
        })
        .catch((e: unknown) => {
          if (seq !== buildSeqRef.current) return;
          setBuildError(errorMessageOf(e));
          setBundle(null);
        })
        .finally(() => {
          if (seq === buildSeqRef.current) setBuilding(false);
        });
    },
    [api, threadId],
  );

  const selectTurn = React.useCallback(
    (turnIndex: number): void => {
      setSelectedTurn(turnIndex);
      setBundle(null);
      build(turnIndex);
    },
    [build],
  );

  const exportTurn = React.useCallback(async (): Promise<ProofExportResultLike | string> => {
    if (threadId === null || threadId === '' || selectedTurn === null) {
      return t('先选择一个回合，再导出证据包。');
    }
    try {
      const result = await api.proof.proofExport(threadId, selectedTurn);
      if (isFailure(result)) return result.message;
      return result;
    } catch (e) {
      return errorMessageOf(e);
    }
  }, [api, threadId, selectedTurn]);

  return {
    turns,
    selectedTurn,
    bundle,
    loadingTurns,
    building,
    turnsError,
    buildError,
    selectTurn,
    exportTurn,
    refreshTurns: loadTurns,
  };
}
