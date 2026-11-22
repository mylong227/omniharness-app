// 右栏开合偏好解析：显式偏好优先，没有偏好时才按视口自动收起。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  RIGHT_AUTO_COLLAPSE_BELOW,
  RightPanePreference,
} from '../src/ui/models/RightPanePreference.ts';

test('RightPanePreference：显式收起 / 展开优先于视口宽度', () => {
  assert.equal(RightPanePreference.resolve('1', 1600), true, '明确收过就保持收起');
  assert.equal(RightPanePreference.resolve('', 900), false, '明确展开过就尊重选择');
});

test('RightPanePreference：没有偏好时，窄视口自动收起、宽视口展开', () => {
  assert.equal(
    RightPanePreference.resolve(null, RIGHT_AUTO_COLLAPSE_BELOW - 1),
    true,
    '低于阈值应收起',
  );
  assert.equal(
    RightPanePreference.resolve(null, RIGHT_AUTO_COLLAPSE_BELOW),
    false,
    '恰好等于阈值应展开',
  );
  assert.equal(RightPanePreference.resolve(null, 1600), false, '宽屏展开');
});

test('RightPanePreference：NaN 视口按展开处理（不让脏值把右栏藏掉）', () => {
  assert.equal(RightPanePreference.resolve(null, Number.NaN), false);
  assert.equal(RightPanePreference.resolve(null, -1), true, '负数仍按「窄视口」处理');
});
