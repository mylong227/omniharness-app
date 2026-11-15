/**
 * 审计记录折叠判据（2026-11-15 用户截图：一轮几十条 audit JSON 平铺，整屏重复单调）。
 *
 * 钉三条：
 * 1. 块构建把同一轮的 audit 事件收成**一个** `audit_group`（不是逐条 single）；
 * 2. 折叠块默认收起（details 无 open），摘要显示条数与记录类型分布；
 * 3. 展开体保留逐条原始负载（审计事实不丢，只是不在聊天流里铺开）。
 */

// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildDisplayBlocks } from '../src/ui/textUtils.ts';
import { renderAuditGroup } from '../src/ui/components/stream/EventNodeRenderers.tsx';
import { renderElement } from './rtlHarness.ts';
import type { ThreadEvent } from '../src/types/models.ts';

/** 造一条 audit 事件。 */
function auditEvent(id: string, kind: string, at: number): ThreadEvent {
  return {
    id,
    type: 'audit',
    timestamp: at,
    payload: { record: { kind, at: new Date(at).toISOString() }, prevHash: 'p', hash: 'h' },
  };
}

test('同一轮的多条 audit 收成一个 audit_group（不再逐条占聊天流）', () => {
  const events: ThreadEvent[] = [
    { id: 'u1', type: 'user', timestamp: 1, payload: { content: '做任务' } },
    auditEvent('a1', 'heartbeat', 2),
    auditEvent('a2', 'approval', 3),
    auditEvent('a3', 'decision', 4),
  ];
  const blocks = buildDisplayBlocks(events, false);
  const groups = blocks.filter((b) => b.kind === 'audit_group');
  assert.equal(groups.length, 1, '同一轮只允许一个审计折叠块');
  assert.equal(groups[0]?.events.length, 3);
  assert.equal(blocks.filter((b) => b.kind === 'single' && b.event.type === 'audit').length, 0);
});

test('折叠块默认收起，摘要给出条数与类型分布', () => {
  const events = [auditEvent('a1', 'heartbeat', 2), auditEvent('a2', 'approval', 3)];
  const { container } = renderElement(renderAuditGroup(events));
  const details = container.querySelector('details.audit-fold');
  assert.ok(details instanceof HTMLDetailsElement, '必须渲染成 details 折叠块');
  assert.equal(details.open, false, '默认必须收起（用户反馈太长）');
  const text = details.textContent ?? '';
  assert.match(text, /审计记录 × 2/u);
  assert.match(text, /heartbeat×1/u);
  assert.match(text, /approval×1/u);
  assert.equal(container.querySelectorAll('.audit-record').length, 2, '展开体保留逐条记录');
});

test('展开体逐条保留原始负载（审计事实不丢）', () => {
  const { container } = renderElement(renderAuditGroup([auditEvent('a1', 'decision', 2)]));
  const pre = container.querySelector('.audit-record__json');
  assert.ok(pre !== null);
  assert.match(pre.textContent ?? '', /"kind": "decision"/u);
});
