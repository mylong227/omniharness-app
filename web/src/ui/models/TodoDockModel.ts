import { todoStatusOf } from './TodoStatus.ts';
import { EventFields } from './EventFields.ts';
import type { ThreadEvent } from '../../types/models.ts';
/** 一条待办（与 `todo` 事件载荷一致；status 已按 TodoStatus 归一成新词表）。 */
export interface TodoDockItem {
  /** 任务文本。 */
  readonly content: string;
  /** 状态：pending / in_progress / completed。 */
  readonly status: string;
  /** 稳定 id（可选）。 */
  readonly id?: string;
  /** 前置步骤 id（可选）。 */
  readonly dependsOn?: readonly string[];
}

/** 面板需要的最小事件形状（不依赖后端类型，避免 web 包反向 import src）。 */
export interface TodoEventLike {
  /** 事件类型。 */
  readonly type: string;
  /** 事件载荷（历史事件可能缺省）。 */
  readonly payload?: unknown;
}

/** 最新待办快照：清单 + 数据时刻（陈旧可读化——模型不更新待办时，坞能如实显示数据新旧）。 */
export interface TodoSnapshot {
  /** 最新一份待办清单。 */
  readonly items: readonly TodoDockItem[];
  /** 快照事件时刻（毫秒；事件缺省时间戳或不可解析时缺省）。 */
  readonly at?: number;
}

/**
 * 从事件流提取**最新**一条 todo 快照。
 *
 * 为什么取最新而不是拼接：`todo_write` 是整表替换语义，旧快照只代表历史状态；
 * 面板只应展示当前计划，否则完成项会重复计数。
 */
export class TodoDockModel {
  /**
   * 取最新待办快照（含事件时刻）。
   * @param events 会话事件（按数组顺序扫描）。
   * @returns 最新待办与时刻；从未写过返回 null。
   */
  public static latest(events: readonly TodoEventLike[]): TodoSnapshot | null {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      if (event?.type !== 'todo') continue;
      const raw = (event.payload as { readonly todos?: unknown } | undefined)?.todos;
      if (!Array.isArray(raw)) return null;
      const items = raw
        .map((item) => {
          const record = item as {
            readonly content?: unknown;
            readonly status?: unknown;
            readonly id?: unknown;
            readonly dependsOn?: unknown;
          };
          const dependsOn = Array.isArray(record.dependsOn)
            ? record.dependsOn.filter((dep): dep is string => typeof dep === 'string')
            : undefined;
          return {
            content: typeof record.content === 'string' ? record.content : '',
            status: todoStatusOf(typeof record.status === "string" ? record.status : undefined),
            ...(typeof record.id === 'string' ? { id: record.id } : {}),
            ...(dependsOn !== undefined && dependsOn.length > 0 ? { dependsOn } : {}),
          };
        })
        .filter((item) => item.content !== '');
      // 时刻归一单源（EventFields.timestamp）：毫秒 / ISO 双形态只写一份。
      const ms = EventFields.timestamp(event as ThreadEvent);
      return { items, ...(ms > 0 ? { at: ms } : {}) };
    }
    return null;
  }
}
