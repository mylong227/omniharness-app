// 编队模式（Fleet）：子代理车道列表 + 详情（只读观察为主；取消 / 应用补丁是 P2 动作批次）。
//
// 诚实语义（设计 §4.6）：truncated 显示「未做完」、writesUnrecoverable 显示「改动不可取回」、
// 运行中的步数/token 未上报显示「未上报」——绝不把 ok 当完成、绝不填 0 冒充数字。
//
// 2026-11-11 控制台 antd 化：车道列表用 `Collapse`（标题即行、展开即详情，键盘可达），
// 状态用 `StatusTag`，事实表用 `Descriptions`，动作与补丁预览用 `Button` / `Alert` / `Skeleton`。

import * as React from 'react';
import type { ReactElement } from 'react';
// 子路径导入（不走 barrel，理由见 vite.config.ts「分块改造」注释）。
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Collapse from 'antd/es/collapse';
import Descriptions from 'antd/es/descriptions';
import Divider from 'antd/es/divider';
import Flex from 'antd/es/flex';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { t } from '../../../i18n/i18n.ts';
import { useApp } from '../../../context.ts';
import { icon } from '../../../models/Icon.ts';
import { timeOf } from '../../../format.ts';
import type { FleetNodeLike, FleetPatchResultLike, FleetStatus } from '../../../../types/models.ts';
import { EmptyState } from '../../../kit/EmptyState.tsx';
import { PanelSection } from '../../../kit/PanelSection.tsx';
import { StatusTag } from '../../../kit/StatusTag.tsx';
import type { StatusKind } from '../../../kit/StatusTag.tsx';
import { useFleet } from './useFleet.ts';

/** 车道状态 → 徽标语义（圆点改由 antd Tag 承担，文字仍在，不只靠颜色——设计 §2.5）。 */
const STATUS_KIND: Readonly<Record<FleetStatus, StatusKind>> = {
  queued: 'neutral',
  running: 'info',
  ok: 'ok',
  failed: 'err',
  aborted: 'warn',
  truncated: 'warn',
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
 * 状态徽标 + 文案（aria-label 保证色盲可读）。
 * @param status 车道状态。
 * @returns 状态节点。
 */
function statusChip(status: FleetStatus): ReactElement {
  return (
    <StatusTag status={STATUS_KIND[status]}>
      <span aria-label={STATUS_TEXT[status]}>{STATUS_TEXT[status]}</span>
    </StatusTag>
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
    return <Typography.Text type="secondary">{t('未上报')}</Typography.Text>;
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

/** 补丁预览的运行态（loading / 结果 / 错误）。 */
interface PatchState {
  readonly loading: boolean;
  readonly result: FleetPatchResultLike | null;
  readonly error: string | null;
}

/** 空补丁态（未选中车道时不显示预览，也不把别人的补丁带过去）。 */
const EMPTY_PATCH: PatchState = { loading: false, result: null, error: null };

/** 车道稳定 key：子会话 id 优先；运行中还没有 id 时用「开始时刻 + 任务」避免同任务串选。 */
function laneKey(node: FleetNodeLike): string {
  return node.childSessionId ?? `${node.startedAt}:${node.task}`;
}

/** 编队模式：父会话的车道一览。 */
export function FleetMode(props: FleetModeProps): ReactElement {
  const { snapshot, loading, error, staleMs, refresh } = useFleet(props.threadId, props.active);
  const { api, dialog, toast } = useApp();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [patch, setPatch] = React.useState<FleetPatchResultLike | null>(null);
  const [patchError, setPatchError] = React.useState<string | null>(null);
  const [patchLoading, setPatchLoading] = React.useState(false);
  const [cancelling, setCancelling] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  /** 预览请求序号：切车道/关闭后旧响应不得落到新车道。 */
  const patchSeqRef = React.useRef(0);

  /** 收起补丁预览并让在途响应作废。 */
  const closePatch = React.useCallback((): void => {
    patchSeqRef.current += 1;
    setPatchLoading(false);
    setPatch(null);
    setPatchError(null);
  }, []);

  /**
   * 选中车道：重复选中同一车道是 no-op（与迁移前的行按钮一致，见 onChange 的护栏）。
   * @param key 车道 key。
   */
  const selectLane = React.useCallback(
    (key: string): void => {
      closePatch();
      setSelected(key);
    },
    [closePatch],
  );

  /**
   * 打开只读补丁预览：不应用、不写工作区。
   * @param path 工作区相对 patch 路径。
   */
  const openPatch = React.useCallback(
    (path: string): void => {
      const seq = ++patchSeqRef.current;
      setPatch(null);
      setPatchError(null);
      setPatchLoading(true);
      api
        .fleetPatch(path)
        .then((result) => {
          if (seq === patchSeqRef.current) setPatch(result);
        })
        .catch((e: unknown) => {
          if (seq === patchSeqRef.current) setPatchError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (seq === patchSeqRef.current) setPatchLoading(false);
        });
    },
    [api],
  );

  /**
   * 取消一条运行中的子代理；先确认，再发取消信号。
   * @param node 车道。
   */
  const cancelCall = React.useCallback(
    async (node: FleetNodeLike): Promise<void> => {
      if (node.callId === undefined) {
        toast(t('这条车道没有可取消的调用 id。'), 'err');
        return;
      }
      const ok = await dialog.confirm(
        t('取消这个子代理？已产生的 patch 会保留，但当前子任务会中止。'),
        {
          title: t('取消子代理'),
          confirmLabel: t('取消子代理'),
          cancelLabel: t('保留'),
          danger: true,
        },
      );
      if (!ok) return;
      setCancelling(node.callId);
      try {
        const result = await api.fleetCancel(node.callId);
        if (result.ok) {
          toast(t('已发送取消信号；状态会在下一次刷新时更新。'), 'info');
          refresh();
        } else {
          toast(result.message, 'err');
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), 'err');
      } finally {
        setCancelling(null);
      }
    },
    [api, dialog, refresh, t, toast],
  );

  /**
   * 应用补丁：二次确认后写主工作区；不自动提交。
   * @param path 工作区相对路径。
   */
  const applyPatch = React.useCallback(
    (path: string): void => {
      void dialog
        .confirm(
          t('应用这个补丁到主工作区？会直接修改文件，不会自动提交或回滚。'),
          {
            title: t('应用补丁'),
            confirmLabel: t('应用'),
            cancelLabel: t('取消'),
            danger: true,
          },
        )
        .then((ok) => {
          if (!ok) return;
          setApplying(true);
          return api
            .fleetApplyPatch(path)
            .then((result) => {
              if (!result.ok) {
                toast(result.message, 'err');
                return;
              }
              toast(t('补丁已应用到主工作区。'), 'info');
              setPatch(null);
              setPatchError(null);
              refresh();
            })
            .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), 'err'))
            .finally(() => setApplying(false));
        });
    },
    [api, dialog, refresh, t, toast],
  );

  if (props.threadId === null || props.threadId === '') {
    return <EmptyState title={t('先选择一个会话，再打开编队。')} />;
  }
  const errorText = error ?? (snapshot?.error !== undefined && snapshot.error !== '' ? snapshot.error : null);
  if (errorText !== null) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('编队状态不可读：{msg}', { msg: errorText })}
        action={
          <Button size="small" onClick={refresh}>
            {t('重试')}
          </Button>
        }
      />
    );
  }
  if (loading && snapshot === null) {
    return <Skeleton active title={false} paragraph={{ rows: 5 }} />;
  }
  if (snapshot === null || snapshot.nodes.length === 0) {
    return (
      <EmptyState
        title={t('还没有子代理。当主代理在任务中派生子代理时，它们会出现在这里。')}
        hint={t('委派任务需在会话输入区发起（控制室 v1 只观察）。')}
      />
    );
  }
  const stale = staleMs > 30_000;
  return (
    <Flex vertical gap={16}>
      <Flex align="center" wrap gap={8}>
        <Typography.Text type="secondary">
          {t('{count} 条车道 · {running} 条在跑', {
            count: snapshot.nodes.length,
            running: snapshot.runningCount,
          })}
        </Typography.Text>
        {stale ? (
          <StatusTag status="warn">
            {t('已过期（{sec} 秒前的快照）', { sec: Math.round(staleMs / 1000) })}
          </StatusTag>
        ) : null}
      </Flex>
      <PanelSection title={t('子代理车道')}>
        <Collapse
          ghost
          size="small"
          expandIconPlacement="end"
          activeKey={selected === null ? [] : [selected]}
          onChange={(keys) => {
            const key = Array.isArray(keys) ? keys[0] : keys;
            // antd Collapse 自带「再点已展开项即收起」；迁移前重复选中是 no-op，
            // 这里忽略收起事件，车道只能换选、不能点空（行为保持不变）。
            if (typeof key !== 'string') return;
            selectLane(key);
          }}
          items={snapshot.nodes.map((node) => ({
            key: laneKey(node),
            label: <LaneLabel node={node} />,
            children: (
              <LaneDetail
                node={node}
                onViewPatch={openPatch}
                onCancel={cancelCall}
                cancelling={cancelling}
                patch={
                  selected === laneKey(node)
                    ? { loading: patchLoading, result: patch, error: patchError }
                    : EMPTY_PATCH
                }
                applying={applying}
                onApply={() => applyPatch(node.patchPath ?? '')}
                onClosePatch={closePatch}
              />
            ),
          }))}
        />
      </PanelSection>
    </Flex>
  );
}

/** 单条车道标题行的入参。 */
interface LaneLabelProps {
  readonly node: FleetNodeLike;
}

/** 一条车道标题行：状态徽标 + 任务 + 隔离 + 步数 + token + 改动。 */
function LaneLabel(props: LaneLabelProps): ReactElement {
  const { node } = props;
  const files = node.changedFiles?.length ?? 0;
  const patchState =
    node.writesUnrecoverable === true
      ? t('改动不可取回')
      : node.writesForbidden === true
        ? t('禁写（copy 隔离）')
        : node.patchBytes !== undefined
          ? t('patch {kb} KB', { kb: Math.max(1, Math.round(node.patchBytes / 1024)) })
          : files > 0
            ? t('patch 未落盘')
            : '';
  return (
    <Flex align="center" gap={10} wrap style={{ minWidth: 0, paddingBlock: 4 }}>
      {statusChip(node.status)}
      <Typography.Text ellipsis style={{ flex: '1 1 220px', minWidth: 0 }} title={node.task}>
        {node.task}
      </Typography.Text>
      <Typography.Text type="secondary" className="mono">
        {node.isolation === 'copy' ? t('copy') : t('worktree')}
      </Typography.Text>
      <Typography.Text type="secondary">{metricOf(node.steps, t(' 步'))}</Typography.Text>
      <Typography.Text type="secondary">
        {node.tokens === undefined ? t('token 未上报') : <span className="mono">{node.tokens}</span>}
      </Typography.Text>
      <Typography.Text type="secondary">
        {files > 0
          ? t('{n} 文件', { n: files })
          : node.writesForbidden === true
            ? ''
            : t('无改动')}
        {patchState !== '' ? ` · ${patchState}` : ''}
      </Typography.Text>
    </Flex>
  );
}

/** 车道详情的入参。 */
interface LaneDetailProps {
  readonly node: FleetNodeLike;
  readonly onViewPatch: (path: string) => void;
  readonly onCancel: (node: FleetNodeLike) => void;
  readonly cancelling: string | null;
  readonly patch: PatchState;
  readonly applying: boolean;
  readonly onApply: () => void;
  readonly onClosePatch: () => void;
}

/** 选中车道详情：任务原文 / 隔离 / 改动 / 验证 / 轨迹可用性（只读）+ 动作。 */
function LaneDetail(props: LaneDetailProps): ReactElement {
  const { node } = props;
  const showPatch = props.patch.loading || props.patch.result !== null || props.patch.error !== null;
  return (
    <Flex vertical gap={12} role="region" aria-label={t('子代理详情')}>
      <Flex align="center" wrap gap={8}>
        {statusChip(node.status)}
        {node.childSessionId !== undefined ? (
          <Typography.Text type="secondary" className="mono">
            {node.childSessionId}
          </Typography.Text>
        ) : null}
        {node.startedAt !== '' ? (
          <Typography.Text type="secondary">
            {t('开始 {time}', { time: timeOf(Date.parse(node.startedAt)) })}
          </Typography.Text>
        ) : null}
        {node.endedAt !== undefined ? (
          <Typography.Text type="secondary">
            {t('结束 {time}', { time: timeOf(Date.parse(node.endedAt)) })}
          </Typography.Text>
        ) : null}
      </Flex>
      <Descriptions
        size="small"
        column={1}
        colon
        items={[
          {
            key: 'isolation',
            label: t('隔离方式'),
            children:
              node.isolation === 'copy'
                ? t('copy（整目录拷贝降级，禁写）')
                : t('worktree（git 分支隔离）'),
          },
          {
            key: 'steps',
            label: t('步数 / 耗时'),
            children: (
              <>
                {metricOf(node.steps, t(' 步'))}
                {node.durationMs !== undefined ? (
                  <span className="mono"> / {(Math.round(node.durationMs / 100) / 10).toFixed(1)}s</span>
                ) : null}
              </>
            ),
          },
          { key: 'verify', label: t('验证状态'), children: verificationText(node) },
          { key: 'changes', label: t('改动'), children: changesText(node) },
          {
            key: 'patch',
            label: t('patch'),
            children: (
              <Flex align="center" wrap gap={8}>
                <Typography.Text>{patchText(node)}</Typography.Text>
                {canPreviewPatch(node) ? (
                  <Button
                    type="link"
                    size="small"
                    icon={icon('diff', { size: 14 })}
                    onClick={() => props.onViewPatch(node.patchPath ?? '')}
                  >
                    {t('查看补丁')}
                  </Button>
                ) : null}
              </Flex>
            ),
          },
          { key: 'trace', label: t('轨迹'), children: traceText(node) },
          ...(node.error !== undefined && node.error !== ''
            ? [{ key: 'error', label: t('原因'), children: node.error }]
            : []),
        ]}
      />
      {node.status === 'running' && node.callId !== undefined ? (
        <Flex align="center" wrap gap={12}>
          <Button
            danger
            icon={icon('x', { size: 14 })}
            loading={props.cancelling === node.callId}
            onClick={() => props.onCancel(node)}
          >
            {props.cancelling === node.callId ? t('正在取消…') : t('取消子代理')}
          </Button>
          <Typography.Text type="secondary">{t('只中止这一条子代理；父会话继续。')}</Typography.Text>
        </Flex>
      ) : null}
      {showPatch ? (
        <PatchPreview
          path={node.patchPath ?? ''}
          patch={props.patch}
          applying={props.applying}
          onApply={props.onApply}
          onClose={props.onClosePatch}
        />
      ) : null}
    </Flex>
  );
}

/** 「改动」一栏的文案（三种不可用态各说清楚）。 */
function changesText(node: FleetNodeLike): string {
  if (node.writesForbidden === true) return t('禁写：该模式无法产生改动');
  if (node.writesUnrecoverable === true) return t('改动不可取回（采集失败，主工作区未被改动）');
  return node.changedFiles !== undefined && node.changedFiles.length > 0
    ? node.changedFiles.join('、')
    : t('无改动');
}

/** 「轨迹」一栏的文案。 */
function traceText(node: FleetNodeLike): string {
  if (node.traceAvailable === true) return t('子会话轨迹已持久化（可用 trace.read 查询）');
  if (node.childSessionId === undefined) return t('尚未回传（运行中）');
  return t('轨迹未落盘（子代理未产生事件或存档不可读）');
}

/** 补丁预览入参。 */
interface PatchPreviewProps {
  readonly path: string;
  readonly patch: PatchState;
  readonly applying: boolean;
  readonly onApply: () => void;
  readonly onClose: () => void;
}

/** 只读补丁预览：展开在详情下方，不自动应用；不套第二层卡（设计 §2.4 禁止卡套卡）。 */
function PatchPreview(props: PatchPreviewProps): ReactElement {
  const { patch } = props;
  return (
    <Flex vertical gap={8} role="region" aria-label={t('补丁预览')}>
      <Divider dashed style={{ margin: '4px 0 0', borderBlockStartColor: 'var(--border-soft)' }} />
      <Flex align="center" justify="space-between" wrap gap={8}>
        <Typography.Text strong>{t('补丁预览')}</Typography.Text>
        <Button type="link" size="small" icon={icon('x', { size: 14 })} onClick={props.onClose}>
          {t('关闭预览')}
        </Button>
      </Flex>
      <Typography.Text type="secondary" className="mono">
        {props.path}
      </Typography.Text>
      {patch.loading ? (
        <Skeleton active title={false} paragraph={{ rows: 3 }} />
      ) : patch.error !== null ? (
        <Alert type="error" showIcon message={t('补丁不可读：{msg}', { msg: patch.error })} />
      ) : patch.result !== null && !patch.result.ok ? (
        <Alert type="error" showIcon message={t('补丁不可读：{msg}', { msg: patch.result.message })} />
      ) : patch.result !== null && patch.result.ok ? (
        <>
          <Typography.Text type="secondary">
            {t('{bytes} 字节', { bytes: patch.result.bytes })}
            {patch.result.truncated ? ` · ${t('已截断（仅前 512 KB）')}` : ''}
          </Typography.Text>
          <pre className="control-patch__body">{patch.result.content}</pre>
          <Typography.Text type="secondary">{t('只读预览；确认后才会写入主工作区。')}</Typography.Text>
          <Space wrap>
            <Button
              danger
              icon={icon('check', { size: 14 })}
              disabled={props.applying || patch.result.truncated}
              loading={props.applying}
              onClick={props.onApply}
            >
              {props.applying ? t('应用中…') : t('应用补丁')}
            </Button>
            <Typography.Text type="secondary">
              {patch.result.truncated ? t('截断的补丁不能应用。') : t('应用到主工作区；不会自动提交。')}
            </Typography.Text>
          </Space>
        </>
      ) : null}
    </Flex>
  );
}

/**
 * 是否可预览补丁（禁写 / 不可取回 / 无路径都不显示按钮）。
 * @param node 车道。
 * @returns 可预览时为 true。
 */
function canPreviewPatch(node: FleetNodeLike): boolean {
  return (
    node.patchPath !== undefined &&
    node.patchPath !== '' &&
    node.writesForbidden !== true &&
    node.writesUnrecoverable !== true
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
  const bytes =
    node.patchBytes !== undefined
      ? t('{kb} KB', { kb: Math.max(1, Math.round(node.patchBytes / 1024)) })
      : t('未落盘');
  const truncated = node.patchTruncated === true ? t('（仅前一段，已截断）') : '';
  return `${node.patchPath} · ${bytes}${truncated}`;
}
