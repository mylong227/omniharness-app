// @vitest-environment jsdom
// 计划坞（TodoDock）+ 流内待办摘要判据（2026-11-27「重复了 / 收不起来 / 没同步」三连修复）：
//  · 开合纪律：<details> 非受控——只在「进行项从无到有」时自动展开一次，
//    用户折叠不被后续渲染掰回（此前 open={current !== undefined} 受控口径的回归钉）；
//  · 快照时刻：updatedAt>0 显示、缺省不显示（陈旧可读化，不伪造完成态）；
//  · todoBrief：完成计数 / 首个进行项口径与 todoView 同词表（completed|done / in_progress|doing）；
//  · TodoDockModel.latest：倒扫取最新快照 + 时刻归一（毫秒与 ISO 双形态）。
import assert from 'node:assert/strict';
import * as React from 'react';
import { test } from 'vitest';
import { cleanup, fireEvent, render } from './rtlHarness.ts';
import { TodoDock } from '../src/ui/components/TodoDock.tsx';
import { TodoDockModel } from '../src/ui/models/TodoDockModel.ts';
import { todoBrief } from '../src/ui/format.ts';
import { renderTodoNode } from '../src/ui/components/stream/EventNodeRenderers.tsx';

/** 造一份待办：statuses 依序生成「任务1..n」。 */
function todoListOf(statuses: readonly string[]): { content: string; status: string }[] {
  return statuses.map((status, i) => ({ content: `任务${String(i + 1)}`, status }));
}

/** 造一条 todo 事件桩。 */
function todoEvent(todos: unknown, timestamp?: number | string): Record<string, unknown> {
  return {
    id: 'ev1',
    type: 'todo',
    ...(timestamp !== undefined ? { timestamp } : {}),
    payload: { todos },
  };
}

test('模型：倒扫取最新 todo 快照，忽略中间非 todo 事件', () => {
  const events = [
    todoEvent(todoListOf(['completed']), 1000),
    { id: 'x', type: 'assistant', payload: {} },
    todoEvent(todoListOf(['in_progress', 'pending']), 2000),
  ];
  const snap = TodoDockModel.latest(events as never);
  assert.ok(snap !== null);
  assert.strictEqual(snap.items.length, 2);
  assert.strictEqual(snap.items[0]?.status, 'in_progress');
  assert.strictEqual(snap.at, 2000);
});

test('模型：时刻 ISO 串与毫秒双形态归一；无时间戳则 at 缺省', () => {
  const iso = TodoDockModel.latest([todoEvent(todoListOf(['pending']), '2026-11-27T10:00:00Z')] as never);
  assert.ok(iso !== null && iso.at === Date.parse('2026-11-27T10:00:00Z'));
  const bare = TodoDockModel.latest([{ id: 'e', type: 'todo', payload: { todos: [] } }] as never);
  assert.ok(bare !== null && bare.at === undefined);
});

test('模型：没有 todo 事件 / todos 非数组 → null', () => {
  assert.strictEqual(TodoDockModel.latest([{ id: 'a', type: 'user', payload: {} }] as never), null);
  assert.strictEqual(TodoDockModel.latest([todoEvent('bad')] as never), null);
});

test('todoBrief：完成计数与首个进行项（新旧两套词表同口径）', () => {
  const brief = todoBrief([
    { content: 'a', status: 'completed' },
    { content: 'b', status: 'done' },
    { content: 'c', status: 'in_progress' },
    { content: 'd', status: 'doing' },
    { content: 'e', status: 'pending' },
  ]);
  assert.strictEqual(brief.total, 5);
  assert.strictEqual(brief.done, 2);
  assert.strictEqual(brief.current, 'c');
  assert.strictEqual(todoBrief([]).current, undefined);
});

test('坞：items 空 / null 不渲染', () => {
  const empty = render(React.createElement(TodoDock, { items: todoListOf([]) }));
  assert.strictEqual(empty.container.querySelector('.todo-dock'), null);
  const nil = render(React.createElement(TodoDock, { items: null }));
  assert.strictEqual(nil.container.querySelector('.todo-dock'), null);
});

test('坞：挂载即有进行项 → 自动展开一次', () => {
  const ui = render(React.createElement(TodoDock, { items: todoListOf(['in_progress', 'pending']) }));
  const details = ui.container.querySelector('.todo-dock');
  assert.ok(details !== null);
  assert.strictEqual(details.open, true);
});

test('坞：挂载无进行项 → 收起；用户展开后重渲染保持展开（尊重用户）', () => {
  const ui = render(React.createElement(TodoDock, { items: todoListOf(['completed', 'pending']) }));
  const details = ui.container.querySelector('.todo-dock');
  assert.ok(details !== null);
  assert.strictEqual(details.open, false);
  fireEvent.click(ui.container.querySelector('.todo-dock__summary') as Element);
  assert.strictEqual(details.open, true);
  ui.rerender(React.createElement(TodoDock, { items: todoListOf(['completed', 'pending']) }));
  assert.strictEqual(details.open, true);
});

test('坞（回归钉）：用户折叠后重渲染（仍有进行项）不被掰回', () => {
  const ui = render(React.createElement(TodoDock, { items: todoListOf(['in_progress', 'pending']) }));
  const details = ui.container.querySelector('.todo-dock');
  assert.ok(details !== null && details.open === true);
  fireEvent.click(ui.container.querySelector('.todo-dock__summary') as Element);
  assert.strictEqual(details.open, false);
  // 换一份新清单（内容变化、引用变化、仍有进行项）——旧受控口径会在这一步把它掰开。
  ui.rerender(React.createElement(TodoDock, { items: todoListOf(['in_progress', 'completed']) }));
  assert.strictEqual(details.open, false);
});

test('坞：进行项从无到有（跨回合新写待办）→ 重新自动展开', () => {
  const ui = render(React.createElement(TodoDock, { items: todoListOf(['completed']) }));
  const details = ui.container.querySelector('.todo-dock');
  assert.ok(details !== null && details.open === false);
  ui.rerender(React.createElement(TodoDock, { items: todoListOf(['completed', 'in_progress']) }));
  assert.strictEqual(details.open, true);
});

test('坞：快照时刻徽标——有则显示、0 缺省不显示', () => {
  const withTime = render(
    React.createElement(TodoDock, { items: todoListOf(['pending']), updatedAt: 1700000000000 }),
  );
  assert.ok(withTime.container.querySelector('.todo-dock__time') !== null);
  const noTime = render(React.createElement(TodoDock, { items: todoListOf(['pending']) }));
  assert.strictEqual(noTime.container.querySelector('.todo-dock__time'), null);
});

test('流内待办卡：折叠摘要（计数 + 当前项），展开体含全量留痕', () => {
  const node = (inner: React.ReactElement): React.ReactElement =>
    React.createElement('div', { className: 'ev' }, inner);
  const ui = render(
    renderTodoNode({ todos: todoListOf(['in_progress', 'pending', 'pending']) }, node),
  );
  const details = ui.container.querySelector('details.todo-event');
  assert.ok(details !== null, '待办事件卡应是可折叠 details');
  assert.strictEqual(details.open, false, '历史卡默认折叠');
  const summary = details.querySelector('.todo-event__summary');
  assert.ok(summary !== null);
  assert.ok(summary.textContent?.includes('0/3'), '摘要应含完成计数');
  assert.ok(summary.textContent?.includes('任务1'), '摘要应含当前进行项');
  assert.strictEqual(details.querySelectorAll('.todo-item').length, 3, '展开体保留全量留痕');
});
