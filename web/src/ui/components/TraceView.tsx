// 「轨迹」视图：把当前会话的工具调用压成一张紧凑时间线（截图式三栏壳的中栏第二视图）。
// 与「对话」的区别：不渲染任何正文 / 推理，只留「图标 + 动作 + 状态 + 时间」一行一条，
// 用来回答「这一轮到底动了哪些文件、跑了哪些命令」。数据完全来自既有事件流，不新增请求。
//
// 2026-11-15：长任务（139 次调用）只有平铺列表，无法按读/写/命令/失败缩范围——
// 增加筛选 chips、文本搜索与轮次分隔；过滤算术下沉 models/TraceFilter（可直测）。
//
// 函数组件范式：行渲染下沉为模块级纯函数；仅筛选/搜索两个局部状态。

import * as React from 'react';
import { icon } from '../models/Icon.ts';
import type { IconName } from '../models/Icon.ts';
import { describeToolCall } from '../textUtils.ts';
import { timeOf } from '../format.ts';
import { EventFields } from '../models/EventFields.ts';
import { t } from '../i18n/i18n.ts';
import {
  TRACE_FILTERS,
  categoryOfTool,
  filterTraceRows,
  traceFilterCounts,
  type TraceFilterKind,
  type TraceRow,
} from '../models/TraceFilter.ts';
import type { ThreadEvent } from '../../types/models.ts';
import type { LiveInput, ToolResultView } from '../shared.ts';

/** TraceView 组件的入参。 */
export interface TraceViewProps {
  /** 会话事件（从中筛 tool_call）。 */
  events: ThreadEvent[];
  /** 流式中的工具输入（尚无事件落盘，作为"进行中"行追加在末尾）。 */
  liveInputs: LiveInput[];
  /** 工具结果视图（有结果的调用显示「完成」）。 */
  toolResults: Record<string, ToolResultView>;
  /** 是否隐藏（对话/轨迹双视图常驻，切换只切显示，避免卸载重挂闪白）。 */
  hidden?: boolean;
}

/**
 * 工具名 → 线性图标。判据是工具名的关键词（read/edit/glob…），未识别回退扳手。
 * @param name 工具名
 * @returns 图标名
 */
function iconOfTool(name: string): IconName {
  const lower = name.toLowerCase();
  // 目录浏览用文件夹图标（归入「读取」筛选，但视觉上要和读文件区分）。
  if (lower.includes('list') || lower.includes('dir') || lower === 'ls') return 'folder';
  const category = categoryOfTool(name);
  if (category === 'write') return 'pencil';
  if (category === 'read') return 'file';
  if (category === 'search') return 'search';
  if (category === 'command') return 'wrench';
  return 'wrench';
}

/**
 * 从事件流组装轨迹行（保持时间顺序；孤儿结果不显示——它没有对应的"动作"可讲）。
 *
 * 完成判据有两条来源：`toolResults`（本回合实时合并的结果视图）**与**事件流里的
 * `tool_result` 事件（加载历史会话时结果以独立事件回放，`toolResults` 未必填充——
 * 真机实测：历史会话的已完成调用被误标「进行中」）。两边任一命中即「完成」；
 * 失败同理取任一侧的 `ok:false`。
 * @param events 会话事件
 * @param toolResults 工具结果
 * @returns 轨迹行列表
 */
function collectRows(
  events: readonly ThreadEvent[],
  toolResults: Record<string, ToolResultView>,
): TraceRow[] {
  const doneCallIds = new Set<string>(Object.keys(toolResults));
  const failedCallIds = new Set<string>(
    Object.entries(toolResults)
      .filter(([, value]) => !value.ok)
      .map(([callId]) => callId),
  );
  for (const ev of events) {
    if (ev.type !== 'tool_result') continue;
    const callId = EventFields.rawCallId(ev);
    doneCallIds.add(callId);
    const p = (ev.payload || {}) as Record<string, unknown>;
    if (p['ok'] === false || typeof p['error'] === 'string') failedCallIds.add(callId);
  }
  const rows: TraceRow[] = [];
  let turn = 0;
  for (const ev of events) {
    if (ev.type === 'user') {
      turn += 1;
      continue;
    }
    if (ev.type !== 'tool_call') continue;
    const p = (ev.payload || {}) as Record<string, unknown>;
    const name = (p.name as string) || '';
    if (name === '') continue;
    const callId = EventFields.callId(ev);
    rows.push({
      key: ev.id,
      name,
      action: describeToolCall(name, (p.args as Record<string, unknown>) || p),
      done: doneCallIds.has(callId),
      failed: failedCallIds.has(callId),
      time: timeOf(ev.timestamp),
      turn: Math.max(turn, 1),
      category: categoryOfTool(name),
    });
  }
  return rows;
}

/**
 * 单行渲染。
 * @param row 轨迹行
 * @returns 行节点
 */
function TraceRowLine(props: { row: TraceRow }): ReactElement {
  const { row } = props;
  return (
    <div className={'tr-row' + (row.failed ? ' failed' : '')}>
      <span className="tr-ico" aria-hidden="true">
        {icon(iconOfTool(row.name), { size: 14 })}
      </span>
      <span className="tr-act" title={row.action}>
        {row.action}
      </span>
      <span className={row.failed ? 'tr-st err' : row.done ? 'tr-st ok' : 'tr-st run'}>
        {row.failed ? t('失败') : row.done ? t('完成') : t('进行中')}
      </span>
      <span className="tr-time" aria-hidden="true">
        {row.time}
      </span>
    </div>
  );
}

/**
 * 筛选工具栏：chips（带计数）+ 搜索框。
 * @param props 当前筛选、搜索、计数与回调
 * @returns 工具栏节点
 */
function TraceToolbar(props: {
  filter: TraceFilterKind;
  query: string;
  counts: Readonly<Record<TraceFilterKind, number>>;
  onFilter: (kind: TraceFilterKind) => void;
  onQuery: (query: string) => void;
}): ReactElement {
  const { filter, query, counts, onFilter, onQuery } = props;
  return (
    <div className="tr-tools">
      <div className="tr-chips" role="group" aria-label={t('筛选轨迹')}>
        {TRACE_FILTERS.map((item) => (
          <button
            key={item.kind}
            type="button"
            className={'tr-chip' + (filter === item.kind ? ' on' : '')}
            aria-pressed={filter === item.kind}
            onClick={() => onFilter(item.kind)}
          >
            {t(item.label)}
            <span className="tr-chip-count">{counts[item.kind]}</span>
          </button>
        ))}
      </div>
      <input
        type="search"
        className="tr-search"
        placeholder={t('搜索轨迹…')}
        aria-label={t('搜索轨迹')}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
    </div>
  );
}

/**
 * 按轮次分组渲染行（第 N 轮分隔）；筛选/搜索态不插分隔，避免与过滤结果错位。
 * @param props 行、是否显示轮次
 * @returns 行节点列表
 */
function TraceRows(props: { rows: readonly TraceRow[]; showTurns: boolean }): ReactElement {
  const { rows, showTurns } = props;
  const out: ReactElement[] = [];
  let lastTurn = 0;
  for (const row of rows) {
    if (showTurns && row.turn !== lastTurn) {
      lastTurn = row.turn;
      out.push(
        <div className="tr-turn" key={'turn:' + String(row.turn)}>
          {t('第 {n} 轮', { n: row.turn })}
        </div>,
      );
    }
    out.push(<TraceRowLine row={row} key={row.key} />);
  }
  return <>{out}</>;
}

/**
 * 轨迹视图：紧凑工具时间线；空态给一句说明（不是空白）。
 * @param props 组件入参
 * @returns 轨迹节点
 */
export function TraceView(props: TraceViewProps): ReactElement {
  const { events, liveInputs, toolResults, hidden } = props;
  const [filter, setFilter] = React.useState<TraceFilterKind>('all');
  const [query, setQuery] = React.useState('');
  // 对话流每个文本增量都会让父组件重渲染；轨迹行只依赖事件/结果，缓存后隐藏态切换不重算。
  const rows = React.useMemo(() => collectRows(events, toolResults), [events, toolResults]);
  const counts = React.useMemo(() => traceFilterCounts(rows), [rows]);
  const shown = React.useMemo(() => filterTraceRows(rows, filter, query), [rows, filter, query]);
  const running = rows.filter((r) => !r.done).length;
  const filtered = filter !== 'all' || query.trim() !== '';
  return (
    <div
      className={'trace' + (hidden === true ? ' view-hidden' : '')}
      role={hidden === true ? undefined : 'log'}
      aria-label={t('工具调用轨迹')}
      aria-hidden={hidden === true ? 'true' : undefined}
    >
      <div className="trace-inner">
        <div className="trace-head" aria-hidden="true">
          {t('共 {count} 次工具调用', { count: rows.length })}
          {running > 0 ? t(' · {count} 次进行中', { count: running }) : ''}
          {filtered ? t(' · 显示 {count} 条', { count: shown.length }) : ''}
        </div>
        {rows.length > 0 ? (
          <TraceToolbar
            filter={filter}
            query={query}
            counts={counts}
            onFilter={setFilter}
            onQuery={setQuery}
          />
        ) : null}
        {rows.length === 0 && liveInputs.length === 0 ? (
          <div className="trace-empty">
            {t('本轮还没有工具调用。发起任务后，读取 / 编辑 / 命令会按顺序出现在这里。')}
          </div>
        ) : shown.length === 0 && liveInputs.length === 0 ? (
          <div className="trace-empty">{t('没有匹配的工具调用。')}</div>
        ) : (
          <div className="trace-list">
            <TraceRows rows={shown} showTurns={!filtered} />
            {liveInputs.map((li) => (
              <div className="tr-row" key={li.id}>
                <span className="tr-ico" aria-hidden="true">
                  {icon('wrench', { size: 14 })}
                </span>
                <span className="tr-act">
                  {(() => {
                    let args: unknown = {};
                    try {
                      args = JSON.parse(li.partial);
                    } catch {
                      args = {};
                    }
                    return describeToolCall(li.name, args);
                  })()}
                </span>
                <span className="tr-st run">{t('进行中')}</span>
                <span className="tr-time" aria-hidden="true"></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
