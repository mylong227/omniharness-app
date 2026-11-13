import * as React from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Checkbox from 'antd/es/checkbox';
import Drawer from 'antd/es/drawer';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Switch from 'antd/es/switch';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useApp } from '../../../context.ts';
import { t } from '../../../i18n/i18n.ts';
import type {
  DecisionCheckLike,
  DecisionExportResultLike,
  DecisionSessionViewLike,
  DecisionSettingsLike,
} from '../../../../types/models.ts';
import {
  downloadText,
} from './decisionModel.ts';

/** 复核抽屉入参。 */
export interface VerificationDrawerProps {
  readonly open: boolean;
  readonly view: DecisionSessionViewLike;
  readonly refreshing: boolean;
  readonly onClose: () => void;
  readonly onRefresh: () => void;
}

/**
 * 结构 + 共形复核抽屉。
 * @param props 打开 / 视图 / 刷新。
 * @returns 抽屉节点。
 */
export function VerificationDrawer(props: VerificationDrawerProps): React.ReactElement {
  const { view } = props;
  const structural = view.structural;
  const conformal = view.conformal;
  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      size={560}
      title={t('复核这份账本')}
      className="decision-drawer"
      extra={
        <Button size="small" loading={props.refreshing} onClick={props.onRefresh}>
          {t('重新复核')}
        </Button>
      }
    >
      <div className="decision-verify" aria-live="polite">
        <Typography.Paragraph type="secondary">
          {t('原始审计链、AAT 链、共形证据三者独立；只有全部通过才显示绿色。')}
        </Typography.Paragraph>

        {structural.status === 'fail' ? (
          <Alert
            type="error"
            showIcon
            message={t('结构复核失败')}
            description={structural.problems[0]?.detail ?? t('原始审计链或 AAT 链不连续。')}
          />
        ) : null}
        {structural.status === 'disabled' ? (
          <Alert type="info" showIcon message={t('决策审计当前关闭')} description={t('开启后只记录未来回合。')} />
        ) : null}
        {structural.status === 'empty' ? (
          <Alert type="info" showIcon message={t('还没有决策记录')} description={t('审计已开启，等待下一回合的工具调用。')} />
        ) : null}

        <section className="decision-verify__section" aria-label={t('结构复核')}>
          <h3 className="decision-section-title">{t('结构复核')}</h3>
          <p className="decision-verify__meta">
            {t('{audit} 条原始 audit 记录 · {aat} 条 AAT 记录', {
              audit: structural.auditCount,
              aat: structural.aatCount,
            })}
          </p>
          <CheckList checks={structural.checks} />
        </section>

        <section className="decision-verify__section" aria-label={t('共形复核')}>
          <h3 className="decision-section-title">{t('共形复核')}</h3>
          {conformal.status === 'not_applicable' ? (
            <Alert
              type="info"
              showIcon
              message={t('共形复核未运行（不是通过）')}
              description={t('本会话没有共形放行；这不等于共形证据通过。')}
            />
          ) : null}
          {conformal.status === 'not_run' ? (
            <Alert type="info" showIcon message={t('尚未复核')} description={t('开启审计并产生工具调用后再复核。')} />
          ) : null}
          {conformal.status !== 'not_applicable' && conformal.status !== 'not_run' ? (
            <>
              <p className="decision-verify__meta">
                {t('复核 {decisions} 条共形决策 · {snapshots} 个校准快照', {
                  decisions: conformal.checkedDecisions,
                  snapshots: conformal.snapshots,
                })}
              </p>
              <CheckList checks={conformal.checks} />
              {conformal.problems.length > 0 ? (
                <ul className="decision-problems">
                  {conformal.problems.map((problem, index) => (
                    <li key={`${problem.code}-${String(index)}`}>
                      <span className="decision-mono">{problem.code}</span> {problem.detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </section>

        <footer className="decision-verify__foot">
          <Tag bordered>{t('AAT-09 子集')}</Tag>
          <Tag bordered>L0</Tag>
          <Tag bordered>{t('未签名')}</Tag>
          <Typography.Paragraph type="secondary">
            {t('链自洽不等于内容为真；未签名不等于可信。导出包只在结构 + 共形都通过时生成。')}
          </Typography.Paragraph>
        </footer>
      </div>
    </Drawer>
  );
}

/**
 * 复核项列表。
 * @param props 检查项。
 * @returns 列表。
 */
function CheckList(props: { readonly checks: readonly DecisionCheckLike[] }): React.ReactElement {
  if (props.checks.length === 0) {
    return <Typography.Text type="secondary">{t('没有可展示的检查项。')}</Typography.Text>;
  }
  return (
    <ul className="decision-checks">
      {props.checks.map((check) => (
        <li key={check.code} className={`decision-check decision-check--${check.status}`}>
          <span className="decision-check__state">{checkStatusLabel(check.status)}</span>
          <span className="decision-check__code decision-mono">{check.code}</span>
          <span className="decision-check__detail">{check.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** 导出对话框入参。 */
export interface ExportDialogProps {
  readonly open: boolean;
  readonly view: DecisionSessionViewLike;
  readonly onClose: () => void;
  readonly onExport: () => Promise<DecisionExportResultLike | string>;
}

/**
 * 导出 AAT 证据（本地下载；结构/共形失败时禁用）。
 * @param props 打开 / 视图 / 导出动作。
 * @returns 对话框节点。
 */
export function ExportDialog(props: ExportDialogProps): React.ReactElement {
  const { toast } = useApp();
  const [exporting, setExporting] = React.useState(false);
  const blocked = props.view.structural.status !== 'pass' || props.view.conformal.status === 'fail';
  const runExport = (): void => {
    setExporting(true);
    void props
      .onExport()
      .then((result) => {
        if (typeof result === 'string') {
          toast(result, 'err');
          return;
        }
        downloadText(result.filename, result.content);
        downloadText(
          `${result.filename.replace(/\.json$/u, '')}.sha256.txt`,
          `${result.digest}  ${result.filename}\n${result.sessionHash}  session\n`,
          'text/plain',
        );
        toast(t('已导出 {name}', { name: result.filename }), 'info');
        props.onClose();
      })
      .finally(() => setExporting(false));
  };
  return (
    <Modal
      open={props.open}
      onCancel={props.onClose}
      title={t('导出 AAT 证据')}
      okText={t('导出')}
      cancelText={t('取消')}
      confirmLoading={exporting}
      okButtonProps={{ disabled: blocked }}
      onOk={runExport}
    >
      <div className="decision-export">
        <p className="decision-export__summary">
          {t('{decisions} 条决策 · {aat} 条 AAT 记录 · {audit} 条原始审计记录', {
            decisions: props.view.counts.decisions,
            aat: props.view.structural.aatCount,
            audit: props.view.structural.auditCount,
          })}
        </p>
        <p className="decision-export__meta">
          {t('结构：{structural} · 共形：{conformal}', {
            structural: props.view.structural.status === 'pass' ? t('通过') : t('未通过'),
            conformal:
              props.view.conformal.status === 'not_applicable'
                ? t('未运行（不是通过）')
                : props.view.conformal.status === 'pass'
                  ? t('通过')
                  : t('未通过'),
          })}
        </p>
        <Alert
          type="info"
          showIcon
          message={t('包含什么')}
          description={t('策略快照、裁决、审批、授权 ID、共形 α/τ/r 与校准单元；不含工具参数原文，不上传。')}
        />
        {blocked ? (
          <Alert
            type="error"
            showIcon
            message={t('复核未通过，导出已禁用')}
            description={t('先处理断链或共形证据问题，再导出。')}
          />
        ) : null}
        <Typography.Text type="secondary">
          {t('导出为标准 AAT records JSON + 同名 .sha256.txt；离线用同版本内核复核。')}
        </Typography.Text>
      </div>
    </Modal>
  );
}

/** 审计设置对话框入参。 */
export interface AuditSettingsDialogProps {
  readonly open: boolean;
  readonly settings: DecisionSettingsLike;
  readonly onClose: () => void;
  readonly onSave: (enabled: boolean, principal: string | undefined) => Promise<DecisionSettingsLike | string>;
}

/**
 * 决策审计设置（用户级开关 + 主体；只影响未来回合）。
 * @param props 打开 / 当前设置 / 保存。
 * @returns 对话框节点。
 */
export function AuditSettingsDialog(props: AuditSettingsDialogProps): React.ReactElement {
  const { toast } = useApp();
  const [enabled, setEnabled] = React.useState(props.settings.enabled);
  const [principal, setPrincipal] = React.useState(props.settings.principal ?? '');
  const [confirmed, setConfirmed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!props.open) return;
    setEnabled(props.settings.enabled);
    setPrincipal(props.settings.principal ?? '');
    setConfirmed(false);
    setError(null);
  }, [props.open, props.settings.enabled, props.settings.principal]);

  const blocked = enabled && !confirmed;
  const save = (): void => {
    setSaving(true);
    setError(null);
    void props
      .onSave(enabled, principal.trim() === '' ? undefined : principal.trim())
      .then((result) => {
        if (typeof result === 'string') {
          setError(result);
          return;
        }
        toast(enabled ? t('决策审计已开启；下一回合生效。') : t('决策审计已关闭；历史记录保留。'), 'info');
        props.onClose();
      })
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      open={props.open}
      onCancel={props.onClose}
      title={t('决策审计设置')}
      okText={t('保存')}
      cancelText={t('取消')}
      confirmLoading={saving}
      okButtonProps={{ disabled: blocked }}
      onOk={save}
    >
      <div className="decision-settings">
        <Alert
          type="warning"
          showIcon
          message={t('只记录未来回合')}
          description={t('开启前的回合没有决策记录，不能补造；关闭后已有记录保留但不再追加。')}
        />
        <div className="decision-settings__row">
          <div>
            <div className="decision-settings__label">{t('记录执行前决策')}</div>
            <div className="decision-settings__hint">{t('每次工具调用前写 policy_snapshot / decision / 授权。')}</div>
          </div>
          <Switch checked={enabled} onChange={setEnabled} aria-label={t('记录执行前决策')} />
        </div>
        <div className="decision-settings__field">
          <div className="decision-settings__label">{t('授权主体（可选）')}</div>
          <Input
            value={principal}
            placeholder="local:you"
            maxLength={200}
            onChange={(event) => setPrincipal(event.target.value)}
            aria-label={t('授权主体')}
          />
          <div className="decision-settings__hint">{t('不填则复核会标记「主体缺失」；不会用当前用户回填历史记录。')}</div>
        </div>
        {enabled ? (
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>
            {t('我理解：开启前的回合无法补造。')}
          </Checkbox>
        ) : null}
        {error !== null ? <Alert type="error" showIcon message={error} /> : null}
        <Typography.Text type="secondary" className="decision-note">
          {t('设置落在本机 OmniHome；下一回合生效；不改变工具放行结果。')}
        </Typography.Text>
      </div>
    </Modal>
  );
}

/**
 * 复核状态文案。
 * @param status 状态。
 * @returns 文案。
 */
function checkStatusLabel(status: DecisionCheckLike['status']): string {
  switch (status) {
    case 'pass':
      return t('通过');
    case 'warn':
      return t('未证明');
    default:
      return t('失败');
  }
}
