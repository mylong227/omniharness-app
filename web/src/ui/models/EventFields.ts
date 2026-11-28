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

  /**
   * 工具结果的原始 ok 读数（三态）：`payload.ok` 为 true / false 时如实返回，**缺省返回
   * undefined**。失败判定请用 {@link toolFailed}——三处消费点（轨迹徽标 / 轨迹过滤 /
   * 工作台简报）此前口径漂移：轨迹侧 fail-closed（缺 ok 算失败）、简报侧 fail-open（缺 ok
   * 不算），同一回合两处读数可以不一致（2026-11-28 评审发现）。现统一 fail-closed。
   * @param ev 事件
   * @returns true / false / undefined（缺省）
   */
  public static toolOk(ev: ThreadEvent): boolean | undefined {
    const raw: unknown = (ev.payload || {}).ok;
    return typeof raw === 'boolean' ? raw : undefined;
  }

  /**
   * 工具结果是否算失败：**fail-closed**——`ok` 缺省（老事件 / 被截断的载荷）不能读成成功。
   * 全仓 tool_result 失败判定的唯一口径（诚实语义：没有证据不宣称通过）。
   * @param ev 事件
   * @returns 失败为 true
   */
  public static toolFailed(ev: ThreadEvent): boolean {
    return EventFields.toolOk(ev) !== true;
  }
}
