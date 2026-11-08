// 内核「已承诺能力」影子门禁（2026-11-08）：把 `kernel:check` 第 9 条搬进常规 `web:test`。
//
// 判什么：`src/host/extensions/**` 自己声明的符号名，不得与内核 `exports` 承诺模块的 `.d.ts`
// 导出名重合——内核已承诺的能力必须经 `src/host/kernel/` 对接面消费，app 侧再留一份即影子回归。
//
// 为什么用子进程而不是 `import`：与 `tests/kernelSurface.test.ts` 同一套 CI 兼容做法——
// 生成器/扫描器由原生 Node 解析，不经 Vite 打包器（2026-11-08 Windows CI 上动态 import
// `.mjs` 报过 SyntaxError，本地绿 CI 红）。
//
// 为什么还要断言两侧计数：只判「冲突 0」在扫描器扫空时也会绿（假绿）。断言真的扫到了
// 承诺面与 extensions 声明，才能证明这次 0 是「比对过」而不是「没比」。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'vitest';

test('extensions 里不得出现内核已承诺能力的同名实现', () => {
  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, [join('scripts', 'kernelShadowScan.mjs')], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    assert.fail(
      `kernelShadowScan 失败：extensions 里出现了内核已承诺的同名实现（改走 src/host/kernel/ 对接面）：${detail}`,
    );
  }
  assert.match(stdout, /kernel:shadow OK/u, '扫描器应给出通过结论');
  assert.match(stdout, /承诺导出名 [1-9]\d* 个/u, '必须真的扫到内核承诺面（防空扫假绿）');
  assert.match(stdout, /extensions 声明名 [1-9]\d* 个/u, '必须真的扫到 extensions 声明（防空扫假绿）');
  assert.match(stdout, /同名冲突 0/u, '冲突数应为 0');
});
