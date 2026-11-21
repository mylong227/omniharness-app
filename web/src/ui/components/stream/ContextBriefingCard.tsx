// 上下文注记卡：把「机器写给机器看」的 system 事件收成一张可展开的简报卡。
//
// 背景（2026-11-16 用户截图反馈）：压缩游标（`OMNI_COMPACTION_V1 … evidence=…`）与工作流记忆
// 召回（`[WorkflowMemory] → shell …`）此前按纯文本平铺，几 KB 的 base64 与上千字的命令串
// 像一段没有格式的墙横在对话里。用户要的是：**默认可收起、可展开，展开后是一份排好版的预览**。
//
// 折叠态 = 一枚图标 + 标题 + 元信息（游标 / 字数 / 步数）+ 一行摘要 + 「展开」；
// 展开态 = 证据 chip + 分节后的 Markdown（压缩摘要）或逐条编号的步骤（工作流记忆）。
// 正文按需挂载：未展开时不进 DOM——长会话里这些摘要动辄数万字，白挂一次就是白付一次布局。
//
// 纯展示组件（函数组件范式）：唯一内部状态是展开态；判定与文案全部来自 models/SystemNote。

import * as React from 'react';
import { renderMarkdown } from '../../format.ts';
import { icon } from '../../kit/Icon.tsx';
import type { IconName } from '../../kit/Icon.tsx';
import { SystemNote, type SystemNoteBody, type SystemNoteView } from '../../models/SystemNote.ts';
import { t } from '../../i18n/i18n.ts';

/** SystemNoteNode 组件的入参。 */
export interface SystemNoteNodeProps {
  /** system 事件的 payload.content。 */
  readonly content: string;
}

/** ContextBriefingCard 组件的入参。 */
export interface ContextBriefingCardProps {
  /** SystemNote.classify 的产物（短旁白不会走到这里）。 */
  readonly view: SystemNoteView;
}

/** 每种注记的图标：压缩=归档、工作流记忆=流程、其余长注记=分层。 */
const KIND_ICON: Record<SystemNoteView['kind'], IconName> = {
  compaction: 'archive',
  memory: 'workflow',
  plain: 'layers',
};

/**
 * 拆一步「工具名 + 目标」：首个 ASCII 单词是工具名，其余是目标（命令 / 路径 / 参数）。
 * 不是这个形态（纯中文、`patch:…` 这类）就整段当命令，不硬拆。
 * @param step 单步原文
 * @returns 工具名与目标
 */
function splitStep(step: string): { readonly verb: string; readonly detail: string } {
  const hit = /^([a-z][a-z0-9_.-]*)\s+([\s\S]+)$/iu.exec(step);
  if (hit === null) return { verb: step, detail: '' };
  return { verb: hit[1] ?? step, detail: (hit[2] ?? '').trim() };
}

/**
 * 展开态正文：Markdown 文档 / 有序步骤 / 保留换行的原文。
 * @param props 正文模型
 * @returns 正文节点
 */
function NoteBody(props: { readonly body: SystemNoteBody }): ReactElement {
  const { body } = props;
  if (body.type === 'markdown') {
    return <div className="ctx-note__doc">{renderMarkdown(body.markdown)}</div>;
  }
  if (body.type === 'text') {
    return <div className="ctx-note__text">{body.text}</div>;
  }
  return (
    <ol className="ctx-steps">
      {body.steps.map((step, index) => {
        const { verb, detail } = splitStep(step);
        return (
          <li className="ctx-step" key={`${String(index)}:${step}`}>
            <span className="ctx-step__cmd">
              <span className="ctx-step__verb">{verb}</span>
              {detail === '' ? null : <span className="ctx-step__target">{detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * system 事件的对话流节点：长注记收成折叠卡，短旁白仍是一行 `— 旁白 —`。
 *
 * 归类结果按 content 记忆：中栏是虚拟化列表，一条已收口的事件会在之后每一帧流式增量里
 * 重渲染；压缩摘要动辄数万字，`sectionize` 每次重跑一遍纯属白烧（内容不变 ⇒ 结果不变）。
 * @param props 事件正文
 * @returns 折叠卡或一行旁白
 */
export function SystemNoteNode(props: SystemNoteNodeProps): ReactElement {
  const { content } = props;
  const view = React.useMemo(() => SystemNote.classify(content), [content]);
  if (view === null) {
    return (
      <div className="sysnote" spellCheck="false">
        — {content} —
      </div>
    );
  }
  return <ContextBriefingCard view={view} />;
}

/**
 * 上下文注记卡：折叠态是一行简报，展开后是排好版的正文。
 * @param props 视图模型
 * @returns 卡片节点
 */
export function ContextBriefingCard(props: ContextBriefingCardProps): ReactElement {
  const { view } = props;
  const [open, setOpen] = React.useState(false);
  const bodyId = React.useId();

  return (
    // 阻断冒泡：外层 `.ev.clickable` 会把点击上抛成「事件钻取」，而读摘要时点一下不该跳走。
    // spellCheck 关掉：卡里是命令 / 路径 / 工具名，红波浪线纯属噪音。
    // kind 修饰类带出「身份色温」（--note-tint）：图标 + 分节锚点共用一个信号源（左侧色轨已撤，
    // 2026-11-18 用户反馈——高亮弧在圆角下读成「括号」，喧宾夺主）。
    <div
      className={`ctx-note ctx-note--${view.kind}` + (open ? ' ctx-note--open' : '')}
      spellCheck="false"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <button
        type="button"
        className="ctx-note__head"
        aria-expanded={open ? 'true' : 'false'}
        // 收起时正文不在 DOM 里：不给 aria-controls 指向不存在的 id（无效 IDREF 会被辅助技术忽略，
        // 在 axe 里也是 aria-valid-attr-value 的违规项）。
        aria-controls={open ? bodyId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ctx-note__row">
          <span className="ctx-note__ico" aria-hidden="true">
            {icon(KIND_ICON[view.kind], { size: 14 })}
          </span>
          <span className="ctx-note__title">{view.title}</span>
          {view.meta === '' ? null : <span className="ctx-note__meta">{view.meta}</span>}
          <span className="ctx-note__toggle">
            <span>{open ? t('收起') : t('展开')}</span>
            <span className="ctx-note__chev" aria-hidden="true">
              {icon('chevron-down', { size: 12, strokeWidth: 2.2 })}
            </span>
          </span>
        </span>
        {open || view.excerpt === '' ? null : (
          <span className="ctx-note__excerpt" title={view.excerpt}>
            {view.excerpt}
          </span>
        )}
      </button>
      {open ? (
        <div className="ctx-note__body" id={bodyId}>
          {view.chips.length === 0 ? null : (
            <div className="ctx-note__chips">
              {view.chips.map((chip) => (
                <span className={`ctx-note__chip ctx-note__chip--${chip.tone}`} key={chip.text}>
                  {chip.text}
                </span>
              ))}
            </div>
          )}
          <NoteBody body={view.body} />
        </div>
      ) : null}
    </div>
  );
}
