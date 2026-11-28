// 事件级渲染函数（2026-11-01 从 StreamView 下沉）：按事件类型产出对话流节点。
//
// 独立成文件的原因：StreamView.tsx 挂着文件行数基线（check.mjs 白名单，只减不增），
// 原地抽函数带 JSDoc 会让文件越线；且这些渲染函数本就自包含——只吃事件与只读上下文，
// 分派器（renderEventNode）留在 StreamView，这里只放「叶子渲染」。
// S2 长函数清偿批次：renderEventNode 体 135 → <80。

import * as React from 'react';
import { badge, jsonView, questionView, timeOf, todoBrief, todoView } from '../../format.ts';
import { EventFields } from '../../models/EventFields.ts';

/**
 * 事件载荷 pretty-print 的按 id 缓存：折叠体（audit / unknown）的 JSON.stringify 在
 * <details> 折叠态也照常执行，事件流每个 SSE 增量都会重跑视口内全部折叠体（一轮几十条）
 * ——2026-11-28 评审发现的真实每帧开销。载荷不可变（事件不可变语义），按 id 缓存一次。
 */
const PAYLOAD_JSON_CACHE = new Map<string, string>();

/**
 * 取事件载荷的 pretty-print（按事件 id 缓存；上限 600 条，超限即不再缓存直算）。
 * @param ev 事件
 * @returns pretty-print JSON 文本
 */
function payloadJsonOf(ev: ThreadEvent): string {
  const cached = PAYLOAD_JSON_CACHE.get(ev.id);
  if (cached !== undefined) return cached;
  const json = JSON.stringify(ev.payload ?? {}, null, 2);
  if (PAYLOAD_JSON_CACHE.size < 600) PAYLOAD_JSON_CACHE.set(ev.id, json);
  return json;
}
import { icon } from '../../kit/Icon.tsx';
import { SystemNoteNode } from './ContextBriefingCard.tsx';
import { t } from '../../i18n/i18n.ts';
import type { ThreadEvent } from '../../../types/models.ts';
import type { ToolResultView } from '../../shared.ts';

/** 事件渲染上下文（StreamView 组装，渲染函数只读）。 */
export interface EventCtx {
  /** 当前会话 id（压缩注跳转上下文面板的路由参数；null = 未选会话）。 */
  threadId: string | null;
  toolResults: Record<string, ToolResultView>;
  onEventClick: (ev: ThreadEvent) => void;
  onOpenFile?: (path: string) => Promise<boolean> | boolean | void;
  /** 只查文件是否存在（结果卡过滤已删除的临时产物；不打开文件）。 */
  onCheckFile?: (path: string) => Promise<boolean> | boolean;
  /** 在右栏网页标签打开本地地址（缺省时不渲染该入口）。 */
  onOpenUrl?: (url: string) => void;
  busy?: boolean;
  /** 最后一条用户消息 id（仅它可编辑重发）。 */
  lastUserId: string;
  /** 最后一条助手消息 id（仅它可重新生成）。 */
  lastAssistantId: string;
  onEditUser?: () => void;
  /** 历史用户消息「从此处重开」：服务端回退事件流到该消息（最后一条走编辑重发）。 */
  onRewindUser?: (ev: ThreadEvent) => void;
  /** 引用追问：把该消息以引用块填回输入框（缺省不渲染入口）。 */
  onQuote?: (ev: ThreadEvent) => void;
  onRegenerate?: () => void;
  /** 已被 assistant 事件收口的流式文本。 */
  finalizedStreamText: string;
  /** 本回合出现过的工具调用 id（只读：仅用于 `has` 判定）。 */
  toolCallIds: ReadonlySet<string>;
  /** 每段对话（user 事件 id）的独立用时。 */
  turnDurations: ReadonlyMap<string, number>;
  /** 是否正有提问等待作答（对话流里的提问卡据此给出「去下方提问卡作答」的指引）。 */
  questionPending: boolean;
  /** 回合刚收尾（1.5s 内）：思考轨迹挂载瞬间的「回闪」高亮。历史加载恒 false。 */
  clusterFresh: boolean;
}

/** 事件包装器形态（给 ev 套统一外壳并可点击钻取）。 */
export type EvWrapper = (inner: React.ReactElement) => React.ReactElement;

/**
 * 孤儿工具结果（调用被历史截断）折叠成一行可展开的独立事件。
 * @param ev 事件本体
 * @param p 事件负载
 * @returns 节点
 */
export function renderStandaloneToolResult(ev: ThreadEvent, p: Record<string, unknown>): React.ReactElement {
  return (
    <details className="ev tool_result standalone" key={ev.id}>
      <summary className="tc-line dim">
        <span className="tc-chevron">▸</span>
        <span className="tc-icon">{icon('undo', { size: 14 })}</span>
        <span className="tc-summary">{t('工具结果（独立事件）')}</span>
      </summary>
      <div className="tc-detail">
        <div className="tool-output">{JSON.stringify(p)}</div>
      </div>
    </details>
  );
}

/**
 * system 事件：上下文中继类注记（压缩游标 / 工作流记忆 / 长注记）收成一张可展开的简报卡，
 * 一两句旁白仍按普通系统注记渲染。
 * @param p 事件负载
 * @param node 事件包装器
 * @returns 节点
 */
export function renderSystemNode(
  p: Record<string, unknown>,
  ctx: EventCtx,
  node: EvWrapper,
): React.ReactElement {
  // 2026-11-16 用户反馈：压缩游标（带 evidence=）与工作流记忆（单行 → 步骤串）此前按纯文本
  // 平铺，几 KB 的 base64 与上千字命令串糊满一屏。2026-11-27/28 收敛为单行注入注；
  // 压缩详情的家在右栏「上下文」面板（压缩切点分区）——流内只给跳转入口，不重建详情。
  return node(
    <SystemNoteNode
      content={(p.content as string) || ''}
      threadId={ctx.threadId}
    />,
  );
}

/**
 * 审计记录折叠块（2026-11-15）：每轮把 audit 事件收成一条默认收起的摘要，展开才看逐条 JSON。
 *
 * 为什么不在聊天流逐条展示：audit 是内部事实（heartbeat / approval / decision 各一条 JSON），
 * 一轮几十条会把对话糊满（用户截图反馈「太长、重复、单调」）。完整审计仍在审计/决策面板。
 * @param events 本轮 audit 事件（保持时间顺序）
 * @returns 折叠块节点
 */
export function renderAuditGroup(events: readonly ThreadEvent[]): React.ReactElement {
  const kinds = new Map<string, number>();
  for (const ev of events) {
    const kind = auditKindOf(ev);
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  const kindText = [...kinds.entries()].map(([kind, count]) => `${kind}×${String(count)}`).join(' · ');
  return (
    <details className="audit-fold" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <summary className="audit-fold__summary">
        <span className="audit-fold__icon" aria-hidden="true">
          {icon('shield-alert', { size: 14 })}
        </span>
        <span>{t('审计记录 × {n}', { n: events.length })}</span>
        {kindText === '' ? null : <span className="audit-fold__kinds">{kindText}</span>}
        <span className="audit-fold__hint">{t('点击展开')}</span>
      </summary>
      <div className="audit-fold__body">
        {events.map((ev) => (
          <div className="audit-record" key={ev.id}>
            <div className="audit-record__head">
              <span className="mono">{auditTimeOf(ev)}</span>
              <span className="audit-record__kind">{auditKindOf(ev)}</span>
            </div>
            <pre className="audit-record__json">{payloadJsonOf(ev)}</pre>
          </div>
        ))}
      </div>
    </details>
  );
}

/**
 * 取 audit 事件的记录类型（heartbeat / approval / decision…）；形态不符回退 `audit`。
 * @param ev audit 事件
 * @returns 记录类型
 */
function auditKindOf(ev: ThreadEvent): string {
  const record = (ev.payload as { record?: unknown } | undefined)?.record;
  const kind = (record as { kind?: unknown } | undefined)?.kind;
  return typeof kind === 'string' && kind !== '' ? kind : 'audit';
}

/**
 * 取 audit 事件的展示时间（兼容 number / ISO；非法给空串）。
 * @param ev audit 事件
 * @returns 本地时间文本
 */
function auditTimeOf(ev: ThreadEvent): string {
  // 归一单源（EventFields.timestamp）：number / ISO 双形态的兼容只写一份。
  return timeOf(EventFields.timestamp(ev));
}

/**
 * 待办清单事件（2026-11-27 收编为折叠摘要）：badge + 完成计数 + 当前进行项一行摘要，
 * 点击展开全量。为什么折叠：底部计划坞（TodoDock）已经常驻显示最新待办，流内历史卡
 * 再整表铺开就是同屏重复（用户报「重复了」）；历史卡的职责是留痕，不是抢实时状态位。
 * @param p 事件负载
 * @param node 事件包装器
 * @returns 节点
 */
export function renderTodoNode(p: Record<string, unknown>, node: EvWrapper): React.ReactElement {
  const todos = (p.todos as Parameters<typeof todoView>[0]) || [];
  if (todos.length === 0) {
    return node(
      <>
        <div className="head">{badge('todo')}</div>
        {todoView(todos)}
      </>,
    );
  }
  const brief = todoBrief(todos);
  return node(
    // 阻断冒泡（与 audit-fold / unknown-fold 同纪律）：折叠开关的点击不该顺带打开事件钻取。
    <details
      className="todo-event"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <summary className="head todo-event__summary">
        {badge('todo')}
        <span className="todo-event__brief">
          {brief.done}/{brief.total}
          {brief.current === undefined ? null : (
            <span className="todo-event__current">{brief.current}</span>
          )}
        </span>
      </summary>
      {todoView(todos)}
    </details>,
  );
}

/**
 * 计划事件：badge 头 + JSON 视图。
 * @param p 事件负载
 * @param node 事件包装器
 * @returns 节点
 */
export function renderPlanNode(p: Record<string, unknown>, node: EvWrapper): React.ReactElement {
  return node(
    <>
      <div className="head">{badge('plan')}</div>
      <div className="card">{jsonView(p)}</div>
    </>,
  );
}

/**
 * 提问事件：badge 头 + 提问卡（pending 态由 ctx 传入）。
 * @param p 事件负载
 * @param ctx 渲染上下文
 * @param node 事件包装器
 * @returns 节点
 */
export function renderQuestionNode(
  p: Record<string, unknown>,
  ctx: EventCtx,
  node: EvWrapper,
): React.ReactElement {
  return node(
    <>
      <div className="head">{badge('question')}</div>
      <div className="card">{questionView((p.questions as unknown) || p, { pending: ctx.questionPending })}</div>
    </>,
  );
}

/**
 * 未知事件类型兜底：badge 头 + JSON 全文（新事件先可见、后美化）。
 * @param ev 事件本体
 * @param p 事件负载
 * @param node 事件包装器
 * @returns 节点
 */
export function renderUnknownNode(
  ev: ThreadEvent,
  p: Record<string, unknown>,
  node: EvWrapper,
): React.ReactElement {
  // 未知事件默认收起：裸 JSON 平铺会像审计记录一样糊满整屏（2026-11-15 用户反馈
  // 「整屏重复、单调」）。先给一行可识别的摘要，点击再展开完整负载。
  return node(
    <details className="sysnote-fold unknown-fold" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <summary className="sysnote-fold__summary">
        {badge(ev.type)} · {t('点击展开')}
      </summary>
      <div className="sysnote-fold__body">
        <pre className="unknown-fold__json" spellCheck="false">
          {JSON.stringify(p, null, 2)}
        </pre>
      </div>
    </details>,
  );
}
