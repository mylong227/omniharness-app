// 应用层文案目录覆盖门禁（AppText）。
//
// 判据：
//   ① 源码里每个 `AppText.t('…')` 的中文字面量键都必须在 en 分片有同键条目；
//   ② 分片之间不得重复键（合并后后者覆盖前者会静默丢翻译）；
//   ③ 服务端/CLI/审计的「用户可见文案上下文」不得再出现裸 CJK 字面量
//      （new Error / message / reason / toast / stdout/stderr.write）——防回潮。
//
// 动态拼接键（`'前缀: ' + id`）仍以「字面量段」为键，en 覆盖前缀即可。

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';
const EN_DIR = join('src', 'apps', 'i18n', 'en');
const APP_DIRS = ['src/apps/server', 'src/apps/cli', 'src/apps/audit', 'src/apps/enterprise'];

/** 递归收集 .ts/.tsx。 */
function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.(ts|tsx)$/u.test(name)) out.push(full);
  }
  return out;
}

/** 分片里的条目（单引号/双引号键均可）。 */
function entriesOf(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /^\s*'((?:[^'\\\n]|\\.)*)'\s*:\s*(?:\n\s*)?'((?:[^'\\\n]|\\.)*)'/gmu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.set(m[1]!, m[2]!);
  return out;
}

test('① AppText.t 的字面量键都有 en 词条', () => {
  const en = new Map<string, string>();
  for (const file of collect(EN_DIR)) {
    for (const [k, v] of entriesOf(readFileSync(file, 'utf8'))) en.set(k, v);
  }
  const missing: string[] = [];
  for (const file of collect(SRC)) {
    if (file.startsWith(join('src', 'apps', 'i18n'))) continue;
    const text = readFileSync(file, 'utf8');
    const re = /AppText\.t\(\s*'((?:[^'\\\n]|\\.)*)'/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const key = m[1]!;
      if (!en.has(key)) missing.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(missing, [], '以下 AppText 键缺 en 词条——补 i18n/en 分片');
});

test('② en 分片之间无重复键', () => {
  const seen = new Map<string, string>();
  const dup: string[] = [];
  for (const file of collect(EN_DIR)) {
    for (const [key] of entriesOf(readFileSync(file, 'utf8'))) {
      if (seen.has(key)) dup.push(`${key}（${seen.get(key)} 与 ${file}）`);
      else seen.set(key, file);
    }
  }
  assert.deepEqual(dup, [], '词条键跨分片重复（后者会静默覆盖前者）');
});

test('③ 用户可见文案上下文不得残留裸 CJK 字面量', () => {
  const offenders: string[] = [];
  for (const dir of APP_DIRS) {
    for (const file of collect(dir)) {
      const text = readFileSync(file, 'utf8');
      const patterns = [
        /new\s+(?:Error|TypeError|RangeError|RpcError)\(\s*'([^']*[\u3400-\u9fff][^']*)'/gu,
        /^\s*message:\s*'([^']*[\u3400-\u9fff][^']*)'/gmu,
        /^\s*reason:\s*'([^']*[\u3400-\u9fff][^']*)'/gmu,
        /\.(?:stdout|stderr)\.write\(\s*'([^']*[\u3400-\u9fff][^']*)'/gu,
      ];
      for (const re of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) offenders.push(`${file}: ${m[1]}`);
      }
    }
  }
  assert.deepEqual(offenders, [], '以上用户可见文案仍未走 AppText.t（硬编码回潮）');
});
