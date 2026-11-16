// 会话面板资源取数钩子（2026-11-17 全面 review 抽取）。
//
// 「useCallback 取数 + seq 竞态守卫 + effect 跟随 sessionTick」这套骨架此前在十个面板里
// 各拷一份，其中六份（TraceTab / AuditTab / GovernanceTab / VaultTab / DiagnosticsTab /
// AutomationsTab）**没有守卫**：快速切会话时，A 会话的迟到响应会覆盖 B 会话的数据
// （跨会话串数据）；sessionTick 高频重入时晚到的旧帧还会把新数据回滚。本钩子单源实现
// 守卫语义，六个面板全部收编；已带守卫的 useDecisionLedger / useContextStudio / useFleet
// 形状更丰富（quiet / 多流），保持原样不强行套壳。
//
// 取数纪律：
//   · enabled=false（未选会话等）不发请求，并清空状态、弃掉在飞响应；
//   · 每次请求带序号，晚到响应按序号弃掉（后发必胜）；
//   · load 身份变化（参数变了）或 sessionTick 变化即重取；
//   · 刷新失败**保留已渲染数据**：tick 高频重入，一次瞬时失败就把面板打回错误页、
//     下一次 tick 又自愈——中间那几帧的「读取失败」是纯噪音；
//   · loading 只在「还没有任何数据」时为 true：运行中会话的周期刷新不再把面板闪回骨架屏
//     （也保住过滤输入框的焦点——见 AuditTab 的注释）。

import * as React from 'react';
import { useApp } from '../context.ts';

/** useSessionResource 的入参。 */
export interface SessionResourceOptions<T> {
  /** 是否可取（false = 未选会话等；不发请求并清空状态）。 */
  readonly enabled: boolean;
  /** 请求本体（抛错进 error；用 useCallback 包裹，参数变化即自动重取）。 */
  readonly load: () => Promise<T>;
  /** 是否跟随 sessionTick 重取（会话级数据 true；全局状态类 false——tick 是回合推进信号，全局状态不必陪跑）。 */
  readonly followTick?: boolean;
}

/** useSessionResource 的返回值。 */
export interface SessionResourceResult<T> {
  /** 最近一次成功的数据（null = 尚无）。 */
  readonly data: T | null;
  /** 最近一次失败的文案（下一次请求发出时清空）。 */
  readonly error: string | null;
  /** 首次取数中（已有数据后的后台刷新不计）。 */
  readonly loading: boolean;
  /** 手动重取（错误页「重试」按钮用）。 */
  readonly refresh: () => void;
}

/**
 * 会话面板资源取数：seq 守卫 + sessionTick 跟随 + 失败保留旧数据。
 * @param options enabled / load / followTick
 * @returns 数据、错误、加载态与重取
 */
export function useSessionResource<T>(options: SessionResourceOptions<T>): SessionResourceResult<T> {
  const { enabled, load, followTick = true } = options;
  const { sessionTick } = useApp();
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const seqRef = React.useRef(0);

  const refresh = React.useCallback((): void => {
    if (!enabled) return;
    const seq = ++seqRef.current;
    setError(null);
    load().then(
      (result) => {
        if (seq !== seqRef.current) return;
        setData(result);
        setLoading(false);
      },
      (e: unknown) => {
        if (seq !== seqRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      },
    );
  }, [enabled, load]);

  React.useEffect(() => {
    if (!enabled) {
      seqRef.current += 1; // 弃掉在飞响应
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (data === null) setLoading(true);
    refresh();
    // data 不进依赖：effect 只在「可取性 / 参数 / tick」变化时重跑；data 只作“是否首次”的
    // 快照判定，成功回调里的 setData 不应触发重取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refresh, ...(followTick ? [sessionTick] : [])]);

  return { data, error, loading, refresh };
}
