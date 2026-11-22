/**
 * 轨迹筛选模型（零 React）：把工具调用行按类型/失败/进行中与文本过滤。
 *
 * 为什么单独成模型：轨迹是长任务里唯一能回答「到底跑了什么」的地方，139 条平铺时
 * 用户需要先缩范围；把过滤算术从组件里拆出来，可直测且不依赖 DOM。
 */

/** 工具动作大类。 */
export type TraceCategory = 'read' | 'write' | 'command' | 'search' | 'other';

/** 筛选档（all = 全部；failed/running 按状态，其余按动作大类）。 */
export type TraceFilterKind = 'all' | 'read' | 'write' | 'command' | 'search' | 'failed' | 'running';

/** 一条轨迹行（模块级中间形态，渲染前组装）。 */
export interface TraceRow {
  /** 稳定 key（事件 id 或流式输入 id）。 */
  readonly key: string;
  /** 工具名（图标映射用）。 */
  readonly name: string;
  /** 人话动作描述。 */
  readonly action: string;
  /** 是否已完成（有结果回包）。 */
  readonly done: boolean;
  /** 是否失败（结果 ok=false / 带 error）。 */
  readonly failed: boolean;
  /** 展示时间。 */
  readonly time: string;
  /** 轮次（第几条 user 消息之后，1 起）。 */
  readonly turn: number;
  /** 动作大类。 */
  readonly category: TraceCategory;
}

/** 筛选项清单（顺序即渲染顺序；label 为中文原文，渲染时过 t()）。 */
export const TRACE_FILTERS: readonly { readonly kind: TraceFilterKind; readonly label: string }[] = [
  { kind: 'all', label: '全部' },
  { kind: 'read', label: '读取' },
  { kind: 'write', label: '写入' },
  { kind: 'command', label: '命令' },
  { kind: 'search', label: '搜索' },
  { kind: 'failed', label: '失败' },
  { kind: 'running', label: '进行中' },
];

/**
 * 工具名 → 动作大类（与图标映射同源的关键词判据）。
 * @param name 工具名
 * @returns 动作大类
 */
export function categoryOfTool(name: string): TraceCategory {
  const n = name.toLowerCase();
  if (n.includes('edit') || n.includes('write') || n.includes('patch')) return 'write';
  // 浏览目录归入「读取」：用户找文件时它和 read 是同一类动作。
  if (n.includes('read') || n.includes('cat') || n.includes('list') || n === 'ls') {
    return 'read';
  }
  if (n.includes('search') || n.includes('grep') || n.includes('glob') || n.includes('find')) {
    return 'search';
  }
  if (n.includes('command') || n.includes('bash') || n.includes('shell') || n.includes('run')) {
    return 'command';
  }
  return 'other';
}

/**
 * 按筛选档 + 文本过滤行。
 * @param rows 全部行
 * @param kind 筛选档
 * @param query 文本（动作/工具名，大小写不敏感；空串不过滤）
 * @returns 过滤后的行（保持原顺序）
 */
export function filterTraceRows(
  rows: readonly TraceRow[],
  kind: TraceFilterKind,
  query: string,
): TraceRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (kind === 'failed' && !row.failed) return false;
    if (kind === 'running' && row.done) return false;
    if (kind !== 'all' && kind !== 'failed' && kind !== 'running' && row.category !== kind) {
      return false;
    }
    if (q === '') return true;
    return row.action.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
  });
}

/**
 * 各筛选档的计数（渲染筛选 chips 的角标）。
 * @param rows 全部行
 * @returns 档位 → 条数
 */
export function traceFilterCounts(
  rows: readonly TraceRow[],
): Readonly<Record<TraceFilterKind | 'other', number>> {
  const counts: Record<TraceFilterKind | 'other', number> = {
    all: rows.length,
    read: 0,
    write: 0,
    command: 0,
    search: 0,
    other: 0,
    failed: 0,
    running: 0,
  };
  for (const row of rows) {
    counts[row.category] += 1;
    if (row.failed) counts.failed += 1;
    if (!row.done) counts.running += 1;
  }
  return counts;
}
