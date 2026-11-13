import * as React from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Segmented from 'antd/es/segmented';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useApp } from '../../context.ts';
import { icon } from '../../models/Icon.ts';
import { t } from '../../i18n/i18n.ts';
import type {
  DecisionRowLike,
  DecisionTurnSummaryLike,
} from '../../../types/models.ts';
import { DecisionDetailPanel } from './decision/DecisionDetailPanel.tsx';
import {
  AuditSettingsDialog,
  ExportDialog,
  VerificationDrawer,
} from './decision/DecisionDialogs.tsx';
import { DecisionList } from './decision/DecisionList.tsx';
import { filterRows, type DecisionFilter } from './decision/decisionModel.ts';
import { useDecisionLedger } from './decision/useDecisionLedger.ts';

/** 决策账本面板入参。 */
export interface DecisionTabProps {
  /** 当前会话 id（null / 空 = 未选会话）。 */
  readonly threadId: string | null;
}

/**
 * 决策账本（2026-11-11）：执行前决策列表 + 为什么 + 双链/共形复核 + 导出。
 *
 * 一个 job：只回答「这次调用为什么被允许/拒绝」；不复制审计全局链，也不复制凭证回合证书。
 * @param props 当前会话。
 * @returns 面板节点。
 */
export function DecisionTab(props: DecisionTabProps): React.ReactElement {
  const { toast } = useApp();
  const ledger = useDecisionLedger(props.threadId);
  const [filter, setFilter] = React.useState<DecisionFilter>('all');
  const [turnIndex, setTurnIndex] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState('');
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    setFilter('all');
    setTurnIndex(null);
    setQuery('');
    setVerifyOpen(false);
    setExportOpen(false);
    setSettingsOpen(false);
  }, [props.threadId]);

  React.useEffect(() => {
    if (ledger.view === null) return;
    if (turnIndex !== null && !ledger.view.turns.some((turn) => turn.turnIndex === turnIndex)) {
      setTurnIndex(null);
    }
  }, [ledger.view, turnIndex]);

  const copy = React.useCallback(
    (text: string): void => {
      void navigator.clipboard
        .writeText(text)
        .then(() => toast(t('已复制'), 'info'))
        .catch((error: unknown) => toast(error instanceof Error ? error.message : String(error), 'err'));
    },
    [toast],
  );

  if (props.threadId === null || props.threadId === '') {
    return (
      <div className="decision-tab">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('先选择一个会话，再打开决策账本')}
        />
        <Typography.Paragraph type="secondary" className="decision-note">
          {t('账本跟随当前会话；没有会话时不会跨项目读取。')}
        </Typography.Paragraph>
      </div>
    );
  }

  if (ledger.loading && ledger.view === null) {
    return (
      <div className="decision-tab" aria-busy="true">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (ledger.error !== null && ledger.view === null) {
    return (
      <div className="decision-tab">
        <Alert
          type="error"
          showIcon
          message={t('决策账本读取失败')}
          description={ledger.error}
          action={
            <Button size="small" onClick={ledger.refresh}>
              {t('重试')}
            </Button>
          }
        />
      </div>
    );
  }

  if (ledger.view === null) return <div className="decision-tab" />;

  const view = ledger.view;
  const filtered = filterRows(view.rows, filter, turnIndex, query);
  const groups = groupsOf(view.turns, filtered);
  const exportable = view.rows.length > 0 && view.structural.status === 'pass';

  return (
    <div className="decision-tab">
      <header className="decision-head">
        <div className="decision-head__meta">
          <div className="decision-head__line">
            <span className={`decision-state-dot decision-state-dot--${view.audit.enabled ? 'on' : 'off'}`} aria-hidden="true" />
            <Typography.Text strong>
              {view.audit.enabled
                ? t('决策审计已开启')
                : view.audit.closed
                  ? t('决策审计已关闭 · 仅历史')
                  : t('决策审计当前关闭')}
            </Typography.Text>
            <span className="decision-head__sep" aria-hidden="true">·</span>
            <Typography.Text type="secondary">
              {t('{decisions} 条决策 · 覆盖 {recorded}/{total} 回合', {
                decisions: view.counts.decisions,
                recorded: view.coverage.turnsRecorded,
                total: view.coverage.turnsTotal,
              })}
            </Typography.Text>
          </div>
          <Typography.Text type="secondary" className="decision-head__hint">
            {t('先有裁决，后有动作；这里解释执行前的依据，不改写任何记录。')}
          </Typography.Text>
        </div>
        <Space wrap size={8}>
          <Button
            icon={icon('refresh', { size: 14 })}
            loading={ledger.refreshing}
            onClick={() => {
              ledger.refresh();
              setVerifyOpen(true);
            }}
          >
            {t('复核')}
          </Button>
          <Button
            type="primary"
            icon={icon('download', { size: 14 })}
            disabled={!exportable}
            onClick={() => setExportOpen(true)}
          >
            {t('导出 AAT')}
          </Button>
          <Button icon={icon('sliders', { size: 14 })} onClick={() => setSettingsOpen(true)}>
            {t('审计设置')}
          </Button>
        </Space>
      </header>

      {view.structural.status === 'fail' ? (
        <Alert
          type="error"
          showIcon
          message={t('结构复核失败，导出已禁用')}
          description={view.structural.problems[0]?.detail ?? t('原始审计链或 AAT 链不连续。')}
        />
      ) : null}
      {view.audit.closed ? (
        <Alert
          type="info"
          showIcon
          message={t('审计已关闭')}
          description={t('已有记录保留；关闭后的回合不再追加，不能补造。')}
        />
      ) : null}
      {view.coverage.partial ? (
        <Alert
          type="warning"
          showIcon
          message={t('链完整 {aat}/{aat}；覆盖 {recorded}/{total} 回合', {
            aat: view.structural.aatCount,
            recorded: view.coverage.turnsRecorded,
            total: view.coverage.turnsTotal,
          })}
          description={t('审计从第 {n} 回合开始；之前的回合没有决策记录，不能补造。', {
            n: view.coverage.firstRecordedTurn ?? 0,
          })}
        />
      ) : null}

      <section className="decision-summary" aria-label={t('决策摘要')}>
        <Metric label={t('决策')} value={view.counts.decisions} />
        <Metric label={t('放行')} value={view.counts.allow} tone="allow" />
        <Metric label={t('升级')} value={view.counts.escalate} tone="escalate" />
        <Metric label={t('拒绝')} value={view.counts.deny} tone="deny" />
        <Metric label={t('共形放行')} value={view.counts.conformal} tone="accent" />
        <div className="decision-summary__chain">
          <span className="decision-summary__chain-label">{t('AAT 链')}</span>
          <span className={`decision-summary__chain-value${view.structural.status === 'pass' ? ' is-pass' : ' is-fail'}`}>
            {view.structural.aatCount}/{view.structural.aatCount}
          </span>
          <span className="decision-summary__chain-label">{t('原始')}</span>
          <span className={`decision-summary__chain-value${view.structural.status === 'pass' ? ' is-pass' : ' is-fail'}`}>
            {view.structural.auditCount}/{view.structural.auditCount}
          </span>
          {view.truncated ? <Tag bordered>{t('仅显示最近 500 条')}</Tag> : null}
        </div>
      </section>

      <div className="decision-toolbar">
        <Segmented
          className="decision-segmented"
          value={filter}
          onChange={(value) => setFilter(value as DecisionFilter)}
          options={[
            { value: 'all', label: t('全部') },
            { value: 'allow', label: t('放行') },
            { value: 'escalate', label: t('升级') },
            { value: 'deny', label: t('拒绝') },
            { value: 'conformal', label: t('共形') },
          ]}
        />
        <div className="decision-toolbar__right">
          <Select
            className="decision-turn-select"
            value={turnIndex}
            allowClear
            placeholder={t('全部回合')}
            aria-label={t('筛选回合')}
            options={view.turns.map((turn) => ({
              value: turn.turnIndex,
              label: turn.displayIndex === 0 ? t('系统回合') : t('第 {n} 回合', { n: turn.displayIndex }),
            }))}
            onChange={(value) => setTurnIndex(typeof value === 'number' ? value : null)}
          />
          <Input
            className="decision-search"
            value={query}
            allowClear
            placeholder={t('搜索工具名')}
            prefix={icon('search', { size: 14 })}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('搜索工具名')}
          />
        </div>
      </div>

      {view.rows.length === 0 ? (
        <DecisionEmpty
          enabled={view.audit.enabled}
          onEnable={() => setSettingsOpen(true)}
        />
      ) : (
        <div className="decision-body">
          <DecisionList groups={groups} selectedRecordId={ledger.selectedRecordId} onSelect={ledger.selectRecord} />
          <DecisionDetailPanel
            detail={ledger.detail}
            loading={ledger.detailLoading}
            error={ledger.detailError}
            selected={ledger.selectedRecordId !== null}
            onClose={() => ledger.selectRecord('')}
            onCopy={copy}
          />
        </div>
      )}

      <VerificationDrawer
        open={verifyOpen}
        view={view}
        refreshing={ledger.refreshing}
        onClose={() => setVerifyOpen(false)}
        onRefresh={ledger.refresh}
      />
      <ExportDialog
        open={exportOpen}
        view={view}
        onClose={() => setExportOpen(false)}
        onExport={ledger.exportEvidence}
      />
      <AuditSettingsDialog
        open={settingsOpen}
        settings={{
          enabled: view.audit.enabled,
          ...(view.audit.configuredPrincipal !== undefined
            ? { principal: view.audit.configuredPrincipal }
            : {}),
        }}
        onClose={() => setSettingsOpen(false)}
        onSave={ledger.configure}
      />
    </div>
  );
}

/** 摘要指标入参。 */
interface MetricProps {
  readonly label: string;
  readonly value: number;
  readonly tone?: 'allow' | 'escalate' | 'deny' | 'accent';
}

/**
 * 摘要指标（不用 antd Statistic 的大数字模板，避免 hero-metric）。
 * @param props 标签 / 值 / 语义色。
 * @returns 指标节点。
 */
function Metric(props: MetricProps): React.ReactElement {
  return (
    <div className={`decision-metric${props.tone !== undefined ? ` decision-metric--${props.tone}` : ''}`}>
      <span className="decision-metric__label">{props.label}</span>
      <span className="decision-metric__value">{String(props.value)}</span>
    </div>
  );
}

/**
 * 按回合分组当前过滤结果（只保留有行的回合）。
 * @param turns 回合摘要。
 * @param rows 过滤后的行。
 * @returns 分组。
 */
function groupsOf(
  turns: readonly DecisionTurnSummaryLike[],
  rows: readonly DecisionRowLike[],
): readonly { readonly turn: DecisionTurnSummaryLike; readonly rows: readonly DecisionRowLike[] }[] {
  return turns
    .map((turn) => ({ turn, rows: rows.filter((row) => row.turnIndex === turn.turnIndex) }))
    .filter((group) => group.rows.length > 0);
}

/**
 * 空态：区分未开启 / 已开启但无记录。
 * @param props 是否开启 / 开启回调。
 * @returns 空态节点。
 */
function DecisionEmpty(props: { readonly enabled: boolean; readonly onEnable: () => void }): React.ReactElement {
  return (
    <div className="decision-empty">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={props.enabled ? t('审计已开启，还没有工具调用') : t('决策审计当前关闭')}
      />
      <Typography.Paragraph type="secondary" className="decision-empty__hint">
        {props.enabled
          ? t('下一回合的工具调用会产生 policy_snapshot / decision / 授权记录；开启前的回合无法补造。')
          : t('开启后每次工具调用前都会写一条执行前记录；开启前的回合无法补造。')}
      </Typography.Paragraph>
      {!props.enabled ? (
        <Button type="primary" onClick={props.onEnable}>
          {t('开启决策审计')}
        </Button>
      ) : null}
    </div>
  );
}
