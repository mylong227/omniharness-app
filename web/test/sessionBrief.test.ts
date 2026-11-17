// SessionBrief：只从事件流派生一屏摘要，不依赖后端。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { SessionBrief } from '../src/ui/models/SessionBrief.ts';
import type { ThreadEvent } from '../src/types/models.ts';

const at = (n: number): number => 1_700_000_000_000 + n * 1000;

/** 一条最小事件。 */
function event(
  id: string,
  type: ThreadEvent['type'],
  payload: Record<string, unknown> = {},
  timestamp = 0,
): ThreadEvent {
  return { id, type, payload, ...(timestamp > 0 ? { timestamp } : {}) };
}

const DIFF = [
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,3 @@',
  ' const a = 1;',
  '+const b = 2;',
  '-const c = 3;',
  '--- a/docs/readme.md',
  '+++ b/docs/readme.md',
  '@@ -1,0 +1,1 @@',
  '+hello',
].join('\n');

test('SessionBrief：回合 / 工具 / 失败 / 文件 / 增删 / token / 时长一次算清', () => {
  const events: ThreadEvent[] = [
    event('u1', 'user', { content: 'hi' }, at(0)),
    event('t1', 'tool_call', { name: 'read_file', callId: 'c1' }, at(1)),
    event('r1', 'tool_result', { callId: 'c1', ok: true }, at(2)),
    event('m1', 'model', { model: 'deepseek-chat', usage: { promptTokens: 100, completionTokens: 20 } }, at(3)),
    event('d1', 'turn_diff', { diff: DIFF }, at(4)),
    event('u2', 'user', { content: 'again' }, at(10)),
    event('t2', 'tool_call', { name: 'write_file', callId: 'c2' }, at(11)),
    event('r2', 'tool_result', { callId: 'c2', ok: false }, at(12)),
    event('m2', 'model', { model: 'deepseek-chat', usage: { promptTokens: 50, completionTokens: 5 } }, at(20)),
  ];
  const stats = SessionBrief.from(events);
  assert.equal(stats.turns, 2);
  assert.equal(stats.toolCalls, 2);
  assert.equal(stats.toolFailures, 1);
  assert.equal(stats.files, 2);
  assert.equal(stats.added, 2);
  assert.equal(stats.deleted, 1);
  assert.equal(stats.tokens, 175);
  assert.equal(stats.durationMs, 20_000);
  assert.deepEqual(stats.models, ['deepseek-chat']);
});

test('SessionBrief：同一文件跨多轮只计一次文件数、增删累加', () => {
  const events = [
    event('d1', 'turn_diff', { diff: DIFF }, at(0)),
    event('d2', 'turn_diff', { diff: DIFF }, at(1)),
  ];
  const stats = SessionBrief.from(events);
  assert.equal(stats.files, 2);
  assert.equal(stats.added, 4);
  assert.equal(stats.deleted, 2);
});

test('SessionBrief：没有 turn_diff 时，成功的写文件工具仍计入文件数', () => {
  const stats = SessionBrief.from([
    event('t1', 'tool_call', { name: 'write_file', callId: 'c1', args: { path: 'src/a.ts' } }),
    event('r1', 'tool_result', { callId: 'c1', ok: true, output: 'ok' }),
    event('t2', 'tool_call', { name: 'write_file', callId: 'c2', args: { path: 'src/a.ts' } }),
    event('r2', 'tool_result', { callId: 'c2', ok: true, output: 'ok' }),
    event('t3', 'tool_call', { name: 'write_file', callId: 'c3', args: { path: 'src/b.ts' } }),
    event('r3', 'tool_result', { callId: 'c3', ok: false, error: 'disk full' }),
  ]);
  assert.equal(stats.files, 1, '同一路径只计一次，失败写入不计');
  assert.equal(stats.toolFailures, 1);
});

test('SessionBrief：取最近一次 model 事件的上下文快照与缓存命中率', () => {
  const stats = SessionBrief.from([
    event('m1', 'model', {
      model: 'deepseek-chat',
      usage: { promptTokens: 100, cachedPromptTokens: 20, completionTokens: 5 },
      context: { windowTokens: 1000, usedTokens: 200 },
    }),
    event('m2', 'model', {
      model: 'deepseek-chat',
      usage: { promptTokens: 400, cachedPromptTokens: 100, completionTokens: 10 },
      context: { windowTokens: 1000, usedTokens: 500 },
    }),
  ]);
  assert.equal(stats.context?.usedTokens, 500);
  assert.equal(stats.context?.windowTokens, 1000);
  assert.equal(stats.context?.percent, 50);
  assert.equal(stats.context?.cacheHitRate, 25, '缓存率取同一次调用：100 / 400');
});

test('SessionBrief：空事件 / 脏 usage 不产生 NaN', () => {
  assert.equal(SessionBrief.isEmpty(SessionBrief.from([])), true);
  const stats = SessionBrief.from([
    event('m', 'model', { model: 'x', usage: { promptTokens: 'bad', completionTokens: null } }),
  ]);
  assert.equal(stats.tokens, 0);
  assert.deepEqual(stats.models, ['x']);
});

test('SessionBrief：成本估算只累计有参考价的模型（宁缺毋滥）', () => {
  // deepseek-chat 在参考价表内：(100+50)×0.28 + (20+5)×0.42（per 1M）
  const known = SessionBrief.from([
    event('m1', 'model', { model: 'deepseek-chat', usage: { promptTokens: 100, completionTokens: 20 } }, at(0)),
    event('m2', 'model', { model: 'deepseek-chat', usage: { promptTokens: 50, completionTokens: 5 } }, at(1)),
  ]);
  const expected = (150 * 0.28 + 25 * 0.42) / 1_000_000;
  assert.ok(known.costUsd !== undefined && Math.abs(known.costUsd - expected) < 1e-12);
  // 未知价模型：不累计（宁缺毋滥，绝不猜价）
  const unknown = SessionBrief.from([
    event('m1', 'model', { model: 'no-such-model', usage: { promptTokens: 100, completionTokens: 20 } }, at(0)),
  ]);
  assert.equal(unknown.costUsd, undefined);
  // 混用：未知价调用不贡献，已知价的照常累计
  const mixed = SessionBrief.from([
    event('m1', 'model', { model: 'no-such-model', usage: { promptTokens: 999, completionTokens: 999 } }, at(0)),
    event('m2', 'model', { model: 'glm-4.6', usage: { promptTokens: 1_000_000, completionTokens: 0 } }, at(1)),
  ]);
  assert.ok(mixed.costUsd !== undefined && Math.abs(mixed.costUsd - 0.6) < 1e-9);
  // 无 usage 的 model 事件不产生成本
  const bare = SessionBrief.from([event('m1', 'model', { model: 'deepseek-chat' }, at(0))]);
  assert.equal(bare.costUsd, undefined);
});
