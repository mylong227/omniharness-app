/**
// web/test/configWiring.test.ts
 * 配置通道接线判据（alpha.21）：FileConfig 里的上下文三段 / 读缓存 / 能力防火墙，
 * 必须经 `ArgParser.configDefaults` 与 `CliConfigSections.tooling` 一路透传到
 * `ConfigFactory.build` 的 partial。
 *
 * 背景：2026-11-15 实测发现三段能落盘、设置页也显示「已保存」，但 CLI/serve 启动时
 * `configDefaults` 从未映射 ⇒ 内核收到 undefined、行为静默回落到 off（I5a 同型事故）。
 */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ArgParser } from '../src/apps/cli/argParser.ts';
import { CliConfigSections } from '../src/apps/cli/cliConfigSections.ts';
import type { CliArgs } from '../src/apps/cli/cliArgs.ts';
import type { FileConfig } from '../src/host/kernel/config.ts';

const FILE: FileConfig = {
  retrievalContext: { mode: 'bm25', maxSnippets: 4, maxTokens: 600 },
  semanticRecall: { mode: 'on' },
  contextPolicy: { degradeLadder: { compactionForce: true }, cacheGuard: { hitRateFloor: 0.7 } },
  toolCache: { enabled: true, maxEntries: 8 },
  capflow: { mode: 'shadow' },
};

test('configDefaults：上下文三段 + 读缓存/防火墙全部进 CliArgs（漏映射 = 内核收不到）', () => {
  const defaults = ArgParser.configDefaults(FILE);
  assert.deepEqual(defaults.retrievalContext, FILE.retrievalContext);
  assert.deepEqual(defaults.semanticRecall, FILE.semanticRecall);
  assert.deepEqual(defaults.contextPolicy, FILE.contextPolicy);
  assert.deepEqual(defaults.toolCache, FILE.toolCache);
  assert.deepEqual(defaults.capflow, FILE.capflow);
});

test('CliConfigSections.tooling：五段原样进入 ConfigFactory partial', () => {
  const args = {
    retrievalContext: FILE.retrievalContext,
    semanticRecall: FILE.semanticRecall,
    contextPolicy: FILE.contextPolicy,
    toolCache: FILE.toolCache,
    capflow: FILE.capflow,
  } as unknown as CliArgs;
  const partial = CliConfigSections.tooling(args, { workers: undefined, lspServer: undefined });
  assert.deepEqual(partial.retrievalContext, FILE.retrievalContext);
  assert.deepEqual(partial.semanticRecall, FILE.semanticRecall);
  assert.deepEqual(partial.contextPolicy, FILE.contextPolicy);
  assert.deepEqual(partial.toolCache, FILE.toolCache);
  assert.deepEqual(partial.capflow, FILE.capflow);
});

test('缺省不写 partial：未配置段不产生任何键（零行为变更）', () => {
  const partial = CliConfigSections.tooling({} as unknown as CliArgs, {
    workers: undefined,
    lspServer: undefined,
  });
  assert.equal('retrievalContext' in partial, false);
  assert.equal('toolCache' in partial, false);
  assert.equal('capflow' in partial, false);
});

test('mcpServers：env/cwd 内核 M117 文件面 → CLI 参数透传（漏映射 = 用户配置静默失效）', () => {
  const file: FileConfig = {
    mcpServers: [
      { name: 'local', command: 'node', args: ['srv.js'], env: { TOKEN: 'x' }, cwd: '/srv' },
      { name: 'remote', url: 'https://mcp.example.com', headers: { 'x-k': 'v' } },
    ],
  } as FileConfig;
  const defaults = ArgParser.configDefaults(file);
  assert.deepEqual(defaults.mcpServers?.[0], {
    name: 'local', command: 'node', args: ['srv.js'], env: { TOKEN: 'x' }, cwd: '/srv',
  }, 'stdio 形态 env/cwd 必须透传（内核连接器已消费）');
  assert.deepEqual(defaults.mcpServers?.[1], {
    name: 'remote', url: 'https://mcp.example.com', headers: { 'x-k': 'v' },
  }, '远端形态不带 env/cwd（形状按声明归一）');
});
