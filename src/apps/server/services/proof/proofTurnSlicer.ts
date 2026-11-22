import type { SessionEvent } from '../../../../host/kernel/contracts.ts';

/**
 * 凭证回合切分器（纯静态）：把事件流按 `user` 事件切成回合（设计 §6.2 回合边界）。
 *
 * 边界口径：
 *  - 起点：`type === 'user'` 的事件（合成 user 事件——nudge / 续跑引导——也算，它们是真实
 *    进入上下文的边界）；终点：下一条 user 事件之前；
 *  - 事件流开头没有 user 事件的片段（自动化回合 / 崩溃恢复注入）单独成**系统回合**
 *    （`systemTurn: true`），不与用户回合混排；
 *  - 切片只是**下标区间**，不复制事件（export / build 时再按区间取数）。
 */

/** 一个回合的事件区间（左闭右开，指向原事件流下标）。 */
export interface TurnSlice {
  /** 回合下标（0 起，指向 `slice()` 返回数组；RPC 选择回合用）。 */
  readonly turnIndex: number;
  /** 用户回合序号（1 起；系统回合为 0，不占用用户轮次）。 */
  readonly displayIndex: number;
  /** 起始下标（含）。 */
  readonly from: number;
  /** 结束下标（不含）。 */
  readonly to: number;
  /** 是否系统回合。 */
  readonly systemTurn: boolean;
}

/** 凭证回合切分器（纯静态，无实例状态）。 */
export class ProofTurnSlicer {
  private constructor() {}

  /**
   * 切分事件流为回合区间。
   * @param events 会话事件流（升序）。
   * @returns 回合区间列表（按 turnIndex 升序；空事件流为空数组）。
   */
  public static slice(events: readonly SessionEvent[]): readonly TurnSlice[] {
    const slices: TurnSlice[] = [];
    let start = 0;
    let systemTurn = events.length > 0 && events[0]!.type !== 'user';
    let userTurns = 0;
    for (let i = 1; i <= events.length; i += 1) {
      const isBoundary = i === events.length || events[i]!.type === 'user';
      if (!isBoundary) continue;
      // 空区间（连续 user 边界理论不会出现，防御：user 事件自身就是起点，区间至少含 1 条）。
      if (i <= start) continue;
      if (!systemTurn) userTurns += 1;
      slices.push({
        turnIndex: slices.length,
        displayIndex: systemTurn ? 0 : userTurns,
        from: start,
        to: i,
        systemTurn,
      });
      start = i;
      systemTurn = false;
    }
    return slices;
  }

  /**
   * 取某回合的事件切片。
   * @param events 会话事件流。
   * @param slice 回合区间。
   * @returns 该回合的事件数组（切片为空时返回 undefined，由调用方报 proof_empty）。
   */
  public static eventsOf(events: readonly SessionEvent[], slice: TurnSlice): readonly SessionEvent[] {
    return events.slice(slice.from, slice.to);
  }
}
