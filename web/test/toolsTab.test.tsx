// @vitest-environment jsdom
// 工具面板：清单行（名称 + 状态点 + 状态词）、点击定位回调、空态指引。
// 2026-11-12 antd 迁移后补：行从自写 div 换成 antd Button（真按钮语义）+ Badge 状态点，
// 这条判据钉住行的语义结构（button + 状态色映射 + 点击回环）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { fireEvent, renderFacadeAsync } from './rtlHarness.ts';
import { allText, byClass, byTag } from './domFacade.ts';
import { ToolsTab } from '../src/ui/components/tabs/ToolsTab.tsx';
import type { ToolItem } from '../src/ui/shared.ts';

test('ToolsTab：行是可聚焦按钮，状态点走 antd 语义色，点击定位到事件流', async () => {
  const shown: string[] = [];
  const items: ToolItem[] = [
    { callId: 'c1', name: 'shell', status: 'ok' },
    { callId: 'c2', name: 'read_file', status: 'pending' },
    { callId: 'c3', name: 'write_file', status: 'err' },
  ];
  const ui = await renderFacadeAsync(ToolsTab, {
    props: { toolItems: items, onShowTool: (callId: string) => shown.push(callId) },
  });
  const rows = byClass(ui.node, 'tool-item');
  assert.strictEqual(rows.length, 3, '每条工具调用一行');
  // 真按钮语义（迁移前 div+onClick 不可键盘达）。
  for (const row of rows) assert.strictEqual(row.type, 'button', '行必须是 button');
  const text = allText(ui.node);
  assert.match(text, /完成/u);
  assert.match(text, /失败/u);
  // 状态点语义色（挂在 dot 子层）：ok=success / err=error / pending=warning（旧 `--warn` 点色）。
  const dotClass = (row: ReturnType<typeof byClass>[number], cls: string): boolean =>
    byClass(row, cls).length > 0;
  assert.ok(dotClass(rows[0]!, 'ant-badge-status-success'), 'ok 行的状态点应为 success');
  assert.ok(dotClass(rows[1]!, 'ant-badge-status-warning'), 'pending 行的状态点应为 warning');
  assert.ok(dotClass(rows[2]!, 'ant-badge-status-error'), 'err 行的状态点应为 error');
  // 点击回环：定位到事件流对应卡片。
  fireEvent.click(rows[1]!.el);
  assert.deepStrictEqual(shown, ['c2']);
});

test('ToolsTab：空清单展示指引空态', async () => {
  const ui = await renderFacadeAsync(ToolsTab, {
    props: { toolItems: [], onShowTool: () => undefined },
  });
  assert.match(allText(ui.node), /暂无工具调用/u);
  assert.strictEqual(byTag(ui.node, 'button').length, 0, '空态不给可点的行');
});
