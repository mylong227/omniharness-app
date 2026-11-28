// 工作区整树读取（2026-11-17 全面 review 去重）：FilePicker 与 FolderPicker 各有一份逐字
// 相同的 useWorkspaceTree（seq 守卫 + fail-closed），收成单源；DEPTH 同为 3。
//
// 与旧的逐目录代际守卫不同：这里只有**一个**请求，不存在「后到的旧目录响应改写列表」的竞态；
// 但刷新可以与首次加载重叠，故仍用序号丢弃过期响应（语义是「最后一次刷新为准」）。

import { errorMessageOf } from '../../core/errorText.ts';
import * as React from 'react';
import type { ApiClient } from '../../core/ApiClient.ts';
import type { FsNode } from '../../types/models.ts';
import { t } from '../i18n/i18n.ts';

/** 树的拉取深度：3 层覆盖绝大多数工作区（更深目录由具体面板懒加载/搜索兜底）。 */
const DEPTH = 3;

/** 工作区树的数据态。 */
export interface WorkspaceTreeState {
  tree: FsNode[];
  loading: boolean;
  error: string | null;
}

/**
 * 拉工作区整树（`fs.list`）：首开一次，刷新按钮再拉一次。
 * @param api RPC 客户端
 * @returns 数据态与 refresh
 */
export function useWorkspaceTree(api: ApiClient): WorkspaceTreeState & { refresh: () => void } {
  const [state, setState] = React.useState<WorkspaceTreeState>({
    tree: [],
    loading: true,
    error: null,
  });
  const seq = React.useRef(0);

  const load = React.useCallback(async (): Promise<void> => {
    const mine = ++seq.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const r = await api.workspace.listFs(DEPTH);
      if (mine !== seq.current) return;
      if (!Array.isArray(r?.tree)) {
        // fail-closed：形状不合法 ⇒ 当作读取失败，绝不把 undefined 灌进树。
        setState({ tree: [], loading: false, error: t('文件树返回格式异常（fs.list）') });
        return;
      }
      setState({ tree: r.tree, loading: false, error: null });
    } catch (e) {
      if (mine !== seq.current) return;
      setState({ tree: [], loading: false, error: errorMessageOf(e) });
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: () => void load() };
}
