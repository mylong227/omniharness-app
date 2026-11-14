// 设置页内核能力补全判据（2026-11-14，docs/design/settings-completion §2/§4）：
//  ① config.update 白名单（PERSISTABLE_KEYS）覆盖设置页新增的 9 个内核键；
//  ② 每个白名单键都在内核字段规格（configFieldSpecs）的类型白名单里——写进配置文件
//     不会被 normalizeConfig 以"未知 key"拒绝；
//  ③ 内核校验是最终裁决：越界值（costBudgetSoftRatio > 1）走 mergeConfigs 真实拒绝。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERSISTABLE_KEYS } from '../src/apps/server/core/appServerState.ts';
import { ConfigError } from '@omniharness/kernel/kernel/config/configError.js';

const KERNEL_DIST = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  '@omniharness',
  'kernel',
  'dist',
);

/** 2026-11-14 设置页补全新增的键（与设计文档 §1.3 一一对应）。 */
const NEW_KEYS = [
  'costBudgetUsd',
  'costBudgetOnExceed',
  'costBudgetSoftRatio',
  'modelCircuitBreaker',
  'modelCircuitBreakerThreshold',
  'modelCircuitBreakerOpenMs',
  'longTermMemoryEncryption',
  'longTermMemoryGovernance',
  'longTermMemoryKeyFile',
];

test('PERSISTABLE_KEYS 覆盖设置页新增的全部内核键（漏一个 UI 就写不进配置文件）', () => {
  for (const key of NEW_KEYS) {
    assert.ok(PERSISTABLE_KEYS.includes(key), `新设置键 ${key} 不在 config.update 白名单里`);
  }
});

test('白名单键全部在内核字段规格的类型白名单里（不会被 normalizeConfig 未知 key 拒绝）', () => {
  const req = createRequire(import.meta.url);
  const specs = req(join(KERNEL_DIST, 'kernel', 'config', 'configFieldSpecs.js'));
  for (const key of PERSISTABLE_KEYS) {
    const known =
      key in specs.ENUM_VALUES ||
      specs.STRING_FIELDS.has(key) ||
      specs.NUMBER_FIELDS.has(key) ||
      specs.BOOLEAN_FIELDS.has(key) ||
      // 特殊动作参数与结构化段（有各自 validator / 特殊路径，不走标量白名单）；
      // elevatedSandbox 例外地是**一等枚举**（ENUM_VALUES 里有），列在这里只因
      // 早期内核版本未进标量白名单——内核若已把它收进 ENUM 分支，本行兜底无害。
      ['apiKey', 'providerKeys', 'autoApprove', 'permission', 'ssrfPolicy', 'limits', 'elevatedSandbox', 'longTermMemoryKeyFile', 'modelRouter', 'providerKeysDpapi'].includes(key);
    assert.ok(known, `PERSISTABLE_KEYS 里的 ${key} 不是内核已登记的配置键`);
  }
});

test('内核校验是最终裁决：costBudgetSoftRatio 越界（>1）被 mergeConfigs 拒绝', () => {
  assert.throws(
    () => ConfigError.mergeConfigs({}, { costBudgetSoftRatio: 1.5 } as never),
    ConfigError,
    '软阈值 >1 必须被内核 fail-closed 拒绝（前端范围校验只是先挡输错）',
  );
  // 合法值（=1）不被拒绝。
  assert.doesNotThrow(() => ConfigError.mergeConfigs({}, { costBudgetSoftRatio: 1 } as never));
});
