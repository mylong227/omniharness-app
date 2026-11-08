// 内核对接面生成物门禁（2026-11-06）：把 `kernel:check` 第 8 条搬进常规 `web:test`，
// 让「只改业务 import、忘了跑 npm run kernel:surface」在本地测试就直接红，而不是等 CI。
//
// 2026-11-08 CI 修：原先用 `await import('../scripts/kernelSurface.mjs')` 经 Vite 转译，
// Windows CI 上该动态导入报 SyntaxError（本地绿、CI 红）。改为直接 spawn 生成器的
// `--check` 模式：与 `kernel:check` 完全同一条实现，且原生 Node 解析，不经过打包器。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'vitest';

test('内核对接面：生成物与业务实际使用一致，且目录内只有生成文件', () => {
  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, [join('scripts', 'kernelSurface.mjs'), '--check'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    assert.fail(`kernelSurface --check 失败（运行 npm run kernel:surface 后重试）：${detail}`);
  }
  assert.match(stdout, /kernel:surface OK/u, '生成器 --check 应输出一致结论');
});
