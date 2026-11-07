// 授权失效横幅判据（2026-11-08 升级为「就地换令牌」后补齐）：401 → 横幅出现 → 提交新令牌
// → authToken 生效 + omni:token-updated 派发 + 横幅收起；重复事件幂等；dismiss 无害。
//
// 直跑（web 测试统一入口）：npm run web:test
// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

const { installAuthRequiredBanner, dismissAuthBanner } = await import(
  '../src/ui/authRequiredBanner.ts'
);
const { authToken } = await import('../src/core/authToken.ts');

afterEach(() => {
  dismissAuthBanner();
  authToken.set('');
});

test('omni:auth-required ⇒ 横幅出现（含令牌输入与「连接」按钮）；重复事件幂等', () => {
  installAuthRequiredBanner();
  window.dispatchEvent(new CustomEvent('omni:auth-required'));
  const banner = document.getElementById('omni-auth-banner');
  assert.notEqual(banner, null, '401 后必须出现横幅');
  assert.notEqual(banner?.querySelector('input'), null, '必须提供就地换令牌的输入框');
  assert.equal(
    [...(banner?.querySelectorAll('button') ?? [])].some((b) => b.textContent === '连接'),
    true,
  );

  window.dispatchEvent(new CustomEvent('omni:auth-required'));
  assert.equal(document.querySelectorAll('#omni-auth-banner').length, 1, '重复事件只挂一次');
});

test('提交新令牌 ⇒ authToken 覆盖生效 + omni:token-updated 派发 + 横幅收起', () => {
  installAuthRequiredBanner();
  let updated = 0;
  window.addEventListener('omni:token-updated', () => {
    updated += 1;
  });

  window.dispatchEvent(new CustomEvent('omni:auth-required'));
  const input = document.querySelector('#omni-auth-banner input') as HTMLInputElement;
  input.value = ' brand-new-token ';
  const button = [...document.querySelectorAll('#omni-auth-banner button')].find(
    (b) => b.textContent === '连接',
  ) as HTMLButtonElement;
  button.click();

  assert.equal(authToken.resolve(), 'brand-new-token', '粘贴值必须去空白后进覆盖层');
  assert.equal(updated, 1, '必须派发 omni:token-updated（AppController 据此重建 SSE 流）');
  assert.equal(document.getElementById('omni-auth-banner'), null, '提交后横幅收起');

  // 空值提交不得误触发换令牌流程。
  window.dispatchEvent(new CustomEvent('omni:auth-required'));
  (document.querySelector('#omni-auth-banner input') as HTMLInputElement).value = '   ';
  const submit2 = [...document.querySelectorAll('#omni-auth-banner button')].find(
    (b) => b.textContent === '连接',
  ) as HTMLButtonElement;
  submit2.click();
  assert.equal(updated, 1, '空令牌提交必须被忽略');
  assert.notEqual(document.getElementById('omni-auth-banner'), null, '横幅保持等待有效输入');
});

test('dismissAuthBanner：流重连成功后收起残留横幅；无横幅时无害', () => {
  installAuthRequiredBanner();
  dismissAuthBanner(); // 无横幅时调用不得抛
  window.dispatchEvent(new CustomEvent('omni:auth-required'));
  assert.notEqual(document.getElementById('omni-auth-banner'), null);
  dismissAuthBanner();
  assert.equal(document.getElementById('omni-auth-banner'), null);
});
