// i18n 词条完整性门禁（纯静态扫描，零浏览器依赖）：
//
// 判据一：web/src 源码里每个 `t('…')` / `t("…")` **字面量键**都必须能在 en 词条分片
//         （web/src/ui/i18n/en/*.ts）里找到同键条目——缺词条时 en 语言会静默回落中文，
//         靠人眼发现不了，这里用扫描兜底。
// 判据二：跨分片键不得重复（分片会被 en/index.ts 展开合并成一张表，重复键后者覆盖前者，
//         属静默丢翻译）。
// 判据三（键表模式，2026-11-17 沉淀）：渲染处大量 `t(var.label)` / `t(var.hint)` /
//         `t(var.name)` / `t(var.group)` 查表调用（SETTINGS_FIELDS / 快捷键行 / 命令面板
//         buildCommands / 权限档 / 轨迹筛选 chips / 主题方案…），键值是**中文标签字面量**，
//         en 是否覆盖只能从「表的值」侧比对。判据：源码里这四个键的 CJK 字符串值都必须在
//         en 分片有条目。本轮批次 C 曾靠一次性脚本比对（清出 85 孤儿词条时顺带查过表模式），
//         现沉淀为常驻门禁；首跑即抓到 AppReducers 命令「专注模式」缺 en 词条。
//
// 已知边界：① 动态拼接键（`'编辑：' + name` 这类）无法静态枚举，靠「值与分片逐字一致」
// 约定 + code review；② title/desc/combo/subject 等键当前没有任何 CJK 值、也没有 t(var.X)
// 消费者，不纳入——将来出现消费者时再扩键集（避免对非 UI 数据字段误报）。
//
// 直跑：node --test web/test/i18nCoverage.test.mjs（无需构建）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = fileURLToPath(new URL('../src/', import.meta.url));
const EN_DIR = fileURLToPath(new URL('../src/ui/i18n/en/', import.meta.url));

/** 递归收集目录下全部 .ts/.tsx 文件（跳过 i18n 词条目录自身）。 */
function collectTsFiles(dir: string, skipDirs: string[] = []): string[] {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (skipDirs.includes(full)) continue;
    if (statSync(full).isDirectory()) out.push(...collectTsFiles(full, skipDirs));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * 从源码文本提取 t('…') / t("…") 的字面量键。
 * 匹配面排除成员/标识符调用（.t( / xt( 不算），只认独立标识符 t(。
 * @param text 源码文本
 * @returns 键数组（保留源码里的转义写法，与分片里的写法逐字对比）
 */
function extractTLiteralKeys(text: string): string[] {
  const keys: string[] = [];
  const re = /(?:^|[^\w$.])t\(\s*('((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    keys.push(m[2] !== undefined ? m[2] : m[3]);
  }
  return keys;
}

/** 分片文本里是否存在该键的条目形态（`'key':` 或裸 CJK 标识 `key:`）。 */
function chunkHasEntry(chunkText: string, rawKey: string) {
  const esc = rawKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = new RegExp("(?:^|\\n)\\s*(?:'" + esc + "'|\"" + esc + '")\\s*:');
  if (quoted.test(chunkText)) return true;
  if (/^[\p{L}\p{N}_]+$/u.test(rawKey)) {
    return new RegExp('(?:^|\\n)\\s*' + esc + '\\s*:', 'm').test(chunkText);
  }
  return false;
}

/** 从分片文本收集键值对（分片是纯对象字面量 + 行注释，条目形态即 `键: '值'`，值允许换行缩进）。 */
function collectChunkEntries(chunkText: string) {
  const entries: { key: string; value: string }[] = [];
  // TS1530（\p{L} 需 u 标志）只检查**正则字面量**，故以字符串构造同一正则，运行时与迁移前
  // 的 .mjs 逐字节一致。不能加 u：收紧后 \p{L} 真正生效，会翻出 en 分片裸 CJK 键的既有冲突
  // （当前/主题/检测，属 src 根因），超出本判据的类型层修复授权。
  const re = new RegExp(
    String.raw`(?:^|\n)\s*(?:'((?:[^'\\\n]|\\.)*)'|([\p{L}\p{N}_]+))\s*:\s*\n?\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")`,
    'g',
  );
  let m;
  while ((m = re.exec(chunkText)) !== null) {
    entries.push({
      key: m[1] !== undefined ? m[1] : m[2],
      value: m[3] !== undefined ? m[3] : m[4],
    });
  }
  return entries;
}

/**
 * 剥离注释与字符串字面量里的干扰（行/块注释清空；字符串原样保留供正则匹配）。
 * 轻量状态机：不追求完整 TS 词法（正则字面量等边角会造成漏检方向的误差，可接受），只保证
 * 注释里的示例调用（如 `t('已保存')`）不产生假红。
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  let mode = 'code';
  while (i < n) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : '';
    if (mode === 'code') {
      if (c === '/' && d === '/') {
        mode = 'line';
        out += ' ';
        i += 2;
        continue;
      }
      if (c === '/' && d === '*') {
        mode = 'block';
        out += ' ';
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        mode = c === "'" ? 'squote' : c === '"' ? 'dquote' : 'template';
        out += c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code';
        out += '\n';
      }
      i += 1;
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && d === '/') {
        mode = 'code';
        out += ' ';
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (c === '\\') {
      out += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if ((mode === 'squote' && c === "'") || (mode === 'dquote' && c === '"') || (mode === 'template' && c === '`')) {
      mode = 'code';
    }
    out += c;
    i += 1;
  }
  return out;
}

test('源码里每个 t() 字面量键都在 en 词条分片中有条目', () => {
  const files = collectTsFiles(SRC_ROOT, [EN_DIR.replace(/[\\/]+$/, '')]);
  const chunkFiles = collectTsFiles(EN_DIR);
  const chunks = chunkFiles.map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));
  const missing: string[] = [];
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const key of extractTLiteralKeys(text)) {
      const hit = chunks.some((c) => chunkHasEntry(c.text, key));
      if (!hit) missing.push(file.replace(SRC_ROOT, '') + ' → ' + key);
    }
  }
  assert.deepEqual(missing, [], '以下 t() 键缺英文词条（补进 web/src/ui/i18n/en/ 对应分片）');
});

test('en 词条分片之间的重复键不得有相异的译文（合并时后者覆盖前者会静默换翻译）', () => {
  const chunkFiles = collectTsFiles(EN_DIR);
  const seen = new Map();
  const conflicts = [];
  for (const f of chunkFiles) {
    for (const { key, value } of collectChunkEntries(readFileSync(f, 'utf8'))) {
      if (seen.has(key)) {
        if (seen.get(key).value !== value) {
          conflicts.push(key + '：' + seen.get(key).file + '="' + seen.get(key).value + '" vs ' + f + '="' + value + '"');
        }
      } else seen.set(key, { file: f, value });
    }
  }
  assert.deepEqual(conflicts, [], '跨分片同键不同译文（统一成一个分片或对齐译文）');
});

/** 键表模式的键集：源码里有 `t(var.X)` 消费者的表键（边界见文件头 ②）。 */
const KEY_TABLE_KEYS = new Set(['label', 'hint', 'name', 'group']);

/**
 * 从源码文本提取键表条目（`label: '中文'` 等形态；键可裸字或引号——只认键集内的键，
 * 其余键名条目一律跳过）。值允许跨行缩进，与 collectChunkEntries 同口径。
 * @param text 已剥注释的源码文本
 * @returns 键值对数组
 */
function collectKeyTableEntries(text: string) {
  const entries: { key: string; value: string }[] = [];
  const re = new RegExp(
    String.raw`(?:^|\n)\s*(?:'(label|hint|name|group)'|"(label|hint|name|group)"|(label|hint|name|group))\s*:\s*\n?\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")`,
    'g',
  );
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = m[1] ?? m[2] ?? m[3];
    if (key === undefined || !KEY_TABLE_KEYS.has(key)) continue;
    entries.push({ key, value: m[4] !== undefined ? m[4] : m[5]! });
  }
  return entries;
}

test('键表模式：label/hint/name/group 的 CJK 值都必须在 en 词条分片有条目（t(var.X) 查表兜底）', () => {
  const files = collectTsFiles(SRC_ROOT, [EN_DIR.replace(/[\\/]+$/, '')]);
  const chunkFiles = collectTsFiles(EN_DIR);
  const chunks = chunkFiles.map((f) => readFileSync(f, 'utf8'));
  const missing: string[] = [];
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const { key, value } of collectKeyTableEntries(text)) {
      if (!/[\u4e00-\u9fff]/.test(value)) continue; // 只看中文值（英文值无需词条）
      const hit = chunks.some((c) => chunkHasEntry(c, value));
      if (!hit) missing.push(file.replace(SRC_ROOT, '') + ' → ' + key + ': ' + value);
    }
  }
  assert.deepEqual(
    missing,
    [],
    '以下键表 CJK 值缺英文词条（渲染处 t(var.X) 查表，en 缺条目即静默回落中文；补进 web/src/ui/i18n/en/ 对应分片）',
  );
});
