// 上下文模式（Context）：六类构成 + 压缩时间线 + 便签区（只读，v1 便签未接线如实标注）。
//
// 诚实语义（设计 §5.6）：估算标「估算」；没有压缩写「尚未压缩」；审计未记录写
// 「未记录审计」而不是「全部通过」。

import * as React from 'react';
import type { ReactElement } from 'react';
import { t } from '../../../i18n/i18n.ts';
import { useApp } from '../../../context.ts';
import { timeOf } from '../../../format.ts';
import type { CompactionMarkLike } from '../../../../types/models.ts';
import { useContextStudio } from './useContextStudio.ts';

/** 上下文模式入参。 */
export interface ContextModeProps {
  /** 当前会话 id。 */
  readonly threadId: string | null;
  /** 本 tab 是否活跃。 */
  readonly active: boolean;
}

/** 上下文模式：构成 / 河流切点 / 压缩记录。 */
export function ContextMode(props: ContextModeProps): ReactElement {
  const { snapshot, loading, error, refresh } = useContextStudio(props.threadId, props.active);
  const { api, dialog, toast } = useApp();
  const [openMark, setOpenMark] = React.useState<number | null>(null);
  const [noteText, setNoteText] = React.useState('');
  const [noteBusy, setNoteBusy] = React.useState(false);
  const [compacting, setCompacting] = React.useState(false);

  /**
   * 追加一条交接便签并刷新快照。
   * @returns 无
   */
  const addNote = React.useCallback((): void => {
    const text = noteText.trim();
    if (text === '' || noteBusy) return;
    setNoteBusy(true);
    api
      .contextHandoffAdd(text, ['handoff'])
      .then((note) => {
        if (note === null) {
          toast(t('便签通道未接线，写入失败。'), 'err');
          return;
        }
        setNoteText('');
        refresh();
        toast(t('交接便签已写入；下一次压缩会带上它。'), 'info');
      })
      .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), 'err'))
      .finally(() => setNoteBusy(false));
  }, [api, noteBusy, noteText, refresh, t, toast]);

  /**
   * 立即压缩：二次确认后写回压缩游标。
   * @returns 无
   */
  const compactNow = React.useCallback((): void => {
    if (compacting) return;
    void dialog
      .confirm(
        t('立即压缩会改写压缩游标并折叠较早历史；运行中的会话会被拒绝。确定继续？'),
        {
          title: t('立即压缩上下文'),
          confirmLabel: t('压缩'),
          cancelLabel: t('取消'),
          danger: true,
        },
      )
      .then((ok) => {
        if (!ok) return;
        setCompacting(true);
        return api
          .contextCompact(props.threadId ?? '')
          .then((result) => {
            if (!result.ok) {
              toast(result.message, 'err');
              return;
            }
            toast(
              t('压缩已写入：折叠 {n} 条，下一次请求会使用新游标。', {
                n: result.compactedUpTo,
              }),
              'info',
            );
            refresh();
          })
          .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), 'err'))
          .finally(() => setCompacting(false));
      });
  }, [api, compacting, dialog, props.threadId, refresh, t, toast]);

  if (props.threadId === null || props.threadId === '') {
    return <div className="control-mode">{t('先选择一个会话，再查看上下文。')}</div>;
  }
  if (error !== null) {
    return (
      <div className="control-mode">
        <p className="hint">{t('上下文报告读取失败：{msg}', { msg: error })}</p>
        <button type="button" onClick={refresh}>
          {t('重试')}
        </button>
      </div>
    );
  }
  if (snapshot?.error !== undefined && snapshot.error !== '') {
    return (
      <div className="control-mode">
        <p className="hint">{t('上下文报告读取失败：{msg}', { msg: snapshot.error })}</p>
        <button type="button" onClick={refresh}>
          {t('重试')}
        </button>
      </div>
    );
  }
  if (loading && snapshot === null) {
    return <div className="control-mode">{t('正在读取上下文…')}</div>;
  }
  if (snapshot === null) {
    // 活跃 tab 的第一帧还没拿到数据：显示读取中，避免闪一下「暂无」。
    return <div className="control-mode">{props.active ? t('正在读取上下文…') : t('暂无上下文数据。')}</div>;
  }
  const report = snapshot.report;
  const sourceLabel =
    report.source === 'measured' ? t('实测') : report.source === 'estimated' ? t('估算') : t('无数据');
  return (
    <div className="control-mode">
      <section className="control-block" aria-label={t('本轮构成')}>
        <h3>
          {t('本轮构成')} · <span className="hint">{sourceLabel}</span>
        </h3>
        <p className="control-meta mono">
          {report.usedTokens.toLocaleString()} / {report.windowTokens.toLocaleString()} · {report.percent}%
        </p>
        <div className="control-detail__actions">
          <button
            type="button"
            className="control-danger-action"
            disabled={compacting}
            onClick={compactNow}
          >
            {compacting ? t('压缩中…') : t('立即压缩')}
          </button>
          <span className="hint">
            {t('只对空闲会话生效；会写回压缩游标，不是仅刷新显示。')}
          </span>
        </div>
        <div className="control-usage" role="img" aria-label={t('六类构成')}>
          {report.rows.map((row) => (
            <div
              key={row.label}
              className={`control-usage__seg control-usage__seg--${row.key ?? 'other'}`}
              style={{ flexGrow: Math.max(row.tokens, 0) }}
              title={`${row.label} ${row.tokens.toLocaleString()}（${row.percent}%）`}
            />
          ))}
        </div>
        <ul className="control-legend">
          {report.rows.map((row) => (
            <li key={row.label}>
              {row.label} <span className="mono">{row.percent}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="control-block" aria-label={t('压缩记录')}>
        <h3>{t('压缩切点')}</h3>
        {snapshot.compactions.length === 0 ? (
          <p className="hint">{t('尚未压缩。当会话接近窗口预算时，内核会把较早历史折叠为摘要，切点会出现在这里。')}</p>
        ) : (
          <ul className="control-marks">
            {snapshot.compactions.map((mark, index) => (
              <CompactionRow
                key={mark.at + String(index)}
                mark={mark}
                open={openMark === index}
                onToggle={() => setOpenMark(openMark === index ? null : index)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="control-block" aria-label={t('交接便签')}>
        <h3>{t('交接便签')}</h3>
        {snapshot.handoffAvailable ? (
          <>
            <p className="hint">
              {t('工作区级便签；压缩摘要会自动带上最新一条，重置后仍能恢复「做到哪、下一步」。')}
            </p>
            <label className="control-note-form">
              <span>{t('写一条交接便签')}</span>
              <textarea
                rows={3}
                value={noteText}
                maxLength={2000}
                placeholder={t('例：已完成 A；下一步 B；约束：不要改 C。')}
                onChange={(event) => setNoteText(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="control-inline-action"
              disabled={noteText.trim() === '' || noteBusy}
              onClick={addNote}
            >
              {noteBusy ? t('写入中…') : t('写入便签')}
            </button>
            {snapshot.handoff.length === 0 ? (
              <p className="hint">{t('便签通道已接线，但还没有便签。')}</p>
            ) : (
              <ul className="control-notes">
                {snapshot.handoff.map((note) => (
                  <li key={note.id}>
                    <p>{note.text}</p>
                    <p className="hint">
                      {timeOf(Date.parse(note.createdAt))}
                      {note.tags.length > 0 ? ` · ${note.tags.join('、')}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="hint">
            {t(
              '便签通道未接线（内核 ScratchpadPort 在当前 serve 路径没有注入点），v1 暂无便签；接线后这里显示跨压缩存活的交接内容。',
            )}
          </p>
        )}
      </section>
    </div>
  );
}

/** 压缩记录行的入参。 */
interface CompactionRowProps {
  readonly mark: CompactionMarkLike;
  readonly open: boolean;
  readonly onToggle: () => void;
}

/** 一条压缩记录：轮次 / 时间 / 折叠范围 + 可展开的摘要与审计状态。 */
function CompactionRow(props: CompactionRowProps): ReactElement {
  const { mark, open } = props;
  return (
    <li className="control-mark">
      <button
        type="button"
        className="control-mark__head"
        onClick={props.onToggle}
        aria-expanded={open}
      >
        <span className="control-dot control-dot--cut" aria-hidden="true">
          <span className="control-dot__ink" />
        </span>
        <span>
          {t('第 {n} 轮后', { n: mark.turnIndex + 1 })} · {timeOf(Date.parse(mark.at))} ·{' '}
          <span className="mono">{t('折叠 {n} 条', { n: mark.compactedUpTo })}</span>
        </span>
        {mark.auditRecorded ? null : <span className="hint"> · {t('未记录审计')}</span>}
      </button>
      {open ? (
        <div className="control-mark__body">
          <p className="mono hint">
            {t('前缀指纹 {hash}', { hash: mark.headHash })}
          </p>
          <pre className="control-summary">{mark.summary}</pre>
        </div>
      ) : null}
    </li>
  );
}
