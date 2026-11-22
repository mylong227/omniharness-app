/**
 * 轨迹视图版式判据（2026-11-15 用户截图：内容贴左、状态/时间被甩到极右，与对话卡错位）。
 *
 * 钉三件事：
 * 1. 轨迹与对话共用同一条 800px（专注 920px）居中正文列；
 * 2. 外层内边距与 `.stream` 一致（22/28/10），否则两条内容轴仍会差一截；
 * 3. `TraceView` 的头部与列表确实包在 `.trace-inner` 内（只改 CSS 不包容器 = 假对齐）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const SHELL = readFileSync('web/styles/shell.css', 'utf8');
const RESILIENCE = readFileSync('web/styles/resilience.css', 'utf8');
const VIEW = readFileSync('web/src/ui/components/TraceView.tsx', 'utf8');

test('轨迹与对话共用 800px 居中正文列（专注模式 920px）', () => {
  assert.match(SHELL, /\.trace-inner\s*\{[^}]*max-width:\s*800px[^}]*margin:\s*0 auto/su);
  assert.match(SHELL, /\.body\.focus \.trace-inner\s*\{[^}]*max-width:\s*920px/su);
});

test('轨迹外层内边距与 `.stream` 一致（22 / 28 / 10）', () => {
  assert.match(SHELL, /\.trace\s*\{[^}]*padding:\s*22px 28px 10px/su);
});

test('TraceView 的头部与列表包在 `.trace-inner` 内（只改 CSS 不算对齐）', () => {
  assert.match(VIEW, /className="trace-inner"/u);
  const inner = VIEW.indexOf('className="trace-inner"');
  const head = VIEW.indexOf('className="trace-head"');
  const list = VIEW.indexOf('className="trace-list"');
  assert.ok(inner >= 0 && head > inner && list > inner, 'trace-head / trace-list 必须在 trace-inner 之后');
});

test('窄窗与对话同步回收（≤880 内边距 / ≤640 满宽）', () => {
  assert.match(RESILIENCE, /@media \(max-width: 880px\)[\s\S]*?\.trace\s*\{[^}]*padding:\s*14px 12px 4px/su);
  assert.match(RESILIENCE, /@media \(max-width: 640px\)[\s\S]*?\.trace-inner\s*\{[^}]*max-width:\s*100%/su);
});

test('时间列等宽右对齐（同一列数字不参差）', () => {
  assert.match(SHELL, /\.tr-time\s*\{[^}]*text-align:\s*right/su);
  assert.match(SHELL, /\.tr-time\s*\{[^}]*font-variant-numeric:\s*tabular-nums/su);
});
