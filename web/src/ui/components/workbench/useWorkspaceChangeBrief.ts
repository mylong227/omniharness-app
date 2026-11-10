// 工作台首页的「工作区变更」取数 hook：拉一次 git 清单，供右栏概览展示。
//
// 为什么有独立 hook：`changes.list` 在 git 工作区要跑 3 条 git 子进程，不能随每个 SSE
// 事件重拉；这里只在挂载与 `workspaceEpoch`（项目身份真的换了）变化时取一次。
// `alive` 防迟到响应写回已卸载 / 已切项目的视图。

import * as React from 'react';
import type { ApiClient } from '../../../core/ApiClient.ts';

/** 概览里的一行变更。 */
export interface WorkspaceChangeRow {
  /** 工作区相对路径。 */
  readonly path: string;
  /** git 状态字母（M/A/D/??…）。 */
  readonly status: string;
  /** 新增行数。 */
  readonly additions: number;
  /** 删除行数。 */
  readonly deletions: number;
}

/** 工作区变更概览。 */
export interface WorkspaceChangeBrief {
  /** 数据来源（git / session）。 */
  readonly source: string;
  /** 当前分支（非 git 时 undefined）。 */
  readonly branch?: string;
  /** 变更文件（最多保留前 6 条，够首页展示）。 */
  readonly files: readonly WorkspaceChangeRow[];
}

/** hook 返回状态。 */
export interface WorkspaceChangeState {
  /** 取数中。 */
  readonly loading: boolean;
  /** 最近一次结果（首次取数前 undefined）。 */
  readonly brief: WorkspaceChangeBrief | undefined;
  /** 失败原因（成功清空）。 */
  readonly error: string | null;
}

/** 首页最多展示的变更行数。 */
const MAX_ROWS = 6;

/**
 * 把 RPC 返回体收窄成概览形状（服务端返回未知；脏数据不炸界面）。
 * @param value 原始返回
 * @returns 概览；形状不合法时 undefined
 */
function toBrief(value: unknown): WorkspaceChangeBrief | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const rawFiles = record['files'];
  if (!Array.isArray(rawFiles)) return undefined;
  const files: WorkspaceChangeRow[] = [];
  for (const raw of rawFiles) {
    if (raw === null || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const path = row['path'];
    if (typeof path !== 'string' || path === '') continue;
    files.push({
      path,
      status: typeof row['status'] === 'string' ? row['status'] : 'M',
      additions: typeof row['additions'] === 'number' ? row['additions'] : 0,
      deletions: typeof row['deletions'] === 'number' ? row['deletions'] : 0,
    });
    if (files.length >= MAX_ROWS) break;
  }
  return {
    source: typeof record['source'] === 'string' ? record['source'] : 'unknown',
    ...(typeof record['branch'] === 'string' && record['branch'] !== ''
      ? { branch: record['branch'] }
      : {}),
    files,
  };
}

/**
 * 取当前工作区的变更概览。
 * @param api API 客户端（控制器单例，身份稳定）
 * @param workspaceEpoch 项目身份代数（变化即重取）
 * @returns 加载 / 结果 / 错误
 */
export function useWorkspaceChangeBrief(
  api: ApiClient,
  workspaceEpoch: number,
): WorkspaceChangeState {
  const [loading, setLoading] = React.useState(true);
  const [brief, setBrief] = React.useState<WorkspaceChangeBrief | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .listChanges()
      .then((value) => {
        if (!alive) return;
        setBrief(toBrief(value));
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [api, workspaceEpoch]);

  return { loading, brief, error };
}
