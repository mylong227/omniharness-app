// 事件公共字段口径（纯模型）：callId 回落 / raw callId / 正文 / 工具名 / 时间戳。
//
// 这些细节原先在 StreamView / ThinkingTrail / TurnSummary / TraceView / 控制器里各写一份；
// 统一后，任何一处改口径都由这一组判据兜底。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ThreadEvent } from '../src/types/models.ts';

const { EventFields } = await import('../src/ui/models/EventFields.ts');

/** 造一条事件。 */
function ev(payload: Record<string, unknown> = {}, timestamp?: unknown): ThreadEvent {
  return { id: 'e1', type: 'tool_call', payload, ...(timestamp !== undefined ? { timestamp } : {}) } as ThreadEvent;
}

test('callId：非空字符串优先，缺失/空串/非字符串回落事件 id', () => {
  assert.strictEqual(EventFields.callId(ev({ callId: 'k1' })), 'k1');
  assert.strictEqual(EventFields.callId(ev({ callId: '' })), 'e1');
  assert.strictEqual(EventFields.callId(ev({ callId: 42 })), 'e1');
  assert.strictEqual(EventFields.callId(ev()), 'e1');
});

test('rawCallId：绝不回落事件 id（tool_result 匹配不能误配）', () => {
  assert.strictEqual(EventFields.rawCallId(ev({ callId: 'k1' })), 'k1');
  assert.strictEqual(EventFields.rawCallId(ev({ callId: '' })), '');
  assert.strictEqual(EventFields.rawCallId(ev({ callId: 42 })), '');
  assert.strictEqual(EventFields.rawCallId(ev()), '');
});

test('content / toolName：只认字符串，缺失为空串', () => {
  assert.strictEqual(EventFields.content(ev({ content: '思考' })), '思考');
  assert.strictEqual(EventFields.content(ev({ content: 1 })), '');
  assert.strictEqual(EventFields.content(ev()), '');
  assert.strictEqual(EventFields.toolName(ev({ name: 'read_file' })), 'read_file');
  assert.strictEqual(EventFields.toolName(ev({ name: 1 })), '');
  assert.strictEqual(EventFields.toolName(ev()), '');
});

test('timestamp：number 与 ISO 串都归一为毫秒，非法/缺失为 0', () => {
  assert.strictEqual(EventFields.timestamp(ev({}, 1_700_000_000_000)), 1_700_000_000_000);
  assert.strictEqual(
    EventFields.timestamp(ev({}, '2026-11-06T00:00:00.000Z')),
    Date.parse('2026-11-06T00:00:00.000Z'),
  );
  assert.strictEqual(EventFields.timestamp(ev({}, 0)), 0);
  assert.strictEqual(EventFields.timestamp(ev({}, '不是时间')), 0);
  assert.strictEqual(EventFields.timestamp(ev()), 0);
});
