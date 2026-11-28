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
const TITLEBAR = readFileSync('web/src/ui/components/TitlebarStrip.tsx', 'utf8');

test('桌面标题条不重复品牌/项目（只留窗口操作）', () => {
  assert.doesNotMatch(TITLEBAR, /titlebar-brand|titlebar-workspace|titlebar-name/u);
  assert.doesNotMatch(TITLEBAR, />\s*OmniHarness\s*</u);
  assert.doesNotMatch(TITLEBAR, /tb-quick-label|tb-quick-kbd/u, '快速提问收成图标，不再占一行文字');
  assert.match(TITLEBAR, /onQuickCapture/u, '快速提问仍保留');
});

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

test('事件卡片详情按钮：鼠标不可见（键盘专用），卡片点按仍是鼠标捷径', () => {
  assert.match(STREAM_VIEW, /className="ev-open"/u);
  assert.match(STREAM_VIEW, /aria-label=\{t\('查看事件详情'\)\}/u);
  assert.match(STREAM_VIEW, /e\.stopPropagation\(\);\s*ctx\.onEventClick\(ev\);/u);
  const CHAT_CSS = readFileSync('web/styles/chat.css', 'utf8');
  // 2026-11-27 用户口径「去掉」悬浮「…」：hover 不再显形，仅键盘 :focus-visible 显形。
  assert.doesNotMatch(CHAT_CSS, /\.ev:hover \.ev-open/u, '悬浮显形已移除——鼠标用户不应再看到「…」');
  assert.doesNotMatch(CHAT_CSS, /@media \(hover: none\)[\s\S]{0,40}\.ev-open/u, '触屏也不再半显形');
  assert.match(CHAT_CSS, /\.ev-open:focus-visible\s*\{[^}]*pointer-events:\s*auto/u, '键盘焦点显形且可激活');
  assert.match(CHAT_CSS, /\.ev-open\s*\{[^}]*pointer-events:\s*none/u, '隐形态不拦截指针（触屏不误触）');
});

test('设置字段行带 data-field-id（搜索跳转的锚点），搜索组件常驻左栏', () => {
  const consoleUi = readFileSync('web/src/ui/components/console/ConsoleUI.tsx', 'utf8');
  const consoleView = readFileSync('web/src/ui/components/console/ConsoleView.tsx', 'utf8');
  assert.match(consoleUi, /dataFieldId=\{id\}/u);
  assert.match(consoleUi, /'data-field-id': dataFieldId/u);
  assert.match(consoleView, /<SettingsSearchBox pick=\{pick\} contentRef=\{contentRef\} \/>/u);
  assert.match(consoleView, /\[data-field-id="\$\{CSS\.escape\(id\)\}"\]/u);
});
