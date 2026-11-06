// 专注模式布局状态（零 DOM、真 LayoutController）：进入时记住左右栏真实状态，退出原样恢复。
//
// 为什么单独测：专注模式最容易写错成「退出时把两栏都撑开」。用户可能在「右栏本就收起、左栏打开」
// 的布局里进入专注，退出必须回到那份布局，而不是重置成全开。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { AppHost, AppState } from '../src/ui/controllers/AppController.ts';

const { LayoutController } = await import('../src/ui/controllers/LayoutController.ts');

/** 最小状态：只放 LayoutController 会读写的字段，其余按 AppState 收窄。 */
function makeHost(initial: Partial<AppState> = {}) {
  const state = {
    leftOpen: false,
    rightOpen: false,
    rightCollapsed: false,
    focusMode: false,
    ...initial,
  } as AppState;
  const host = {
    patch(action: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) {
      Object.assign(state, typeof action === 'function' ? action(state) : action);
    },
    getState: () => state,
  } as AppHost;
  return { ctrl: new LayoutController(host), state };
}

test('专注模式：进入隐藏两栏，退出恢复进入前的真实布局', () => {
  const { ctrl, state } = makeHost({ leftOpen: true, rightCollapsed: false, rightOpen: true });
  ctrl.toggleFocus();
  assert.equal(state.focusMode, true);
  assert.equal(state.leftOpen, false, '专注时不保留左栏');
  assert.equal(state.rightOpen, false, '窄屏抽屉也不保留');
  assert.equal(state.rightCollapsed, true, '桌面右栏收起');

  ctrl.toggleFocus();
  assert.equal(state.focusMode, false);
  assert.equal(state.leftOpen, true, '退出恢复左栏打开');
  assert.equal(state.rightCollapsed, false, '退出恢复右栏展开');
  assert.equal(state.rightOpen, true, '退出恢复抽屉态');
});

test('专注模式：右栏本就收起时，退出仍是收起（不是全开）', () => {
  const { ctrl, state } = makeHost({ leftOpen: false, rightCollapsed: true });
  ctrl.toggleFocus();
  ctrl.toggleFocus();
  assert.equal(state.leftOpen, false);
  assert.equal(state.rightCollapsed, true);
});

test('专注模式：手动开合任一面板即退出专注', () => {
  const { ctrl, state } = makeHost({ rightCollapsed: false });
  ctrl.toggleFocus();
  assert.equal(state.focusMode, true);
  ctrl.toggleLeft();
  assert.equal(state.focusMode, false, '手动开左栏后不再是专注态');
  assert.equal(state.leftOpen, true);
});
