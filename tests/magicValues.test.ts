// 魔法值门禁：可调参数必须走 `src/config/app.json`（RuntimeConfig / UI_TUNABLES），
// 不得在业务代码里重新写死超时/间隔/上限/缓存条数。
//
// 判据：`const <大写名含 TIMEOUT|TTL|POLL|…> = <数字>` 一律拒绝，除非：
//   ① 右值引用 RuntimeConfig / UI_TUNABLES / envLimit / process.env（配置来源）；
//   ② 命中显式 C 类豁免（纯展示截断，见 docs/HARDCODE-POLICY.md）。
// 协议/安全上限通常不叫这些名字（如 PATCH_MAX_BYTES），由策略文档而非本门禁约束。

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/apps', 'web/src'];
const NAME = /(?:TIMEOUT|TTL|POLL|DEBOUNCE|LIMIT|PAGE_SIZE|MAX_ENTRIES|CACHE|INTERVAL|RETRY|BUDGET|THROTTLE)/u;
const DECL = /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*([0-9][0-9_]*)\s*;/gmu;

/** C 类豁免（文件 + 常量名 + 理由）。 */
const EXEMPT = new Map([
  [
    'src/apps/tui/tuiAgentBridge.ts:TEXT_LIMIT',
    '纯展示截断（TUI 单行），不随部署调节',
  ],
  [
    'src/apps/tui/tuiAgentBridge.ts:ARGS_LIMIT',
    '纯展示截断（工具参数预览），不随部署调节',
  ],
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

test('可调参数不得在业务代码里写死（必须来自 app.json）', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of collect(root)) {
      if (file.includes(join('apps', 'config')) || file.includes(join('ui', 'i18n'))) continue;
      const key = file.split('\\').join('/');
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(DECL)) {
        const name = m[1]!;
        if (!NAME.test(name)) continue;
        if (EXEMPT.has(`${key}:${name}`)) continue;
        offenders.push(`${file}: ${name} = ${m[2]}`);
      }
    }
  }
  assert.deepEqual(offenders, [], '以上可调参数写死在业务代码——迁入 src/config/app.json');
});
