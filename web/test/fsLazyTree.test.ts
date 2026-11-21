// 选择器懒加载公共核的行为判据（W6，2026-11-21）。
//
// 背景：FilePicker / FolderPicker 的懒加载机制（节点级状态表、加载中/错误+重试/空目录占位、
// 已加载子级递归回填）此前各写一份同构实现。抽出 FsLazyTree 后，本文件把机制本身的
// **可观察行为**钉住（以前只能靠两个选择器的端到端判据间接覆盖）：
//   · 占位行的三种形态与 key 后缀（#loading / #err / #empty）不得混用；
//   · 重试按钮必须把**该节点自己的 key** 传回，且 stopPropagation（否则点重试会顺带选中节点）；
//   · attachLazy 只回填 `fs:` key 且**递归**（深层目录首版漏递归，P2 判据当场红）；
//   · 非 fs key / 未加载节点必须原样保留（工作区节点不能被挂空 children）。

import assert from 'node:assert/strict';
import { test } from 'vitest';
import * as React from 'react';
import type { TreeDataNode } from 'antd';
import { attachLazy, lazyChildrenOf } from '../src/ui/models/FsLazyTree.tsx';
import type { LazyNodeState } from '../src/ui/models/FsLazyTree.tsx';
import { fsKeyOf } from '../src/ui/models/FsPickerLazy.ts';

/** 造一个节点状态（默认：尚未加载）。 */
function stateOf(patch: Partial<LazyNodeState> = {}): LazyNodeState {
  return { children: null, files: new Set<string>(), loading: false, error: null, ...patch };
}

/** 取占位行标题里的根 span className（标题不是元素则直接失败）。 */
function titleClassOf(node: TreeDataNode): string {
  const title: unknown = node.title;
  assert.ok(React.isValidElement(title), '占位行标题必须是 React 元素');
  const props = title.props as { className?: string };
  return props.className ?? '';
}

test('lazyChildrenOf：未加载不产生占位行；加载中 → #loading；空目录 → #empty', () => {
  assert.deepEqual(lazyChildrenOf('fs:D:/x', undefined, () => {}), [], '未加载 = 空数组');
  assert.deepEqual(
    lazyChildrenOf('fs:D:/x', stateOf(), () => {}),
    [],
    '已加载但 children=null 且未在加载中 = 空数组',
  );

  const loading = lazyChildrenOf('fs:D:/x', stateOf({ loading: true }), () => {});
  assert.equal(loading.length, 1);
  assert.equal(loading[0]!.key, 'fs:D:/x#loading');
  assert.equal(titleClassOf(loading[0]!), 'fp-tree-loading');
  assert.equal(loading[0]!.selectable, false, '占位行不可选中');
  assert.equal(loading[0]!.checkable, false, '占位行不可勾选');

  const empty = lazyChildrenOf('fs:D:/x', stateOf({ children: [] }), () => {});
  assert.equal(empty.length, 1);
  assert.equal(empty[0]!.key, 'fs:D:/x#empty');
  assert.equal(titleClassOf(empty[0]!), 'fp-tree-empty');
});

test('lazyChildrenOf：错误 → #err 行，重试按钮回传本节点 key 且阻止冒泡', () => {
  const retried: string[] = [];
  const rows = lazyChildrenOf('fs:D:/broken', stateOf({ error: 'EACCES' }), (key) => {
    retried.push(key);
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.key, 'fs:D:/broken#err');
  assert.equal(titleClassOf(rows[0]!), 'fp-tree-error');

  const title: unknown = rows[0]!.title;
  assert.ok(React.isValidElement(title));
  const children = (title.props as { children: React.ReactNode }).children;
  assert.ok(Array.isArray(children), '错误行标题 = [文案, 重试按钮]');
  const button: unknown = children[1];
  assert.ok(React.isValidElement(button), '第二个子节点必须是重试按钮');
  const onClick = (button.props as { onClick: (event: { stopPropagation: () => void }) => void })
    .onClick;
  let stopped = false;
  onClick({
    stopPropagation: () => {
      stopped = true;
    },
  });
  assert.deepEqual(retried, ['fs:D:/broken'], '重试必须回传该节点自己的 key');
  assert.equal(stopped, true, '必须 stopPropagation：点重试不应顺带选中节点');
});

test('attachLazy：递归回填 fs: 子级；工作区节点与非 fs 节点原样保留', () => {
  const inner: TreeDataNode = {
    key: fsKeyOf('D:/a/b'),
    title: 'b',
    isLeaf: false,
  };
  const nodes: TreeDataNode[] = [
    { key: 'workspace/rel.ts', title: 'rel.ts', isLeaf: true },
    {
      key: fsKeyOf('D:/a'),
      title: 'a',
      isLeaf: false,
      children: [inner],
    },
  ];
  const states: Record<string, LazyNodeState> = {
    [fsKeyOf('D:/a')]: stateOf({ children: [inner] }),
    [fsKeyOf('D:/a/b')]: stateOf({
      children: [{ key: fsKeyOf('D:/a/b/c'), title: 'c', isLeaf: true }],
    }),
  };

  const attached = attachLazy(nodes, states, () => {});
  // 工作区节点不在 states 里：不得被塞 children。
  assert.deepEqual(attached[0], nodes[0]);
  const fsRoot = attached[1]!;
  assert.equal(fsRoot.key, fsKeyOf('D:/a'));
  assert.equal(fsRoot.children?.length, 1);
  const nested = fsRoot.children![0]!;
  assert.equal(nested.key, fsKeyOf('D:/a/b'), '子节点必须原样保留');
  assert.deepEqual(
    nested.children?.map((node) => node.key),
    [fsKeyOf('D:/a/b/c')],
    '深层节点也必须被递归回填（只挂一层是首版 bug）',
  );
});

test('attachLazy：未加载的 fs 节点只保留自身（不产生空 children）', () => {
  const node: TreeDataNode = { key: fsKeyOf('D:/cold'), title: 'cold', isLeaf: false };
  const attached = attachLazy([node], {}, () => {});
  assert.deepEqual(attached[0], node);
  assert.equal(attached[0]!.children, undefined);
});
