#!/usr/bin/env node
/**
 * 重建 `vendor/omniharness-kernel-*.tgz`（应用消费的唯一内核来源）。
 *
 * 为什么需要脚本：应用钉的是**内核仓库某个 tag 的构建产物**，不是源码目录。手写 `npm pack`
 * 容易漏掉两件本应用特有的事：
 * 1. 当前内核从仓内 Rust 构建平台原生产物；没有 Rust 源码的旧 tag 才兼容应用中的旧插件；
 * 2. 打包前检查 `package.json#files` 包含 `native/`，防止原生产物漏包。
 *
 * 脚本流程：kernel worktree（tag 可覆盖）→ 复用 kernel 的 node_modules → build →
 * 准备平台原生产物 → 检查 `files` → `npm pack` → 更新根 `package.json` 与 `package-lock.json` 的
 * 路径/integrity。all-or-nothing 由各步非零退出保证。
 *
 * 用法：
 *   node scripts/vendorKernel.ts          # 缺省 vend 当前 package.json 钉的那个 tag
 *   OMNI_KERNEL_ROOT=D:\path\to\kernel OMNI_KERNEL_TAG=v0.1.0-alpha.7 node scripts/vendorKernel.ts
 */
import { createHash } from 'node:crypto';
import { KernelNativeArtifacts } from './KernelNativeArtifacts.ts';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 同卷 rename（原子；跨卷回退 copy+delete）。 */
function cpSyncLocal(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch {
    copyFileSync(from, to);
    rmSync(from);
  }
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kernelRoot = resolve(process.env.OMNI_KERNEL_ROOT ?? join(ROOT, '..', 'omniharness-kernel'));
// 缺省 tag 从根 package.json 当前钉的 vendored tgz 文件名解析（self-consistent：
// 「再 vendor 一次当前版本」永远可复现，不存在脚本缺省 tag 与实际钉版本漂移的缺陷类）。
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, unknown>;
};
const pkgDep: unknown = pkg.dependencies?.['@omniharness/kernel'];
const pinnedTag = (() => {
  if (typeof pkgDep !== 'string') throw new Error('package.json 缺 @omniharness/kernel 依赖');
  const file = pkgDep.startsWith('file:') ? pkgDep.slice('file:'.length) : '';
  const m = /^vendor\/omniharness-kernel-(.+)\.tgz$/.exec(file);
  if (m === null) throw new Error(`依赖不是 file:vendor/*.tgz 形态：${String(pkgDep)}`);
  return `v${m[1]!}`;
})();
const tag = (process.env.OMNI_KERNEL_TAG ?? pinnedTag).trim();
const worktree = join(ROOT, '.tmp', 'kernel-vendor');
const vendorDir = join(ROOT, 'vendor');

const run = (cmd: string, args: readonly string[], cwd: string): void => {
  process.stdout.write(`[vendor] ${cmd} ${args.join(' ')}\n`);
  // Windows 的 npm 是 `.cmd`，不经过 shell 无法直接 exec；但 shell: true 会把命令与参数
  // 按空格裸拼接——`C:\Program Files\nodejs\node.exe` 这类带空格路径会被 cmd 撕成两半
  // （2026-11-06 审计 P2）。故仅 npm 走 shell，node/git 直接 exec（参数数组原样传递）。
  const needsShell = process.platform === 'win32' && /npm(?:\.cmd)?$/i.test(cmd);
  execFileSync(cmd, [...args], {
    cwd,
    stdio: 'inherit',
    shell: needsShell,
  });
};

if (!existsSync(join(kernelRoot, 'package.json'))) {
  throw new Error(`内核仓库不存在或不是包根：${kernelRoot}`);
}

// 1. 干净 worktree（重复运行可恢复）
if (existsSync(worktree)) {
  try {
    run('git', ['-C', kernelRoot, 'worktree', 'remove', '--force', worktree], ROOT);
  } catch {
    rmSync(worktree, { recursive: true, force: true });
  }
}
run('git', ['-C', kernelRoot, 'worktree', 'add', '--detach', worktree, tag], ROOT);

// 2. 复用 kernel 的 node_modules（build 需要 typescript / 依赖）
const kernelModules = join(kernelRoot, 'node_modules');
if (!existsSync(kernelModules)) throw new Error(`内核仓库缺 node_modules：${kernelModules}（先在其根 npm ci）`);
const linkedModules = join(worktree, 'node_modules');
if (!existsSync(linkedModules)) {
  symlinkSync(kernelModules, linkedModules, process.platform === 'win32' ? 'junction' : 'dir');
}

// 3. 构建 + 准备平台原生产物 + 检查 files
run(process.execPath, ['scripts/build.ts'], worktree);
KernelNativeArtifacts.prepare(worktree, join(ROOT, 'native', 'omni_napi.node'));
const kernelPkgPath = join(worktree, 'package.json');
const kernelPkg = JSON.parse(readFileSync(kernelPkgPath, 'utf8')) as {
  files?: string[];
  version?: string;
};
// files 字段守卫（2026-11-06 审计 P3）：内核包极简形态可能没有 files 数组，直接 .includes 会 NPE。
if (Array.isArray(kernelPkg.files)) {
  if (!kernelPkg.files.includes('native')) kernelPkg.files.unshift('native');
} else {
  kernelPkg.files = ['native'];
}
writeFileSync(kernelPkgPath, `${JSON.stringify(kernelPkg, null, 2)}\n`);

// 4. pack（**原子替换**，2026-11-06 审计 P1 修）：先 pack 到 .tmp 暂存目录，成功后才
// 删旧 tgz、搬入新 tgz。原实现先清空 vendor/ 再 pack——内核 build/pack 任何一步失败，
// package.json 与 lock 仍指向已消失的 tarball ⇒ `npm ci` / `kernel:check` 全红，仓库被打断。
// 头注释声称的 all-or-nothing 从这里才真正成立。
const stagingDir = join(ROOT, '.tmp', 'kernel-pack');
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });
// pack 不走 `npm`（2026-11-08 审计）：Windows 下 npm.cmd 必须 shell:true，参数按空格裸拼接——
// 带空格的暂存目录路径会被 cmd 撕成两半（run 头注点破的缺陷在参数侧的真身）。改用当前 node
// 直跑 npm-cli.js，参数数组原样传递、零 shell。
const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
if (!existsSync(npmCli)) throw new Error(`npm-cli.js 不存在：${npmCli}`);
run(process.execPath, [npmCli, 'pack', '--pack-destination', stagingDir], worktree);
const packedStaged = readdirSync(stagingDir).filter((name) => /^omniharness-kernel-.*\.tgz$/.test(name));
if (packedStaged.length !== 1) throw new Error(`期望恰好一个 kernel tarball，实际：${packedStaged.join(', ')}`);
const packedName = packedStaged[0]!;
mkdirSync(vendorDir, { recursive: true });
for (const name of readdirSync(vendorDir)) {
  if (/^omniharness-kernel-.*\.tgz$/.test(name)) rmSync(join(vendorDir, name));
}
const tarball = join(vendorDir, packedName);
cpSyncLocal(join(stagingDir, packedName), tarball);
const relTarball = relative(ROOT, tarball).replaceAll('\\', '/');
const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;

// 5. 同步根 package.json + package-lock.json
const rootPkgPath = join(ROOT, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8')) as {
  dependencies: Record<string, string>;
};
rootPkg.dependencies['@omniharness/kernel'] = `file:${relTarball}`;
writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);

const lockPath = join(ROOT, 'package-lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
  packages?: Record<string, { resolved?: unknown; integrity?: unknown; version?: unknown }>;
};
const locked = lock.packages?.['node_modules/@omniharness/kernel'];
if (locked === undefined) throw new Error('package-lock.json 缺少 node_modules/@omniharness/kernel 条目');
locked.resolved = `file:${relTarball}`;
locked.integrity = integrity;
locked.version = kernelPkg.version;
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

// 6. 清理 worktree（失败不掩盖成功的主结果）
try {
  run('git', ['-C', kernelRoot, 'worktree', 'remove', '--force', worktree], ROOT);
} catch (error) {
  process.stderr.write(`[vendor] ⚠ worktree 清理失败（不影响产物）：${String(error)}\n`);
}

process.stdout.write(
  `[vendor] OK ${packedName} (${String(Math.round(readFileSync(tarball).length / 1024))} KiB)\n` +
    `[vendor] integrity ${integrity}\n` +
    `[vendor] 下一步：npm ci（或删除 node_modules/@omniharness/kernel 后 npm ci）\n`,
);
