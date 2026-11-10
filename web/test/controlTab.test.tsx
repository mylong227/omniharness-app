// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppContext, type AppContextValue } from '../src/ui/context.ts';
import { ControlTab } from '../src/ui/components/tabs/ControlTab.tsx';
import type { ControlView } from '../src/ui/components/tabs/ControlTab.tsx';

/** 最小 App 上下文（控制室空态不调 API）。 */
function contextOf(): AppContextValue {
  return {
    api: {} as AppContextValue['api'],
    toast: () => {},
    dialog: {} as AppContextValue['dialog'],
    sessionId: null,
    sessionTick: 0,
  };
}

afterEach(cleanup);

test('ControlTab：三模式 tab 有 ARIA 关系，未知 view 落回编队', () => {
  render(
    <AppContext.Provider value={contextOf()}>
      <ControlTab threadId={null} view="unknown" onNavigate={() => {}} />
    </AppContext.Provider>,
  );
  const tabs = screen.getAllByRole('tab');
  assert.deepEqual(
    tabs.map((tab) => tab.textContent),
    ['编队', '上下文', '凭证'],
  );
  assert.equal(tabs[0]?.getAttribute('aria-selected'), 'true');
  assert.equal(tabs[0]?.getAttribute('aria-controls'), 'control-panel-fleet');
  assert.equal(document.querySelector('#control-panel-fleet')?.getAttribute('role'), 'tabpanel');
  assert.match(document.body.textContent ?? '', /先选择一个会话/u);
});

test('ControlTab：点击与方向键都经 onNavigate 切 view（不复制第二份状态）', () => {
  const picked: ControlView[] = [];

  /** 受控宿主：模拟 App 根据 onNavigate 更新 view（真实路由收口的最小替身）。 */
  function Host(): React.ReactElement {
    const [view, setView] = React.useState<ControlView>('fleet');
    return (
      <ControlTab
        threadId={null}
        view={view}
        onNavigate={(next) => {
          picked.push(next);
          setView(next);
        }}
      />
    );
  }

  render(
    <AppContext.Provider value={contextOf()}>
      <Host />
    </AppContext.Provider>,
  );
  fireEvent.click(screen.getByRole('tab', { name: '上下文' }));
  fireEvent.keyDown(screen.getByRole('tab', { name: '上下文' }), { key: 'ArrowRight' });
  assert.deepEqual(picked, ['context', 'proof']);
  assert.equal(screen.getByRole('tab', { name: '凭证' }).getAttribute('aria-selected'), 'true');
});
