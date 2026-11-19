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
  // alpha.19 上下文三段（结构化对象；2026-11-15 补入口）。
  'retrievalContext',
  'semanticRecall',
  'contextPolicy',
  // alpha.21：读缓存 / 能力防火墙（内核文件面补齐）。
  'toolCache',
  'capflow',
  // 2026-11-19 模型角色路由卡（内核 #B4；结构化段，整段提交/按段替换）。
  'modelRouter',
  // 2026-11-20 Skill Lab（skills 内联数组；整段提交/按段替换）。
  'skills',
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
      ['apiKey', 'providerKeys', 'autoApprove', 'permission', 'ssrfPolicy', 'limits', 'elevatedSandbox', 'longTermMemoryKeyFile', 'modelRouter', 'providerKeysDpapi', 'retrievalContext', 'semanticRecall', 'contextPolicy', 'toolCache', 'capflow', 'skills'].includes(key);
    assert.ok(known, `PERSISTABLE_KEYS 里的 ${key} 不是内核已登记的配置键`);
  }
});

test('上下文三段：内核段校验器是最终裁决（合法通过 / 非法枚举与越界拒绝）', () => {
  assert.doesNotThrow(
    () =>
      ConfigError.mergeConfigs({}, {
        retrievalContext: { mode: 'bm25', maxSnippets: 4, maxTokens: 600 },
        semanticRecall: { mode: 'on' },
        contextPolicy: { degradeLadder: { compactionForce: true }, cacheGuard: { hitRateFloor: 0.5 } },
      } as never),
    '合法段必须通过（否则设置页保存会被 fail-closed 误拒）',
  );
  assert.throws(
    () => ConfigError.mergeConfigs({}, { retrievalContext: { mode: 'semantic' } } as never),
    ConfigError,
    '未知 mode 必须拒绝',
  );
  assert.throws(
    () => ConfigError.mergeConfigs({}, { contextPolicy: { cacheGuard: { hitRateFloor: 2 } } } as never),
    ConfigError,
    '命中率下限必须落在 (0,1]',
  );
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
