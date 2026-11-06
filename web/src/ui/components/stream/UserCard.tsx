// 用户消息卡：展示用户文本；末条用户消息挂载「编辑重发」入口。
// 编辑重发（F4）把该消息填回底部输入框（ComposerDraft），用户在输入框里改完直接回车即重发——
// 重发复用既有提交通路（turns.run），不新造 RPC，也不再维护第二套内联编辑器。
// 函数组件范式：无内部 state，纯展示 + 一个回调。

import * as React from 'react';
import { badge, timeOf } from '../../format.ts';
import { icon } from '../../models/Icon.ts';
import { formatDurationMs } from '../../models/DurationFormat.ts';
import type { ThreadEvent } from '../../../types/models.ts';
import { t } from '../../i18n/i18n.ts';

/** UserCard 组件的入参。 */
export interface UserCardProps {
  /** 用户事件（payload.content 为消息文本）。 */
  ev: ThreadEvent;
  /** 回合进行中（编辑按钮在 busy 时隐藏，避免与生成态冲突）。 */
  busy?: boolean;
  /** 是否允许编辑（仅最后一条用户消息挂载）。 */
  canEdit: boolean;
  /** 本段对话独立用时（ms；未收口/不足 1s 不显示）。 */
  turnDurationMs?: number;
  /** 编辑重发：把这条消息填回底部输入框。 */
  onEdit: () => void;
  /**
   * 从此处重开（仅历史用户消息；最后一条走「编辑重发」）。
   * 服务端回退事件流到这条消息，再从已回填的输入框继续。
   */
  onRewind?: () => void;
}

/**
 * 用户消息卡：展示消息文本；允许时提供「编辑重发」（填回输入框）。
 * @param props 组件入参
 * @returns 用户消息节点
 */
export function UserCard(props: UserCardProps): ReactElement {
  const { ev, canEdit, busy, turnDurationMs, onEdit, onRewind } = props;
  const text = (ev.payload?.content as string) || '';
  const turnDuration =
    turnDurationMs !== undefined && turnDurationMs >= 1000
      ? formatDurationMs(turnDurationMs)
      : '';
  return (
    <>
      <div className="head">
        {badge('user')}
        <span className="time">{timeOf(ev.timestamp)}</span>
        {turnDuration === '' ? null : (
          <span className="time turn-duration" title={t('本段对话从提问到完成的有效时长')}>
            {t('本轮用时 {duration}', { duration: turnDuration })}
          </span>
        )}
        {onRewind !== undefined && !canEdit && busy !== true ? (
          <button
            className="msg-act"
            title={t('从此处重开：回到这条消息，之后的事件会从会话中移除（文件不自动还原）')}
            aria-label={t('从此处重开')}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onRewind();
            }}
          >
            {icon('rewind', { size: 12 })}
          </button>
        ) : null}
        {canEdit && busy !== true ? (
          <button
            className="msg-act"
            title={t('编辑重发：把这条消息填回输入框，改完回车重发')}
            aria-label={t('编辑重发')}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            {icon('pencil', { size: 12 })} {t('编辑重发')}
          </button>
        ) : null}
      </div>
      <div className={'card ' + ev.type}>
        <div className="content" spellCheck="false">
          {text}
        </div>
      </div>
    </>
  );
}
