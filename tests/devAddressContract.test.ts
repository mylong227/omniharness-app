// 开发回路地址镜像契约（2026-11-08 补齐）：三处注释长期声称由 tests/unit/devAddressContract.test.ts
// 钉死（scripts/devConfig.mjs / scripts/lib/launchReadiness.mjs / scripts/startAll.mjs），
// 但该判据从未随迁——镜像一致性当前裸奔。本文件兑现该承诺：
//
//   · devConfig.DEV_DEFAULTS.backendPort  ←镜像→  serveDefaults.DEFAULT_SERVE_PORT（后端 TS 源）
//   · launchReadiness.DEFAULT_SERVE_PORT  ←派生自→  devConfig（禁止手抄）
//   · vite dev 端口                        ←单源自→  devConfig.uiPort（vite.config.ts 消费）
//
// 改默认端口要 devConfig 与 serveDefaults 两处同改，本判据红着提醒。
// 直跑（web 测试统一入口）：npm run web:test

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const { DEV_DEFAULTS } = await import('../scripts/devConfig.mjs');
const launch = await import('../scripts/lib/launchReadiness.mjs');
const { ServeDefaults } = await import('../src/apps/cli/serveDefaults.ts');

test('devConfig.backendPort 必须镜像 serveDefaults.DEFAULT_SERVE_PORT', () => {
  assert.equal(
    DEV_DEFAULTS.backendPort,
    ServeDefaults.DEFAULT_SERVE_PORT,
    'dev 工具的默认后端端口与后端 serve 默认端口漂移——两处同改（devConfig.mjs + serveDefaults.ts）',
  );
});

test('launchReadiness.DEFAULT_SERVE_PORT 必须派生自 devConfig（不得手抄第二份）', () => {
  assert.equal(
    launch.DEFAULT_SERVE_PORT,
    DEV_DEFAULTS.backendPort,
    'launchReadiness 自声明「不得自成一源」——它必须继续从 devConfig 派生',
  );
});

test('vite dev 端口必须单源自 devConfig.uiPort（vite.config.ts 消费方锚点）', () => {
  const viteSrc = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.match(viteSrc, /from '\.\/scripts\/devConfig\.mjs'/, 'vite.config 必须从 devConfig 取地址');
  assert.match(viteSrc, /dev\.uiPort/, 'vite dev 端口必须消费 dev.uiPort（禁止再写字面量）');
});
