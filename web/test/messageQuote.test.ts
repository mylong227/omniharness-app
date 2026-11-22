// 消息引用追问（2026-11-17 粘性批次）纯逻辑判据。
//
// 组装语义：`>` 前缀逐行包裹 + 尾部空行（光标落追问位）；空正文不可引用（控制器据此
// toast 拒绝）；超长截断到 4000 字符 + 省略号（输入框 UX 边界，全文走导出）。
// 直跑：npx vitest run web/test/messageQuote.test.ts
import assert from 'node:assert/strict';
import { test } from 'vitest';

const { MessageQuote } = await import('../src/ui/models/MessageQuote.ts');

test('引用组装：逐行 > 包裹 + 尾部空行（光标落追问位）', () => {
  const out = MessageQuote.compose('第一行\n第二行');
  assert.strictEqual(out, '> 第一行\n> 第二行\n\n');
});

test('引用组装：空 / 空白正文返回 null（无可引用内容）', () => {
  assert.strictEqual(MessageQuote.compose(''), null);
  assert.strictEqual(MessageQuote.compose('   \n  '), null);
  assert.strictEqual(MessageQuote.compose(''), null);
});

test('引用组装：超长截断到 4000 字符 + 省略号', () => {
  const long = 'x'.repeat(4500);
  const out = MessageQuote.compose(long);
  assert.ok(out !== null);
  const body = out.slice(2, -2); // 去 '> ' 前缀与尾部 '\n\n'
  assert.strictEqual(body.length, 4001, '4000 字符 + 省略号');
  assert.ok(body.endsWith('…'));
});

test('引用组装：自带 > 前缀的嵌套引用不会破坏块结构', () => {
  const out = MessageQuote.compose('> 已是引用\n正文');
  assert.strictEqual(out, '> > 已是引用\n> 正文\n\n');
});
