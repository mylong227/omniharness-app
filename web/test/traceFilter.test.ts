/**
 * 轨迹筛选判据（2026-11-15）：139 次工具调用不能只靠滚动。
 *
 * 钉三件事：工具名→大类映射、筛选档与文本组合过滤、各档计数（chips 角标）。
 */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  categoryOfTool,
  filterTraceRows,
  traceFilterCounts,
  type TraceRow,
} from '../src/ui/models/TraceFilter.ts';

/** 造一行轨迹（只填过滤用字段）。 */
function row(over: Partial<TraceRow> & Pick<TraceRow, 'key' | 'name'>): TraceRow {
  return {
    action: over.name,
    done: true,
    failed: false,
    time: '10:00:00',
    turn: 1,
    category: categoryOfTool(over.name),
    ...over,
  };
}

const ROWS: TraceRow[] = [
  row({ key: 'r1', name: 'read_file', action: '读取 a.ts' }),
  row({ key: 'r2', name: 'read_file', action: '读取 b.ts' }),
  row({ key: 'w1', name: 'apply_patch', action: '修改 a.ts' }),
  row({ key: 'c1', name: 'shell', action: '执行 npm test', failed: true, done: true }),
  row({ key: 's1', name: 'grep_search', action: '搜索 foo' }),
  row({ key: 'x1', name: 'mystery', action: '未知动作', done: false }),
];

test('工具名 → 动作大类（顺序无关，含常见别名）', () => {
  assert.equal(categoryOfTool('read_file'), 'read');
  assert.equal(categoryOfTool('apply_patch'), 'write');
  assert.equal(categoryOfTool('edit_file'), 'write');
  assert.equal(categoryOfTool('shell'), 'command');
  assert.equal(categoryOfTool('grep_search'), 'search');
  assert.equal(categoryOfTool('glob'), 'search');
  assert.equal(categoryOfTool('list_dir'), 'read', '目录浏览归入读取');
  assert.equal(categoryOfTool('mystery'), 'other');
});

test('筛选档：all / 读取 / 失败 / 进行中', () => {
  assert.equal(filterTraceRows(ROWS, 'all', '').length, 6);
  assert.deepEqual(
    filterTraceRows(ROWS, 'read', '').map((r) => r.key),
    ['r1', 'r2'],
  );
  assert.deepEqual(
    filterTraceRows(ROWS, 'failed', '').map((r) => r.key),
    ['c1'],
  );
  assert.deepEqual(
    filterTraceRows(ROWS, 'running', '').map((r) => r.key),
    ['x1'],
  );
});

test('文本搜索与筛选档叠加（动作/工具名，大小写不敏感）', () => {
  assert.deepEqual(
    filterTraceRows(ROWS, 'read', 'b.TS').map((r) => r.key),
    ['r2'],
  );
  assert.deepEqual(
    filterTraceRows(ROWS, 'all', 'npm').map((r) => r.key),
    ['c1'],
  );
  assert.equal(filterTraceRows(ROWS, 'write', 'npm').length, 0);
});

test('计数与筛选结果一致：failed/running 不重复计入动作大类', () => {
  const counts = traceFilterCounts(ROWS);
  assert.equal(counts.all, 6);
  assert.equal(counts.read, 2);
  assert.equal(counts.write, 1);
  assert.equal(counts.command, 1);
  assert.equal(counts.search, 1);
  assert.equal(counts.other, 1);
  assert.equal(counts.failed, 1);
  assert.equal(counts.running, 1);
  for (const kind of ['read', 'write', 'command', 'search'] as const) {
    assert.equal(filterTraceRows(ROWS, kind, '').length, counts[kind]);
  }
});
