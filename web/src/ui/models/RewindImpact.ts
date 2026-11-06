// 「从此处重开」的影响面（纯模型）：回退某条消息时，之后会被丢弃的事件有哪些。
//
// 为什么需要它：确认框只说「N 条事件」时，用户不知道被丢的是几次工具调用、几条回复；
// 内核事件流是结构化事件，应该把影响面如实拆给用户看，确认才是有依据的决定。

import type { ThreadEvent } from '../../types/models.ts';

/** 一次回退会丢弃的事件构成。 */
export interface RewindImpact {
  /** 被丢弃的事件总数。 */
  readonly total: number;
  /** 工具调用数。 */
  readonly toolCalls: number;
  /** 工具结果数（含被内联的）。 */
  readonly toolResults: number;
  /** 助手回复数。 */
  readonly assistant: number;
  /** 思考 / 说明数。 */
  readonly reasoning: number;
  /** 用户消息数（正常情况下回退点之后不应再有，防御性统计）。 */
  readonly user: number;
  /** 其它事件数（模型 / 元数据 / 压缩提示等）。 */
  readonly other: number;
}

/** 回退影响面计算器。 */
export class RewindImpact {
  /**
   * 计算保留到 `keepIndex`（含）后，将被丢弃的事件构成。
   * @param events 当前事件流
   * @param keepIndex 保留到哪条事件（含）
   * @returns 影响面；越界时全部为 0
   */
  public static of(events: readonly ThreadEvent[], keepIndex: number): RewindImpact {
    const dropped = events.slice(Math.max(0, keepIndex) + 1);
    let toolCalls = 0;
    let toolResults = 0;
    let assistant = 0;
    let reasoning = 0;
    let user = 0;
    let other = 0;
    for (const ev of dropped) {
      if (ev.type === 'tool_call') toolCalls += 1;
      else if (ev.type === 'tool_result') toolResults += 1;
      else if (ev.type === 'assistant') assistant += 1;
      else if (ev.type === 'reasoning') reasoning += 1;
      else if (ev.type === 'user') user += 1;
      else other += 1;
    }
    return { total: dropped.length, toolCalls, toolResults, assistant, reasoning, user, other };
  }
}
