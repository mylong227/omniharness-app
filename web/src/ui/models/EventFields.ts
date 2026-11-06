// 会话事件的**公共字段口径**（纯函数）：调用 id / 正文 / 时间戳 / 工具名。
//
// 为什么收成一处：这些「缺省回落到事件 id」「payload 不是对象」「时间戳是 ISO 串」的细节
// 原先散在 StreamView / ThinkingTrail / TurnSummary / TraceView / 控制器里，各处实现略有差异
// （失败形态就是同一事件在轨迹里算成功、在结果卡里算失败）。这里只保留**一份**口径，消费方按需调用。
//
// 边界：`callId` 会回落事件 id（tool_call 的稳定键）；`rawCallId` 不回落（tool_result 匹配时
// 缺 callId 不能误配成事件 id）；`timestamp` 兼容 number 与 ISO 串，非法/缺省为 0。

import type { ThreadEvent } from '../../types/models.ts';

/** 会话事件的公共字段读取器。 */
export class EventFields {
  /**
   * 工具调用的稳定 id：`payload.callId`（非空字符串）优先，缺省回落到事件 id。
   * @param ev 事件
   * @returns 调用 id
   */
  public static callId(ev: ThreadEvent): string {
    const raw: unknown = (ev.payload || {}).callId;
    return typeof raw === 'string' && raw !== '' ? raw : ev.id;
  }

  /**
   * 事件原始 `payload.callId`（不做事件 id 回落）；tool_result 匹配时用。
   * @param ev 事件
   * @returns 调用 id；缺失/非字符串为空串
   */
  public static rawCallId(ev: ThreadEvent): string {
    const raw: unknown = (ev.payload || {}).callId;
    return typeof raw === 'string' ? raw : '';
  }

  /**
   * 事件正文（`payload.content`）。
   * @param ev 事件
   * @returns 正文；缺失/非字符串为空串
   */
  public static content(ev: ThreadEvent): string {
    const raw: unknown = (ev.payload || {}).content;
    return typeof raw === 'string' ? raw : '';
  }

  /**
   * 事件工具名（`payload.name`）。
   * @param ev 事件
   * @returns 工具名；缺失/非字符串为空串
   */
  public static toolName(ev: ThreadEvent): string {
    const raw: unknown = (ev.payload || {}).name;
    return typeof raw === 'string' ? raw : '';
  }

  /**
   * 事件毫秒时间戳。
   * @param ev 事件
   * @returns 毫秒；缺失/非法为 0
   */
  public static timestamp(ev: ThreadEvent): number {
    const raw: unknown = ev.timestamp;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw === 'string') {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }
}
