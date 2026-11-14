// 上下文模式（Context）：六类构成 + 压缩时间线 + 便签区。
//
// 诚实语义（设计 §5.6）：估算标「估算」；没有压缩写「尚未压缩」；审计未记录写
// 「未记录审计」而不是「全部通过」。
//
// 2026-11-11 控制台 antd 化：卡片/按钮/折叠/输入/空态/错误态全部换成 antd 组件，
// 只保留「六类构成条」这一处自绘图形（antd 没有按比例堆叠的分段条）。

import * as React from 'react';
import type { ReactElement } from 'react';
// 子路径导入（不走 barrel，理由见 vite.config.ts「分块改造」注释）。
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Collapse from 'antd/es/collapse';
import Divider from 'antd/es/divider';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { t } from '../../../i18n/i18n.ts';
import { contextRowLabelOf } from '../../../models/KernelTextOverrides.ts';
import { useApp } from '../../../context.ts';
import { icon } from '../../../models/Icon.ts';
import { timeOf } from '../../../format.ts';
import type { CompactionMarkLike, ContextStudioSnapshotLike } from '../../../../types/models.ts';
import { EmptyState } from '../../../kit/EmptyState.tsx';
import { PanelSection } from '../../../kit/PanelSection.tsx';
import { StatusTag } from '../../../kit/StatusTag.tsx';
import type { StatusKind } from '../../../kit/StatusTag.tsx';
import { useContextStudio } from './useContextStudio.ts';

/** 上下文模式入参。 */
export interface ContextModeProps {
  /** 当前会话 id。 */
  readonly threadId: string | null;
  /** 本 tab 是否活跃。 */
  readonly active: boolean;
}

/**
 * 快照来源 → 徽标语义（实测=成功、估算=中性、无数据=警告）。
 * @param source 快照来源。
 * @returns StatusTag 的语义档。
 */
function sourceStatusKind(source: ContextStudioSnapshotLike['report']['source']): StatusKind {
  if (source === 'measured') return 'ok';
  if (source === 'estimated') return 'neutral';
  return 'warn';
}

/** 上下文模式：构成 / 河流切点 / 压缩记录。 */
export function ContextMode(props: ContextModeProps): ReactElement {
  const { snapshot, loading, error, refresh } = useContextStudio(props.threadId, props.active);
  const { api, dialog, toast } = useApp();
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
  }, [api, noteBusy, noteText, refresh, toast]);

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
  }, [api, compacting, dialog, props.threadId, refresh, toast]);

  if (props.threadId === null || props.threadId === '') {
    return <EmptyState title={t('先选择一个会话，再查看上下文。')} />;
  }
  if (error !== null || (snapshot?.error !== undefined && snapshot.error !== '')) {
    const message = error ?? snapshot?.error ?? '';
    return (
      <Alert
        type="error"
        showIcon
        message={t('上下文报告读取失败：{msg}', { msg: message })}
        action={
          <Button size="small" onClick={refresh}>
            {t('重试')}
          </Button>
        }
      />
    );
  }
  if (loading && snapshot === null) {
    return <Skeleton active title={false} paragraph={{ rows: 6 }} />;
  }
  if (snapshot === null) {
    return props.active ? (
      <Skeleton active title={false} paragraph={{ rows: 6 }} />
    ) : (
      <EmptyState title={t('暂无上下文数据。')} />
    );
  }
  const report = snapshot.report;
  const sourceLabel =
    report.source === 'measured' ? t('实测') : report.source === 'estimated' ? t('估算') : t('无数据');
  return (
    <Flex vertical gap={16}>
      <PanelSection
        title={t('本轮构成')}
        extra={<StatusTag status={sourceStatusKind(report.source)}>{sourceLabel}</StatusTag>}
      >
        <Flex vertical gap={12}>
          <Typography.Text type="secondary" className="mono">
            {report.usedTokens.toLocaleString()} / {report.windowTokens.toLocaleString()} · {report.percent}%
          </Typography.Text>
          <div className="control-usage" role="img" aria-label={t('六类构成')}>
            {report.rows.map((row) => (
              <div
                key={row.key}
                className={`control-usage__seg control-usage__seg--${row.key ?? 'other'}`}
                style={{ flexGrow: Math.max(row.tokens, 0) }}
                title={`${contextRowLabelOf(String(row.key), row.label)} ${row.tokens.toLocaleString()}（${row.percent}%）`}
              />
            ))}
          </div>
          <Space wrap size={16}>
            {report.rows.map((row) => (
              <Typography.Text key={row.key} type="secondary">
                {contextRowLabelOf(String(row.key), row.label)} <span className="mono">{row.percent}%</span>
              </Typography.Text>
            ))}
          </Space>
          <Divider dashed style={{ margin: 0, borderBlockStartColor: 'var(--border-soft)' }} />
          <Flex align="center" wrap gap={12}>
            <Button
              danger
              icon={icon('archive', { size: 14 })}
              loading={compacting}
              onClick={compactNow}
            >
              {compacting ? t('压缩中…') : t('立即压缩')}
            </Button>
            <Typography.Text type="secondary">
              {t('只对空闲会话生效；会写回压缩游标，不是仅刷新显示。')}
            </Typography.Text>
          </Flex>
        </Flex>
      </PanelSection>

      <PanelSection title={t('压缩切点')}>
        {snapshot.compactions.length === 0 ? (
          <Typography.Text type="secondary">
            {t('尚未压缩。当会话接近窗口预算时，内核会把较早历史折叠为摘要，切点会出现在这里。')}
          </Typography.Text>
        ) : (
          <Collapse
            ghost
            size="small"
            expandIconPlacement="end"
            items={snapshot.compactions.map((mark, index) => ({
              key: `${mark.at}-${String(index)}`,
              label: <CompactionLabel mark={mark} />,
              children: <CompactionBody mark={mark} />,
            }))}
          />
        )}
      </PanelSection>

      <PanelSection title={t('交接便签')}>
        {snapshot.handoffAvailable ? (
          <Flex vertical gap={12}>
            <Typography.Text type="secondary">
              {t('工作区级便签；压缩摘要会自动带上最新一条，重置后仍能恢复「做到哪、下一步」。')}
            </Typography.Text>
            <Flex vertical gap={8}>
              <Typography.Text type="secondary">{t('写一条交接便签')}</Typography.Text>
              <Input.TextArea
                rows={3}
                maxLength={2000}
                showCount
                value={noteText}
                placeholder={t('例：已完成 A；下一步 B；约束：不要改 C。')}
                aria-label={t('写一条交接便签')}
                onChange={(event) => setNoteText(event.target.value)}
              />
              <Flex align="center" wrap gap={12}>
                <Button
                  type="primary"
                  icon={icon('pencil', { size: 14 })}
                  disabled={noteText.trim() === '' || noteBusy}
                  loading={noteBusy}
                  onClick={addNote}
                >
                  {noteBusy ? t('写入中…') : t('写入便签')}
                </Button>
                {snapshot.handoff.length === 0 ? (
                  <Typography.Text type="secondary">{t('便签通道已接线，但还没有便签。')}</Typography.Text>
                ) : null}
              </Flex>
            </Flex>
            {snapshot.handoff.length === 0 ? null : (
              <List
                size="small"
                split={false}
                dataSource={[...snapshot.handoff]}
                renderItem={(note) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Typography.Text>{note.text}</Typography.Text>}
                      description={
                        <Typography.Text type="secondary" className="mono">
                          {timeOf(Date.parse(note.createdAt))}
                          {note.tags.length > 0 ? ` · ${note.tags.join('、')}` : ''}
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Flex>
        ) : (
          <Typography.Text type="secondary">
            {t(
              '便签通道未接线（内核 ScratchpadPort 在当前 serve 路径没有注入点），v1 暂无便签；接线后这里显示跨压缩存活的交接内容。',
            )}
          </Typography.Text>
        )}
      </PanelSection>
    </Flex>
  );
}

/** 折叠项标题的入参。 */
interface CompactionLabelProps {
  readonly mark: CompactionMarkLike;
}

/** 一条压缩记录的标题行：轮次 / 时间 / 折叠范围 + 审计徽标。 */
function CompactionLabel(props: CompactionLabelProps): ReactElement {
  const { mark } = props;
  return (
    <Flex align="center" gap={8} wrap>
      <Typography.Text>
        {t('第 {n} 轮后', { n: mark.turnIndex + 1 })} · {timeOf(Date.parse(mark.at))} ·{' '}
        <span className="mono">{t('折叠 {n} 条', { n: mark.compactedUpTo })}</span>
      </Typography.Text>
      {mark.auditRecorded ? null : <StatusTag status="warn">{t('未记录审计')}</StatusTag>}
    </Flex>
  );
}

/** 一条压缩记录的展开体：前缀指纹 + 摘要正文。 */
function CompactionBody(props: CompactionLabelProps): ReactElement {
  return (
    <Flex vertical gap={8}>
      <Typography.Text type="secondary" className="mono">
        {t('前缀指纹 {hash}', { hash: props.mark.headHash })}
      </Typography.Text>
      <pre className="control-summary">{props.mark.summary}</pre>
    </Flex>
  );
}
