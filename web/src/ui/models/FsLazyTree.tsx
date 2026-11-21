// 文件系统选择器的「懒加载子树」公共核（W6，2026-11-21）。
//
// ## 为什么抽出来
//
// FilePicker（选文件）与 FolderPicker（选目录）各自维护过一份**同构**的懒加载机制：
// 节点级状态表 + 展开时按 `fs:` key 拉 `fs.browse` + 加载中/错误+重试/空目录占位行 +
// 「已加载子级递归挂回树上」。两份实现逐行同构，只有「回包 → 子节点」的映射不同
// （文件选择器还要收集文件 key 供勾选闸用）。行为判据已由 filePickerTree /
// folderPickerTree / pickerShapeGuard / pathBrowse / popoverKeyboard 五组钉住。
//
// 本模块只收**机制**：状态表 hook、占位行、递归回填。
// 「回包 → 子节点」的映射留在各选择器（业务差异：文件/目录、体积、置灰语义）。
//
// 关键纪律（两处都踩过）：`load` 只把结果写进 `nodes[key]`，父节点是每帧现拼的 treeData
// ——必须 `attachLazy` 递归回填，否则深层目录展开后永远挂不上（首版漏这步，P2 判据当场红）。

import * as React from 'react';
import type { TreeDataNode } from 'antd';
import { isFsKey } from './FsPickerLazy.ts';
import { t } from '../i18n/i18n.ts';

/** 单个懒加载节点的状态（键 = 树 key）。 */
export interface LazyNodeState {
  /** null = 尚未加载。 */
  readonly children: TreeDataNode[] | null;
  /** 该节点下的文件 key（文件选择器的勾选闸用；目录选择器恒为空集）。 */
  readonly files: ReadonlySet<string>;
  readonly loading: boolean;
  readonly error: string | null;
}

/** 一次懒加载的结果：子节点 + 可选的文件 key 集。 */
export interface LazyLoadResult {
  readonly children: TreeDataNode[];
  readonly files?: ReadonlySet<string>;
}

/** 按 key 拉取下一层（由各选择器注入：决定调 `fs.browse` 的哪些参数、如何映射回包）。 */
export type FsLazyLoader = (key: string) => Promise<LazyLoadResult>;

/** 懒加载状态表与加载入口。 */
export interface FsLazyTree {
  readonly nodes: Record<string, LazyNodeState>;
  readonly load: (key: string) => Promise<void>;
}

/** 空文件集（共享只读实例，避免每个节点各造一个 Set）。 */
const EMPTY_FILES: ReadonlySet<string> = new Set();

/**
 * 节点级懒加载状态机。
 *
 * 每个 key 是一次独立异步任务：A 的迟到响应只会填 A 节点，结构上不存在「全局代际号防串台」。
 * 失败时保留上一次成功加载的 children（重试期间不闪空），只把 error 记上。
 *
 * @param loader 按 key 拉取下一层（实现由调用方注入）
 * @returns 状态表与 load
 */
export function useFsLazyTree(loader: FsLazyLoader): FsLazyTree {
  const [nodes, setNodes] = React.useState<Record<string, LazyNodeState>>({});
  // loader 每帧可能是新闭包；用 ref 让 load 保持稳定身份（避免 effect 依赖它反复重跑），
  // 同时始终调用最新实现（api 实例切换后不会用旧闭包）。
  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;

  const load = React.useCallback(async (key: string): Promise<void> => {
    setNodes((prev) => {
      const old = prev[key];
      return {
        ...prev,
        [key]: {
          children: old?.children ?? null,
          files: old?.files ?? EMPTY_FILES,
          loading: true,
          error: null,
        },
      };
    });
    try {
      const result = await loaderRef.current(key);
      setNodes((prev) => ({
        ...prev,
        [key]: {
          children: result.children,
          files: result.files ?? EMPTY_FILES,
          loading: false,
          error: null,
        },
      }));
    } catch (error) {
      setNodes((prev) => {
        const old = prev[key];
        return {
          ...prev,
          [key]: {
            children: old?.children ?? null,
            files: old?.files ?? EMPTY_FILES,
            loading: false,
            error: (error as Error).message,
          },
        };
      });
    }
  }, []);

  return { nodes, load };
}

/**
 * 懒加载节点的子节点（加载中 / 错误+重试 / 空目录 的占位行）。
 * @param key 节点 key
 * @param state 该节点状态
 * @param onRetry 重试回调
 * @returns 子节点数组
 */
export function lazyChildrenOf(
  key: string,
  state: LazyNodeState | undefined,
  onRetry: (key: string) => void,
): TreeDataNode[] {
  if (state === undefined) return [];
  if (state.error !== null) {
    return [
      {
        key: `${key}#err`,
        selectable: false,
        checkable: false,
        title: (
          <span className="fp-tree-error">
            {state.error}
            <button
              type="button"
              className="fp-retry"
              onClick={(event) => {
                event.stopPropagation();
                onRetry(key);
              }}
            >
              {t('重试')}
            </button>
          </span>
        ),
      },
    ];
  }
  if (state.loading) {
    return [
      {
        key: `${key}#loading`,
        selectable: false,
        checkable: false,
        title: <span className="fp-tree-loading">{t('读取中…')}</span>,
      },
    ];
  }
  if (state.children !== null && state.children.length === 0) {
    return [
      {
        key: `${key}#empty`,
        selectable: false,
        checkable: false,
        title: <span className="fp-tree-empty">{t('（空目录）')}</span>,
      },
    ];
  }
  return state.children ?? [];
}

/**
 * 把已加载的懒节点子级**递归**挂回树上（父节点每帧现拼，不回填则深层目录永远挂不上）。
 * @param nodes 待挂的节点
 * @param nodesState 节点状态表
 * @param onRetry 重试回调
 * @returns 挂好子级的新数组
 */
export function attachLazy(
  nodes: TreeDataNode[],
  nodesState: Record<string, LazyNodeState>,
  onRetry: (key: string) => void,
): TreeDataNode[] {
  return nodes.map((node) => {
    const key = String(node.key);
    const state = nodesState[key];
    if (!isFsKey(key) || state === undefined) return node;
    return {
      ...node,
      children: attachLazy(lazyChildrenOf(key, state, onRetry), nodesState, onRetry),
    };
  });
}
