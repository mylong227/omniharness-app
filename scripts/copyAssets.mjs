#!/usr/bin/env node
/**
 * 把 `src` 下的非 TS 伴生资源镜像到 `dist/src`。
 *
 * ## 为什么需要它
 *
 * `tsc` **只编译 `.ts` → `.js`**，不会把 `.py` / `.json` / `.wasm` 等伴生资源拷进 `dist`。
 * 但部分适配器依赖与编译产物**同目录**的伴生资源（例如 `src/host/kernel/adapters/laya/laya_infer.py`
 * 由宿主侧 `LayaDecisionEngine` 经子进程调用）。而 `package.json` 的 `files` 只含 `dist/src`、
 * 不含 `src` —— 若不镜像，发布包会缺资源，生产/集成测试下适配器找不到脚本（fail-open 退化）。
 *
 * ## 范围
 *
 * - 仅拷贝**非** `.ts` / `.d.ts` 文件；`.ts` 由 `tsc` 负责。
 * - 排除草稿/备份后缀（`.bak` / `.tmp` / `.swp` / `.orig` / `~` 结尾），避免把并行会话的
 *   未跟踪草稿（如 `sortingAlgorithms.ts.bak`）带进 `dist`。
 * - 保持 `src` 内相对目录结构。
 *
 * 用法：`node scripts/copyAssets.mjs [DIST_ROOT]`（默认 `src` → `dist/src`；
 * 传 `dist.next` 即镜像进暂存目录，供 `scripts/buildDist.mjs` 的原子构建使用）。
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
/** 产物根：可经首个位置参数覆盖（相对仓库根或绝对路径）。 */
const DIST_ROOT =
  process.argv[2] === undefined ? join(ROOT, 'dist') : resolve(ROOT, process.argv[2]);
const DST = join(DIST_ROOT, 'src');

/** 草稿/备份后缀（不拷贝，避免把未跟踪草稿带进 dist）。 */
const SKIP_SUFFIXES = ['.bak', '.tmp', '.swp', '.orig'];

/**
 * 判断文件是否应被拷贝（非 TS、非草稿）。
 * @param name 文件名。
 * @returns 应拷贝为 true。
 */
function shouldCopy(name) {
  if (name.endsWith('.ts') || name.endsWith('.d.ts')) return false;
  if (SKIP_SUFFIXES.some((s) => name.endsWith(s))) return false;
  if (name.endsWith('~')) return false;
  return true;
}

/**
 * 递归镜像非 TS 资源。
 * @param dir 当前源目录。
 * @param rel 相对 `src` 的路径（用于镜像到 `dist/src`）。
 */
function mirror(dir, rel) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      mirror(full, join(rel, entry));
      continue;
    }
    if (!shouldCopy(entry)) continue;
    const target = join(DST, rel, entry);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(full, target);
  }
}

// 2026-10-06（第五十七轮 ④）订正：原写法是 `statSync(SRC, { throwIfNoError: false })` ——
// **没有这个选项名**（真名是 `throwIfNoEntry`）⇒ statSync 直接抛 ENOENT，下面这段"友好跳过"
// 与它的 `exit(0)` **永远不可达**（死分支）。用真名并显式处理 undefined。
if (statSync(SRC, { throwIfNoEntry: false }) === undefined) {
  console.error(`[copyAssets] 跳过：src 不存在（${SRC}）`);
  process.exit(0);
}
mirror(SRC, '.');
console.log(`[copyAssets] 已镜像 src 非 TS 资源 → dist/src`);

// ---- 原生内核二进制：`dist/native/omni_napi.node` ----
//
// 迁移到内核包后，`NativeKernel` 的实现位于 `node_modules/@omniharness/kernel`，它从**包根**
// 找 `native/omni_napi.node`；因此内核 tarball 自带这份二进制（见 `scripts/vendorKernel.mjs`）。
// 这里仍把应用根的 `native/*.node` 镜像进 `dist/native`：打包态 `resources/harness/native`
// 与其它按仓库布局取原生库的脚本共用它，属于部署资产，不是内核加载路径。
const nativeSrc = join(ROOT, 'native');
if (statSync(nativeSrc, { throwIfNoEntry: false })?.isDirectory() === true) {
  const nativeDst = join(DIST_ROOT, 'native');
  mkdirSync(nativeDst, { recursive: true });
  for (const entry of readdirSync(nativeSrc)) {
    if (!entry.endsWith('.node')) continue;
    copyFileSync(join(nativeSrc, entry), join(nativeDst, entry));
  }
  console.log(`[copyAssets] 已镜像 native/*.node → ${nativeDst}`);
}
