// 路由条目凭据物化判据（2026-11-27 真机故障回归 · 应用侧）：
//   · 显式 provider → 端点随厂商预设、Key 取 providerKeys；
//   · 未写 provider → 在该适配器下挑「有 Key」的厂商（优先模型名命中）；
//   · 活动厂商可用顶层 apiKey 回退（老配置兼容）；
//   · 解析不到时保持原条目（交给内核占位/fail-closed），且不改写入参。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { FileConfig, ModelRouterConfig } from '../src/host/kernel/contracts.ts';
import { ModelRouterCredentials } from '../src/apps/cli/modelRouterCredentials.ts';

/**
 * 造一份最小文件配置（只填本判据消费的字段）。
 * @param overrides 覆盖项。
 * @returns 文件配置（测试夹具）。
 */
function fileOf(overrides: Partial<FileConfig>): FileConfig {
  return { ...overrides } as FileConfig;
}

test('显式 provider：端点与 Key 随厂商物化（不再要求 OPENAI_API_KEY）', () => {
  const router: ModelRouterConfig = {
    strategy: 'by-role',
    entries: [{ model: 'deepseek-flash', provider: 'deepseek' }],
  };
  const resolved = ModelRouterCredentials.materialize(
    router,
    fileOf({ providerKeys: { deepseek: 'sk-deepseek' } }),
  );
  assert.deepEqual(resolved?.entries[0], {
    model: 'deepseek-flash',
    provider: 'deepseek',
    adapter: 'openai',
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'sk-deepseek',
  });
});

test('未写 provider：按适配器挑有 Key 的厂商，优先模型名命中', () => {
  const router: ModelRouterConfig = {
    strategy: 'by-role',
    entries: [{ model: 'deepseek-flash', adapter: 'openai' }],
  };
  const resolved = ModelRouterCredentials.materialize(
    router,
    fileOf({ providerKeys: { moonshot: 'sk-moonshot', deepseek: 'sk-deepseek' } }),
  );
  assert.equal(resolved?.entries[0]?.provider, undefined);
  assert.equal(resolved?.entries[0]?.baseUrl, 'https://api.deepseek.com');
  assert.equal(resolved?.entries[0]?.apiKey, 'sk-deepseek');
});

test('活动厂商可用顶层 apiKey 回退（老配置兼容）', () => {
  const router: ModelRouterConfig = {
    strategy: 'by-role',
    entries: [{ model: 'deepseek-v4-flash', adapter: 'openai' }],
  };
  const resolved = ModelRouterCredentials.materialize(
    router,
    fileOf({ modelAdapter: 'openai', apiKey: 'sk-top' }),
  );
  assert.equal(resolved?.entries[0]?.apiKey, 'sk-top');
});

test('解析不到凭据：保持原条目（判定留给内核占位/fail-closed）', () => {
  const entry = { model: 'm', adapter: 'openai' as const };
  const router: ModelRouterConfig = { strategy: 'by-role', entries: [entry] };
  const resolved = ModelRouterCredentials.materialize(router, fileOf({}));
  assert.equal(resolved, router);
  assert.equal(resolved?.entries[0], entry);
});

test('物化不改写入参（apiKey 只在内存对象上出现一次）', () => {
  const router: ModelRouterConfig = {
    strategy: 'by-role',
    entries: [{ model: 'deepseek-flash', adapter: 'openai' }],
  };
  const resolved = ModelRouterCredentials.materialize(
    router,
    fileOf({ providerKeys: { deepseek: 'sk-deepseek' } }),
  );
  assert.notEqual(resolved, router);
  const original = router.entries[0];
  assert.ok(original !== undefined);
  assert.equal('apiKey' in original, false);
  assert.equal(resolved?.entries[0]?.apiKey, 'sk-deepseek');
});
