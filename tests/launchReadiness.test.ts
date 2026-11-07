// launchReadiness 契约判据（2026-11-08 补齐）：scripts/lib/launchReadiness.mjs 的头注声称由
// tests/unit/launchReadiness.test.ts 钉死、但该判据从未随迁。本文件兑现：
//
//   · resolveServePort：旗标 > 环境变量 > devConfig 缺省（三层优先级不得倒置）；
//   · classifyReadyProbe：五分类 fail-closed（观测不可信时绝不乐观判就绪）；
//   · readinessUrl：必须写 127.0.0.1（Windows 上 localhost 可能先解析 ::1 连不上）。
//
// 直跑（web 测试统一入口）：npm run web:test

import assert from 'node:assert/strict';
import { test } from 'vitest';

const launch = await import('../scripts/lib/launchReadiness.mjs');
const { DEV_DEFAULTS } = await import('../scripts/devConfig.mjs');

test('resolveServePort：--port 旗标最高优先（空格与 = 两种写法）', () => {
  assert.equal(launch.resolveServePort(['--port', '9000'], {}), 9000);
  assert.equal(launch.resolveServePort(['--port=9001'], {}), 9001);
  // 非法旗标值回落缺省，而不是把 0 / NaN 交给轮询。
  assert.equal(launch.resolveServePort(['--port', 'not-a-number'], {}), DEV_DEFAULTS.backendPort);
  assert.equal(launch.resolveServePort(['--port', '0'], {}), DEV_DEFAULTS.backendPort);
});

test('resolveServePort：无旗标时读环境变量，再回落 devConfig 缺省', () => {
  assert.equal(launch.resolveServePort([], { OMNI_BACKEND_PORT: '8901' }), 8901);
  assert.equal(launch.resolveServePort([], {}), DEV_DEFAULTS.backendPort);
  assert.equal(launch.resolveServePort([], { OMNI_BACKEND_PORT: 'garbage' }), DEV_DEFAULTS.backendPort);
});

test('classifyReadyProbe：五分类 fail-closed，观测不可信时绝不判就绪', () => {
  // down：连不上 / 观测本身不可信。
  assert.equal(launch.classifyReadyProbe({ error: new Error('ECONNREFUSED') }), 'down');
  assert.equal(launch.classifyReadyProbe({ statusCode: undefined, bodyText: undefined }), 'down');
  assert.equal(launch.classifyReadyProbe({ statusCode: 500, bodyText: 'oops' }), 'down');
  // guarded：401/403 ⇒ 服务已起来（配了鉴权），仍然开浏览器。
  assert.equal(launch.classifyReadyProbe({ statusCode: 401, bodyText: '' }), 'guarded');
  assert.equal(launch.classifyReadyProbe({ statusCode: 403, bodyText: '' }), 'guarded');
  // foreign：2xx 但不是本程序的健康体（端口被别的进程占着）。
  assert.equal(launch.classifyReadyProbe({ statusCode: 200, bodyText: '<html>别人家</html>' }), 'foreign');
  // ready：2xx 且 status === 'ok'。
  assert.equal(launch.classifyReadyProbe({ statusCode: 200, bodyText: '{"status":"ok"}' }), 'ready');
  // degraded：本程序的自述 503（核心组件没齐）⇒ 继续轮询，不当故障也不当就绪。
  assert.equal(launch.classifyReadyProbe({ statusCode: 503, bodyText: '{"status":"degraded"}' }), 'degraded');
  // 本程序健康体但非 2xx/503 的怪状态 ⇒ down（继续轮询）。
  assert.equal(launch.classifyReadyProbe({ statusCode: 404, bodyText: '{"status":"ok"}' }), 'down');
});

test('readinessUrl：必须写 127.0.0.1 且探 /readyz（不是 /healthz）', () => {
  const url = launch.readinessUrl(8787);
  assert.match(url, /^http:\/\/127\.0\.0\.1:8787\/readyz$/);
});
