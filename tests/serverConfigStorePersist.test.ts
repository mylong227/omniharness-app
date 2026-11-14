// ServerConfigStore 真实往返判据（2026-11-14 review P1-2，docs/design/settings-completion §4）：
//  设置页新增的 9 个内核键经 config.update → persist 落**用户级** omniharness.json，
//  重读回得来；null = 显式清除（键从文件里删掉）；内核校验拒绝的越界值不落盘。
//  为什么必须真往返（而不是只测白名单成员）：review 实测发现白名单之外还有
//  normalizeConfig / clearedKeys / 用户级路径推断三层，任何一层断了 UI 都会"显示已保存"。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerConfigStore } from '../src/apps/server/services/serverConfigStore.ts';
import type { ProviderPreset } from '../src/host/kernel/config.ts';

/** 造一个隔离的 store（临时家目录 + 预写空配置的临时工作区，回调全部 no-op）。 */
function storeOf(): { store: ServerConfigStore; file: string; home: string } {
  const home = mkdtempSync(join(tmpdir(), 'omni-cfg-persist-'));
  // 工作区里预写空配置：configFilePath 推断 cwd/displayConfig 的 omniharness.json，
  // 不存在时 loadLayered fail-closed（--config 明确意图），故必须给一个真实可读的空配置。
  const work = join(home, 'work');
  mkdirSync(work);
  writeFileSync(join(work, 'omniharness.json'), '{}', 'utf8');
  const store = new ServerConfigStore({
    displayConfig: { workspace: work },
    autoApprove: false,
    probeProvider: async () => undefined,
    onChanged: () => undefined,
    userHomedir: home,
  });
  // 用户级文件路径：~/.omniharness/omniharness.json（UserLevelConfigStore 的固定布局）。
  return { store, file: join(home, '.omniharness', 'omniharness.json'), home };
}

const NOOP_PRESET = { id: 'mock', adapter: 'mock', label: 'x', baseUrl: '', defaultModel: 'm', needsKey: false } as unknown as ProviderPreset;

test('设置页新键：update → 落盘用户级文件 → 重读回得来（成本/熔断/记忆三组）', async () => {
  const { store, file, home } = storeOf();
  try {
    await store.update({
      costBudgetUsd: 5,
      costBudgetSoftRatio: 0.8,
      costBudgetOnExceed: 'warn',
      modelCircuitBreaker: true,
      modelCircuitBreakerThreshold: 5,
      modelCircuitBreakerOpenMs: 30000,
      longTermMemoryEncryption: true,
      longTermMemoryGovernance: true,
      longTermMemoryKeyFile: 'C:/keys/mem.key',
    });
    const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.strictEqual(saved['costBudgetUsd'], 5);
    assert.strictEqual(saved['modelCircuitBreaker'], true);
    assert.strictEqual(saved['longTermMemoryKeyFile'], 'C:/keys/mem.key');
    // 生效配置（get）同样回得来——config.get 的回填源。
    const live = store.get() as Record<string, unknown>;
    assert.strictEqual(live['costBudgetUsd'], 5);
    assert.strictEqual(live['modelCircuitBreakerOpenMs'], 30000);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('null = 显式清除：键从用户级文件里删掉（「留空=默认」的通道）', async () => {
  const { store, file, home } = storeOf();
  try {
    await store.update({ costBudgetUsd: 5, longTermMemoryKeyFile: 'C:/keys/mem.key' });
    assert.strictEqual((JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>)['costBudgetUsd'], 5);
    await store.update({ costBudgetUsd: null, longTermMemoryKeyFile: null });
    const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.strictEqual('costBudgetUsd' in saved, false, 'null 必须删除键而不是写成 null');
    assert.strictEqual('longTermMemoryKeyFile' in saved, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('内核校验拒绝的越界值不落盘（fail-closed，错误回传 UI）', async () => {
  const { store, file, home } = storeOf();
  try {
    await assert.rejects(
      () => store.update({ costBudgetSoftRatio: 1.5, modelCircuitBreaker: 'yes' } as never),
      /costBudgetSoftRatio|modelCircuitBreaker/,
      '越界值必须被内核 normalizeConfig 拒绝并抛错',
    );
    // 抛错发生在 persist 之前 → 用户级文件不应有半截写入（本用例没写过合法键，文件可能不存在）。
    const written = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
    assert.strictEqual('costBudgetSoftRatio' in written, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// NOOP_PRESET 仅防 TS 未用参数告警（enableProvider 探针在别的判据里验）。
void NOOP_PRESET;
