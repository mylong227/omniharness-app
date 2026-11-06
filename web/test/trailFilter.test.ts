// 思考轨迹筛选算术（纯模型，零 DOM）：行折叠口径 + 计数 + 过滤顺序。
//
// 关键口径：被 tool_call 内联的 tool_result 不得重复成行；孤儿结果保留；失败以结果 ok!==true
// 为准（pending 不算失败）；system / turn_diff 等「其它」行在「全部」里必须还在。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ThreadEvent } from '../src/types/models.ts';

const { TrailFilter } = await import('../src/ui/models/TrailFilter.ts');

/** 造一条事件。 */
function ev(id: string, type: string, payload: Record<string, unknown>): ThreadEvent {
  return { id, type, payload } as ThreadEvent;
}

const EVENTS: ThreadEvent[] = [
  ev('r1', 'reasoning', { content: '先看实现。' }),
  ev('a1', 'assistant', { content: '我准备读文件。' }),
  ev('c1', 'tool_call', { callId: 'k1', name: 'read_file', args: { path: 'a.ts' } }),
  ev('x1', 'tool_result', { callId: 'k1', ok: true, output: 'ok' }),
  ev('c2', 'tool_call', { callId: 'k2', name: 'shell', args: { cmd: 'false' } }),
  ev('x2', 'tool_result', { callId: 'k2', ok: false, output: '✗ failed' }),
  ev('x3', 'tool_result', { callId: 'orphan', ok: false, output: '✗ orphan' }),
  ev('s1', 'system', { content: '上下文已压缩' }),
  ev('c3', 'tool_call', { callId: 'k3', name: 'read_file', args: { path: 'b.ts' } }),
];

test('行折叠：内联结果不成行、孤儿结果保留、其它事件不丢', () => {
  const rows = TrailFilter.rows(EVENTS);
  assert.deepStrictEqual(
    rows.map((row) => row.ev.id),
    ['r1', 'a1', 'c1', 'c2', 'x3', 's1', 'c3'],
    'x1 是 c1 的内联结果（不重复）；x3 是孤儿结果（保留）；s1 是其它行（保留）',
  );
  assert.deepStrictEqual(
    rows.map((row) => row.kind),
    ['thinking', 'narration', 'tool', 'tool', 'result', 'other', 'tool'],
  );
  assert.deepStrictEqual(
    rows.map((row) => row.failed),
    [false, false, false, true, true, false, false],
    'k2 对应失败结果 ⇒ 调用行失败；孤儿失败结果也算；pending 不算失败',
  );
  assert.strictEqual(rows[0]?.index, 0);
  assert.strictEqual(rows[3]?.index, 4, '行保留原事件下标（耗时口径依赖它）');
});

test('计数：全部 / 思考 / 说明 / 工具 / 失败', () => {
  const view = TrailFilter.view(EVENTS);
  assert.deepStrictEqual(view.counts, {
    all: 7,
    thinking: 1,
    narration: 1,
    tools: 4,
    failures: 2,
  });
});

test('过滤：保持原顺序，各自只留对应类型', () => {
  const rows = TrailFilter.rows(EVENTS);
  assert.deepStrictEqual(
    TrailFilter.apply(rows, 'thinking').map((row) => row.ev.id),
    ['r1'],
  );
  assert.deepStrictEqual(
    TrailFilter.apply(rows, 'narration').map((row) => row.ev.id),
    ['a1'],
  );
  assert.deepStrictEqual(
    TrailFilter.apply(rows, 'tools').map((row) => row.ev.id),
    ['c1', 'c2', 'x3', 'c3'],
  );
  assert.deepStrictEqual(
    TrailFilter.apply(rows, 'failures').map((row) => row.ev.id),
    ['c2', 'x3'],
  );
  assert.deepStrictEqual(
    TrailFilter.apply(rows, 'all').map((row) => row.ev.id),
    ['r1', 'a1', 'c1', 'c2', 'x3', 's1', 'c3'],
  );
});
