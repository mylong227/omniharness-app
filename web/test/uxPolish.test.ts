/**
 * 本轮体验打磨的接线判据（2026-11-15）：移动端设置入口、会话分组键盘语义、事件详情按钮。
 *
 * 这些是"结构一改就静默退化"的点（按钮变回 div、入口被移动端样式藏掉），
 * 用源码级接线守卫比快照更稳：只钉契约，不钉像素。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const CHAT_HEADER = readFileSync('web/src/ui/components/ChatHeader.tsx', 'utf8');
const STREAM_VIEW = readFileSync('web/src/ui/components/StreamView.tsx', 'utf8');
const SESSION_VIEWS = readFileSync('web/src/ui/components/SessionViews.tsx', 'utf8');
const APP = readFileSync('web/src/ui/App.ts', 'utf8');

test('移动端顶栏有设置入口（桌面仍走左栏页脚，不重复占位）', () => {
  assert.match(CHAT_HEADER, /onOpenSettings\?: \(\) => void/u);
  assert.match(CHAT_HEADER, /aria-label=\{t\('打开设置'\)\}/u);
  assert.match(CHAT_HEADER, /className="iconbtn mob-only"/u);
  assert.match(APP, /onOpenSettings: \(\) => ctrl\.settings\.open\('general'\)/u);
});

test('会话时间分组头是可展开按钮（不再是 div onClick）', () => {
  assert.match(
    SESSION_VIEWS,
    /<button[\s\S]{0,120}className="ws-head"[\s\S]{0,160}aria-expanded=\{!isCollapsed\}/u,
  );
  assert.doesNotMatch(SESSION_VIEWS, /<div className="ws-head" onClick/u);
  assert.equal(
    (SESSION_VIEWS.match(/className="ws-head"/gu) ?? []).length,
    (SESSION_VIEWS.match(/aria-expanded=\{!isCollapsed\}/gu) ?? []).length,
    '每个 ws-head 都必须带 aria-expanded（工作区/时间两种分组）',
  );
});

test('事件卡片有键盘可达的详情按钮（卡片点按只是鼠标捷径）', () => {
  assert.match(STREAM_VIEW, /className="ev-open"/u);
  assert.match(STREAM_VIEW, /aria-label=\{t\('查看事件详情'\)\}/u);
  assert.match(STREAM_VIEW, /e\.stopPropagation\(\);\s*ctx\.onEventClick\(ev\);/u);
});

test('设置字段行带 data-field-id（搜索跳转的锚点），搜索组件常驻左栏', () => {
  const consoleUi = readFileSync('web/src/ui/components/console/ConsoleUI.tsx', 'utf8');
  const consoleView = readFileSync('web/src/ui/components/console/ConsoleView.tsx', 'utf8');
  assert.match(consoleUi, /dataFieldId=\{id\}/u);
  assert.match(consoleUi, /'data-field-id': dataFieldId/u);
  assert.match(consoleView, /<SettingsSearchBox pick=\{pick\} contentRef=\{contentRef\} \/>/u);
  assert.match(consoleView, /\[data-field-id="\$\{CSS\.escape\(id\)\}"\]/u);
});
