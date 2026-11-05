#!/usr/bin/env node
/**
 * 端到端冒烟：**真起 serve，真发 HTTP**。
 *
 * 判据（任一不满足即退出码 1，且打印实际拿到的东西，不粉饰）：
 *   1. `serve` 启动横幅里的 UI URL 含一次性 token；
 *   2. `GET /healthz` → 200 + JSON（公开，免鉴权）；
 *   3. `GET /readyz` → 200（公开，免鉴权）；
 *   4. `GET /?token=…` → 200 + HTML 含 `id="root"`（说明静态托管指到 `web/dist`）；
 *   5. `POST /rpc config.get`（Bearer）→ JSON-RPC `result` 对象（说明 RPC 分发与会话装配可用）；
 *   6. `POST /rpc sessions.list`（Bearer）→ `result.sessions` 是数组（会话存储/工作区作用域可用）；
 *   7. `@omniharness/kernel` 的 `NativeKernel.available()` 为真且 `ping()` 通过（原生内核随包可加载）。
 *
 * 用法：`npm run smoke`（可选 `--keep` 保留工作区目录便于排查）。
 * 退出码：0 全过 / 1 断言失败 / 2 启动超时。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ENTRY = join(ROOT, 'dist', 'src', 'apps', 'cli', 'exec.js');
const keep = process.argv.includes('--keep');
const workspace = mkdtempSync(join(tmpdir(), 'omni-app-smoke-'));

const failures = [];
/** 记录一条判据结果（失败不中断，最后统一退出）。 */
function check(name, ok, detail) {
  process.stdout.write(`${ok ? '✓' : '✗'} ${name}${detail === undefined ? '' : `：${detail}`}\n`);
  if (!ok) failures.push(name);
}

const child = spawn(
  process.execPath,
  [ENTRY, 'serve', '--port', '0', '--workspace', workspace],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, OMNI_NO_OPEN: '1' } },
);

let banner = '';
child.stdout.on('data', (chunk) => {
  banner += chunk.toString('utf8');
  process.stdout.write(chunk.toString('utf8'));
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk.toString('utf8')));

// 2026-11-06 审计 P2 修：横幅等待此前在 try/finally **之外**——超时/serve 提前退出时
// 顶层 reject 直接终止脚本，serve 子进程与临时工作区双双泄漏（孤儿进程 + omni-app-smoke-* 残目录）。
// 现在整段收纳进 try/finally，任何失败路径都会走同一份清理。
try {
  /** 等横幅出现（最多 90s；serve 首次启动要读默认策略表）。 */
  const uiUrl = await new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('等待 serve 启动横幅超时')), 90_000);
    const tick = setInterval(() => {
      const match = banner.match(/OmniHarness UI:\s*(https?:\/\/\S+\?token=([0-9a-fA-F]+))/u);
      if (match !== null) {
        clearTimeout(timer);
        clearInterval(tick);
        resolvePromise({ url: match[1], token: match[2] });
      }
    }, 100);
    child.on('exit', (code) => {
      clearTimeout(timer);
      clearInterval(tick);
      rejectPromise(new Error(`serve 提前退出（code ${String(code)}）`));
    });
  });

  const origin = new URL(uiUrl.url).origin;
  check('启动横幅含 token', uiUrl.token.length >= 16, `token 长度 ${String(uiUrl.token.length)}`);

  const health = await fetch(`${origin}/healthz`);
  const healthBody = await health.text();
  check('GET /healthz 200', health.status === 200, `HTTP ${String(health.status)}`);
  check('healthz 是 JSON', healthBody.trimStart().startsWith('{'), healthBody.slice(0, 80));

  const ready = await fetch(`${origin}/readyz`);
  check('GET /readyz 200', ready.status === 200, `HTTP ${String(ready.status)}`);

  const page = await fetch(uiUrl.url);
  const html = await page.text();
  check('GET / 返回工作台 HTML', page.status === 200 && html.includes('id="root"'), `HTTP ${String(page.status)}`);

  const rpc = await fetch(`${origin}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${uiUrl.token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'config.get', params: {} }),
  });
  const rpcBody = await rpc.json().catch(() => ({}));
  check(
    'POST /rpc config.get 有 result',
    rpc.status === 200 && rpcBody !== null && typeof rpcBody === 'object' && 'result' in rpcBody,
    `HTTP ${String(rpc.status)}${'error' in rpcBody ? ` error=${JSON.stringify(rpcBody.error)}` : ''}`,
  );

  const sessionsRpc = await fetch(`${origin}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${uiUrl.token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'sessions.list', params: {} }),
  });
  const sessionsBody = await sessionsRpc.json().catch(() => ({}));
  check(
    'POST /rpc sessions.list 有数组',
    sessionsRpc.status === 200 &&
      Array.isArray(sessionsBody?.result?.sessions),
    `HTTP ${String(sessionsRpc.status)} count=${String(sessionsBody?.result?.sessions?.length ?? '?')}`,
  );

  const { NativeKernel } = await import('@omniharness/kernel/kernel/native/nativeKernel.js');
  const native = new NativeKernel();
  const pong = native.available() ? native.ping() : { ok: false, native: false };
  check(
    '原生内核实载',
    native.available() && pong.ok === true && pong.native === true,
    `${native.modulePath()} ping=${JSON.stringify(pong)}`,
  );
} catch (error) {
  process.stderr.write(`✗ 冒烟异常：${String(error?.message ?? error)}\n`);
  failures.push('exception');
} finally {
  child.kill();
  if (!keep) rmSync(workspace, { recursive: true, force: true });
  else process.stdout.write(`工作区保留在：${workspace}\n`);
}

process.stdout.write(failures.length === 0 ? '\n✓ 冒烟全过\n' : `\n✗ ${failures.length} 项失败\n`);
process.exit(failures.length === 0 ? 0 : 1);
