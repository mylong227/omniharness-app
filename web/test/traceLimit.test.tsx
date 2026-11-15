/**
 * 轨迹长列表渲染上限（2026-11-15 P2）：300 行先渲染，剩余手动展开。
 *
 * 139 条是常见长任务，1000+ 条时一次性挂全部行会拖慢滚动；这里钉住上限与「显示剩余」入口。
 */
// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { TraceView } from '../src/ui/components/TraceView.tsx';
import type { ThreadEvent } from '../src/types/models.ts';

test('超过 300 行先渲染 300 行，「显示剩余」再追加', () => {
  const events: ThreadEvent[] = [{ id: 'u', type: 'user', timestamp: 1, payload: { content: '跑' } }];
  for (let i = 0; i < 301; i += 1) {
    events.push({
      id: `c${String(i)}`,
      type: 'tool_call',
      timestamp: 2,
      payload: { callId: `c${String(i)}`, name: 'read_file', args: { path: `f${String(i)}.ts` } },
    } as ThreadEvent);
  }
  const { container } = render(<TraceView events={events} liveInputs={[]} toolResults={{}} />);
  assert.equal(container.querySelectorAll('.tr-row').length, 300, '首屏最多 300 行');
  const more = container.querySelector('.tr-more');
  assert.ok(more !== null, '必须有「显示剩余」按钮');
  assert.match(more.textContent ?? '', /1/u);
  fireEvent.click(more);
  assert.equal(container.querySelectorAll('.tr-row').length, 301, '点击后追加剩余行');
  assert.equal(container.querySelector('.tr-more'), null, '全部显示后按钮消失');
});
