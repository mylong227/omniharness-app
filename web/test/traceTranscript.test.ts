// 轨迹导出（2026-11-17 粘性批次）纯逻辑判据。
//
// 语义：按轮分节（## 第 N 轮），行格式 `时刻 · 类别 · 工具 · 状态 · 动作`；
// 筛选态在文稿开头如实标注「只包含筛选结果」；空行集给占位说明；文件名带轨迹前缀。
// 直跑：npx vitest run web/test/traceTranscript.test.ts
import assert from 'node:assert/strict';
import { test } from 'vitest';

const { TraceTranscript } = await import('../src/ui/models/TraceTranscript.ts');

type TraceRow = import('../src/ui/models/TraceFilter.ts').TraceRow;

/** 造一行（只填判据关心的字段）。 */
function row(over: Partial<TraceRow> = {}): TraceRow {
  return {
    key: over.key ?? 'e1',
    name: over.name ?? 'shell',
    action: over.action ?? 'npm run build',
    done: over.done ?? true,
    failed: over.failed ?? false,
    time: over.time ?? '12:03:41',
    turn: over.turn ?? 1,
    category: over.category ?? 'command',
  };
}

test('轨迹文稿：按轮分节 + 行格式 + 状态三态', () => {
  const md = TraceTranscript.markdown(
    [
      row({ turn: 1, done: true }),
      row({ key: 'e2', turn: 1, failed: true, name: 'write', category: 'write' }),
      row({ key: 'e3', turn: 2, done: false, time: '12:04:02' }),
    ],
    { title: '排查任务', now: Date.UTC(2026, 10, 17, 4, 0, 0) },
  );
  assert.match(md, /# 轨迹导出 · 排查任务/u);
  assert.match(md, /> 导出时间：2026-11-17T04/u);
  assert.match(md, /## 第 1 轮/u);
  assert.match(md, /## 第 2 轮/u);
  assert.match(md, /- 12:03:41 · command · `shell` · 完成 · npm run build/u);
  assert.match(md, / · write · `write` · 失败 · /u);
  assert.match(md, /- 12:04:02 · command · `shell` · 进行中 · /u);
});

test('轨迹文稿：筛选态如实标注 + 空行集占位', () => {
  const filtered = TraceTranscript.markdown([row()], {
    filtered: true,
    filterLabel: '失败 · 搜索「npm」',
  });
  assert.match(filtered, /只包含当前筛选结果（失败 · 搜索「npm」）/u);
  const empty = TraceTranscript.markdown([], {});
  assert.match(empty, /（没有轨迹行）/u);
});

test('轨迹文件名：轨迹前缀 + 非法字符清洗', () => {
  const name = TraceTranscript.filename('a/b:c', Date.UTC(2026, 10, 17));
  assert.strictEqual(name, '轨迹-a-b-c-2026-11-17.md');
  assert.strictEqual(TraceTranscript.filename('', Date.UTC(2026, 10, 17)), '轨迹-会话-2026-11-17.md');
});
