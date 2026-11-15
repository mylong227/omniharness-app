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
import Descriptions from 'antd/es/descriptions';
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
import type {
  CompactionMarkLike,
  ContextCacheStat,
  ContextStudioSnapshotLike,
  KernelContextViewLike,
} from '../../../../types/models.ts';
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

/**
 * 内核上下文是否至少有一项开着（决定徽标是「按配置启用」还是「全部关闭」）。
 * @param kernel 内核上下文视图
 * @returns 是否有任一开关生效
 */
function kernelEnabled(kernel: KernelContextViewLike): boolean {
  const retrieval = kernel.retrievalContext;
  const policy = kernel.contextPolicy;
  return (
    retrieval.mode !== 'off' ||
    retrieval.rewriter !== 'off' ||
    retrieval.rerank !== 'off' ||
    kernel.semanticRecall.requested ||
    policy.shapersAggressive ||
    policy.compactionForce ||
    policy.cacheGuardFloor !== undefined
  );
}

/**
 * 内核上下文徽标语义：语义召回降档 = 警告（不是正常），有开关 = 成功，全关 = 中性。
 * @param kernel 内核上下文视图
 * @returns StatusTag 语义档
 */
function kernelStatusKind(kernel: KernelContextViewLike): StatusKind {
  if (kernel.semanticRecall.degraded) return 'warn';
  return kernelEnabled(kernel) ? 'ok' : 'neutral';
}

/**
 * 内核上下文徽标文案（与 {@link kernelStatusKind} 同源，避免色与字互相矛盾）。
 * @param kernel 内核上下文视图
 * @returns 徽标文案
 */
function kernelStatusLabel(kernel: KernelContextViewLike): string {
  if (kernel.semanticRecall.degraded) return t('降档运行');
  return kernelEnabled(kernel) ? t('按配置启用') : t('全部关闭');
}

/**
 * 布尔开关 → 「开 / 关」。
 * @param value 开关值
 * @returns 文案
 */
function onOffText(value: boolean): string {
  return value ? t('已启用') : t('未启用');
}

/**
 * 模型开关 → 「未启用 / 模型」。
 * @param mode 开关值
 * @returns 文案
 */
function modeText(mode: 'off' | 'model'): string {
  return mode === 'off' ? t('未启用') : t('模型');
}

/**
 * 检索供给一行：未启用，或 BM25 + 单步预算（未配置时如实说「内核默认」）。
 * @param retrieval 检索视图
 * @returns 文案
 */
function retrievalText(retrieval: KernelContextViewLike['retrievalContext']): string {
  if (retrieval.mode === 'off') return t('未启用');
  const snippets =
    retrieval.maxSnippets === undefined ? t('内核默认') : String(retrieval.maxSnippets);
  const tokens = retrieval.maxTokens === undefined ? t('内核默认') : String(retrieval.maxTokens);
  return t('BM25 · 单步 ≤{n} 条 / ≤{k} token', { n: snippets, k: tokens });
}

/**
 * 语义召回一行：降档必须显式说出（不能读成「未启用」）。
 * @param recall 语义召回视图
 * @returns 文案
 */
function semanticRecallText(recall: KernelContextViewLike['semanticRecall']): string {
  if (recall.degraded) return t('已请求，嵌入不可用（BM25 降档）');
  if (recall.active) return t('启用（嵌入在位）');
  return t('未启用');
}

/**
 * 缓存守卫一行：未设下限 = 未启用；设了则带当前命中率（未上报显示「未上报」）。
 * @param floor 命中率下限
 * @param cache 会话缓存统计
 * @returns 文案
 */
function cacheGuardText(floor: number | undefined, cache: ContextCacheStat): string {
  if (floor === undefined) return t('未启用');
  const rate = cache.hitRate === undefined ? t('未上报') : `${String(cache.hitRate)}%`;
  return t('命中率下限 {floor} · 当前 {rate}', { floor: String(floor), rate });
}

/** 上下文模式：本轮构成 / 内核上下文策略 / 压缩记录 / 交接便签。 */
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

      <PanelSection
        title={t('内核上下文策略')}
        extra={
          <StatusTag status={kernelStatusKind(snapshot.kernel)}>
            {kernelStatusLabel(snapshot.kernel)}
          </StatusTag>
        }
      >
        <Flex vertical gap={10}>
          <Descriptions
            className="control-kernel-context"
            size="small"
            column={1}
            colon={false}
            items={[
              {
                key: 'retrieval',
                label: t('检索供给'),
                children: retrievalText(snapshot.kernel.retrievalContext),
              },
              {
                key: 'rewrite',
                label: t('查询改写 / 精排'),
                children: t('改写 {rewrite} · 精排 {rerank}', {
                  rewrite: modeText(snapshot.kernel.retrievalContext.rewriter),
                  rerank: modeText(snapshot.kernel.retrievalContext.rerank),
                }),
              },
              {
                key: 'semantic',
                label: t('语义召回'),
                children: semanticRecallText(snapshot.kernel.semanticRecall),
              },
              {
                key: 'ladder',
                label: t('降档阶梯'),
                children: t('激进裁剪 {a} · 强制压缩 {b}', {
                  a: onOffText(snapshot.kernel.contextPolicy.shapersAggressive),
                  b: onOffText(snapshot.kernel.contextPolicy.compactionForce),
                }),
              },
              {
                key: 'guard',
                label: t('缓存守卫'),
                children: cacheGuardText(
                  snapshot.kernel.contextPolicy.cacheGuardFloor,
                  report.cache,
                ),
              },
            ]}
          />
          <Typography.Text type="secondary">
            {t('以上是内核 alpha.19 上下文三段的生效值；入口在「设置 → 运行时 → 上下文与检索」。')}
          </Typography.Text>
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

/**
 * 压缩审计徽标语义：无证据 = 警告（不是通过）；有证据按 `ok` 分通过/有缺失。
 * @param mark 压缩记录
 * @returns StatusTag 语义档
 */
function auditStatusKind(mark: CompactionMarkLike): StatusKind {
  if (mark.audit === undefined) return 'warn';
  return mark.audit.ok ? 'ok' : 'warn';
}

/**
 * 压缩审计徽标文案（与 {@link auditStatusKind} 同源）。
 * @param mark 压缩记录
 * @returns 文案
 */
function auditStatusText(mark: CompactionMarkLike): string {
  if (mark.audit === undefined) return t('未记录审计');
  return mark.audit.ok ? t('审计通过') : t('审计有缺失');
}

/**
 * 一条压缩记录的标题行：轮次 / 时间 / 折叠范围 + 审计徽标。
 * @param props 压缩记录
 * @returns 标题节点
 */
function CompactionLabel(props: CompactionLabelProps): ReactElement {
  const { mark } = props;
  return (
    <Flex align="center" gap={8} wrap>
      <Typography.Text>
        {t('第 {n} 轮后', { n: mark.turnIndex + 1 })} · {timeOf(Date.parse(mark.at))} ·{' '}
        <span className="mono">{t('折叠 {n} 条', { n: mark.compactedUpTo })}</span>
      </Typography.Text>
      <StatusTag status={auditStatusKind(mark)}>{auditStatusText(mark)}</StatusTag>
    </Flex>
  );
}

/**
 * 一条压缩记录的展开体：前缀指纹 + 摘要正文 + alpha.21 压缩证据（审计/信号）。
 * @param props 压缩记录
 * @returns 展开体节点
 */
function CompactionBody(props: CompactionLabelProps): ReactElement {
  const { mark } = props;
  return (
    <Flex vertical gap={8}>
      <Typography.Text type="secondary" className="mono">
        {t('前缀指纹 {hash}', { hash: mark.headHash })}
      </Typography.Text>
      {mark.audit === undefined ? null : (
        <Flex vertical gap={2}>
          <Typography.Text type="secondary">
            {t('审计核对：{files} 个文件 / {commands} 条命令 / {todos} 项待办', {
              files: String(mark.audit.checked.editedFiles),
              commands: String(mark.audit.checked.commands),
              todos: String(mark.audit.checked.openTodos),
            })}
          </Typography.Text>
          {mark.audit.missing.length === 0 ? (
            <Typography.Text type="secondary">{t('关键状态全部在场。')}</Typography.Text>
          ) : (
            mark.audit.missing.map((item) => (
              <Typography.Text key={item} type="danger">
                · {item}
              </Typography.Text>
            ))
          )}
        </Flex>
      )}
      {mark.signals === undefined ? null : (
        <Typography.Text type="secondary">
          {t('触发信号：预算 {ratio} · 轮数 {turns} · 工具占比 {share} · 重复率 {rep}；组合规则{combined}', {
            ratio: String(mark.signals.budgetRatio),
            turns: String(mark.signals.turns),
            share: String(mark.signals.toolResultShare),
            rep: String(mark.signals.repetitionRate),
            combined: mark.signals.combinedWouldTrigger ? t('建议触发') : t('不建议触发'),
          })}
        </Typography.Text>
      )}
      <pre className="control-summary">{mark.summary}</pre>
    </Flex>
  );
}
