// Web 数据表词条覆盖门禁：label/hint/description/desc/title/text/message/summary/name/group
// 的中文值必须进入 en 分片（这些值在渲染处经 t() 查表；缺词条时 English UI 会静默回落中文）。
//
// 与 i18nCoverage 的分工：后者覆盖 t('…') 字面量键 + 四类表键；本判据把**表值覆盖面**扩到
// 全部常用展示字段，防止新数据表绕过词条。

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB_SRC = 'web/src';
const EN_DIR = join('web/src', 'ui', 'i18n', 'en');
const FIELD =
  /^\s*(?:'([^']+)'|([\p{L}\p{N}_]+))\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/gmu;
const KEYS = new Set([
  'label',
  'hint',
  'placeholder',
  'description',
  'desc',
  'title',
  'text',
  'name',
  'group',
  'message',
  'reason',
  'summary',
  'ariaLabel',
]);

/** 递归收集 .ts/.tsx。 */
function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.(ts|tsx)$/u.test(name)) out.push(full);
  }
  return out;
}

/** 分片键集合（单引号键 + 裸标识键）。 */
function enKeys(): Set<string> {
  const out = new Set<string>();
  for (const file of collect(EN_DIR)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/^\s*'((?:[^'\\]|\\.)*)'\s*:/gmu)) out.add(m[1]!);
    for (const m of text.matchAll(/^\s*([\p{L}\p{N}_]+)\s*:/gmu)) out.add(m[1]!);
  }
  return out;
}

test('Web 数据表的 CJK 展示值都有 en 词条', () => {
  const en = enKeys();
  const missing: string[] = [];
  for (const file of collect(WEB_SRC)) {
    if (file.includes(join('ui', 'i18n'))) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(FIELD)) {
      const field = m[1] ?? m[2];
      const value = m[3] ?? m[4];
      if (field === undefined || value === undefined) continue;
      if (!KEYS.has(field)) continue;
      if (!/[\u3400-\u9fff]/u.test(value)) continue;
      if (!en.has(value)) missing.push(`${file}: ${field} = ${value}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], '以上表值缺 en 词条——补 web/src/ui/i18n/en 分片');
});
