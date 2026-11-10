// 右栏工作台概览：没有打开文件 / 网页时，用最少的字回答「我在哪、这摊活做到哪了」。
//
// 2026-11-10 第二轮收敛（用户口径：界面更简洁、同一面板不要多个重复入口、别太紧凑）：
//   · 删掉「新建任务 / 命令面板 / 查看变更 / 设置」四个快捷按钮——左栏、页脚和快捷键
//     已经各有一个入口，右栏再放一遍只是把面板变成仪表盘；
//   · 删掉「继续最近」——左栏会话列表就是这件事的唯一入口；
//   · 删掉上下文压力条与连接 / 模型页脚——左栏容量图表与页脚已经是它们的事实源；
//   · 只保留三块：项目身份、本会话一句话摘要、工作区变更（最多 4 条 + 一个「全部变更」）。
//
// 数据仍来自两处：`changes.list`（git / 非 git 回退）与当前事件流（内核会话摘要 +
// model 事件里的上下文快照），零额外轮询。

import * as React from 'react';
import type { ApiClient } from '../../../core/ApiClient.ts';
import type { SessionEntry } from '../../shared.ts';
import type { ThreadEvent } from '../../../types/models.ts';
import { icon } from '../../models/Icon.ts';
import { t } from '../../i18n/i18n.ts';
import { PathJoiner } from '../../models/PathJoiner.ts';
import { SessionBrief, type SessionBriefStats } from '../../models/SessionBrief.ts';
import { formatDurationMs } from '../../models/DurationFormat.ts';
import { TokenScaleFormatter } from '../../models/TokenScaleFormatter.ts';
import { useWorkspaceChangeBrief } from './useWorkspaceChangeBrief.ts';
import type { WorkspaceChangeBrief, WorkspaceChangeState } from './useWorkspaceChangeBrief.ts';

/** WorkbenchHome 的入参。 */
export interface WorkbenchHomeProps {
  /** 当前项目绝对路径（空串 = 尚未解析）。 */
  readonly workspacePath: string;
  /** 项目身份代数（变化时重取 git 变更）。 */
  readonly workspaceEpoch: number;
  /** 当前会话条目（没有选中会话时为 undefined）。 */
  readonly currentSession?: SessionEntry | undefined;
  /** 当前会话已加载事件（用于本会话摘要）。 */
  readonly events: readonly ThreadEvent[];
  /** API 客户端（取工作区变更）。 */
  readonly api: ApiClient;
  /** 在右栏打开文件。 */
  readonly onOpenFile: (path: string) => void;
  /** 打开完整的「变更」面板。 */
  readonly onOpenChanges: () => void;
}

/** 概览最多展示的变更行数（再长就该去完整面板）。 */
const MAX_ROWS = 4;

/** 共享的 token 格式化器（无状态，模块级一份即可）。 */
const TOKENS = new TokenScaleFormatter();

/**
 * 项目标题（无路径时给一句可读的兜底）。
 * @param path 工作区绝对路径
 * @returns 项目名
 */
function workspaceName(path: string): string {
  if (path.trim() === '') return t('当前工作区');
  return PathJoiner.basename(path) || path;
}

/**
 * git 状态字母 → 人话。
 * @param status git porcelain 状态
 * @returns 文案
 */
function changeStatusLabel(status: string): string {
  const key = status.trim().toUpperCase();
  if (key === 'M') return t('修改');
  if (key === 'A') return t('新增');
  if (key === 'D') return t('删除');
  if (key === 'R') return t('重命名');
  if (key === '??') return t('未跟踪');
  return key === '' ? t('变更') : key;
}

/**
 * 项目头：标题 / 路径 / 分支与变更计数。
 * @param props 路径与变更状态
 * @returns 头部节点
 */
function WorkbenchHead(props: {
  readonly path: string;
  readonly changes: WorkspaceChangeState;
}): React.ReactElement {
  const { path, changes } = props;
  const brief = changes.brief;
  const dirty = brief?.files.length ?? 0;
  return (
    <header className="wb-head">
      <h2 className="wb-title" title={path}>
        {workspaceName(path)}
      </h2>
      <div className="wb-path" title={path}>
        {path === '' ? t('正在读取工作区…') : path}
      </div>
      <div className="wb-chips">
        {brief?.branch === undefined ? null : (
          <span className="wb-chip wb-chip--branch" title={t('当前分支')}>
            {icon('workflow', { size: 12 })}
            {brief.branch}
          </span>
        )}
        {changes.loading ? <span className="wb-chip">{t('读取变更…')}</span> : null}
        {changes.error !== null ? (
          <span className="wb-chip wb-chip--error" title={changes.error}>
            {t('变更不可读')}
          </span>
        ) : null}
        {!changes.loading && changes.error === null && dirty > 0 ? (
          <span className="wb-chip wb-chip--dirty" title={t('未提交的变更文件数')}>
            {t('{n} 个变更', { n: dirty })}
          </span>
        ) : null}
        {!changes.loading && changes.error === null && dirty === 0 ? (
          <span className="wb-chip wb-chip--clean">{t('工作区干净')}</span>
        ) : null}
      </div>
    </header>
  );
}

/**
 * 本会话一句话摘要：回合 / 工具 / 文件 / 上下文 / 有效时长。
 *
 * `turns` / `durationMs` 可被服务端会话摘要覆盖：长会话首屏只加载尾部事件时，
 * 事件里可能还没有 user 事件，直接显示 `0 回合` 会与左栏「2 回合」自相矛盾。
 * @param props 摘要数字与服务端摘要覆盖值
 * @returns 摘要行；无内容时 null
 */
function SessionLine(props: {
  readonly stats: SessionBriefStats;
  readonly turns?: number | undefined;
  readonly activeMs?: number | undefined;
}): React.ReactElement | null {
  const { stats } = props;
  const turns = Math.max(stats.turns, props.turns ?? 0);
  const durationMs =
    props.activeMs !== undefined && props.activeMs > 0 ? props.activeMs : stats.durationMs;
  if (SessionBrief.isEmpty({ ...stats, turns })) return null;
  return (
    <div
      className="wb-session"
      aria-label={t('本会话摘要')}
      title={t('统计当前已加载的会话区间')}
    >
      <span className="wb-session-item">
        <strong>{turns}</strong> {t('回合')}
      </span>
      <span
        className="wb-session-item"
        title={stats.toolFailures > 0 ? t('{n} 次工具失败', { n: stats.toolFailures }) : ''}
      >
        <strong>{stats.toolCalls}</strong> {t('工具')}
      </span>
      <span className="wb-session-item">
        <strong>{stats.files}</strong> {t('文件')}
      </span>
      {stats.context === undefined ? null : (
        <span
          className="wb-session-item"
          title={t('已用 {used} / {limit} token', {
            used: TOKENS.compact(stats.context.usedTokens),
            limit: TOKENS.compact(stats.context.windowTokens),
          })}
        >
          {t('上下文 {percent}%', { percent: stats.context.percent })}
        </span>
      )}
      {durationMs > 0 ? <span>{t('有效 {d}', { d: formatDurationMs(durationMs) })}</span> : null}
    </div>
  );
}

/**
 * 工作区变更清单（最多 4 行）。
 * @param props 变更状态与打开回调
 * @returns 变更区
 */
function WorkspaceChanges(props: {
  readonly changes: WorkspaceChangeState;
  readonly onOpenFile: (path: string) => void;
  readonly onOpenChanges: () => void;
}): React.ReactElement {
  const { changes, onOpenFile, onOpenChanges } = props;
  const brief: WorkspaceChangeBrief | undefined = changes.brief;
  const files = (brief?.files ?? []).slice(0, MAX_ROWS);
  return (
    <section className="wb-sec" aria-labelledby="wb-changes-title">
      <div className="wb-sec-head">
        <h3 className="wb-sec-title" id="wb-changes-title">
          {t('工作区变更')}
        </h3>
        <button type="button" className="wb-sec-action" onClick={onOpenChanges}>
          {t('全部变更')}
        </button>
      </div>
      {changes.loading ? (
        <p className="wb-note">{t('正在读取变更…')}</p>
      ) : changes.error !== null ? (
        <p className="wb-note wb-note--error">{t('读取变更失败：{msg}', { msg: changes.error })}</p>
      ) : files.length === 0 ? (
        <p className="wb-note">
          {brief?.branch === undefined ? t('没有未提交的变更') : t('工作区干净，可以开始新任务。')}
        </p>
      ) : (
        <div className="wb-list">
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              className="wb-row"
              title={file.path}
              onClick={() => onOpenFile(file.path)}
            >
              <span className="wb-change-badge">{changeStatusLabel(file.status)}</span>
              <span className="wb-row-main">
                <span className="wb-row-title wb-row-path">{file.path}</span>
                <span className="wb-row-meta">
                  {file.additions > 0 ? <span className="wb-add">+{file.additions}</span> : null}
                  {file.deletions > 0 ? <span className="wb-del">−{file.deletions}</span> : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * 右栏工作台概览。
 * @param props 组件入参
 * @returns 概览节点
 */
export function WorkbenchHome(props: WorkbenchHomeProps): React.ReactElement {
  const changes = useWorkspaceChangeBrief(props.api, props.workspaceEpoch);
  const stats = React.useMemo(() => SessionBrief.from(props.events), [props.events]);
  const current = props.currentSession;
  return (
    <div className="wb-home">
      <WorkbenchHead path={props.workspacePath} changes={changes} />
      <SessionLine stats={stats} turns={current?.turns} activeMs={current?.activeMs} />
      <WorkspaceChanges
        changes={changes}
        onOpenFile={props.onOpenFile}
        onOpenChanges={props.onOpenChanges}
      />
    </div>
  );
}
