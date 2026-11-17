// 上下文余量预测（2026-11-17 粘性批次，纯函数、零 React/DOM 依赖）。
//
// 用户最关心的隐含问题是「这个会话还能干多久才撞上下文墙」——容量坞给了当前百分比，
// 但没人想心算。本模型用事件流里 model 事件自带的 context 快照按**轮**估算每轮增量，
// 除以剩余窗口得「按近几轮的增速，大约还能再撑 N 轮」。
//
// 口径与纪律：
//   · 增量取「相邻两轮各自最后一条 model 事件的 usedTokens 差」的正值（压缩会让它骤降，
//     负增量不参与中位数——那是压缩的功劳，不是本轮更省）；
//   · 只看最近 K 轮（缺省 4）：旧轮的用量习惯对新任务没有代表性；
//   · 数据不足（<2 个可比对轮）或 source 非实测（estimated/empty）返回 null——
//     估算的估算没有意义，展示层据此不渲染，绝不编一个数出来。

import type { ThreadEvent } from '../../types/models.ts';

/** 参与估算的最近轮数。 */
const RECENT_TURNS = 4;

/** 预测结果。 */
export interface ContextForecastResult {
  /** 估算剩余可撑轮数（向下取整；estimate 保证 ≥0——增量为 0 时整体返回 null）。 */
  readonly remainingTurns: number;
  /** 参与估算的轮增量条数（展示「按近 N 轮」用）。 */
  readonly samples: number;
  /** 每轮增量中位数（token，恒为正）。 */
  readonly medianDelta: number;
  /** 剩余窗口（token）。 */
  readonly remainingTokens: number;
}

/** 上下文余量预测器。 */
export class ContextForecast {
  /**
   * 估算「还能撑几轮」。
   * @param events 当前会话已加载事件
   * @param windowTokens 上下文窗口（token）
   * @param usedTokens 当前已用（token；最新快照）
   * @returns 预测结果；数据不足为 null
   */
  public static estimate(
    events: readonly ThreadEvent[],
    windowTokens: number,
    usedTokens: number,
  ): ContextForecastResult | null {
    if (!(windowTokens > 0) || !(usedTokens > 0) || usedTokens >= windowTokens) return null;
    // 按轮收集「该轮最后一条 model 事件的 context.usedTokens」。
    const perTurn: number[] = [];
    let current = -1;
    for (const ev of events) {
      if (ev.type === 'user') {
        current += 1;
        continue;
      }
      if (ev.type !== 'model' || current < 0) continue;
      const ctx = ev.payload?.['context'] as { usedTokens?: unknown } | undefined;
      const used = typeof ctx?.usedTokens === 'number' ? ctx.usedTokens : NaN;
      if (!Number.isFinite(used)) continue;
      if (current === perTurn.length) perTurn.push(used);
      else if (used > (perTurn[current] ?? 0)) perTurn[current] = used;
    }
    // 相邻轮的正增量（压缩导致的下降不参与——那是压缩的功劳，不代表本轮更省）。
    const deltas: number[] = [];
    for (let i = Math.max(1, perTurn.length - RECENT_TURNS); i < perTurn.length; i++) {
      const d = (perTurn[i] ?? 0) - (perTurn[i - 1] ?? 0);
      if (d > 0) deltas.push(d);
    }
    if (deltas.length < 2) return null;
    const sorted = [...deltas].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianDelta =
      sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
    if (!(medianDelta > 0)) return null;
    const remainingTokens = Math.max(0, windowTokens - usedTokens);
    return {
      remainingTurns: Math.floor(remainingTokens / medianDelta),
      samples: deltas.length,
      medianDelta,
      remainingTokens,
    };
  }
}
