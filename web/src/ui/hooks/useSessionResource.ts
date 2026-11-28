// 会话面板资源取数核心（2026-11-17 抽取；2026-11-22 W5 增强为单一核）。
//
// 「useCallback 取数 + seq 竞态守卫 + effect 跟随 sessionTick」这套骨架此前在十个面板里
// 各拷一份，其中六份（TraceTab / AuditTab / GovernanceTab / VaultTab / DiagnosticsTab /
// AutomationsTab）**没有守卫**：快速切会话时，A 会话的迟到响应会覆盖 B 会话的数据
// （跨会话串数据）；sessionTick 高频重入时晚到的旧帧还会把新数据回滚。本钩子单源实现
// 守卫语义，六个面板全部收编。
//
// W5（2026-11-22）把其余三份「更丰富的变体」也收编进本核，避免各 hook 再维护自己的
// seq/轮询/TTL/切会话复位：
//   · `pollMs`     —— 活跃轮询（文档隐藏时暂停）；编队 2s 轮询用它；
//   · `cacheTtlMs` —— 触发式取数的缓存窗口（窗口内不重复请求；手动 refresh 永远发）；
//   · `resetKey`   —— 复位键（切会话）；变化即清空旧数据并作废旧请求；
//   · 返回值补 `refreshing`（已有数据的后台刷新）、`settled`（首次请求已落地，成功或失败）
//     与 `updatedAt`（最近成功时刻；编队「已过期」标注用它）。
//
// 取数纪律：
//   · enabled=false（未选会话等）不发请求，并清空状态、弃掉在飞响应；
//   · 每次请求带票号（LatestRequest），晚到响应按票号弃掉（后发必胜）；
//   · load 身份变化（参数变了）或 sessionTick 变化即重取（受 cacheTtlMs 约束）；
//   · 刷新失败**保留已渲染数据**：tick 高频重入，一次瞬时失败就把面板打回错误页、
//     下一次 tick 又自愈——中间那几帧的「读取失败」是纯噪音；
//   · loading 只在「还没有任何数据」时为 true：运行中会话的周期刷新不再把面板闪回骨架屏
//     （也保住过滤输入框的焦点——见 AuditTab 的注释）。

import { errorMessageOf } from '../../core/errorText.ts';
import * as React from 'react';
import { useApp } from '../context.ts';
import { useLatestRequest } from './LatestRequest.ts';

/** useSessionResource 的入参。 */
export interface SessionResourceOptions<T> {
  /** 是否可取（false = 未选会话等；不发请求并清空状态）。 */
  readonly enabled: boolean;
  /** 请求本体（抛错进 error；用 useCallback 包裹，参数变化即自动重取）。 */
  readonly load: () => Promise<T>;
  /** 是否跟随 sessionTick 重取（会话级数据 true；全局状态类 false——tick 是回合推进信号，全局状态不必陪跑）。 */
  readonly followTick?: boolean;
  /**
   * 外部刷新信号（2026-11-21 批次六 A1 收编全局面板）：SSE 去抖后的 reloadKey /
   * 面板本地自增 tick——值变化即重取。与 followTick 正交（可同时用）。
   */
  readonly reloadTick?: number;
  /** 活跃轮询间隔（毫秒）；缺省不轮询。`document.hidden` 时不发请求。 */
  readonly pollMs?: number;
  /** 触发式取数的缓存窗口（毫秒）：最近一次成功距今不足该值时，effect 触发的取数直接跳过。 */
  readonly cacheTtlMs?: number;
  /** 复位键（如会话 id）：值变化即清空数据并作废在飞请求。 */
  readonly resetKey?: string | null;
  /**
   * 禁用时保留已取数据（只停请求/轮询）。
   *
   * 默认 false = 禁用即清空（未选会话等「没有上下文」的禁用）。编队等「tab 暂不活跃但
   * 会话仍在」的场景传 true：切走再切回时先显示旧快照，不必等一次 RPC。
   */
  readonly keepDataWhenDisabled?: boolean;
}

/** useSessionResource 的返回值。 */
export interface SessionResourceResult<T> {
  /** 最近一次成功的数据（null = 尚无）。 */
  readonly data: T | null;
  /** 最近一次失败的文案（下一次请求发出时清空）。 */
  readonly error: string | null;
  /** 首次取数中（已有数据后的后台刷新不计）。 */
  readonly loading: boolean;
  /** 已有数据时的后台刷新中（首取不计）。 */
  readonly refreshing: boolean;
  /** 是否已有过一次请求落地（成功或失败）。 */
  readonly settled: boolean;
  /** 最近一次成功的时刻（毫秒时间戳；0 = 尚无）。 */
  readonly updatedAt: number;
  /** 手动重取（错误页「重试」按钮用；返回在飞 Promise，动作后可 await 保证列表已刷新）。 */
  readonly refresh: () => Promise<void>;
}

/**
 * 会话面板资源取数：票号守卫 + sessionTick 跟随 + 失败保留旧数据 + 可选轮询/缓存/复位。
 * @param options enabled / load / followTick / reloadTick / pollMs / cacheTtlMs / resetKey
 * @returns 数据、错误、加载态、刷新态与重取
 */
export function useSessionResource<T>(options: SessionResourceOptions<T>): SessionResourceResult<T> {
  const {
    enabled,
    load,
    followTick = true,
    reloadTick,
    pollMs,
    cacheTtlMs,
    resetKey,
    keepDataWhenDisabled = false,
  } = options;
  const { sessionTick } = useApp();
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [settled, setSettled] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState(0);
  /** 请求守卫：票号判定与作废单一实现（W5）。 */
  const request = useLatestRequest();
  /** 当前数据镜像：refresh 里不能依赖 data（否则 refresh 身份每帧变、effect 反复重跑）。 */
  const dataRef = React.useRef<T | null>(null);
  /** 最近成功时刻镜像（同上：TTL 判定要读最新值但不进依赖）。 */
  const updatedAtRef = React.useRef(0);
  /** 上一次复位键（undefined = 本 hook 未启用复位语义）。 */
  const lastResetKeyRef = React.useRef<string | null | undefined>(undefined);

  /** 清空数据与状态（禁用 / 复位时用）。 */
  const clear = React.useCallback((): void => {
    dataRef.current = null;
    updatedAtRef.current = 0;
    setData(null);
    setError(null);
    setLoading(false);
    setRefreshing(false);
    setSettled(false);
    setUpdatedAt(0);
  }, []);

  const refresh = React.useCallback((): Promise<void> => {
    if (!enabled) return Promise.resolve();
    const ticket = request.begin();
    setError(null);
    if (dataRef.current !== null) setRefreshing(true);
    return load().then(
      (result) => {
        if (!request.isCurrent(ticket)) return;
        const now = Date.now();
        updatedAtRef.current = now;
        dataRef.current = result;
        setData(result);
        setUpdatedAt(now);
        setSettled(true);
        setLoading(false);
        setRefreshing(false);
      },
      (cause: unknown) => {
        if (!request.isCurrent(ticket)) return;
        setError(errorMessageOf(cause));
        setSettled(true);
        setLoading(false);
        setRefreshing(false);
      },
    );
  }, [enabled, load, request]);

  /** 跟随信号：followTick=false 时把 tick 从依赖里摘掉（固定位传 null，避免依赖数组长度变化）。 */
  const tickSignal = followTick ? sessionTick : null;

  React.useEffect(() => {
    // 复位键变化（切会话）：旧数据与在飞请求都属于上一个上下文。
    if (resetKey !== undefined && lastResetKeyRef.current !== resetKey) {
      lastResetKeyRef.current = resetKey;
      request.invalidate();
      clear();
    }
    if (!enabled) {
      request.invalidate(); // 弃掉在飞响应
      if (keepDataWhenDisabled) {
        // 「暂不活跃」不是「没有上下文」：保留旧快照，恢复时先显示、再按 TTL 决定是否刷新。
        setLoading(false);
        setRefreshing(false);
      } else {
        clear();
      }
      return;
    }
    // 缓存窗口内不重复请求；手动 refresh 不经过本 effect，永远发。
    if (cacheTtlMs !== undefined && Date.now() - updatedAtRef.current < cacheTtlMs) return;
    if (dataRef.current === null) setLoading(true);
    void refresh();
    // data 不进依赖：effect 只在「可取性 / 参数 / tick / 外部信号 / 复位键」变化时重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refresh, request, clear, cacheTtlMs, resetKey, tickSignal, reloadTick, keepDataWhenDisabled]);

  // 活跃轮询；页面隐藏时跳过本轮（CR-06：后台不产生持续 RPC）。
  React.useEffect(() => {
    if (!enabled || pollMs === undefined) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refresh();
    }, pollMs);
    return () => clearInterval(timer);
  }, [enabled, pollMs, refresh]);

  return { data, error, loading, refreshing, settled, updatedAt, refresh };
}
