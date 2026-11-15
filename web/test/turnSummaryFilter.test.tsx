/**
 * 回合结果卡：本轮新建后又被删除的临时文件必须自动退场（2026-11-15 用户截图）。
 *
 * 之前只在用户点击行、打开失败后才移除；截图上临时脚本仍列在「新建的文件」里。
 * 现在挂载时用 `onCheckFile` 主动核对 created 行，不存在即摘掉。
 */
// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { act, render } from '@testing-library/react';
import { TurnSummaryCard } from '../src/ui/components/stream/TurnSummaryCard.tsx';
import type { ThreadEvent } from '../src/types/models.ts';

/** 造一条写工具事件（回执成功）。 */
function writeEvent(id: string, path: string): ThreadEvent[] {
  return [
    { id: `${id}-call`, type: 'tool_call', timestamp: 1, payload: { callId: id, name: 'write_file', args: { path } } },
    {
      id: `${id}-res`,
      type: 'tool_result',
      timestamp: 2,
      payload: { callId: id, ok: true, output: `已写入 ${path}` },
    },
  ];
}

test('临时文件写后删除：自动从「新建的文件」消失，真实产物保留', async () => {
  const events: ThreadEvent[] = [
    { id: 'u1', type: 'user', timestamp: 1, payload: { content: '清理临时脚本' } },
    ...writeEvent('c1', 'scripts/tmp-probe.ts'),
    ...writeEvent('c2', 'backend/scripts/verify-api-contract.ts'),
  ];
  const { container } = render(
    <TurnSummaryCard
      events={events}
      onCheckFile={(path) => Promise.resolve(path !== 'scripts/tmp-probe.ts')}
    />,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const names = [...container.querySelectorAll('.ts-file .ts-name')].map((el) => el.textContent);
  assert.ok(!names.includes('tmp-probe.ts'), `已删除的临时文件不应出现：${names.join(',')}`);
  assert.ok(names.includes('verify-api-contract.ts'), '真实交付物必须保留');
});

test('查询失败时 fail-open：不误删真实产物', async () => {
  const events: ThreadEvent[] = [
    { id: 'u1', type: 'user', timestamp: 1, payload: { content: '写文件' } },
    ...writeEvent('c1', 'scripts/keep.ts'),
  ];
  const { container } = render(
    <TurnSummaryCard
      events={events}
      onCheckFile={() => Promise.reject(new Error('network down'))}
    />,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.match(container.textContent ?? '', /keep\.ts/u);
});
