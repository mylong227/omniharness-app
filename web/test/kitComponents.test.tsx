// 判据：ui/kit 骨架（W1）。kit 是业务组件消费 antd 的唯一封装层，
// 契约：① 真实渲染（真 React + jsdom）；② testId 透传成 data-testid；③ 文案/语义正确。

// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, test } from 'vitest';

import * as React from 'react';
import { ThemeProvider } from '../src/ui/theme/ThemeProvider.tsx';
import { PanelSection } from '../src/ui/kit/PanelSection.tsx';
import { StatusTag } from '../src/ui/kit/StatusTag.tsx';
import { EmptyState } from '../src/ui/kit/EmptyState.tsx';

afterEach(cleanup);

/** 统一包裹：kit 组件默认假定处于 ThemeProvider 之下（与 App 装配一致）。 */
function ui(node: React.ReactElement): React.ReactElement {
  return React.createElement(ThemeProvider, { theme: 'dark' }, node);
}

test('PanelSection：标题 + 说明 + 内容结构', () => {
  render(
    ui(
      React.createElement(
        PanelSection,
        { title: '上下文构成', description: '两种口径不再混用', testId: 'cap-card' },
        React.createElement('p', null, '正文内容'),
      ),
    ),
  );
  assert.ok(screen.getByTestId('cap-card'));
  assert.ok(screen.getByText('上下文构成'));
  assert.ok(screen.getByText('两种口径不再混用'));
  assert.ok(screen.getByText('正文内容'));
});

test('StatusTag：五种语义全部可渲染', () => {
  for (const status of ['ok', 'warn', 'err', 'info', 'neutral'] as const) {
    render(
      ui(
        React.createElement(StatusTag, { status, testId: `tag-${status}` }, status),
      ),
    );
    assert.ok(screen.getByTestId(`tag-${status}`));
    assert.ok(screen.getByText(status));
    cleanup();
  }
});

test('EmptyState：标题 + 提示 + 动作', () => {
  render(
    ui(
      React.createElement(EmptyState, {
        title: '还没有会话',
        hint: '点「新会话」开始',
        action: React.createElement('button', { type: 'button' }, '新会话'),
        testId: 'empty-sessions',
      }),
    ),
  );
  assert.ok(screen.getByTestId('empty-sessions'));
  assert.ok(screen.getByText('还没有会话'));
  assert.ok(screen.getByText(/点「新会话」开始/));
  assert.ok(screen.getByText('新会话'));
});
