// SessionTranscript：导出文稿只含人读内容，文件名安全且可预测。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { SessionTranscript } from '../src/ui/models/SessionTranscript.ts';
import type { ThreadEvent } from '../src/types/models.ts';

const NOW = Date.parse('2026-11-10T12:00:00.000Z');

/** 构造一条事件。 */
function event(
  id: string,
  type: ThreadEvent['type'],
  payload: Record<string, unknown>,
  timestamp?: number,
): ThreadEvent {
  return { id, type, payload, ...(timestamp !== undefined ? { timestamp } : {}) };
}

test('SessionTranscript：用户 / 助手 / 工具按顺序导出，reasoning 被排除', () => {
  const events: ThreadEvent[] = [
    event('u', 'user', { content: '请读 README' }, NOW - 3000),
    event('r', 'reasoning', { content: '内部推理不应导出' }, NOW - 2000),
    event('t', 'tool_call', { name: 'read_file' }, NOW - 1000),
    event('tr', 'tool_result', { ok: true }, NOW - 500),
    event('a', 'assistant', { content: '完成。' }, NOW),
  ];
  const md = SessionTranscript.markdown(events, { title: '演示会话', now: NOW });
  assert.match(md, /^# 演示会话/m);
  assert.match(md, /## 你 · 2026-11-10T11:59:57\.000Z/);
  assert.match(md, /- 工具调用：`read_file`/);
  assert.match(md, /- 工具结果：成功/);
  assert.match(md, /## OmniHarness · 2026-11-10T12:00:00\.000Z/);
  assert.match(md, /完成。/);
  assert.doesNotMatch(md, /内部推理不应导出/);
});

test('SessionTranscript：部分导出会明确标注；空正文不产生空小节', () => {
  const md = SessionTranscript.markdown(
    [event('u', 'user', { content: '   ' }), event('a', 'assistant', { content: 'hi' })],
    { title: '', now: NOW, partial: true },
  );
  assert.match(md, /^# 会话/m);
  assert.match(md, /更早的历史尚未加载/);
  assert.doesNotMatch(md, /## 你/);
  assert.match(md, /## OmniHarness/);
});

test('SessionTranscript.filename：去掉路径分隔符与非法字符，并带日期', () => {
  assert.equal(SessionTranscript.filename('a/b:c', NOW), 'a-b-c-2026-11-10.md');
  assert.equal(
    SessionTranscript.filename('  demo   notes  ', NOW),
    'demo notes-2026-11-10.md',
  );
  assert.equal(SessionTranscript.filename('   ', NOW), '会话-2026-11-10.md');
});
