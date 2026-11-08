// 影子扫描的「再导出桶」回归判据（2026-11-08）：门禁曾经对 curated 子路径整类漏扫。
//
// 背景：`IsolationLadderFactory` / `SdkPreferredMcpConnector` / `SessionGc` 等 5 件同体副本
// 之所以能在 `kernel:check` 全绿时长期滞留，是因为承诺面读的是 `.d.ts`——curated 子路径
// （`./sandbox` / `./mcp` / `./maintenance`）的声明文件是**纯再导出桶**，旧扫描只认
// `export class …` 直接声明，桶里的 `export { X } from './…'` 一条都扫不到。
//
// 本案用临时仓库夹具把这条漏检钉死：桶承诺 + extensions 同名实现 ⇒ 必须判红，且报错要指出
// 承诺它的桶（让维护者知道「内核已承诺，别再自留」）。
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { spawnSync } from 'node:child_process';

/**
 * 造一个最小夹具：内核包只有一个 curated 桶 `./barrel`，桶再导出 `Widget`；
 * `src/host/extensions` 里按需声明同名实现。
 * @param withShadow 是否在 extensions 里放同名 `Widget`
 * @returns 仓库根（调用方负责清理）
 */
const fixture = (withShadow: boolean): string => {
  const root = mkdtempSync(join(tmpdir(), 'omni-shadow-'));
  const kernel = join(root, 'node_modules', '@omniharness', 'kernel');
  mkdirSync(join(kernel, 'dist'), { recursive: true });
  writeFileSync(
    join(kernel, 'package.json'),
    JSON.stringify({
      name: '@omniharness/kernel',
      version: '0.0.0-fixture',
      exports: { '.': './dist/index.js', './barrel': './dist/barrel.js' },
    }),
  );
  writeFileSync(join(kernel, 'dist', 'index.d.ts'), 'export {};\n');
  writeFileSync(join(kernel, 'dist', 'barrel.d.ts'), "export { Widget } from './widget.ts';\n");
  writeFileSync(join(kernel, 'dist', 'widget.d.ts'), 'export declare class Widget {}\n');
  mkdirSync(join(root, 'src', 'host', 'extensions', 'demo'), { recursive: true });
  if (withShadow) {
    writeFileSync(join(root, 'src', 'host', 'extensions', 'demo', 'widget.ts'), 'export class Widget {}\n');
  }
  return root;
};

/** 以子进程跑扫描器（`--root`），返回退出码与两侧输出。 */
const runScan = (root: string): { status: number; stdout: string; stderr: string } => {
  const result = spawnSync(
    process.execPath,
    [join('scripts', 'kernelShadowScan.mjs'), '--root', root],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
};

test('curated 桶再导出的名字也是承诺面：extensions 同名实现必须判红', () => {
  const root = fixture(true);
  try {
    const result = runScan(root);
    assert.equal(result.status, 1, '桶里承诺的 Widget 被 extensions 自留，扫描必须失败');
    assert.match(result.stderr, /Widget/u, '报错要点名冲突符号');
    assert.match(result.stderr, /dist\/barrel\.d\.ts/u, '报错要指出承诺它的桶（可操作归因）');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('没有同名实现时通过（对照组，防「扫描器一律判红」）', () => {
  const root = fixture(false);
  try {
    const result = runScan(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /kernel:shadow OK/u);
    assert.match(result.stdout, /承诺导出名 1 个/u, '桶里 1 个名字必须真的扫到');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
