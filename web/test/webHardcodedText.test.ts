// Web 用户可见文本裸字面量门禁（防回潮）。
//
// 判据：
//   ① `new Error('中文…')` 一律不得出现在 web/src（内部错误也统一用机读码/英文；
//      用户可见错误必须走 t()）；
//   ② toast/confirm/prompt 的首参不得是裸中文（必须 t('…')）；
//   ③ JSX 的 title / aria-label / placeholder / aria-description 不得是裸中文。
//
// 已知边界：JSX 文本节点（`<span>中文</span>`）与动态拼接键无法用正则可靠识别，
// 由 code review + i18nCoverage/webTableI18n 两条词条门禁补位。

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'web/src';
const CJK = /[\u3400-\u9fff]/u;

/** 递归收集 .ts/.tsx。 */
function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.(ts|tsx)$/u.test(name)) out.push(full);
  }
  return out;
}

/**
 * 去掉块/行注释，避免注释里的示例串误报。
 * @param text 源码
 * @returns 去注释文本
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|\s)\/\/.*$/gmu, '$1');
}

test('① web/src 不得有裸中文 new Error', () => {
  const bad: string[] = [];
  for (const file of collect(ROOT)) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const m of text.matchAll(/new\s+(?:Error|TypeError|RangeError)\(\s*'([^']*)'/gu)) {
      if (CJK.test(m[1]!)) bad.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [], '以上错误文案未走 t()/机读码');
});

test('② toast/confirm/prompt 首参不得是裸中文', () => {
  const bad: string[] = [];
  for (const file of collect(ROOT)) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const m of text.matchAll(/\b(?:toast|confirm|prompt)\(\s*'([^']*)'/gu)) {
      if (CJK.test(m[1]!)) bad.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [], '以上交互文案未走 t()');
});

test('③ JSX 的 title/aria-label/placeholder/aria-description 不得是裸中文', () => {
  const bad: string[] = [];
  for (const file of collect(ROOT)) {
    if (!file.endsWith('.tsx')) continue;
    const text = stripComments(readFileSync(file, 'utf8'));
    const re = /\b(?:title|aria-label|placeholder|aria-description)\s*=\s*"([^"]*)"/gu;
    for (const m of text.matchAll(re)) {
      if (CJK.test(m[1]!)) bad.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [], '以上属性文案未走 t()');
});
