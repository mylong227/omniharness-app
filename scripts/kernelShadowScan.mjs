#!/usr/bin/env node
/**
 * 内核「已承诺能力」影子扫描（2026-11-08）。
 *
 * ## 它判什么
 *
 * `src/host/extensions/**` 里**自己声明**的符号名，不得与内核 `exports` 承诺模块的 `.d.ts`
 * 导出名重合。内核已经承诺的能力必须经 `src/host/kernel/` 对接面消费；在 app 侧再留一份
 * 同名实现，就是「影子副本回归」——2026-11-08 盘点的 `CryptoVault` / `EnvVault` 正是这种
 * 形态（内核版已换成 scrypt + 旧密文回退，app 侧还停在单轮 SHA-256）。
 *
 * ## 承诺面怎么读（2026-11-08 修：再导出桶也要穿透）
 *
 * `exports` 的条目分两种形态：curated 子路径（`./sandbox` / `./mcp` / `./maintenance`）是
 * **纯再导出桶**，深路径是**直接声明**。旧实现只扫直接声明，于是桶里承诺的
 * `IsolationLadderFactory` / `SdkPreferredMcpConnector` / `SessionGc` / `TmpSweep` /
 * `SessionStorageLocation` 全都扫不到——门禁全绿，5 件同体副本照旧滞留。
 * 现口径：每个承诺条目递归收集「直接声明 + `export { … } from` 名单 + `export *`」，
 * 任一形态可达的名字都算已承诺；`src/host/extensions/README.md` 登记表因此清零。
 *
 * ## 为什么只判「已承诺」
 *
 * 内核包里也带着未进 `exports` 的实现——app 无通道可用，只能自有。那一类不算违规
 * （但必须在中登记）；一旦内核把它纳入承诺面，本扫描会立刻把 app 侧同名实现判红。
 *
 * ## 用法
 *
 * - 门禁：`scripts/checkKernelBoundary.mjs` 第 9 条直接调用 {@link scanPromisedShadows}；
 * - 常规判据：`tests/kernelShadowScan.test.ts` 以 `--check` 子进程调用（与 kernelSurface
 *   的 CI 兼容做法一致：原生 Node 解析，不经打包器）；
 * - 手工：`node scripts/kernelShadowScan.mjs` 打印两侧规模与冲突清单。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 仓库根（本文件在 `scripts/` 下）。 */
const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 声明式导出的匹配：`export [declare] [abstract] class|function|… Name`。 */
const DECLARATION_RE =
  /export\s+(?:declare\s+)?(?:abstract\s+)?(class|function|const|let|var|enum|interface|type|namespace)\s+([A-Za-z_$][\w$]*)/g;

/**
 * 再导出的匹配：`export [type] { A, B as C } from './x.ts'`。
 *
 * 为什么必须有（2026-11-08 实锤漏检）：curated 子路径（`./sandbox` / `./mcp` / `./maintenance`）
 * 的 `.d.ts` 是**纯再导出桶**——`IsolationLadderFactory` / `SdkPreferredMcpConnector` /
 * `SessionGc` 这些名字只出现在 `export { X } from './…'` 行里，旧的「只扫声明」口径
 * 扫不到它们，于是 5 件已承诺的同体副本在门禁全绿时照样滞留。
 */
const REEXPORT_RE = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;

/** 星号再导出：`export * from './x.ts'`（把目标模块的全部导出名并入）。 */
const STAR_REEXPORT_RE = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;

/**
 * 递归列出目录下的源码文件。
 * @param {string} dir 起始目录。
 * @param {RegExp} pattern 文件名过滤。
 * @returns {string[]} 绝对路径。
 */
function walkSources(dir, pattern) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSources(abs, pattern));
    else if (pattern.test(entry.name)) out.push(abs);
  }
  return out;
}

/**
 * 把再导出 spec 解析成声明文件候选（`.ts` / `.js` / 省略后缀三种写法都收）。
 * @param {string} fromFile 引用方 `.d.ts`。
 * @param {string} spec 再导出 spec（只处理相对路径）。
 * @returns {string[]} 候选声明文件（绝对路径，按约定优先）。
 */
function declarationCandidates(fromFile, spec) {
  const resolved = resolve(dirname(fromFile), spec);
  const base = resolved.replace(/\.d\.ts$/u, '').replace(/\.(?:js|ts)$/u, '');
  return [`${base}.d.ts`, resolved];
}

/**
 * 把一段再导出名单拆成**导出名**（`B as C` 取 C；`type X` 去掉 `type `）。
 * @param {string} raw 花括号内的文本。
 * @returns {string[]} 导出名列表。
 */
function reexportedNames(raw) {
  return raw
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/u, ''))
    .filter((part) => part !== '')
    .map((part) => part.split(/\s+as\s+/u).at(-1)?.trim() ?? '')
    .filter((name) => name !== '');
}

/**
 * 递归收集一个声明模块的**全部导出名**（直接声明 + 再导出名单 + 星号再导出）。
 *
 * 归因统一记在最外层承诺模块上（报错时指向 `dist/sandbox.d.ts` 这类消费者能理解的入口，
 * 而不是内部实现文件）。
 *
 * @param {string} dtsPath 声明文件绝对路径（缺失即跳过）。
 * @param {string} module 承诺模块（相对内核包根，正斜杠）。
 * @param {Map<string, string[]>} names 符号名 → 承诺模块列表（原地追加）。
 * @param {Set<string>} visited 已访问文件（防循环再导出）。
 * @returns {void}
 */
function collectDeclaredNames(dtsPath, module, names, visited) {
  if (visited.has(dtsPath) || !existsSync(dtsPath)) return;
  visited.add(dtsPath);
  const add = (name) => {
    if (!names.has(name)) names.set(name, []);
    if (!names.get(name).includes(module)) names.get(name).push(module);
  };
  const text = readFileSync(dtsPath, 'utf8');
  for (const match of text.matchAll(DECLARATION_RE)) add(match[2]);
  for (const match of text.matchAll(REEXPORT_RE)) {
    for (const name of reexportedNames(match[1])) add(name);
  }
  for (const match of text.matchAll(STAR_REEXPORT_RE)) {
    for (const candidate of declarationCandidates(dtsPath, match[1])) {
      collectDeclaredNames(candidate, module, names, visited);
    }
  }
}

/**
 * 把 exports 键映射到内核包里的声明文件。
 *
 * 两种键形都要收：深路径（`./kernel/x/y.js` → `dist/kernel/x/y.d.ts`）与 curated 子路径
 * （`./maintenance` → `dist/maintenance.d.ts`）。旧实现只做 `.js → .d.ts` 替换，curated 键
 * 会拼成 `dist/maintenance`（目录名）而永远不存在——桶里的承诺因此整类漏扫。
 *
 * @param {string} kernelRoot 内核包根。
 * @param {string} key exports 键。
 * @returns {string} 声明文件绝对路径（可能不存在，由调用方 `existsSync` 过滤）。
 */
function declarationFileOf(kernelRoot, key) {
  const relativeKey = key.replace(/^\.\//u, '');
  const declaration = relativeKey.endsWith('.js')
    ? `${relativeKey.slice(0, -'.js'.length)}.d.ts`
    : `${relativeKey}.d.ts`;
  return join(kernelRoot, 'dist', declaration);
}

/**
 * 读内核承诺面：`package.json` 的 `exports` 显式条目 → 该模块**可达的全部导出名**。
 *
 * 2026-11-08 修：旧实现只认 `export class …` 直接声明，漏掉 curated 子路径的纯再导出桶
 * （`./sandbox` / `./mcp` / `./maintenance`）——5 件同体副本就是这样在门禁全绿时滞留的。
 *
 * 找不到 `.d.ts` 的条目（原生二进制 / JSON 资产）跳过——它们没有 TS 符号可撞名。
 * @param {string} root 仓库根。
 * @returns {Map<string, string[]>} 符号名 → 承诺它的模块（相对内核 dist 的路径）。
 */
function readPromisedNames(root) {
  const names = new Map();
  const kernelRoot = join(root, 'node_modules', '@omniharness', 'kernel');
  const pkgPath = join(kernelRoot, 'package.json');
  if (!existsSync(pkgPath)) return names;
  const exportsMap = JSON.parse(readFileSync(pkgPath, 'utf8')).exports ?? {};
  for (const key of Object.keys(exportsMap)) {
    // 根入口（`.`）是整包索引桶，只做再导出、不新增模块身份；同名符号在它的深路径条目上
    // 一样会被扫到（重复计入只会制造噪声），故跳过。
    if (key === '.') continue;
    const dts = declarationFileOf(kernelRoot, key);
    if (!existsSync(dts)) continue;
    const module = relative(kernelRoot, dts).replaceAll('\\', '/');
    collectDeclaredNames(dts, module, names, new Set());
  }
  return names;
}

/**
 * 扫 app 自有扩展层自己声明的导出符号名。
 * @param {string} root 仓库根。
 * @returns {Map<string, string[]>} 符号名 → 声明点（`相对路径#声明种类`）。
 */
function readExtensionNames(root) {
  const names = new Map();
  for (const file of walkSources(join(root, 'src', 'host', 'extensions'), /\.(ts|tsx|mts|cts)$/u)) {
    for (const match of readFileSync(file, 'utf8').matchAll(DECLARATION_RE)) {
      if (!names.has(match[2])) names.set(match[2], []);
      names.get(match[2]).push(`${relative(root, file).replaceAll('\\', '/')}#${match[1]}`);
    }
  }
  return names;
}

/**
 * 执行影子扫描。
 * @param {string} [root] 仓库根（缺省本仓；判据可传临时目录）。
 * @returns {{
 *   kernelPackage: boolean,
 *   promisedCount: number,
 *   declaredCount: number,
 *   shadows: { name: string, sites: string[], promisedBy: string[] }[],
 * }} 扫描结果；`shadows` 为空即通过。
 */
export function scanPromisedShadows(root = DEFAULT_ROOT) {
  const promised = readPromisedNames(root);
  const declared = readExtensionNames(root);
  const shadows = [...declared.keys()]
    .filter((name) => promised.has(name))
    .sort()
    .map((name) => ({ name, sites: declared.get(name), promisedBy: promised.get(name) }));
  return {
    kernelPackage: existsSync(join(root, 'node_modules', '@omniharness', 'kernel', 'package.json')),
    promisedCount: promised.size,
    declaredCount: declared.size,
    shadows,
  };
}

/**
 * 把扫描结果渲染成一行结论 + 冲突明细（门禁与判据共用同一口径）。
 * @param {ReturnType<typeof scanPromisedShadows>} result 扫描结果。
 * @returns {{ ok: boolean, text: string }} 结论与可读文本。
 */
export function formatShadowReport(result) {
  if (!result.kernelPackage) {
    return { ok: false, text: '未找到 @omniharness/kernel（先 npm ci 再跑影子扫描）' };
  }
  if (result.shadows.length === 0) {
    return {
      ok: true,
      text:
        `kernel:shadow OK —— 承诺导出名 ${String(result.promisedCount)} 个 / ` +
        `extensions 声明名 ${String(result.declaredCount)} 个 / 同名冲突 0`,
    };
  }
  const detail = result.shadows
    .map((item) => `${item.name}（${item.sites.join(', ')}）← 内核承诺于 ${item.promisedBy.join(', ')}`)
    .join('\n  ');
  return {
    ok: false,
    text:
      `extensions 里出现内核**已承诺**的同名实现（${String(result.shadows.length)} 个——应改经 ` +
      `src/host/kernel/ 对接面消费）：\n  ${detail}`,
  };
}

// CLI：直接运行时输出结论并以退出码裁决（供 tests/kernelShadowScan.test.ts 子进程调用）。
// `--root <path>` 供判据在临时目录里构造「桶再导出 + 同名实现」夹具（不进真实 node_modules）。
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag === -1 ? DEFAULT_ROOT : resolve(process.argv[rootFlag + 1] ?? '.');
  const report = formatShadowReport(scanPromisedShadows(root));
  if (report.ok) process.stdout.write(`${report.text}\n`);
  else {
    process.stderr.write(`kernel:shadow 失败 —— ${report.text}\n`);
    process.exit(1);
  }
}
