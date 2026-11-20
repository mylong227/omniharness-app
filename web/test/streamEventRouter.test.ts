// SSE 事件路由判据（2026-11-20 批次六从 AppController 抽出后补的直测）：
// method → 处理器一一对应 + 未登记 method 静默忽略（服务端新增通知不崩旧前端）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { routeStreamMessage, type StreamEventHandlers } from '../src/ui/controllers/StreamEventRouter.ts';

/** 全记录桩：每个处理器登记自己的名字与载荷。 */
function stubHandlers(): StreamEventHandlers & {
  calls: { name: string; arg: unknown }[];
  call(name: string, arg?: unknown): void;
} {
  const calls: { name: string; arg: unknown }[] = [];
  const call = (name: string, arg?: unknown): void => {
    calls.push({ name, arg });
  };
  return {
    calls,
    call,
    threadEvent: (e) => call('thread.event', e),
    approvalRequest: (p) => call('approval.request', p),
    questionRequest: (p) => call('question.request', p),
    memoryChanged: () => call('memory.changed'),
    profilesReload: () => call('profile.event'),
    profileApplied: (p) => call('profile.applied', p),
    profilePluginToast: (m, p) => call(m, p),
    toolInput: (p) => call('thread.tool_input', p),
    textDelta: (p) => call('thread.text_delta', p),
    graphProgress: (p) => call('graph.progress', p),
    graphDone: (p) => call('graph.done', p),
  };
}

function envelope(method: string, params: Record<string, unknown> = {}): { method: string; params: Record<string, unknown> } {
  return { method, params };
}

test('每个已登记 method 都路由到对应处理器（载荷原样透传）', () => {
  const h = stubHandlers();
  const payload = { threadId: 't' };
  routeStreamMessage(envelope('thread.event', { event: { id: 'e1' } }), h);
  routeStreamMessage(envelope('approval.request', payload), h);
  routeStreamMessage(envelope('question.request', payload), h);
  routeStreamMessage(envelope('memory.changed'), h);
  routeStreamMessage(envelope('profile.event'), h);
  routeStreamMessage(envelope('profile.applied', payload), h);
  routeStreamMessage(envelope('profile.error', payload), h);
  routeStreamMessage(envelope('plugin.loaded', payload), h);
  routeStreamMessage(envelope('thread.tool_input', payload), h);
  routeStreamMessage(envelope('thread.text_delta', payload), h);
  routeStreamMessage(envelope('graph.progress', payload), h);
  routeStreamMessage(envelope('graph.done', payload), h);
  const names = h.calls.map((c) => c.name);
  assert.deepEqual(names, [
    'thread.event', 'approval.request', 'question.request', 'memory.changed',
    'profile.event', 'profile.applied', 'profile.error', 'plugin.loaded',
    'thread.tool_input', 'thread.text_delta', 'graph.progress', 'graph.done',
  ]);
  assert.deepEqual(h.calls[0]?.arg, { id: 'e1' });
  assert.deepEqual(h.calls[1]?.arg, payload);
  // 三族提示 method 原样传给实现（toast 文案按 method 区分）。
  assert.deepEqual(h.calls[6]?.arg, payload);
});

test('未登记的 method 静默忽略（服务端新增通知不崩旧前端）', () => {
  const h = stubHandlers();
  routeStreamMessage(envelope('future.thing', { a: 1 }), h);
  assert.equal(h.calls.length, 0);
});
