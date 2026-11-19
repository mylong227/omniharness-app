// Skill Lab 编辑服务判据（2026-11-20，docs/design/skill-lab §3）：
// 列表归并（config 可编辑 + registry 只读 + 覆盖态）/ get（config 优先回落 registry / 未找到）/ 
// 差异测试三态（通过 / 空字段 / 重名）/ apply 整段替换语义 / delete（config 可删 / registry-only 拒绝）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  applyDraft,
  deleteSkill,
  getSkillView,
  listSkillsView,
  validateDraft,
} from '../src/apps/server/services/skillEditor.ts';

const registry = [
  { name: 'bundled-one', description: '随包技能', trust: 'bundled' },
  { name: 'ws-one', description: '工作区技能', tags: ['ws'], trust: 'workspace' },
];
const config = [
  { name: 'my-skill', description: '我的技能', instructions: '第一步…', tags: ['mine'] },
];

test('listSkillsView：config 可编辑在前、registry 只读在后、同名双现标 overridden', () => {
  const rows = listSkillsView(registry, [...config, { name: 'bundled-one', description: '覆盖版', instructions: '改写' }]);
  const bundled = rows.find((r) => r.name === 'bundled-one');
  assert.equal(bundled?.source, 'config', 'config 侧归并为一行');
  assert.equal(bundled?.editable, true);
  assert.equal(bundled?.overridden, true, '同名 registry 条目存在 → 覆盖编辑态');
  const ws = rows.find((r) => r.name === 'ws-one');
  assert.equal(ws?.source, 'workspace');
  assert.equal(ws?.editable, false);
  assert.equal(ws?.overridden, undefined);
  assert.equal(rows.filter((r) => r.name === 'bundled-one').length, 1, '不重复出两行');
});

test('getSkillView：config 优先（回完整 instructions）→ 回落 registry → 未找到报错', () => {
  const hit = getSkillView(registry, config, 'my-skill');
  assert.deepEqual(hit, { name: 'my-skill', description: '我的技能', instructions: '第一步…', tags: ['mine'], source: 'config', editable: true });
  const reg = getSkillView(registry, config, 'bundled-one');
  assert.equal(reg.editable, false);
  assert.equal(reg.source, 'bundled');
  assert.throws(() => getSkillView(registry, config, 'ghost'), /未找到技能/);
});

test('差异测试三态：通过为空 / 空字段拒绝 / config 内重名拒绝（create）', () => {
  const draft = { name: 'new-one', description: '新技能', instructions: '正文' };
  assert.deepEqual(validateDraft(draft, 'create', config), []);
  assert.ok(
    validateDraft({ ...draft, instructions: '  ' }, 'create', config).some((i) => i.includes('需要 instructions')),
    '空正文拒绝',
  );
  assert.ok(
    validateDraft({ ...draft, name: 'my-skill' }, 'create', config).some((i) => i.includes('拒绝')),
    'create 撞 config 内重名拒绝',
  );
  assert.ok(
    validateDraft({ ...draft, name: 'bundled-one' }, 'create', config).length === 0,
    '撞 bundled 名 = 覆盖编辑语义，create 允许（config 内无同名）',
  );
  assert.ok(
    validateDraft({ ...draft, name: 'ghost' }, 'edit', config).some((i) => i.includes('未找到技能')),
    'edit 模式名必须已在 config 内',
  );
});

test('applyDraft：edit 按名替换、create 追加、深拷贝不共享引用', () => {
  const next = applyDraft(config, { name: 'my-skill', description: '改写版', instructions: '新正文', tags: ['mine'] });
  assert.equal(next.length, 1);
  assert.equal(next[0].description, '改写版');
  const appended = applyDraft(next, { name: 'second', description: '第二条', instructions: '正文' });
  assert.equal(appended.length, 2);
  // 深拷贝：改动返回值不影响原数组。
  (appended[0] as { tags?: string[] }).tags?.push('hacked');
  assert.deepEqual(config[0].tags, ['mine']);
  // tags 空数组不落键（内核 SkillEntry tags 可选）。
  const noTags = applyDraft(config, { name: 'third', description: 'd', instructions: 'i', tags: [] });
  assert.equal(noTags.find((s) => s.name === 'third')?.tags, undefined);
});

test('deleteSkill：config 内可删 / registry-only 返回 null（not-editable）', () => {
  const next = deleteSkill(config, 'my-skill');
  assert.deepEqual(next, []);
  assert.equal(deleteSkill(config, 'bundled-one'), null, 'bundled 不在 config 内 → null');
});
