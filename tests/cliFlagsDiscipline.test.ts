import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAG_TABLE, VALUE_FLAGS, KNOWN_EXTRA_FLAGS } from '../src/apps/cli/cliFlagTable.ts';
import cliHelp from '../defaults/cliHelp.json';

/**
 * CLI 旗标**注册纪律**机检（移植上游 knownFlags.test 的双向核对精髓；2026-11-06 审计 #9/#15）。
 *
 * 上游仓有 45 处注释引用这类判据，本仓未随迁——而审计发现纪律已经在漂（doctor/init 的
 * 旗标长期未登记，靠「不经 parseArgs」侥幸活着）。本判据把两头都钉住：
 *
 * ① 源码里读到的每个旗标（reader.value/has、flagValue、includes 直读）都必须 ∈ 三张登记表
 *    （FLAG_TABLE ∪ VALUE_FLAGS ∪ KNOWN_EXTRA_FLAGS ∪ HELP_FLAGS）——「读取必须被认识」；
 * ② KNOWN_EXTRA_FLAGS 里登记的名字必须在源码里有真实读取——防它腐化成「什么都放行」的白名单；
 * ③ cliHelp.json 的每条 `omniharness <cmd> …` 命令条目必须真的有分发入口——帮助不再许诺幽灵命令。
 */

/** 旗标的三张登记表 + 求助快捷键（exec.ts 快路径自读）。 */
const REGISTERED = new Set<string>([
  ...Object.keys(FLAG_TABLE),
  ...VALUE_FLAGS,
  ...KNOWN_EXTRA_FLAGS,
  '--help',
  '-h',
  '--version',
  '-V',
]);

/** 扫描 CLI 源码里「实际读取」的旗标名（含各直读形态）。 */
function readFlagsFromSource(): Map<string, string[]> {
  const dir = resolve('src/apps/cli');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  const reads = new Map<string, string[]>();
  const patterns = [
    // reader 直读（flag 为第一参）：value/values/number/has/flagValue/flagNumber/flagBoolean
    /\.(?:value|values|number|has|flagValue|flagNumber|flagBoolean)\(\s*['"`]--([a-z][a-z0-9-]*)['"`]/gi,
    // 第二参形态：`this.flagValue(args, '--x')` / `flagValue(rest, '--y')`（首参为任意标识符）
    /\(\s*[a-zA-Z][a-zA-Z0-9]*\s*,\s*['"`]--([a-z][a-z0-9-]*)['"`]/g,
    /\.includes\(\s*['"`]--([a-z][a-z0-9-]*)['"`]\s*\)/gi,
    /(?:value|values|has|number)\(\s*['"`]--([a-z][a-z0-9-]*)['"`]/gi,
    // 相等直读形态：`rest[i] === '--port'`（daemon start 等逐 token 解析的子命令）
    /[!=]==?\s*['"`]--([a-z][a-z0-9-]*)['"`]/gi,
  ];
  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8');
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const flag = `--${m[1]!}`;
        if (!reads.has(flag)) reads.set(flag, []);
        reads.get(flag)!.push(file);
      }
    }
  }
  return reads;
}

describe('CLI 旗标注册纪律（双向核对）', () => {
  const reads = readFlagsFromSource();

  it('判据① 源码读取的每个旗标都已登记（未登记 = 潜在「未知旗标 fail-closed」牺牲品）', () => {
    const unregistered = [...reads.keys()].filter((flag) => !REGISTERED.has(flag));
    expect(
      unregistered,
      '以下旗标被读取但未在 FLAG_TABLE/VALUE_FLAGS/KNOWN_EXTRA_FLAGS 登记——补 knownFlags.ts 并写明由谁直读',
    ).toEqual([]);
  });

  it('判据② 登记在 KNOWN_EXTRA_FLAGS 的旗标必须有真实读取（防白名单腐化）', () => {
    const orphaned = [...KNOWN_EXTRA_FLAGS].filter((flag) => !reads.has(flag));
    expect(
      orphaned,
      '以下旗标登记了却全仓无人读取——删除登记或恢复读取，别让白名单变成摆设',
    ).toEqual([]);
  });

  it('判据③ cliHelp.json 的命令条目都有真实分发入口（帮助不许诺幽灵命令）', () => {
    const execLocal = readFileSync(resolve('src/apps/cli/execLocal.ts'), 'utf8');
    const execCli = readFileSync(resolve('src/apps/cli/execCli.ts'), 'utf8');
    const dispatched = new Set<string>();
    for (const source of [execLocal, execCli]) {
      for (const m of source.matchAll(/command\s*===\s*'([a-z][a-z0-9]*)'/g)) {
        dispatched.add(m[1]!);
      }
      for (const m of source.matchAll(/\[\s*'([a-z][a-z0-9]*)'\s*,\s*\(r?\)?\s*=>/g)) {
        dispatched.add(m[1]!);
      }
    }
    // agent 路径兜底（不带子命令 = 直接给 prompt），不是命令；exec 的 schema 在 `sdk` 下。
    const entries = (cliHelp as { commands?: { usage: string }[] }).commands ?? [];
    const ghosts = entries
      .map((c) => /omniharness\s+([a-z][a-z0-9]*)/.exec(c.usage)?.[1])
      .filter((cmd): cmd is string => cmd !== undefined)
      .filter((cmd) => !dispatched.has(cmd));
    expect(
      ghosts,
      'cliHelp.json 里的这些命令没有分发入口——补分发或删条目（帮助与实现必须同源）',
    ).toEqual([]);
  });
});
