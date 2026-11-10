// 编队模式（Fleet）：子代理车道列表 + 详情（只读，v1 不提供取消/应用补丁——设计 §10 P2 动作批次）。
//
// 诚实语义（设计 §4.6）：truncated 显示「未做完」、writesUnrecoverable 显示「改动不可取回」、
// 运行中的步数/token 未上报显示「未上报」——绝不把 ok 当完成、绝不填 0 冒充数字。

import * as React from 'react';
import type { ReactElement } from 'react';
import { t } from '../../../i18n/i18n.ts';
import { timeOf } from '../../../format.ts';
import type { FleetNodeLike, FleetStatus } from '../../../../types/models.ts';
import { useFleet } from './useFleet.ts';

/** 状态点的色彩语义 class（配合文字，不只靠颜色——设计 §2.5）。 */
const STATUS_CLASS: Readonly<Record<FleetStatus, string>> = {
  queued: 'control-dot control-dot--queued',
  running: 'control-dot control-dot--running',
  ok: 'control-dot control-dot--ok',
  failed: 'control-dot control-dot--failed',
  aborted: 'control-dot control-dot--aborted',
  truncated: 'control-dot control-dot--truncated',
};

/** 状态的中文文案（含诚实语义）。 */
const STATUS_TEXT: Readonly<Record<FleetStatus, string>> = {
  queued: t('排队中'),
  running: t('运行中'),
  ok: t('已完成'),
  failed: t('失败'),
  aborted: t('已中止'),
  truncated: t('未做完'),
};

/**
 * 状态点 + 文案（aria-label 保证色盲可读）。
 * @param status 车道状态。
 * @returns 状态节点。
 */
function statusChip(status: FleetStatus): ReactElement {
  return (
    <span className={STATUS_CLASS[status]} aria-label={STATUS_TEXT[status]}>
      <span className="control-dot__ink" aria-hidden="true" />
      {STATUS_TEXT[status]}
    </span>
  );
}

/**
 * 概要数字（未上报显示「未上报」，不显示 0）。
 * @param value 数值（可能 undefined）。
 * @param suffix 后缀。
 * @returns 数字节点。
 */
function metricOf(value: number | undefined, suffix: string): ReactElement {
  if (value === undefined || !Number.isFinite(value)) {
    return <span className="hint">{t('未上报')}</span>;
  }
  return (
    <span className="mono">
      {value}
      {suffix}
    </span>
  );
}

/** 编队模式入参。 */
export interface FleetModeProps {
  /** 当前会话 id。 */
  readonly threadId: string | null;
  /** 本 tab 是否活跃（控制轮询）。 */
  readonly active: boolean;
}

/** 车道稳定 key：子会话 id 优先；运行中还没有 id 时用「开始时刻 + 任务」避免同任务串选。 */
function laneKey(node: FleetNodeLike): string {
  return node.childSessionId ?? `${node.startedAt}:${node.task}`;
}

/** 编队模式：父会话的车道一览。 */
export function FleetMode(props: FleetModeProps): ReactElement {
  const { snapshot, loading, error, staleMs, refresh } = useFleet(props.threadId, props.active);
  const [selected, setSelected] = React.useState<string | null>(null);

  // 选中态跟随快照里的车道（切会话/快照更新后保持稳定 key 匹配）。
  const selectedNode = snapshot?.nodes.find((node) => laneKey(node) === selected) ?? null;

  if (props.threadId === null || props.threadId === '') {
    return <div className="control-mode">{t('先选择一个会话，再打开编队。')}</div>;
  }
  if (error !== null) {
    return (
      <div className="control-mode">
        <p className="hint">
          {t('编队状态不可读：{msg}', { msg: error })}
        </p>
        <button type="button" onClick={refresh}>
          {t('重试')}
        </button>
      </div>
    );
  }
  if (snapshot?.error !== undefined && snapshot.error !== '') {
    return (
      <div className="control-mode">
        <p className="hint">{t('编队状态不可读：{msg}', { msg: snapshot.error })}</p>
        <button type="button" onClick={refresh}>
          {t('重试')}
        </button>
      </div>
    );
  }
  if (loading && snapshot === null) {
    return <div className="control-mode">{t('正在读取编队…')}</div>;
  }
  if (snapshot === null || snapshot.nodes.length === 0) {
    return (
      <div className="control-mode">
        <p className="hint">{t('还没有子代理。当主代理在任务中派生子代理时，它们会出现在这里。')}</p>
        <p className="hint">{t('委派任务需在会话输入区发起（控制室 v1 只观察）。')}</p>
      </div>
    );
  }
  const stale = staleMs > 30_000;
  return (
    <div className="control-mode">
      <p className="control-meta">
        {t('{count} 条车道 · {running} 条在跑', {
          count: snapshot.nodes.length,
          running: snapshot.runningCount,
        })}
        {stale ? ` · ${t('已过期（{sec} 秒前的快照）', { sec: Math.round(staleMs / 1000) })}` : ''}
      </p>
      <div className="control-lanes">
        {snapshot.nodes.map((node) => (
          <LaneRow
            key={laneKey(node)}
            node={node}
            selected={laneKey(node) === selected}
            onSelect={() => setSelected(laneKey(node))}
          />
        ))}
      </div>
      {selectedNode !== null && <LaneDetail node={selectedNode} />}
    </div>
  );
}

/** 单条车道行的入参。 */
interface LaneRowProps {
  readonly node: FleetNodeLike;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

/** 一条车道行：状态点 + 任务 + 隔离 + 步数 + token + 改动 + 状态。 */
function LaneRow(props: LaneRowProps): ReactElement {
  const { node } = props;
  const files = node.changedFiles?.length ?? 0;
  const patchState = node.writesUnrecoverable === true
    ? t('改动不可取回')
    : node.writesForbidden === true
      ? t('禁写（copy 隔离）')
      : node.patchBytes !== undefined
        ? t('patch {kb} KB', { kb: Math.max(1, Math.round(node.patchBytes / 1024)) })
        : files > 0
          ? t('patch 未落盘')
          : '';
  return (
    <button
      type="button"
      className={`control-lane${props.selected ? ' is-selected' : ''}`}
      onClick={props.onSelect}
      aria-pressed={props.selected}
    >
      {statusChip(node.status)}
      <span className="control-lane__task" title={node.task}>
        {node.task}
      </span>
      <span className="mono control-lane__meta">{node.isolation === 'copy' ? t('copy') : t('worktree')}</span>
      <span className="control-lane__meta">{metricOf(node.steps, t(' 步'))}</span>
      <span className="control-lane__meta">{node.tokens === undefined ? <span className="hint">{t('token 未上报')}</span> : <span className="mono">{node.tokens}</span>}</span>
      <span className="control-lane__meta">
        {files > 0 ? t('{n} 文件', { n: files }) : node.writesForbidden === true ? '' : <span className="hint">{t('无改动')}</span>}
        {patchState !== '' ? <span className="hint"> · {patchState}</span> : null}
      </span>
    </button>
  );
}

/** 车道详情的入参。 */
interface LaneDetailProps {
  readonly node: FleetNodeLike;
}

/** 选中车道详情：任务原文 / 隔离 / 改动 / 验证 / 轨迹可用性（只读）。 */
function LaneDetail(props: LaneDetailProps): ReactElement {
  const { node } = props;
  return (
    <div className="control-detail" role="region" aria-label={t('子代理详情')}>
      <h3>{node.task}</h3>
      <p className="control-meta">
        {statusChip(node.status)}
        {node.childSessionId !== undefined ? <span className="mono"> {node.childSessionId}</span> : null}
        {node.startedAt !== '' ? <span> · {t('开始 {time}', { time: timeOf(Date.parse(node.startedAt)) })}</span> : null}
        {node.endedAt !== undefined ? <span> · {t('结束 {time}', { time: timeOf(Date.parse(node.endedAt)) })}</span> : null}
      </p>
      <dl className="control-facts">
        <dt>{t('隔离方式')}</dt>
        <dd>{node.isolation === 'copy' ? t('copy（整目录拷贝降级，禁写）') : t('worktree（git 分支隔离）')}</dd>
        <dt>{t('步数 / 耗时')}</dt>
        <dd>
          {metricOf(node.steps, t(' 步'))}
          {node.durationMs !== undefined ? <span className="mono"> / {(Math.round(node.durationMs / 100) / 10).toFixed(1)}s</span> : ''}
        </dd>
        <dt>{t('验证状态')}</dt>
        <dd>{verificationText(node)}</dd>
        <dt>{t('改动')}</dt>
        <dd>
          {node.writesForbidden === true
            ? t('禁写：该模式无法产生改动')
            : node.writesUnrecoverable === true
              ? t('改动不可取回（采集失败，主工作区未被改动）')
              : node.changedFiles !== undefined && node.changedFiles.length > 0
                ? node.changedFiles.join('、')
                : t('无改动')}
        </dd>
        <dt>{t('patch')}</dt>
        <dd>{patchText(node)}</dd>
        {node.error !== undefined && node.error !== '' ? (
          <>
            <dt>{t('原因')}</dt>
            <dd>{node.error}</dd>
          </>
        ) : null}
        <dt>{t('轨迹')}</dt>
        <dd>
          {node.traceAvailable === true
            ? t('子会话轨迹已持久化（可用 trace.read 查询）')
            : node.childSessionId === undefined
              ? t('尚未回传（运行中）')
              : t('轨迹未落盘（子代理未产生事件或存档不可读）')}
        </dd>
      </dl>
    </div>
  );
}

/**
 * 验证状态文案（`unverified` 不得读成通过——设计 §4.6）。
 * @param node 车道。
 * @returns 可读文案。
 */
function verificationText(node: FleetNodeLike): string {
  switch (node.verificationState) {
    case 'passed':
      return t('已通过验证');
    case 'failed':
      return t('验证失败');
    case 'unverified':
      return t('尚未运行验证（收尾未核验）');
    case 'not-run':
      return t('尚未运行验证');
    default:
      return t('无验证信息');
  }
}

/**
 * patch 文案（截断 / 缺失如实展示）。
 * @param node 车道。
 * @returns 可读文案。
 */
function patchText(node: FleetNodeLike): string {
  if (node.writesForbidden === true) return t('无（禁写模式）');
  if (node.writesUnrecoverable === true) return t('无（采集失败）');
  if (node.patchPath === undefined) return t('无');
  const bytes = node.patchBytes !== undefined ? t('{kb} KB', { kb: Math.max(1, Math.round(node.patchBytes / 1024)) }) : t('未落盘');
  const truncated = node.patchTruncated === true ? t('（仅前一段，已截断）') : '';
  return `${node.patchPath} · ${bytes}${truncated}`;
}
