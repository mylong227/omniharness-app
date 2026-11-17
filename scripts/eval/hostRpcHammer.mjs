#!/usr/bin/env node
// 后端宿主并发锤（2026-11-17 批次 4）：经嵌入 API 起真实宿主（内核 alpha.26 + 全部域模块），
// 并发打只读 RPC，报告延迟分位数与错误数；验证内核升级后宿主在并发下的稳定性与延迟量级。
//
// 用法：npm run build && node scripts/eval/hostRpcHammer.mjs [--concurrency N] [--rounds N]
// 环境变量：HAMMER_CONCURRENCY（缺省 32）/ HAMMER_ROUNDS（缺省 20，每轮每 worker 一次调用）。
// 只读方法（config.get / kernel.health / sessions.list / rpc.list），不改任何状态。
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const CONCURRENCY = Number(process.env.HAMMER_CONCURRENCY ?? 32);
const ROUNDS = Number(process.env.HAMMER_ROUNDS ?? 20);
const TOKEN = 'hammer-token-0123456789abcdef';
const METHODS = ['config.get', 'kernel.health', 'sessions.list', 'rpc.list'];

const { createOmniHarness } = await import(
  new URL('../../dist/src/index.js', import.meta.url).href
);

/** 单次 JSON-RPC 调用，返回耗时（ms）；失败抛错。 */
async function rpcOnce(origin, method) {
  const started = performance.now();
  const res = await fetch(origin + '/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
  });
  const body = await res.json();
  if (body.error !== undefined) throw new Error(method + ': ' + (body.error.message ?? 'rpc error'));
  return performance.now() - started;
}

/** 分位数（线性插值）。 */
function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const harness = await createOmniHarness({ transport: { http: { port: 0, token: TOKEN } } });
try {
  const origin = new URL(harness.url).origin;
  console.log('[hammer] 宿主已起：' + origin + '（内核 alpha.26，并发 ' + CONCURRENCY + ' × ' + ROUNDS + ' 轮 × ' + METHODS.length + ' 方法）');

  const latencies = [];
  const errors = [];
  const wallStart = performance.now();
  for (let round = 0; round < ROUNDS; round++) {
    const workers = [];
    for (let w = 0; w < CONCURRENCY; w++) {
      const method = METHODS[(round + w) % METHODS.length];
      workers.push(
        rpcOnce(origin, method)
          .then((ms) => latencies.push(ms))
          .catch((e) => errors.push(String(e.message ?? e))),
      );
    }
    await Promise.all(workers);
  }
  const wallMs = performance.now() - wallStart;

  latencies.sort((a, b) => a - b);
  const total = CONCURRENCY * ROUNDS;
  const summary = {
    total,
    ok: latencies.length,
    errors: errors.length,
    wallMs: Math.round(wallMs),
    rps: Math.round((latencies.length / wallMs) * 1000),
    p50Ms: Math.round(quantile(latencies, 0.5) * 10) / 10,
    p95Ms: Math.round(quantile(latencies, 0.95) * 10) / 10,
    p99Ms: Math.round(quantile(latencies, 0.99) * 10) / 10,
    maxMs: Math.round(latencies[latencies.length - 1] ?? 0),
  };
  console.log(
    '[hammer] 调用 ' + summary.ok + '/' + summary.total + '（错误 ' + summary.errors + '）· 墙钟 ' + summary.wallMs + 'ms · ' + summary.rps + ' rps' +
    ' · p50 ' + summary.p50Ms + 'ms / p95 ' + summary.p95Ms + 'ms / p99 ' + summary.p99Ms + 'ms / max ' + summary.maxMs + 'ms',
  );
  if (errors.length > 0) console.log('[hammer] 错误样例：' + errors.slice(0, 3).join(' | '));
  console.log(JSON.stringify(summary));
  process.exitCode = errors.length === 0 ? 0 : 1;
} finally {
  await harness.close();
}
