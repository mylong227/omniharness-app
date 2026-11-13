import * as React from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Skeleton from 'antd/es/skeleton';
import Tag from 'antd/es/tag';
import Tooltip from 'antd/es/tooltip';
import Typography from 'antd/es/typography';
import { icon } from '../../../models/Icon.ts';
import { t } from '../../../i18n/i18n.ts';
import type { DecisionDetailViewLike, DecisionDispositionLike } from '../../../../types/models.ts';
import {
  basisLabel,
  decisionTime,
  dispositionLabels,
  effectClassLabel,
  shortHash,
} from './decisionModel.ts';

/** 详情面板入参。 */
export interface DecisionDetailPanelProps {
  readonly detail: DecisionDetailViewLike | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly selected: boolean;
  readonly onClose: () => void;
  readonly onCopy: (text: string) => void;
}

/**
 * 单条决策详情：为什么 + 依据 + 审批 + 关联动作 + 链。
 * @param props 详情 / 加载 / 错误 / 关闭。
 * @returns 详情节点。
 */
export function DecisionDetailPanel(props: DecisionDetailPanelProps): React.ReactElement {
  if (!props.selected) {
    return (
      <aside className="decision-detail decision-detail--empty" aria-label="决策详情">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('选一条决策，查看执行前依据')}
        />
        <Typography.Paragraph type="secondary" className="decision-note">
          {t('这里解释「谁允许、依据哪版策略、审批和授权发生了什么」，不改写任何记录。')}
        </Typography.Paragraph>
      </aside>
    );
  }
  if (props.loading) {
    return (
      <aside className="decision-detail" aria-label={t('决策详情')} aria-busy="true">
        <Skeleton active paragraph={{ rows: 8 }} />
      </aside>
    );
  }
  if (props.error !== null || props.detail === null) {
    return (
      <aside className="decision-detail" aria-label={t('决策详情')}>
        <Alert
          type="error"
          showIcon
          message={t('决策详情读取失败')}
          description={props.error ?? t('服务端没有返回详情。')}
          action={
            <Button size="small" onClick={props.onClose}>
              {t('关闭')}
            </Button>
          }
        />
      </aside>
    );
  }
  return <DetailBody detail={props.detail} onClose={props.onClose} onCopy={props.onCopy} />;
}

/**
 * 详情正文。
 * @param props 详情 / 关闭 / 复制。
 * @returns 正文节点。
 */
function DetailBody(props: {
  readonly detail: DecisionDetailViewLike;
  readonly onClose: () => void;
  readonly onCopy: (text: string) => void;
}): React.ReactElement {
  const { detail } = props;
  const labels = dispositionLabels(detail.row.disposition);
  return (
    <aside className="decision-detail" aria-label={t('决策详情')}>
      <header className="decision-detail__head">
        <div className="decision-detail__title">
          <span className="decision-detail__tool">{detail.row.toolName}</span>
          <Tag className={`decision-tag decision-tag--${labels.tone}`} bordered>
            {labels.disposition}
          </Tag>
        </div>
        <Button
          type="text"
          size="small"
          aria-label={t('关闭决策详情')}
          title={t('关闭（Esc）')}
          icon={icon('x', { size: 14 })}
          onClick={props.onClose}
        />
      </header>
      <Typography.Text type="secondary" className="decision-detail__meta">
        {basisLabel(detail.row.basis)} · {t('第 {n} 回合', { n: detail.row.displayIndex })} ·{' '}
        {decisionTime(detail.row.at)}
      </Typography.Text>

      <section className="decision-detail__section" aria-label={t('为什么')}>
        <h3 className="decision-section-title">{t('为什么')}</h3>
        <Typography.Paragraph className="decision-why">{whyText(detail)}</Typography.Paragraph>
      </section>

      <section className="decision-detail__section" aria-label={t('依据')}>
        <h3 className="decision-section-title">{t('依据')}</h3>
        <DefList
          className="decision-desc"
          size="small"
          column={1}
          colon={false}
          items={[
            {
              key: 'policy',
              label: t('策略快照'),
              children:
                detail.policy !== undefined
                  ? t('{n} 条规则 · {hash}', {
                      n: detail.policy.rules.length,
                      hash: shortHash(detail.policy.snapshotHash),
                    })
                  : t('未记录'),
            },
            { key: 'evaluator', label: t('裁决器'), children: detail.decision.evaluatorId },
            {
              key: 'default',
              label: t('默认 / fail-closed'),
              children: `${detail.decision.defaultApplied} · ${detail.decision.failClosed ? 'true' : 'false'}`,
            },
            {
              key: 'principal',
              label: t('授权主体'),
              children: detail.decision.principal ?? t('未记录'),
            },
            {
              key: 'authorization',
              label: t('单次授权'),
              children:
                detail.authorization !== undefined ? (
                  <span className="decision-kv-inline">
                    <span className="decision-mono">{detail.authorization.id}</span>
                    <Tag
                      className={`decision-tag decision-tag--${detail.authorization.reused ? 'deny' : 'allow'}`}
                      bordered
                    >
                      {detail.authorization.reused ? t('复用') : t('未复用')}
                    </Tag>
                  </span>
                ) : (
                  t('无（未签发）')
                ),
            },
            {
              key: 'conformal',
              label: t('共形证据'),
              children:
                detail.conformal !== undefined
                  ? `α ${formatNumber(detail.conformal.alpha)} · τ ${formatNumber(detail.conformal.threshold)} · r ${formatNumber(detail.conformal.riskScore)}`
                  : t('未启用 / 未发生'),
            },
          ]}
        />
        {detail.policy !== undefined && detail.policy.rules.length > 0 ? (
          <div className="decision-rules" aria-label={t('策略规则摘要')}>
            {detail.policy.rules.map((rule) => (
              <div key={`${rule.ruleId}-${rule.digest}`} className="decision-rule">
                <span className="decision-rule__name">{rule.ruleId}</span>
                <span className="decision-rule__digest">{shortHash(rule.digest)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="decision-detail__section" aria-label={t('审批轨迹')}>
        <h3 className="decision-section-title">{t('审批轨迹')}</h3>
        {detail.approvals.length === 0 ? (
          <Typography.Text type="secondary">{t('未触发人工审批。')}</Typography.Text>
        ) : (
          <ol className="decision-approvals">
            {detail.approvals.map((approval, index) => (
              <li key={`${approval.phase}-${String(index)}`}>
                <span className="decision-approvals__phase">{approval.phase}</span>
                <span>{approval.result}</span>
                <span className="decision-approvals__meta">
                  {approval.by ?? t('未记录主体')} · {decisionTime(approval.at)}
                </span>
                {approval.reason !== undefined ? (
                  <span className="decision-approvals__reason">{approval.reason}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="decision-detail__section" aria-label={t('关联动作')}>
        <h3 className="decision-section-title">{t('关联动作')}</h3>
        <DefList
          className="decision-desc"
          size="small"
          column={1}
          colon={false}
          items={[
            {
              key: 'call',
              label: 'tool_call',
              children:
                detail.toolCall !== undefined
                  ? `${detail.toolCall.toolName} · ${decisionTime(detail.toolCall.at)}`
                  : t('没有执行'),
            },
            {
              key: 'result',
              label: 'tool_result',
              children:
                detail.toolResult !== undefined ? (
                  <span className="decision-kv-inline">
                    <Tag
                      className={`decision-tag decision-tag--${detail.toolResult.ok ? 'allow' : 'deny'}`}
                      bordered
                    >
                      {detail.toolResult.ok ? 'ok' : 'failed'}
                    </Tag>
                    {detail.toolResult.durationMs !== undefined
                      ? `${String(detail.toolResult.durationMs)} ms`
                      : ''}
                  </span>
                ) : (
                  t('没有结果（未执行 / 被拦）')
                ),
            },
          ]}
        />
        {detail.toolResult?.error !== undefined ? (
          <Typography.Paragraph type="danger" className="decision-error">
            {detail.toolResult.error}
          </Typography.Paragraph>
        ) : null}
      </section>

      {detail.conformal !== undefined ? (
        <section className="decision-detail__section decision-conformal" aria-label={t('共形证据')}>
          <h3 className="decision-section-title">{t('共形证据')}</h3>
          <div className="decision-conformal__metrics">
            <Metric label={t('风险预算 α')} value={formatNumber(detail.conformal.alpha)} />
            <Metric label={t('阈值 τ')} value={formatNumber(detail.conformal.threshold)} />
            <Metric label={t('风险分 r')} value={formatNumber(detail.conformal.riskScore)} accent />
          </div>
          <DefList
            className="decision-desc"
            size="small"
            column={1}
            colon={false}
            items={[
              { key: 'class', label: t('效果类'), children: detail.conformal.effectClass },
              { key: 'units', label: t('校准单元'), children: t('{n} 个', { n: detail.conformal.unitCount }) },
              { key: 'snapshot', label: t('快照 id'), children: shortHash(detail.conformal.calibrationSnapshotId) },
              { key: 'class-digest', label: t('类摘要'), children: shortHash(detail.conformal.classDigest) },
              { key: 'global-digest', label: t('全类摘要'), children: shortHash(detail.conformal.calibrationDigest) },
              { key: 'model', label: t('风险模型'), children: shortHash(detail.conformal.riskModelDigest) },
              {
                key: 'features',
                label: t('风险特征'),
                children: t('argKeys {n} · {kind}/{risk}{mutating}', {
                  n: detail.conformal.riskFeatures.argKeys,
                  kind: detail.conformal.riskFeatures.intentKind,
                  risk: detail.conformal.riskFeatures.intentRisk,
                  mutating: detail.conformal.riskFeatures.mutating ? ' · mutating' : '',
                }),
              },
            ]}
          />
          <Typography.Paragraph type="secondary" className="decision-note">
            {t('保证是边际期望（可交换性下），不是逐调用正确；分布漂移会削弱前提。')}
          </Typography.Paragraph>
        </section>
      ) : null}

      <section className="decision-detail__section" aria-label={t('链')}>
        <h3 className="decision-section-title">{t('链')}</h3>
        <div className="decision-chain-line">
          <span className="decision-mono">#{String(detail.chain.sequenceNumber)}</span>
          <span className="decision-mono decision-muted">
            {shortHash(detail.chain.prevHash)} → {shortHash(detail.chain.hash)}
          </span>
          <Tooltip title={t('复制记录哈希')}>
            <Button
              type="text"
              size="small"
              aria-label={t('复制记录哈希')}
              icon={icon('copy', { size: 13 })}
              onClick={() => props.onCopy(detail.chain.hash)}
            />
          </Tooltip>
        </div>
      </section>

      <footer className="decision-detail__foot">
        <Tag bordered>{t('AAT-09 子集')}</Tag>
        <Tag bordered>L0</Tag>
        <Tag bordered>{t('未签名')}</Tag>
        <Typography.Text type="secondary">
          {t('原始参数不进入账本；导出只含记录与摘要。')}
        </Typography.Text>
      </footer>
    </aside>
  );
}

/** 定义列表项（保留 antd Descriptions 的 items 形状，避免把数据改成渲染树）。 */
interface DefItem {
  readonly key: string;
  readonly label: React.ReactNode;
  readonly children: React.ReactNode;
}

/** DefList 的入参（多余属性只为兼容旧调用形状，渲染时忽略）。 */
interface DefListProps {
  readonly items: readonly DefItem[];
  readonly className?: string;
  readonly size?: unknown;
  readonly column?: number;
  readonly colon?: boolean;
}

/**
 * 紧凑定义列表：替代 antd Descriptions（2026-11-11 panel-antd 循环块合并后此选择已无
 * 分块约束，这里用 dl/dt/dd 保持语义，密度由 decision.css 控制）。
 * @param props items。
 * @returns 定义列表。
 */
function DefList(props: DefListProps): React.ReactElement {
  return (
    <dl className={`decision-defs${props.className !== undefined ? ` ${props.className}` : ''}`}>
      {props.items.map((item) => (
        <div className="decision-def" key={item.key}>
          <dt>{item.label}</dt>
          <dd>{item.children}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 详情里的一个小指标。
 * @param props 标签 / 值 / 强调。
 * @returns 指标节点。
 */
function Metric(props: { readonly label: string; readonly value: string; readonly accent?: boolean }): React.ReactElement {
  return (
    <div className="decision-conformal__metric">
      <span className="decision-metric-label">{props.label}</span>
      <span className={`decision-metric-value${props.accent === true ? ' is-accent' : ''}`}>{props.value}</span>
    </div>
  );
}

/**
 * 确定性「为什么」模板（不调用模型）。
 * @param detail 详情。
 * @returns 2–4 句人话。
 */
function whyText(detail: DecisionDetailViewLike): string {
  const conformal = detail.conformal;
  const result = detail.row.disposition;
  if (conformal !== undefined) {
    const scope = `α=${formatNumber(conformal.alpha)}，风险分 ${formatNumber(conformal.riskScore)} < 阈值 ${formatNumber(conformal.threshold)}（${effectClassLabel(conformal.effectClass)}，n=${String(conformal.unitCount)}）`;
    if (isDenied(result)) {
      return `审批层由共形层放行：${scope}；随后沙箱/计划/污点层拒绝，最终未执行。共形块只描述审批层，不代表最终放行。`;
    }
    return `审批层要求升级；共形层以 ${scope} 直接放行。执行前签发单次授权；${executionTail(detail)}`;
  }
  if (detail.approvals.some((item) => item.result === 'approved' || item.result === 'override')) {
    const approver = detail.approvals.find((item) => item.result === 'approved' || item.result === 'override')?.by ?? '未记录主体';
    return `审批层要求升级；${approver} 批准。执行前签发单次授权；${executionTail(detail)}`;
  }
  if (detail.decision.result === 'unavailable') {
    return `裁决器不可用；fail-closed=${detail.decision.failClosed ? 'true' : 'false'}；${executionTail(detail)}`;
  }
  if (detail.row.disposition === 'escalated_pending') {
    return '审批层要求升级；还没有最终回答，因此没有执行。';
  }
  if (detail.row.disposition === 'approved_not_executed') {
    return '审批已批准；但没有发起工具调用，最终未执行。';
  }
  if (isDenied(result)) {
    return `裁决器 ${detail.decision.evaluatorId} 拒绝；未签发授权，未执行。`;
  }
  return `没有规则命中，按默认 ${detail.decision.defaultApplied} 处理；${executionTail(detail)}`;
}

/**
 * 执行尾部文案。
 * @param detail 详情。
 * @returns 一句执行结论。
 */
function executionTail(detail: DecisionDetailViewLike): string {
  if (detail.toolResult !== undefined) return detail.toolResult.ok ? '工具返回成功。' : '工具返回失败。';
  if (detail.toolCall !== undefined) return '已发起工具调用，结果未记录。';
  return '没有执行。';
}

/**
 * 是否最终拒绝。
 * @param disposition 去向。
 * @returns 拒绝 / 共形后被拦 / 不可用。
 */
function isDenied(disposition: DecisionDispositionLike): boolean {
  return disposition === 'denied' || disposition === 'denied_after_conformal' || disposition === 'unavailable';
}

/**
 * 数字短格式。
 * @param value 数字。
 * @returns 最多 3 位小数。
 */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '');
}
