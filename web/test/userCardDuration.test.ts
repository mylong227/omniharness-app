// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { renderFacade } from './rtlHarness.ts';
import { allText, byClass } from './domFacade.ts';
import { fireEvent } from './rtlHarness.ts';

const { UserCard } = await import('../src/ui/components/stream/UserCard.tsx');

const EV = {
  id: 'u1',
  type: 'user',
  timestamp: 1_700_000_000_000,
  payload: { content: 'hello' },
} as never;

test('用户消息头显示本段独立用时', () => {
  const { node } = renderFacade(UserCard, {
    props: { ev: EV, canEdit: false, turnDurationMs: 65_000, onEdit: () => {} },
  });
  assert.match(allText(node), /本轮用时 1分5秒/u);
  assert.strictEqual(byClass(node, 'turn-duration').length, 1);
});

test('不足 1 秒/缺省不显示（避免无信息量的 0秒）', () => {
  const short = renderFacade(UserCard, {
    props: { ev: EV, canEdit: false, turnDurationMs: 500, onEdit: () => {} },
  });
  assert.strictEqual(byClass(short.node, 'turn-duration').length, 0);
  const absent = renderFacade(UserCard, { props: { ev: EV, canEdit: false, onEdit: () => {} } });
  assert.strictEqual(byClass(absent.node, 'turn-duration').length, 0);
});

test('历史用户消息：显示「从此处重开」且不显示编辑重发；最后一条反之', () => {
  let rewinds = 0;
  const history = renderFacade(UserCard, {
    props: { ev: EV, canEdit: false, onEdit: () => {}, onRewind: () => (rewinds += 1) },
  });
  const rewindBtn = byClass(history.node, 'msg-act').find(
    (node) => node.props['aria-label'] === '从此处重开',
  );
  assert.ok(rewindBtn !== undefined, '历史消息应有「从此处重开」');
  fireEvent.click(rewindBtn!.el);
  assert.strictEqual(rewinds, 1);
  assert.ok(
    !allText(history.node).includes('编辑重发'),
    '历史消息不应显示只在末条出现的编辑重发',
  );

  const last = renderFacade(UserCard, {
    props: { ev: EV, canEdit: true, onEdit: () => {}, onRewind: () => (rewinds += 1) },
  });
  assert.ok(allText(last.node).includes('编辑重发'), '最后一条仍有编辑重发');
  assert.strictEqual(
    byClass(last.node, 'msg-act').filter((node) => node.props['aria-label'] === '从此处重开').length,
    0,
    '最后一条不重复显示重开',
  );
});
