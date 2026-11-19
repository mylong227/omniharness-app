// 模型角色路由草稿模型判据（2026-11-19，内核 #B4 设置页接入）：
// 配置段⇄草稿翻译（adapter 缺省 mock / roles 拷贝）/ 启用种子（默认模型 + 当前适配器）/
// 预挡校验四形态（空条目 / 缺模型名 / 重复模型名 / 角色目标缺失）/ 整段提交面（trim + 空 roles 不落键）。
// 内核语义对照：kernel/adapters/model/modelRouter.js（by-role fail-closed）+ configBuilder.buildRouter。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  MODEL_ROLES,
  ROUTER_ADAPTERS,
  ROUTER_STRATEGIES,
  draftFromSection,
  seedDraft,
  sectionFromDraft,
  validateDraft,
} from '../src/ui/models/ModelRouterDraft.ts';
import type { ModelRouterConfig } from '../src/types/models.ts';

test('draftFromSection：adapter 缺省 mock、roles 浅拷贝、未配置返回 null', () => {
  assert.equal(draftFromSection(undefined), null);
  const section: ModelRouterConfig = {
    strategy: 'by-role',
    entries: [{ model: 'm1' }],
    roles: { executor: 'm1' },
  };
  const draft = draftFromSection(section);
  assert.ok(draft !== null);
  assert.equal(draft.entries[0].adapter, 'mock');
  assert.deepEqual(draft.roles, { executor: 'm1' });
  // 草稿角色改动不回写段（隔离）。
  draft.roles.executor = 'other';
  assert.equal(section.roles?.executor, 'm1');
});

test('seedDraft：entries[0] = 默认模型 + 当前适配器，策略 by-role、空 roles', () => {
  const draft = seedDraft({ model: 'deepseek-v4-flash', modelAdapter: 'openai' });
  assert.equal(draft.strategy, 'by-role');
  assert.deepEqual(draft.entries, [{ model: 'deepseek-v4-flash', adapter: 'openai' }]);
  assert.deepEqual(draft.roles, {});
  // 未配置模型时种子仍可编辑（空模型名会被校验拦下）。
  const bare = seedDraft({});
  assert.equal(bare.entries[0].model, '');
});

test('validateDraft：四形态全拦（空条目 / 缺模型名 / 重复 / 角色目标缺失）', () => {
  assert.deepEqual(validateDraft({ strategy: 'by-role', entries: [], roles: {} }), [
    { code: 'entries-empty' },
  ]);
  const issues = validateDraft({
    strategy: 'by-role',
    entries: [{ model: '', adapter: 'openai' }, { model: 'm1', adapter: 'openai' }, { model: 'm1', adapter: 'openai' }],
    roles: { executor: 'ghost', [MODEL_ROLES[0].id]: 'ghost' },
  });
  assert.deepEqual(issues, [
    { code: 'entry-model-empty', arg: '1' },
    { code: 'entry-model-duplicate', arg: 'm1' },
    { code: 'role-target-missing', arg: MODEL_ROLES[0].id },
  ]);
  // 合法草稿零问题（含空格模型名——trim 语义）。
  assert.deepEqual(
    validateDraft({
      strategy: 'by-role',
      entries: [{ model: ' m1 ', adapter: 'openai' }],
      roles: { executor: 'm1' },
    }),
    [],
  );
});

test('sectionFromDraft：trim 模型名、空 roles 不落键、条目只带 model/adapter', () => {
  const section = sectionFromDraft({
    strategy: 'by-role',
    entries: [{ model: ' m1 ', adapter: 'openai' }, { model: 'm2', adapter: 'anthropic' }],
    roles: { executor: ' m1 ', planner: '  ', compactor: 'm2' },
  });
  assert.deepEqual(section, {
    strategy: 'by-role',
    entries: [{ model: 'm1', adapter: 'openai' }, { model: 'm2', adapter: 'anthropic' }],
    roles: { executor: 'm1', compactor: 'm2' },
  });
  const noRoles = sectionFromDraft({ strategy: 'round-robin', entries: [{ model: 'm', adapter: 'mock' }], roles: {} });
  assert.deepEqual(noRoles, { strategy: 'round-robin', entries: [{ model: 'm', adapter: 'mock' }] });
});

test('清单与内核面对齐：7 策略 + 8 角色 + 6 适配器（内核枚举全集）', () => {
  assert.deepEqual(
    ROUTER_STRATEGIES.map((s) => s.value).sort(),
    ['by-context', 'by-role', 'by-task', 'health-fallback', 'least-cost', 'round-robin', 'ucb1'],
  );
  assert.deepEqual(
    MODEL_ROLES.map((r) => r.id).sort(),
    ['compactor', 'executor', 'goal', 'guardian', 'memory', 'planner', 'reviewer', 'subagent'],
  );
  assert.deepEqual(ROUTER_ADAPTERS, ['mock', 'openai', 'anthropic', 'responses', 'llamacpp', 'gemini']);
});
