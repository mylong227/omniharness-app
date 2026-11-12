// 凭证模式（Proof）：回合选择 + 证书摘要 + 六项复核 + 导出（只读 + 用户显式导出）。
//
// 诚实语义（设计 §6.6）：未签名只写「结构自洽（未签名）」；本地审计链 ≠ 内核回执链；
// 导出是本地文件，不上传。
//
// 2026-11-11 控制台 antd 化：回合选择 `Segmented`（radiogroup 语义，替代迁移前的
// listbox/option）、摘要/清单/导出 `PanelSection`、
// 证据包导入用隐藏 `<input type=file>` + antd Button 触发、结论用 `StatusTag` 与 `Alert`；
// 两栏布局用 `Row/Col`。

import * as React from 'react';
import type { ReactElement } from 'react';
// 子路径导入（不走 barrel，理由见 vite.config.ts「分块改造」注释）。
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Col from 'antd/es/col';
import Flex from 'antd/es/flex';
import Row from 'antd/es/row';
import Segmented from 'antd/es/segmented';
import Skeleton from 'antd/es/skeleton';
import Typography from 'antd/es/typography';
import { useApp } from '../../../context.ts';
import { t } from '../../../i18n/i18n.ts';
import { timeOf } from '../../../format.ts';
import { icon } from '../../../models/Icon.ts';
import type {
  ProofBundleViewLike,
  ProofCheckLike,
  ProofExportResultLike,
  ProofTurnSummaryLike,
  ProofVerifyResultLike,
} from '../../../../types/models.ts';
import { EmptyState } from '../../../kit/EmptyState.tsx';
import { PanelSection } from '../../../kit/PanelSection.tsx';
import { StatusTag } from '../../../kit/StatusTag.tsx';
import type { StatusKind } from '../../../kit/StatusTag.tsx';
import { useProof } from './useProof.ts';

/** 复核状态的语义档。 */
const CHECK_KIND: Readonly<Record<ProofCheckLike['status'], StatusKind>> = {
  pass: 'ok',
  warn: 'warn',
  fail: 'err',
};

/** 凭证模式入参。 */
export interface ProofModeProps {
  /** 当前会话 id。 */
  readonly threadId: string | null;
  /** 本 tab 是否活跃。 */
  readonly active: boolean;
}

/** 凭证模式：回合条 + 证明摘要 + 复核清单 + 导出。 */
export function ProofMode(props: ProofModeProps): ReactElement {
  const proof = useProof(props.threadId, props.active);
  const { api, toast } = useApp();
  const [verify, setVerify] = React.useState<ProofVerifyResultLike | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyName, setVerifyName] = React.useState('');
  /** 原生文件选择器（按钮触发；input 保留 aria-label 供键盘与判据定位）。 */
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  /** 下载导出包（前端下载，不上传）。 */
  const onExport = React.useCallback((): void => {
    void proof.exportTurn().then((result) => {
      if (typeof result === 'string') {
        toast(result, 'err');
        return;
      }
      downloadOf(result);
      toast(t('证据包已下载：{name}', { name: result.filename }), 'info');
    });
  }, [proof, toast]);

  /**
   * 读取本地证据包并调用离线复核；不读取任意路径、不上传。
   * @param file 用户选中的文件。
   */
  const onPickBundle = React.useCallback(
    (file: File): void => {
      setVerify(null);
      setVerifyError(null);
      setVerifyName(file.name);
      if (file.size > 2 * 1024 * 1024) {
        setVerifyError(t('证据包超过 2 MB，无法导入。'));
        return;
      }
      setVerifying(true);
      void file
        .text()
        .then((text) => {
          let bundle: unknown;
          try {
            bundle = JSON.parse(text);
          } catch {
            setVerifyError(t('证据包不是合法 JSON。'));
            return;
          }
          return api.proofVerify(bundle).then((result) => setVerify(result));
        })
        .catch((e: unknown) => setVerifyError(e instanceof Error ? e.message : String(e)))
        .finally(() => setVerifying(false));
    },
    [api],
  );

  if (props.threadId === null || props.threadId === '') {
    return <EmptyState title={t('先选择一个会话，再生成凭证。')} />;
  }
  const bundle = proof.bundle;
  return (
    <Flex vertical gap={16}>
      <PanelSection title={t('回合')}>
        {proof.loadingTurns ? <Skeleton active title={false} paragraph={{ rows: 2 }} /> : null}
        {proof.turnsError !== null ? (
          <Alert
            type="error"
            showIcon
            message={t('回合读取失败：{msg}', { msg: proof.turnsError })}
            action={
              <Button size="small" onClick={proof.refreshTurns}>
                {t('重试')}
              </Button>
            }
          />
        ) : null}
        {proof.turns !== null && proof.turns.length === 0 ? (
          <Typography.Text type="secondary">
            {t('还没有可复核的回合。回合按用户消息切分，发起新回合后出现在这里。')}
          </Typography.Text>
        ) : null}
        {proof.turns !== null && proof.turns.length > 0 ? (
          <Segmented
            block
            aria-label={t('选择回合')}
            // 未选回合给一个不在 options 里的值：否则 Segmented 会把第一项画成选中，
            // 看起来「已经选了」但证书还没构造（诚实语义：没选就是没选）。
            value={proof.selectedTurn ?? -1}
            onChange={(value) => proof.selectTurn(Number(value))}
            options={proof.turns.map((turn) => ({
              value: turn.turnIndex,
              label: <TurnLabel turn={turn} />,
            }))}
          />
        ) : null}
      </PanelSection>

      {proof.buildError !== null ? (
        <Alert type="error" showIcon message={t('复核失败：{msg}', { msg: proof.buildError })} />
      ) : null}

      {bundle !== null && bundle.certificate !== undefined ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={15}>
            <Flex vertical gap={16}>
              <PanelSection
                title={t('第 {n} 回合', { n: bundle.displayIndex })}
                extra={<StatusTag status={stateKind(bundle.state)}>{stateText(bundle.state)}</StatusTag>}
              >
                <Flex vertical gap={8}>
                  <Typography.Text type="secondary">
                    {t('{passed}/{total} 项通过', {
                      passed: bundle.checks.filter((c) => c.status === 'pass').length,
                      total: bundle.checks.length,
                    })}
                    {' · '}
                    {t('{events} 条事件', { events: bundle.eventCount })}
                    {' · '}
                    {bundle.certificate.toolSurfaceDigest !== undefined
                      ? t('工具面已绑定')
                      : t('未绑定工具面')}
                    {' · '}
                    {t('本地审计链 {n} 条', { n: bundle.auditRecords })}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t('事件根')}{' '}
                    <span className="mono">{bundle.certificate.eventRoot}</span>
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {bundle.signature !== undefined
                      ? t('本机签名 {kid} · {alg}', {
                          kid: bundle.signature.kid,
                          alg: bundle.signature.alg,
                        })
                      : t('未签名：只能证明结构自洽')}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t('证明的是事件流的完整性与顺序，不等于「模型说的都是真的」。')}
                  </Typography.Text>
                </Flex>
              </PanelSection>

              <PanelSection title={t('复核清单')}>
                <Flex vertical gap={8}>
                  {bundle.checks.map((check) => (
                    <Flex key={check.code} align="baseline" wrap gap={10}>
                      <StatusTag status={CHECK_KIND[check.status]}>
                        {checkStatusLabel(check.status)}
                      </StatusTag>
                      <Typography.Text type="secondary" className="mono" style={{ minWidth: 108 }}>
                        {check.code}
                      </Typography.Text>
                      <Typography.Text style={{ flex: '1 1 220px', minWidth: 0 }}>
                        {check.detail}
                      </Typography.Text>
                    </Flex>
                  ))}
                </Flex>
              </PanelSection>
            </Flex>
          </Col>
          <Col xs={24} xl={9}>
            <PanelSection title={t('证据包')}>
              <Flex vertical gap={12}>
                <Typography.Text type="secondary">
                  {bundle.signature !== undefined
                    ? t('导出包含执行证书、整包签名与事件流；本机信任根可离线验签。')
                    : t(
                        '导出为本地 JSON 文件（包含执行证书与事件流）；未签名包只能证明结构自洽。复核方需自行核对来源。',
                      )}
                </Typography.Text>
                <Flex>
                  <Button
                    type="primary"
                    icon={icon('download', { size: 14 })}
                    loading={proof.building}
                    disabled={proof.building || proof.selectedTurn === null}
                    onClick={onExport}
                  >
                    {proof.building ? t('构造中…') : t('下载证据包')}
                  </Button>
                </Flex>
              </Flex>
            </PanelSection>
          </Col>
        </Row>
      ) : null}

      <PanelSection title={t('导入复核')}>
        <Flex vertical gap={10}>
          <Typography.Text type="secondary">
            {t('选择本地证据包 JSON；只做离线结构复核，不信任包内签名，也不上传网络。')}
          </Typography.Text>
          <Flex align="center" wrap gap={10}>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              aria-label={t('选择证据包文件')}
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file !== undefined) onPickBundle(file);
              }}
            />
            <Button
              icon={icon('file', { size: 14 })}
              loading={verifying}
              disabled={verifying}
              onClick={() => fileRef.current?.click()}
            >
              {t('选择证据包…')}
            </Button>
            {verifyName !== '' ? (
              <Typography.Text type="secondary" className="mono">
                {verifyName}
              </Typography.Text>
            ) : null}
          </Flex>
          {verifying ? <Typography.Text type="secondary">{t('正在复核证据包…')}</Typography.Text> : null}
          {verifyError !== null ? <Alert type="error" showIcon message={verifyError} /> : null}
          {verify !== null && !verify.ok ? (
            <Alert type="error" showIcon message={verify.message} />
          ) : null}
          {verify !== null && verify.ok ? (
            <Flex vertical gap={8} role="region" aria-label={t('导入复核结果')}>
              <Flex align="center" wrap gap={8}>
                <StatusTag status={verify.verdict.ok ? 'ok' : 'err'}>
                  {verify.verdict.ok ? t('结构自洽（未签名）') : t('结构复核失败')}
                </StatusTag>
                <Typography.Text type="secondary">
                  {verify.verdict.signatureChecked ? t('签名已检查') : t('未验签：不能确认来源')}
                  {' · '}
                  {verify.verdict.commitmentChecked ? t('已核对外部承诺') : t('无带外承诺')}
                </Typography.Text>
              </Flex>
              <Typography.Text type="secondary">
                {t('{sessions} 个会话 · {events} 条事件', {
                  sessions: verify.summary.sessions.length,
                  events: verify.summary.eventCount,
                })}
                {verify.summary.exportedAt !== ''
                  ? ` · ${t('导出于 {time}', { time: timeOf(Date.parse(verify.summary.exportedAt)) })}`
                  : ''}
              </Typography.Text>
              {verify.verdict.problems.length === 0 ? (
                <Typography.Text type="secondary">
                  {t('复核器未报告问题；这不等于内容真实或来源可信。')}
                </Typography.Text>
              ) : (
                <Flex vertical gap={6}>
                  {verify.verdict.problems.map((problem, index) => (
                    <Flex key={`${problem.code}-${String(index)}`} align="center" wrap gap={8}>
                      <StatusTag
                        status={
                          problem.code === 'COMMITMENT_UNVERIFIED' || problem.code === 'UNPROVEN_ORIGIN'
                            ? 'warn'
                            : 'err'
                        }
                      >
                        <span className="mono">{problem.code}</span>
                      </StatusTag>
                      <Typography.Text>{problem.detail}</Typography.Text>
                    </Flex>
                  ))}
                </Flex>
              )}
            </Flex>
          ) : null}
        </Flex>
      </PanelSection>

      {proof.building && bundle === null ? (
        <Skeleton active title={false} paragraph={{ rows: 4 }} />
      ) : null}
    </Flex>
  );
}

/** 回合条的入参。 */
interface TurnChipProps {
  readonly turn: ProofTurnSummaryLike;
}

/** 一个回合选择块（Segmented 的 label）。 */
function TurnLabel(props: TurnChipProps): ReactElement {
  const { turn } = props;
  const label = turn.systemTurn
    ? t('系统回合 {n}', { n: turn.turnIndex + 1 })
    : t('第 {n} 轮', { n: turn.displayIndex });
  return (
    <Flex vertical align="center" gap={2} style={{ paddingBlock: 2 }}>
      <span>{label}</span>
      <span
        className="mono"
        style={{ fontSize: 11, opacity: 0.72 }}
        title={`${timeOf(Date.parse(turn.startedAt))} · ${turn.eventCount} ${t('条事件')}`}
      >
        {turn.eventCount} {t('事件')} · {turn.toolCalls} {t('工具')} · {turn.changedFiles} {t('文件')}
      </span>
    </Flex>
  );
}

/**
 * 下载导出包（Blob + 临时 <a>；纯本地，无网络上传）。
 * @param result 导出结果。
 */
function downloadOf(result: ProofExportResultLike): void {
  const blob = new Blob([result.content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  // 延迟释放：同步 revoke 在部分浏览器会在下载真正开始前把 URL 撤掉。
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * 总体状态的徽标语义（未签名 = 关注，不是通过）。
 * @param state 总体状态。
 * @returns StatusTag 语义档。
 */
function stateKind(state: ProofBundleViewLike['state']): StatusKind {
  switch (state) {
    case 'signed':
      return 'ok';
    case 'failed':
      return 'err';
    case 'structural':
      return 'warn';
    default:
      return 'neutral';
  }
}

/**
 * 总体状态文案（未签名口径——设计 PR-04）。
 * @param state 总体状态。
 * @returns 可读文案。
 */
function stateText(state: ProofBundleViewLike['state']): string {
  switch (state) {
    case 'signed':
      return t('已签名（本机信任根）');
    case 'failed':
      return t('复核失败');
    case 'structural':
      return t('结构自洽（未签名）');
    default:
      return t('未复核');
  }
}

/**
 * 单项状态短文案。
 * @param status 单项结论。
 * @returns 可读文案。
 */
function checkStatusLabel(status: ProofCheckLike['status']): string {
  switch (status) {
    case 'pass':
      return t('通过');
    case 'warn':
      return t('未证明');
    default:
      return t('失败');
  }
}
