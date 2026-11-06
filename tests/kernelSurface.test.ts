// 内核对接面生成物门禁（2026-11-06）：把 `kernel:check` 第 8 条搬进常规 `web:test`，
// 让「只改业务 import、忘了跑 npm run kernel:surface」在本地测试就直接红，而不是等 CI。
//
// 同时钉住「目录纯净」：`src/host/kernel/` 只允许生成物；实现代码必须放 kernel-compat/ 或 apps/。
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';

const { buildSurface } = await import('../scripts/kernelSurface.mjs');

test('内核对接面：生成物与业务实际使用一致，且目录内只有生成文件', () => {
  const root = join(process.cwd(), 'src', 'host', 'kernel');
  const { files, errors } = buildSurface();
  assert.deepEqual(errors, [], `存在无法解析的内核符号（先修导入）：${errors.join('；')}`);
  assert.ok(files.size > 0, '生成器没有产出任何域文件');

  for (const [name, content] of files) {
    const actual = readFileSync(join(root, name), 'utf8');
    assert.equal(actual, content, `${name} 与业务实际 import 不一致：运行 npm run kernel:surface`);
  }

  const entries = readdirSync(root, { withFileTypes: true })
    .map((entry) => entry.name + (entry.isDirectory() ? '/' : ''))
    .sort();
  assert.deepEqual(
    entries,
    [...files.keys()].sort(),
    '对接面目录只允许生成的域文件（实现请放 kernel-compat/ 或 apps/）',
  );
});
