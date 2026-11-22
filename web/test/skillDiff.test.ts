// SkillDiff 行级 LCS diff 判据（2026-11-20，Skill Lab v1 差异预览的纯逻辑层）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { diffLines, diffStats } from '../src/ui/models/SkillDiff.ts';

test('diffLines：相同文本零差异、纯增、纯删', () => {
  assert.deepEqual(diffLines('同文', '同文'), [{ kind: 'same', text: '同文' }]);
  assert.deepEqual(diffStats(diffLines('a\nb', 'a\nb')), { added: 0, removed: 0 });
  // 纯增（尾部）。
  assert.deepEqual(diffLines('a', 'a\nb'), [
    { kind: 'same', text: 'a' },
    { kind: 'add', text: 'b' },
  ]);
  // 纯删（头部）。
  assert.deepEqual(diffLines('x\na', 'a'), [
    { kind: 'del', text: 'x' },
    { kind: 'same', text: 'a' },
  ]);
});

test('diffLines：中部替换 = 删在前加在后，其余行对齐', () => {
  const lines = diffLines('a\nold\nc', 'a\nnew\nc');
  assert.deepEqual(lines, [
    { kind: 'same', text: 'a' },
    { kind: 'del', text: 'old' },
    { kind: 'add', text: 'new' },
    { kind: 'same', text: 'c' },
  ]);
});

test('diffLines：空串边界 + 统计', () => {
  assert.deepEqual(diffLines('', 'a\nb'), [
    { kind: 'add', text: 'a' },
    { kind: 'add', text: 'b' },
  ]);
  assert.deepEqual(diffLines('a\nb', ''), [
    { kind: 'del', text: 'a' },
    { kind: 'del', text: 'b' },
  ]);
  const stats = diffStats(diffLines('a\nx\nc', 'a\ny\nc\nd'));
  assert.deepEqual(stats, { added: 2, removed: 1 });
});
