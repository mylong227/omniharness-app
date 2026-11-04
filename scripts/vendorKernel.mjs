#!/usr/bin/env node
/**
 * 重建 `vendor/omniharness-kernel-*.tgz`（应用消费的唯一内核来源）。
 *
 * 为什么需要脚本：应用钉的是**内核仓库某个 tag 的构建产物**，不是源码目录。手写 `npm pack`
 * 容易漏掉两件本应用特有的事：
 * 1. 内核包自身不带 `native/omni_napi.node`（它由应用仓构建），但 `NativeKernel` 从**包根**找它；
 * 2. `package.json#files` 默认不含 `native/`，不补就打包丢文件。
 *
 * 脚本流程：kernel worktree（tag 可覆盖）→ 复用 kernel 的 node_modules → build →
 * 注入应用 native → 补 `files` → `npm pack` → 更新根 `package.json` 与 `package-lock.json` 的
 * 路径/integrity。all-or-nothing 由各步非零退出保证。
 *
 * 用法：
 *   node scripts/vendorKernel.mjs
 *   OMNI_KERNEL_ROOT=D:\path\to\kernel OMNI_KERNEL_TAG=v0.1.0-alpha.4 node scripts/vendorKernel.mjs
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kernelRoot = resolve(process.env.OMNI_KERNEL_ROOT ?? join(ROOT, '..', 'omniharness-kernel'));
const tag = (process.env.OMNI_KERNEL_TAG ?? 'v0.1.0-alpha.4').trim();
const worktree = join(ROOT, '.tmp', 'kernel-vendor');
const vendorDir = join(ROOT, 'vendor');

const run = (cmd, args, cwd) => {
  process.stdout.write(`[vendor] ${cmd} ${args.join(' ')}\n`);
  // Windows 的 npm 是 `.cmd`，不经过 shell 无法直接 exec；本脚本传入的路径均在应用/内核仓内。
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
};

if (!existsSync(join(kernelRoot, 'package.json'))) {
  throw new Error(`内核仓库不存在或不是包根：${kernelRoot}`);
}

// 1. 干净 worktree（重复运行可恢复）
if (existsSync(worktree)) {
  try {
    run('git', ['-C', kernelRoot, 'worktree', 'remove', '--force', worktree]);
  } catch {
    rmSync(worktree, { recursive: true, force: true });
  }
}
run('git', ['-C', kernelRoot, 'worktree', 'add', '--detach', worktree, tag]);

// 2. 复用 kernel 的 node_modules（build 需要 typescript / 依赖）
const kernelModules = join(kernelRoot, 'node_modules');
if (!existsSync(kernelModules)) throw new Error(`内核仓库缺 node_modules：${kernelModules}（先在其根 npm ci）`);
const linkedModules = join(worktree, 'node_modules');
if (!existsSync(linkedModules)) {
  symlinkSync(kernelModules, linkedModules, process.platform === 'win32' ? 'junction' : 'dir');
}

// 3. 构建 + 注入原生内核 + 补 files
run(process.execPath, ['scripts/build.mjs'], worktree);
const nativeSource = join(ROOT, 'native', 'omni_napi.node');
if (!existsSync(nativeSource)) throw new Error(`应用原生内核不存在：${nativeSource}`);
mkdirSync(join(worktree, 'native'), { recursive: true });
copyFileSync(nativeSource, join(worktree, 'native', 'omni_napi.node'));
const kernelPkgPath = join(worktree, 'package.json');
const kernelPkg = JSON.parse(readFileSync(kernelPkgPath, 'utf8'));
if (!kernelPkg.files.includes('native')) kernelPkg.files.unshift('native');
writeFileSync(kernelPkgPath, `${JSON.stringify(kernelPkg, null, 2)}\n`);

// 4. pack 到 vendor/
mkdirSync(vendorDir, { recursive: true });
for (const name of readdirSync(vendorDir)) {
  if (/^omniharness-kernel-.*\.tgz$/.test(name)) rmSync(join(vendorDir, name));
}
run('npm', ['pack', '--pack-destination', vendorDir], worktree);
const packed = readdirSync(vendorDir).filter((name) => /^omniharness-kernel-.*\.tgz$/.test(name));
if (packed.length !== 1) throw new Error(`期望恰好一个 kernel tarball，实际：${packed.join(', ')}`);
const tarball = join(vendorDir, packed[0]);
const relTarball = relative(ROOT, tarball).replaceAll('\\', '/');
const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;

// 5. 同步根 package.json + package-lock.json
const rootPkgPath = join(ROOT, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
rootPkg.dependencies['@omniharness/kernel'] = `file:${relTarball}`;
writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);

const lockPath = join(ROOT, 'package-lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const locked = lock.packages?.['node_modules/@omniharness/kernel'];
if (locked === undefined) throw new Error('package-lock.json 缺少 node_modules/@omniharness/kernel 条目');
locked.resolved = `file:${relTarball}`;
locked.integrity = integrity;
locked.version = kernelPkg.version;
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

// 6. 清理 worktree（失败不掩盖成功的主结果）
try {
  run('git', ['-C', kernelRoot, 'worktree', 'remove', '--force', worktree]);
} catch (error) {
  process.stderr.write(`[vendor] ⚠ worktree 清理失败（不影响产物）：${String(error)}\n`);
}

process.stdout.write(
  `[vendor] OK ${packed[0]} (${String(Math.round(readFileSync(tarball).length / 1024))} KiB)\n` +
    `[vendor] integrity ${integrity}\n` +
    `[vendor] 下一步：npm ci（或删除 node_modules/@omniharness/kernel 后 npm ci）\n`,
);
