#!/usr/bin/env node
/**
 * 文档门禁：相对链接必须存在，关键计数必须与代码实测同源。
 *
 * 为什么需要：文档里的路径与数字最容易烂，而且烂了不会让任何判据变红
 * （2026-11-22 合并后审计一次抓到 7 处计数漂移 + 1 个退役目录死链）。
 *
 * 判据（任一失败退出码 1）：
 * 1. 白名单 Markdown 里的相对链接必须解析到存在的路径（外链 / 纯锚点跳过）；
 * 2. README 与 `docs/KERNEL-CONTRACT.md` 声明的域数、域模块数、RPC 方法数，
 *    必须等于实测值（`src/host/kernel/*.ts` 文件数、`modules/index.ts` 登记数、
 *    parity 快照里的 `expect(methods.length).toBe(N)`）。
 *
 * 范围：README、CONTRIBUTING、docs/**、desktop/README、src/host/extensions/README、vendor/README。
 * 仓库外的引用（如 `../omniharness-kernel` 兄弟仓）按外链跳过——CI 检出里不存在，不能用它判死。
 * CHANGELOG 是历史记录（条目里的路径可能已退役），不参与本门禁。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 参与门禁的 Markdown 入口文件（相对仓库根）。 */
const DOC_FILES: readonly string[] = [
  'README.md',
  'CONTRIBUTING.md',
  'desktop/README.md',
  'src/host/extensions/README.md',
  'vendor/README.md',
];

/** 参与门禁的 Markdown 目录（相对仓库根，递归）。 */
const DOC_DIRS: readonly string[] = ['docs'];

/** 收集到的失败项；全部跑完后一次性输出。 */
const failures: string[] = [];

/**
 * 记录一条失败。
 * @param message 人可读的失败说明。
 */
function fail(message: string): void {
  failures.push(message);
}

/**
 * 读取仓库内文本文件（UTF-8）。
 * @param file 相对仓库根的路径。
 * @returns 文件文本。
 */
function readText(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8');
}

/**
 * 递归收集目录下的 Markdown 文件（相对仓库根）。
 * @param dir 相对仓库根的目录。
 * @param out 收集结果（递归累加）。
 * @returns 相对仓库根的 Markdown 文件列表。
 */
function collectMarkdown(dir: string, out: string[] = []): string[] {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return out;
  for (const name of readdirSync(absolute)) {
    const relative = join(dir, name);
    if (name.endsWith('.md')) {
      out.push(relative);
      continue;
    }
    collectMarkdown(relative, out);
  }
  return out;
}

/**
 * 去掉围栏代码块：代码示例里的 `](…)` 不是链接，不能误判。
 * @param text 原始 Markdown。
 * @returns 去掉 ``` 代码块后的文本。
 */
function stripFencedCode(text: string): string {
  return text.replace(/```[\s\S]*?```/gu, '');
}

/**
 * 检查单个 Markdown 文件里的相对链接。
 * @param file 相对仓库根的 Markdown 路径。
 */
function checkLinks(file: string): void {
  const text = stripFencedCode(readText(file));
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const raw = match[1]?.trim() ?? '';
    if (/^(?:https?:|mailto:|#)/u.test(raw)) continue;
    const target = raw.replace(/^</u, '').replace(/>$/u, '').split('#')[0] ?? '';
    if (target === '') continue;
    const absolute = resolve(dirname(join(ROOT, file)), target);
    // 仓库外引用（如 ../omniharness-kernel 兄弟仓）在 CI 检出里不存在，按外链跳过。
    const inside = relative(ROOT, absolute);
    if (inside.startsWith('..') || isAbsolute(inside)) continue;
    if (!existsSync(absolute)) {
      fail(`${file}: 相对链接指向不存在的路径 -> ${target}`);
    }
  }
}

/**
 * 断言文本里某个正则捕获到的数字等于期望值。
 * @param file 相对仓库根的文件（用于失败信息）。
 * @param text 文件文本。
 * @param pattern 含一个数字捕获组的正则。
 * @param expected 期望数字。
 * @param label 数字含义（用于失败信息）。
 */
function expectNumber(
  file: string,
  text: string,
  pattern: RegExp,
  expected: number,
  label: string,
): void {
  const match = pattern.exec(text);
  if (match === null) {
    fail(`${file}: 找不到${label}声明（正则 ${pattern.source}）`);
    return;
  }
  if (Number(match[1]) !== expected) {
    fail(`${file}: ${label}写的是 ${String(match[1])}，实测 ${String(expected)}`);
  }
}

/**
 * 校验文档声明的计数与代码实测一致。
 */
function checkCounts(): void {
  const domains = readdirSync(join(ROOT, 'src/host/kernel')).filter((name) =>
    name.endsWith('.ts'),
  ).length;
  const registry = readText('src/apps/server/modules/index.ts');
  const modules = (registry.match(/^\s+\w+Module\(\),/gmu) ?? []).length;
  const parity = readText('tests/serverModulesParity.test.ts');
  const methodsMatch = /expect\(methods\.length\)\.toBe\((\d+)\)/u.exec(parity);
  if (methodsMatch === null) {
    fail('tests/serverModulesParity.test.ts: 找不到 RPC 方法数断言');
    return;
  }
  const methods = Number(methodsMatch[1]);

  const readme = readText('README.md');
  const contract = readText('docs/KERNEL-CONTRACT.md');
  expectNumber('README.md', readme, /（(\d+) 域对接面/gu, domains, '内核域数');
  expectNumber('README.md', readme, /（(\d+) 方法，(\d+) 个域模块/gu, methods, 'RPC 方法数');
  expectNumber('README.md', readme, /（\d+ 方法，(\d+) 个域模块/gu, modules, 'RPC 域模块数');
  expectNumber(
    'docs/KERNEL-CONTRACT.md',
    contract,
    /(\d+) 个\*\*自动生成\*\*的域文件/gu,
    domains,
    '内核域数',
  );
  expectNumber('docs/KERNEL-CONTRACT.md', contract, /（(\d+) 方法，parity 快照钉住）/gu, methods, 'RPC 方法数');
}

const files = [...DOC_FILES, ...collectMarkdown(DOC_DIRS[0] ?? 'docs')];
for (const file of files) checkLinks(file);
checkCounts();

if (failures.length > 0) {
  process.stderr.write(`docs:check 失败 —— ${String(failures.length)} 项：\n`);
  for (const message of failures) process.stderr.write(`  - ${message}\n`);
  process.exit(1);
}
process.stdout.write(
  `docs:check OK —— ${String(files.length)} 个 Markdown 文件的仓库内相对链接全部存在；` +
    `域数 / 域模块数 / RPC 方法数与代码实测一致\n`,
);
