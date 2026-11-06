// 思考轨迹的**筛选算术**（纯函数、零 React）：把一轮过程事件折叠成「可筛选的步骤行」。
//
// 为什么单独成模型：轨迹已从「静态列表」演进为「思考 / 说明 / 工具 / 失败」四类可筛选视图，
// 计数与过滤规则若散在组件里，会和渲染口径漂移（例如把内联的 tool_result 又算成一行）。
// 这里只依赖事件本身，组件与单测共用同一份口径。
//
// 口径（与 StreamView/ToolCallCard 的渲染一致）：
//   · reasoning → 思考；assistant → 说明；tool_call → 工具；
//   · tool_result 已被同轮 tool_call 内联时**不单独成行**；孤儿结果才成行；
//   · 其余事件（system / turn_diff / 压缩提示…）保留为「其它」行，筛选「全部」时不能丢；
//   · 失败 = 工具调用对应的结果 ok!==true，或孤儿结果 ok!==true（pending 不算失败）。

import type { ThreadEvent } from '../../types/models.ts';
import { EventFields } from './EventFields.ts';

/** 轨迹筛选模式。 */
export type TrailFilterMode = 'all' | 'thinking' | 'narration' | 'tools' | 'failures';

/** 一个可渲染的轨迹行类型。 */
export type TrailRowKind = 'thinking' | 'narration' | 'tool' | 'result' | 'other';

/** 一条轨迹行（事件 + 预计算的分组与失败标记）。 */
export interface TrailRow {
  /** 原始事件。 */
  readonly ev: ThreadEvent;
  /** 该行在原始事件数组中的下标（耗时计算沿用原下标）。 */
  readonly index: number;
  /** 行类型。 */
  readonly kind: TrailRowKind;
  /** 是否失败（仅 tool / result 可能为 true）。 */
  readonly failed: boolean;
}

/** 各筛选模式的行数。 */
export interface TrailCounts {
  readonly all: number;
  readonly thinking: number;
  readonly narration: number;
  readonly tools: number;
  readonly failures: number;
}

/** 一轮过程的筛选视图。 */
export interface TrailView {
  /** 全部可渲染行（保持事件顺序）。 */
  readonly rows: readonly TrailRow[];
  /** 各筛选模式的行数。 */
  readonly counts: TrailCounts;
}

/**
 * 思考轨迹筛选器：事件 → 行 → 计数/过滤。全部静态方法，便于直测与复用。
 */
export class TrailFilter {
  /**
   * 把一轮过程事件折叠成可筛选行。
   * @param events 过程事件（reasoning / assistant / tool_call / tool_result / 其它）
   * @returns 行列表（保持事件顺序，内联结果不重复成行）
   */
  public static rows(events: readonly ThreadEvent[]): TrailRow[] {
    const callIds = new Set<string>();
    const resultOk = new Map<string, boolean>();
    for (const ev of events) {
      if (ev.type === 'tool_call') callIds.add(EventFields.callId(ev));
      else if (ev.type === 'tool_result') resultOk.set(EventFields.callId(ev), ev.payload?.ok === true);
    }
    const rows: TrailRow[] = [];
    events.forEach((ev, index) => {
      if (ev.type === 'reasoning') {
        rows.push({ ev, index, kind: 'thinking', failed: false });
        return;
      }
      if (ev.type === 'assistant') {
        rows.push({ ev, index, kind: 'narration', failed: false });
        return;
      }
      if (ev.type === 'tool_call') {
        rows.push({ ev, index, kind: 'tool', failed: resultOk.get(EventFields.callId(ev)) === false });
        return;
      }
      if (ev.type === 'tool_result') {
        // 调用卡已内联的结果不再成行；孤儿结果（历史被截断）保留。
        if (callIds.has(EventFields.callId(ev))) return;
        rows.push({ ev, index, kind: 'result', failed: ev.payload?.ok !== true });
        return;
      }
      rows.push({ ev, index, kind: 'other', failed: false });
    });
    return rows;
  }

  /**
   * 统计各筛选模式的行数。
   * @param rows 行列表
   * @returns 计数
   */
  public static counts(rows: readonly TrailRow[]): TrailCounts {
    let thinking = 0;
    let narration = 0;
    let tools = 0;
    let failures = 0;
    for (const row of rows) {
      if (row.kind === 'thinking') thinking += 1;
      else if (row.kind === 'narration') narration += 1;
      else if (row.kind === 'tool' || row.kind === 'result') tools += 1;
      if (row.failed) failures += 1;
    }
    return { all: rows.length, thinking, narration, tools, failures };
  }

  /**
   * 按模式过滤行。
   * @param rows 行列表
   * @param mode 筛选模式
   * @returns 过滤后的行（保持原顺序）
   */
  public static apply(rows: readonly TrailRow[], mode: TrailFilterMode): TrailRow[] {
    if (mode === 'all') return [...rows];
    if (mode === 'failures') return rows.filter((row) => row.failed);
    if (mode === 'tools') return rows.filter((row) => row.kind === 'tool' || row.kind === 'result');
    if (mode === 'thinking') return rows.filter((row) => row.kind === 'thinking');
    return rows.filter((row) => row.kind === 'narration');
  }

  /**
   * 一次性构建视图（行 + 计数）。
   * @param events 过程事件
   * @returns 轨迹视图
   */
  public static view(events: readonly ThreadEvent[]): TrailView {
    const rows = TrailFilter.rows(events);
    return { rows, counts: TrailFilter.counts(rows) };
  }
}
