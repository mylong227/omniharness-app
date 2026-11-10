// 凭证数据钩子：打开取回合列表；选中回合后显式构造证书（复核/导出由用户触发，不自动生成大包）。

import * as React from 'react';
import { useApp } from '../../../context.ts';
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
  const seqRef = React.useRef(0);
  /** 上一次请求的会话（切会话时清掉旧回合 / 选中 / 证书）。 */
  const lastThreadRef = React.useRef<string | null>(null);

  const loadTurns = React.useCallback((): void => {
    if (threadId === null || threadId === '') return;
    const seq = ++seqRef.current;
    setLoadingTurns(true);
    api
      .proofTurns(threadId)
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
        setTurnsError(e instanceof Error ? e.message : String(e));
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
      const seq = ++seqRef.current;
      setBuilding(true);
      setBuildError(null);
      api
        .proofBuild(threadId, turnIndex)
        .then((result) => {
          if (seq !== seqRef.current) return;
          if (isFailure(result)) {
            setBuildError(result.message);
            setBundle(null);
          } else {
            setBundle(result);
          }
        })
        .catch((e: unknown) => {
          if (seq !== seqRef.current) return;
          setBuildError(e instanceof Error ? e.message : String(e));
          setBundle(null);
        })
        .finally(() => {
          if (seq === seqRef.current) setBuilding(false);
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
      return '先选择一个回合，再导出证据包。';
    }
    try {
      const result = await api.proofExport(threadId, selectedTurn);
      if (isFailure(result)) return result.message;
      return result;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
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
