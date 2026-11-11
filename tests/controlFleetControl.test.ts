import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ToolCall, ToolContext, ToolPort, ToolResult } from '../src/host/kernel/contracts.ts';
import {
  FleetControlRegistry,
  FleetToolPort,
} from '../src/apps/server/services/fleet/fleetControlRegistry.ts';

test('FleetControlRegistry：单独取消只 abort 该调用，父信号仍可联动', async () => {
  const registry = new FleetControlRegistry();
  const parent = new AbortController();
  const call: ToolCall = {
    id: 'call_1',
    name: 'subagent',
    arguments: { task: '补类型' },
  };
  const context: ToolContext = { sessionId: 'parent', workspaceRoot: 'D:/work', signal: parent.signal };
  const signal = registry.begin(call, context);
  assert.equal(signal.aborted, false);
  assert.equal(registry.list().length, 1);
  const canceled = registry.cancel('call_1');
  assert.equal(canceled.ok, true);
  assert.equal(signal.aborted, true);
  registry.finish('call_1');
  assert.equal(registry.list().length, 0);
  assert.equal(registry.cancel('call_1').ok, false);
});

test('FleetToolPort：subagent 调用拿到可取消子信号，普通工具原样透传', async () => {
  const registry = new FleetControlRegistry();
  const seen: string[] = [];
  let captured: AbortSignal | undefined;
  const result: ToolResult = { callId: 'call_1', ok: true, output: 'done' };
  let release: (() => void) | undefined;
  const inner = {
    name: 'test-tools',
    list: () => [],
    execute: async (call: ToolCall, context: ToolContext) => {
      seen.push(call.name);
      if (call.name === 'subagent') captured = context.signal;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return result;
    },
  } satisfies ToolPort;
  const port = new FleetToolPort(inner, registry);
  const parent = new AbortController();
  const subagent: ToolCall = { id: 'call_1', name: 'subagent', arguments: { task: 'x' } };
  const context: ToolContext = { sessionId: 'p', workspaceRoot: 'D:/work', signal: parent.signal };
  const pending = port.execute(subagent, context);
  await Promise.resolve();
  assert.ok(captured !== undefined);
  assert.equal(registry.cancel('call_1').ok, true);
  assert.equal(captured?.aborted, true);
  release?.();
  await pending;
  assert.deepEqual(seen, ['subagent']);
  assert.equal(registry.list().length, 0);
});
