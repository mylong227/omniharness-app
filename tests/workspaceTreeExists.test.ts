/**
 * `fs.exists`：回合结果卡用它核对「写过又删除」的临时产物。
 *
 * 只回答存在的普通文件，越界/目录/空路径一律 false（fail-closed）；不读正文、不产生副作用。
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { WorkspaceTree } from '../src/apps/server/services/workspaceTree.ts';

test('WorkspaceTree.exists：文件 true；缺失/目录/越界/空路径 false', () => {
  const root = mkdtempSync(join(tmpdir(), 'omni-tree-'));
  try {
    writeFileSync(join(root, 'keep.ts'), 'x');
    mkdirSync(join(root, 'dir'));
    const tree = new WorkspaceTree({ workspaceRoot: () => root });
    assert.deepEqual(tree.exists({ path: 'keep.ts' }), { exists: true });
    assert.deepEqual(tree.exists({ path: 'missing.ts' }), { exists: false });
    assert.deepEqual(tree.exists({ path: 'dir' }), { exists: false }, '目录不是文件');
    assert.deepEqual(tree.exists({ path: '../outside.ts' }), { exists: false }, '越界拒绝');
    assert.deepEqual(tree.exists({ path: '' }), { exists: false });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
