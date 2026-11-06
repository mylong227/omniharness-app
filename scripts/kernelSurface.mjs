#!/usr/bin/env node
/**
 * 内核对接面生成器（2026-11-06）。
 *
 * ## 它解决什么
 *
 * `src/host/kernel/<area>.ts` 是 app 里唯一允许导入 `@omniharness/kernel` 的地方。此前这 17 个
 * 文件是**手写**的纯 re-export：每加一个内核符号都要人去翻包的 `.d.ts`、找深路径、区分
 * `export` / `export type`。本脚本把它变成**生成物**：
 *
 *   1. 扫 `src/**`（排除 17 个生成物），收集业务代码实际从 `host/kernel/<area>.ts` 导入的符号；
 *   2. 用现有对接面（若有）或内核包 `dist/**\/*.d.ts` 的导出索引，解析每个符号的**真实模块**；
 *   3. 按域生成只含**实际使用**符号的 re-export；`kernel:check` 第 8 条判据拒绝漂移。
 *
 * 于是新增符号的姿势变成：业务代码照常 `import { X } from '../../host/kernel/<area>.ts'`
 * → 跑 `npm run kernel:surface` → 自动补上（无需手写，也不会留下没人用的 re-export）。
 *
 * ## 为什么不是「删掉 17 个文件、直接深路径导入」
 *
 * 内核明确不承诺内部路径兼容。集中一层虽然文件多，但内核升级只改这一层；直接深路径会让
 * 升级的爆炸半径扩散到全部业务文件。分域而不是单文件桶，是为了保留「按域加载」——根入口
 * 整包实测 ~780ms，单域 ~60ms。
 *
 * ## 命令行
 *
 *   node scripts/kernelSurface.mjs           # 生成（写盘）
 *   node scripts/kernelSurface.mjs --check   # 只校验是否与源码一致（kernel:check 用）
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SURFACE = join(ROOT, 'src', 'host', 'kernel');
const KERNEL_DIST = join(ROOT, 'node_modules', '@omniharness', 'kernel', 'dist');

/** 对接面文件名（`<area>.ts`；下划线/连字符与数字，避免误伤子目录里的实现文件）。 */
const AREA_FILE = /^[a-z0-9_-]+\.ts$/;

/**
 * 递归列出某目录下的文件。
 * @param {string} dir 目录
 * @param {RegExp} filter 文件名过滤
 * @returns {string[]} 绝对路径
 */
function walk(dir, filter) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, filter));
    else if (filter.test(entry.name)) out.push(abs);
  }
  return out;
}

/**
 * 解析 `{ A, B as C, type D }` 形式的名单。
 * @param {string} raw 花括号内的文本
 * @param {'local'|'exported'} mode 取本地名（import 用）还是导出名（surface 定义用）
 * @returns {string[]} 符号名
 */
function namesOf(raw, mode) {
  return raw
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/u, ''))
    .filter((part) => part !== '')
    .map((part) => {
      const [original, alias] = part.split(/\s+as\s+/u);
      const name = mode === 'exported' ? (alias ?? original) : original;
      return name.trim();
    })
    .filter((name) => name !== '');
}

/**
 * 读现有对接面：area → 符号 → { spec, typeOnly }。
 *
 * 现有对接面是「符号 → 真实模块」的已知正确映射（含 `Runtime` / `TrustTier` 这类同名不同模块的
 * 消歧），生成时优先用它；只有业务代码新引入、现有面没有的符号才回退到内核包索引。
 * @returns {Map<string, Map<string, { spec: string, typeOnly: boolean }>>}
 */
function readCurrentSurface() {
  const maps = new Map();
  /** 现有文件的模块出现顺序：新符号沿用/追加，避免改变 ESM 求值顺序。 */
  const orders = new Map();
  for (const name of readdirSync(SURFACE)) {
    if (!AREA_FILE.test(name)) continue;
    const area = name.replace(/\.ts$/u, '');
    const map = new Map();
    const order = [];
    const text = readFileSync(join(SURFACE, name), 'utf8');
    for (const match of text.matchAll(
      /export\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gu,
    )) {
      if (!order.includes(match[3])) order.push(match[3]);
      for (const symbol of namesOf(match[2], 'exported')) {
        map.set(symbol, { spec: match[3], typeOnly: Boolean(match[1]) });
      }
    }
    maps.set(area, map);
    orders.set(area, order);
  }
  return { maps, orders };
}

/**
 * 业务代码实际从对接面导入了哪些符号：area → Set<name>（`*` 表示命名空间导入）。
 * @returns {Map<string, Set<string>>}
 */
function collectUsed() {
  const used = new Map();
  const add = (area, name) => {
    if (!used.has(area)) used.set(area, new Set());
    used.get(area).add(name);
  };
  const surfaceFiles = new Set(
    readdirSync(SURFACE)
      .filter((name) => AREA_FILE.test(name))
      .map((name) => join(SURFACE, name)),
  );
  /** 把相对 spec 解析成对接面文件；不是对接面（或外部包）返回 undefined。 */
  const surfaceAreaOf = (fromFile, spec) => {
    if (!spec.startsWith('.')) return undefined;
    const target = resolve(dirname(fromFile), spec);
    // 源码约定写 `.ts`；同时容忍 `.js`（编译后写法）与省略后缀。
    const candidates = [target, `${target}.ts`, `${target.replace(/\.(js|mjs|cjs)$/u, '')}.ts`];
    const hit = candidates.find((candidate) => surfaceFiles.has(candidate));
    return hit === undefined ? undefined : basename(hit).replace(/\.ts$/u, '');
  };
  const files = walk(join(ROOT, 'src'), /\.(ts|tsx)$/u).filter(
    (file) => !(dirname(file) === SURFACE && AREA_FILE.test(basename(file))),
  );
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // import { A, B as C } / export type { A } from '<任意相对路径>/kernel/<area>.ts'
    // （kernel-compat 里写作 `../../../kernel/contracts.ts`，不能只按字面量 `host/kernel` 匹配）
    for (const match of text.matchAll(/(?:import|export)\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gu)) {
      const area = surfaceAreaOf(file, match[3]);
      if (area === undefined) continue;
      for (const name of namesOf(match[2], 'local')) add(area, name);
    }
    // import * as ns from ... / export * from ...（命名空间/全量：该域全部保留）
    for (const match of text.matchAll(
      /(?:import|export)\s+\*\s+(?:as\s+\w+\s+)?from\s+['"]([^'"]+)['"]/gu,
    )) {
      const area = surfaceAreaOf(file, match[1]);
      if (area !== undefined) add(area, '*');
    }
    // const { A, B } = await import('<...>/kernel/<area>.ts')
    for (const match of text.matchAll(
      /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/gu,
    )) {
      const area = surfaceAreaOf(file, match[2]);
      if (area !== undefined) for (const name of namesOf(match[1], 'local')) add(area, name);
    }
    // const [{ A }, { B }] = await Promise.all([import('...'), import('...')])
    for (const match of text.matchAll(
      /(?:const|let|var)\s+\[([\s\S]*?)\]\s*=\s*await\s+Promise\.all\(\s*\[([\s\S]*?)\]\s*\)/gu,
    )) {
      const left = [...match[1].matchAll(/\{([^}]*)\}/gu)].map((item) => item[1]);
      const right = [...match[2].matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/gu)].map(
        (item) => item[1],
      );
      if (left.length !== right.length) continue;
      for (const [index, spec] of right.entries()) {
        const area = surfaceAreaOf(file, spec);
        if (area !== undefined) for (const name of namesOf(left[index] ?? '', 'local')) add(area, name);
      }
    }
    // const mod = await import('...'); const x = mod.Foo（命名空间式动态导入）
    for (const match of text.matchAll(
      /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/gu,
    )) {
      const area = surfaceAreaOf(file, match[2]);
      if (area === undefined) continue;
      const propertyRe = new RegExp(`\\b${match[1]}\\.([A-Za-z_$][\\w$]*)`, 'gu');
      for (const property of text.matchAll(propertyRe)) add(area, property[1]);
    }
    // import('<...>/kernel/<area>.ts').Foo（type query 或动态属性访问）
    for (const match of text.matchAll(
      /import\(\s*['"]([^'"]+)['"]\s*\)\.([A-Za-z_$][\w$]*)/gu,
    )) {
      const area = surfaceAreaOf(file, match[1]);
      if (area !== undefined) add(area, match[2]);
    }
  }
  return used;
}

/**
 * 扫内核包 `.d.ts` 建立「导出名 → 模块」索引（新符号的回退解析）。
 *
 * 只认直接声明（`export declare class/function/const/...`、`export interface/type`），跳过
 * `index.d.ts` 聚合桶（同一符号会在桶里重复出现，制造假歧义）与 `export { ... }` 再导出。
 * 对 2026-11 的 alpha.6 实测：1680 个导出名、仅 3 个同名（WorkflowStep/TrustTier/LspPosition），
 * 且都已在现有对接面里有确定映射。
 * @returns {Map<string, { spec: string, typeOnly: boolean }[]>}
 */
function readKernelIndex() {
  const index = new Map();
  if (!existsSync(KERNEL_DIST)) return index;
  const add = (name, spec, typeOnly) => {
    if (!index.has(name)) index.set(name, []);
    const list = index.get(name);
    if (!list.some((item) => item.spec === spec)) list.push({ spec, typeOnly });
  };
  for (const file of walk(KERNEL_DIST, /\.d\.ts$/u)) {
    if (basename(file) === 'index.d.ts') continue;
    const spec =
      '@omniharness/kernel/' + relative(KERNEL_DIST, file).replaceAll('\\', '/').replace(/\.d\.ts$/u, '.js');
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(
      /export\s+(?:declare\s+)?(?:abstract\s+)?(class|function|const|let|var|enum|namespace|interface|type)\s+([A-Za-z_$][\w$]*)/gu,
    )) {
      add(match[2], spec, match[1] === 'interface' || match[1] === 'type');
    }
  }
  return index;
}

/**
 * 解析一个业务导入符号的真实模块（优先现有面对应域，其次同名全局映射，最后内核包索引）。
 * @param {string} area 域
 * @param {string} name 符号名
 * @param {ReturnType<typeof readCurrentSurface>} surface 现有对接面
 * @param {ReturnType<typeof readKernelIndex>} kernelIndex 内核包索引
 * @returns {{ spec: string, typeOnly: boolean } | undefined}
 */
function resolveSymbol(area, name, surface, kernelIndex) {
  const local = surface.get(area)?.get(name);
  if (local !== undefined) return local;
  // 同名符号可能在不同域指向不同模块（TrustTier 就有两个）。只有全仓唯一映射才可直接回退；
  // 多域同名时交给内核包索引 + 本域已用模块消歧，避免把两个不同符号混成一个。
  const hits = [...surface.values()].filter((map) => map.has(name));
  if (hits.length === 1) return hits[0].get(name);
  const candidates = kernelIndex.get(name) ?? [];
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return undefined;
  // 同名多模块：优先选该域已经用过的模块，避免把两个不同符号混成一个。
  const specs = new Set([...(surface.get(area)?.values() ?? [])].map((item) => item.spec));
  const preferred = candidates.filter((item) => specs.has(item.spec));
  if (preferred.length === 1) return preferred[0];
  return undefined;
}

/**
 * 计算生成结果。
 * @returns {{ files: Map<string, string>, errors: string[] }}
 */
export function buildSurface() {
  const { maps: surface, orders } = readCurrentSurface();
  const used = collectUsed();
  const kernelIndex = readKernelIndex();
  const errors = [];
  const files = new Map();
  for (const area of [...surface.keys()].sort()) {
    const usedNames = used.get(area);
    if (usedNames === undefined || usedNames.size === 0) continue;
    const wildcard = usedNames.has('*');
    const names = wildcard
      ? [...(surface.get(area)?.keys() ?? [])].sort()
      : [...usedNames].filter((name) => name !== '*').sort();
    const groups = new Map();
    for (const name of names) {
      const hit = resolveSymbol(area, name, surface, kernelIndex);
      if (hit === undefined) {
        errors.push(`${area}: 无法解析内核符号 ${name}（不在现有对接面，也不在内核包 .d.ts 索引里）`);
        continue;
      }
      const key = `${hit.typeOnly ? 'type' : 'value'}|${hit.spec}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(name);
    }
    const header = [
      '/**',
      ` * 内核对接面 · ${area} 域 —— **自动生成，勿手改**。`,
      ' *',
      ' * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。',
      ' * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，',
      ' * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。',
      ' *',
      ' * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。',
      ' */',
    ];
    // 模块顺序沿用现有文件（ESM 按声明顺序求值，排序会改变副作用顺序）；新模块追加到末尾。
    const orderOf = new Map((orders.get(area) ?? []).map((spec, index) => [spec, index]));
    const lines = [...groups.entries()]
      .sort((a, b) => {
        const [kindA, specA] = a[0].split('|');
        const [kindB, specB] = b[0].split('|');
        const indexA = orderOf.get(specA) ?? Number.MAX_SAFE_INTEGER;
        const indexB = orderOf.get(specB) ?? Number.MAX_SAFE_INTEGER;
        if (indexA !== indexB) return indexA - indexB;
        if (specA !== specB) return specA.localeCompare(specB);
        return kindA === kindB ? 0 : kindA === 'value' ? -1 : 1;
      })
      .map(([key, list]) => {
        const [kind, spec] = key.split('|');
        return `export ${kind === 'type' ? 'type ' : ''}{ ${list.join(', ')} } from '${spec}';`;
      });
    files.set(`${area}.ts`, header.join('\n') + '\n\n' + lines.join('\n') + '\n');
  }
  return { files, errors };
}

/**
 * 生成/校验对接面。
 * @param {{ check: boolean }} options `check` 为 true 时只比较不写盘
 * @returns {number} 退出码
 */
export function runSurface({ check }) {
  const { files, errors } = buildSurface();
  if (errors.length > 0) {
    process.stderr.write('kernel:surface 失败 —— 无法解析以下符号：\n');
    for (const message of errors) process.stderr.write(`  - ${message}\n`);
    return 1;
  }
  const changed = [];
  for (const [name, content] of files) {
    const path = join(SURFACE, name);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (current !== content) changed.push(name);
  }
  const generated = new Set(files.keys());
  const extras = readdirSync(SURFACE).filter(
    (name) => AREA_FILE.test(name) && !generated.has(name),
  );
  if (check) {
    if (changed.length === 0 && extras.length === 0) {
      process.stdout.write(
        `kernel:surface OK —— ${String(files.size)} 个域文件与业务实际使用一致\n`,
      );
      return 0;
    }
    process.stderr.write(
      `kernel:surface 漂移：${String(changed.length)} 个文件需重新生成` +
        `${extras.length > 0 ? `，${String(extras.length)} 个文件已无使用` : ''}\n`,
    );
    for (const name of [...changed, ...extras]) process.stderr.write(`  - src/host/kernel/${name}\n`);
    process.stderr.write('  修复：npm run kernel:surface\n');
    return 1;
  }
  for (const [name, content] of files) {
    writeFileSync(join(SURFACE, name), content, 'utf8');
  }
  process.stdout.write(
    `kernel:surface 已生成 ${String(files.size)} 个域文件` +
      `${changed.length > 0 ? `（更新 ${String(changed.length)} 个）` : '（无变化）'}\n`,
  );
  if (extras.length > 0) {
    process.stderr.write(
      `注意：以下文件已无业务使用但未删除（自动删除有风险，请人工确认）：${extras.join(', ')}\n`,
    );
  }
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = runSurface({ check: process.argv.includes('--check') });
}
