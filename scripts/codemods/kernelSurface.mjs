#!/usr/bin/env node
/**
 * 一次性迁移工具：把 `src/**` 对 `@omniharness/kernel` 的全部静态/动态导入，
 * 收敛到 `src/host/kernel/` 分域对接面（本仓唯一的内核导入点，由
 * `scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 为什么是"分域目录"而不是单文件桶：实测根入口整包加载 ~780ms、单深路径 ~60ms（Node 22），
 * 单文件桶会让每个碰内核的 CLI 命令平添 ~700ms 冷启动。分域文件保持按需加载，
 * 同时把"内核升级要适配的 locus"收敛到一个目录。
 *
 * 用法：`node scripts/codemods/kernelSurface.mjs`
 *  - 扫描 src/**（ts/tsx/mts）里所有 `(import|export) ... from '@omniharness/kernel...'`
 *    与 `import('@omniharness/kernel...')`；
 *  - 按路径前缀把符号归入分域文件，生成/覆写 `src/host/kernel/<area>.ts`；
 *  - 把业务文件的导入说明符改写为对接面相对路径（导入子句原样保留）；
 *  - 收尾全量复扫：任何残留的内核导入说明符都打印出来（default/namespace 等漏网形态）。
 * 已知局限：纯动态 `import()` 的具名访问（`mod.X`）无法静态收集，由 typecheck 兜底补齐。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const OUT = join(SRC, 'host', 'kernel');

// ── 分域规则：spec（'@omniharness/kernel' 之后的其余部分）→ 对接面文件名 ───────────
function areaOf(rest) {
  if (rest === '' || rest === undefined) return 'runtime'; // 根入口（Runtime 等）
  const seg = rest.replace(/^\//, '').split('/');
  if (seg[0] === 'omniError.js') return 'platform';
  if (seg[0] === 'contracts') return 'contracts';
  if (seg[0] === 'protocols') return 'protocols';
  if (seg[0] !== 'kernel') throw new Error(`未知内核路径段: ${rest}`);
  const k = seg[1] ?? '';
  if (['core', 'config', 'util', 'security', 'autonomy', 'context', 'evolution', 'subagent'].includes(k)) {
    return k;
  }
  if (k === 'composition' || k === '') return 'runtime'; // composition（Runtime/ServiceKeys）与根入口同域
  if (k === 'adapters') {
    const a = seg[2];
    if (a === 'tool') return 'adapters-tool';
    if (a === 'model') return 'adapters-model';
    if (a === 'sandbox') return 'adapters-sandbox';
    if (a === 'approval') return 'adapters-approval';
    return 'adapters-misc';
  }
  return 'platform'; // skill/governance/native/capability/supervisor/worker/search/transport/…
}

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (p === OUT) continue; // 对接面自身不参与扫描/改写
      walk(p, out);
    } else if (/\.(ts|tsx|mts)$/.test(e.name)) out.push(p);
  }
  return out;
};

// ── 1) 扫描 + 改写业务文件 ────────────────────────────────────────────────────────
// 三种形态：`import [type] {...} from` / `export [type] {...} from` / `import('...')`
const importRe =
  /((?:\bimport|\bexport)\s+(?:type\s+)?(?:\* as [A-Za-z0-9_]+\s+)?\{[^}]*\}\s+from\s+|\bimport\s*\(\s*)['"](@omniharness\/kernel[^'"]*)['"]/g;
const files = walk(SRC);
const inventory = new Map(); // area -> Map<name, { kind: 'value'|'type', specs: Set<string> }>
let rewritten = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const edits = [];
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(text)) !== null) {
    const clause = m[1];
    const spec = m[2];
    const rest = spec === '@omniharness/kernel' ? '' : spec.slice('@omniharness/kernel'.length);
    const area = areaOf(rest);
    if (clause.startsWith('import(')) {
      edits.push([m.index + clause.length, spec, area, file]); // 动态导入：只改说明符
      continue;
    }
    // 子句级类型标记：`import type {...}` / `export type {...}`
    const clauseIsType = /^\s*(?:import|export)\s+type\s/.test(clause);
    const inner = clause.slice(clause.indexOf('{') + 1, clause.lastIndexOf('}'));
    for (let part of inner.split(',')) {
      part = part.trim();
      if (part === '') continue;
      const isType = clauseIsType || part.startsWith('type ');
      const name = part.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (name === '') continue;
      if (!inventory.has(area)) inventory.set(area, new Map());
      const names = inventory.get(area);
      const prev = names.get(name);
      const kind = isType ? 'type' : 'value';
      if (prev === undefined) names.set(name, { kind, specs: new Set([spec]) });
      else {
        // 同名跨文件：类型/值取并（有任一值用法即按值导出），spec 记录保持不变（同符号）
        names.set(name, {
          kind: prev.kind === 'value' || kind === 'value' ? 'value' : 'type',
          specs: prev.specs,
        });
      }
    }
    edits.push([m.index + clause.length, spec, area, file]);
  }
  if (edits.length === 0) continue;
  // 从后往前替换，避免位移
  let out = text;
  for (const [quoteStart, spec, area, f] of edits.reverse()) {
    const rel = relative(dirname(f), join(OUT, `${area}.ts`)).replaceAll('\\', '/');
    const importee = rel.startsWith('.') ? rel : `./${rel}`;
    out = out.slice(0, quoteStart) + `'${importee}'` + out.slice(quoteStart + spec.length + 2);
    rewritten += 1;
  }
  writeFileSync(file, out);
}

// ── 2) 生成对接面文件（确定性排序；同域同名取首个 spec） ─────────────────────────
mkdirSync(OUT, { recursive: true });
for (const [area, names] of [...inventory].sort()) {
  const bySpec = new Map(); // spec -> { value: Set, type: Set }
  for (const [name, info] of [...names].sort()) {
    const spec = [...info.specs].sort()[0];
    if (!bySpec.has(spec)) bySpec.set(spec, { value: new Set(), type: new Set() });
    bySpec.get(spec)[info.kind].add(name);
  }
  const lines = [
    `/**`,
    ` * 内核对接面 · ${area} 域 —— 本目录是 app 侧唯一的 \`@omniharness/kernel\` 导入点`,
    ` * （\`scripts/checkKernelBoundary.mjs\` 第 7 条判据强制）。`,
    ` *`,
    ` * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持`,
    ` * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。`,
    ` * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。`,
    ` */`,
    '',
  ];
  for (const [spec, { value, type }] of [...bySpec].sort()) {
    if (value.size > 0) lines.push(`export { ${[...value].sort().join(', ')} } from '${spec}';`);
    if (type.size > 0) lines.push(`export type { ${[...type].sort().join(', ')} } from '${spec}';`);
  }
  writeFileSync(join(OUT, `${area}.ts`), lines.join('\n') + '\n');
}

// ── 3) 收尾复扫：残留的内核导入说明符 = 漏网形态，必须人工处理 ───────────────────
const leftoverRe = /(?:\bfrom\s+|\bimport\s*\(\s*)['"]@omniharness\/kernel[^'"]*['"]/g;
const leftovers = [];
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  let m;
  while ((m = leftoverRe.exec(text)) !== null) {
    const line = text.slice(0, m.index).split('\n').length;
    leftovers.push(`${relative(ROOT, file)}:${line} :: ${m[0].slice(0, 90)}`);
  }
}

console.log(`改写导入 ${rewritten} 条 / 扫描源文件 ${files.length} 个；生成对接面域：${[...inventory.keys()].sort().join(', ')}`);
if (leftovers.length > 0) {
  console.log(`残留内核导入 ${leftovers.length} 条（漏网形态，需人工处理）：`);
  for (const s of leftovers) console.log('  ' + s);
} else {
  console.log('残留内核导入 0 条 ✔');
}
