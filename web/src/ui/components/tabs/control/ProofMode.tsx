// 凭证模式（Proof）：回合选择 + 证书摘要 + 六项复核 + 导出（只读 + 用户显式导出）。
//
// 诚实语义（设计 §6.6）：未签名只写「结构自洽（未签名）」；本地审计链 ≠ 内核回执链；
// 导出是本地文件，不上传。

import * as React from 'react';
import type { ReactElement } from 'react';
import { useApp } from '../../../context.ts';
import { t } from '../../../i18n/i18n.ts';
import { timeOf } from '../../../format.ts';
import type {
  ProofBundleViewLike,
  ProofCheckLike,
  ProofExportResultLike,
  ProofTurnSummaryLike,
  ProofVerifyResultLike,
} from '../../../../types/models.ts';
import { useProof } from './useProof.ts';

/** 复核状态的色彩语义 class。 */
const CHECK_CLASS: Readonly<Record<ProofCheckLike['status'], string>> = {
  pass: 'control-dot control-dot--ok',
  warn: 'control-dot control-dot--truncated',
  fail: 'control-dot control-dot--failed',
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
   * @param event 文件选择事件。
   */
  const onPickBundle = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file === undefined) return;
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
    return <div className="control-mode">{t('先选择一个会话，再生成凭证。')}</div>;
  }
  return (
    <div className="control-mode">
      <section className="control-block" aria-label={t('回合')}>
        <h3>{t('回合')}</h3>
        {proof.loadingTurns ? <p className="hint">{t('正在读取回合…')}</p> : null}
        {proof.turnsError !== null ? (
          <p className="hint">
            {t('回合读取失败：{msg}', { msg: proof.turnsError })}
            <button type="button" onClick={proof.refreshTurns}>
              {t('重试')}
            </button>
          </p>
        ) : null}
        {proof.turns !== null && proof.turns.length === 0 ? (
          <p className="hint">{t('还没有可复核的回合。回合按用户消息切分，发起新回合后出现在这里。')}</p>
        ) : null}
        {proof.turns !== null && proof.turns.length > 0 ? (
          <div className="control-turns" role="listbox" aria-label={t('选择回合')}>
            {proof.turns.map((turn) => (
              <TurnChip
                key={turn.turnIndex}
                turn={turn}
                selected={proof.selectedTurn === turn.turnIndex}
                onSelect={() => proof.selectTurn(turn.turnIndex)}
              />
            ))}
          </div>
        ) : null}
      </section>

      {proof.buildError !== null ? (
        <p className="hint">{t('复核失败：{msg}', { msg: proof.buildError })}</p>
      ) : null}

      {proof.bundle !== null && proof.bundle.certificate !== undefined ? (
        <div className="control-proof-grid">
          <div className="control-proof-main">
            <section className="control-block" aria-label={t('证明摘要')}>
            <h3>
              {t('第 {n} 回合 · {state}', { n: proof.bundle.displayIndex, state: stateText(proof.bundle.state) })}
            </h3>
            <p className="control-meta">
              {t('{passed}/{total} 项通过', {
                passed: proof.bundle.checks.filter((c) => c.status === 'pass').length,
                total: proof.bundle.checks.length,
              })}
              {' · '}
              {t('{events} 条事件', { events: proof.bundle.eventCount })}
              {proof.bundle.certificate.toolSurfaceDigest !== undefined
                ? ` · ${t('工具面已绑定')}`
                : ` · ${t('未绑定工具面')}`}
              {' · '}
              {t('本地审计链 {n} 条', { n: proof.bundle.auditRecords })}
            </p>
            <p className="control-meta">
              <span className="hint">{t('事件根')}</span>{' '}
              <span className="mono">{proof.bundle.certificate.eventRoot}</span>
            </p>
            <p className="control-meta">
              {proof.bundle.signature !== undefined
                ? t('本机签名 {kid} · {alg}', {
                    kid: proof.bundle.signature.kid,
                    alg: proof.bundle.signature.alg,
                  })
                : t('未签名：只能证明结构自洽')}
            </p>
            <p className="hint">
              {t('证明的是事件流的完整性与顺序，不等于「模型说的都是真的」。')}
            </p>
          </section>
          <section className="control-block" aria-label={t('复核清单')}>
            <h3>{t('复核清单')}</h3>
            <ul className="control-checks">
              {proof.bundle.checks.map((check) => (
                <li key={check.code} className="control-check">
                  <span className={CHECK_CLASS[check.status]} aria-label={check.status}>
                    <span className="control-dot__ink" aria-hidden="true" />
                    {checkStatusLabel(check.status)}
                  </span>
                  <span className="control-check__code mono">{check.code}</span>
                  <span>{check.detail}</span>
                </li>
              ))}
            </ul>
          </section>
          </div>
          <div className="control-proof-side">
          <section className="control-block" aria-label={t('导出')}>
            <h3>{t('证据包')}</h3>
            <p className="hint">
              {proof.bundle.signature !== undefined
                ? t('导出包含执行证书、整包签名与事件流；本机信任根可离线验签。')
                : t(
                    '导出为本地 JSON 文件（包含执行证书与事件流）；未签名包只能证明结构自洽。复核方需自行核对来源。',
                  )}
            </p>
            <button type="button" onClick={onExport} disabled={proof.building || proof.selectedTurn === null}>
              {proof.building ? t('构造中…') : t('下载证据包')}
            </button>
          </section>
          </div>
        </div>
      ) : null}
          <section className="control-block" aria-label={t('导入复核')}>
            <h3>{t('导入复核')}</h3>
            <p className="hint">
              {t('选择本地证据包 JSON；只做离线结构复核，不信任包内签名，也不上传网络。')}
            </p>
            <label className="control-file">
              <span>{t('选择证据包…')}</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={onPickBundle}
                aria-label={t('选择证据包文件')}
                disabled={verifying}
              />
            </label>
            {verifyName !== '' ? <p className="mono hint">{verifyName}</p> : null}
            {verifying ? <p className="hint">{t('正在复核证据包…')}</p> : null}
            {verifyError !== null ? <p className="err">{verifyError}</p> : null}
            {verify !== null && !verify.ok ? <p className="err">{verify.message}</p> : null}
            {verify !== null && verify.ok ? (
              <div className="control-verify">
                <p className="control-verify__state">
                  {verify.verdict.ok ? t('结构自洽（未签名）') : t('结构复核失败')}
                </p>
                <p className="control-meta">
                  {verify.verdict.signatureChecked ? t('签名已检查') : t('未验签：不能确认来源')}
                  {' · '}
                  {verify.verdict.commitmentChecked ? t('已核对外部承诺') : t('无带外承诺')}
                </p>
                <p className="control-meta">
                  {t('{sessions} 个会话 · {events} 条事件', {
                    sessions: verify.summary.sessions.length,
                    events: verify.summary.eventCount,
                  })}
                  {verify.summary.exportedAt !== ''
                    ? ` · ${t('导出于 {time}', { time: timeOf(Date.parse(verify.summary.exportedAt)) })}`
                    : ''}
                </p>
                {verify.verdict.problems.length === 0 ? (
                  <p className="hint">{t('复核器未报告问题；这不等于内容真实或来源可信。')}</p>
                ) : (
                  <ul className="control-problems">
                    {verify.verdict.problems.map((problem, index) => (
                      <li
                        key={`${problem.code}-${String(index)}`}
                        className={
                          problem.code === 'COMMITMENT_UNVERIFIED' || problem.code === 'UNPROVEN_ORIGIN'
                            ? 'control-problem control-problem--warn'
                            : 'control-problem control-problem--fail'
                        }
                      >
                        <span className="mono">{problem.code}</span> {problem.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>

      {proof.building && proof.bundle === null ? <p className="hint">{t('正在构造证书…')}</p> : null}
    </div>
  );
}

/** 回合条的入参。 */
interface TurnChipProps {
  readonly turn: ProofTurnSummaryLike;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

/** 一个回合选择块。 */
function TurnChip(props: TurnChipProps): ReactElement {
  const { turn } = props;
  const label = turn.systemTurn
    ? t('系统回合 {n}', { n: turn.turnIndex + 1 })
    : t('第 {n} 轮', { n: turn.displayIndex });
  return (
    <button
      type="button"
      role="option"
      aria-selected={props.selected}
      className={`control-turn${props.selected ? ' is-selected' : ''}`}
      onClick={props.onSelect}
      title={`${timeOf(Date.parse(turn.startedAt))} · ${turn.eventCount} ${t('条事件')}`}
    >
      <span>{label}</span>
      <span className="mono hint">
        {turn.eventCount} {t('事件')} · {turn.toolCalls} {t('工具')} · {turn.changedFiles} {t('文件')}
      </span>
    </button>
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
