import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';
import { ProofTurnSlicer } from '../src/apps/server/services/proof/proofTurnSlicer.ts';
import { FleetLaneParser } from '../src/apps/server/services/fleet/fleetLaneParser.ts';

/** 构造一条最小会话事件。 */
function event(index: number, type: SessionEvent['type'], payload: unknown = {}): SessionEvent {
  return {
    id: `evt_${String(index)}`,
    sessionId: 'sess_test',
    type,
    timestamp: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    payload,
  };
}

test('ProofTurnSlicer：系统回合不占用用户轮次，首个人类回合从 1 开始', () => {
  const slices = ProofTurnSlicer.slice([
    event(0, 'system', { content: 'boot' }),
    event(1, 'assistant', { content: 'hi' }),
    event(2, 'user', { content: 'first' }),
    event(3, 'assistant', { content: 'a1' }),
    event(4, 'user', { content: 'second' }),
    event(5, 'assistant', { content: 'a2' }),
  ]);
  assert.deepEqual(
    slices.map((s) => ({ index: s.turnIndex, display: s.displayIndex, system: s.systemTurn })),
    [
      { index: 0, display: 0, system: true },
      { index: 1, display: 1, system: false },
      { index: 2, display: 2, system: false },
    ],
  );
  assert.equal(ProofTurnSlicer.eventsOf([], slices[1]!).length, 0, '空事件流切片为空');
});

test('ProofTurnSlicer：正常首条 user 不产生系统回合', () => {
  const slices = ProofTurnSlicer.slice([
    event(0, 'user', { content: 'one' }),
    event(1, 'assistant', { content: 'a' }),
    event(2, 'user', { content: 'two' }),
  ]);
  assert.deepEqual(slices.map((s) => [s.turnIndex, s.displayIndex, s.systemTurn]), [
    [0, 1, false],
    [1, 2, false],
  ]);
});

test('FleetLaneParser：subagent 结果文本解析为诚实状态与补丁信息', () => {
  const output = [
    '[子智能体 sess_child_1] 18 步 / 1200ms 未完成：达步数上限',
    '改动文件：src/a.ts、src/b.ts',
    'patch 在 `.omniharness/subagent-patches/sess_child_1.patch`',
  ].join('\n');
  const nodes = FleetLaneParser.parse(
    [
      event(0, 'tool_call', { callId: 'c1', name: 'subagent', args: { task: '补类型' } }),
      event(1, 'tool_result', { callId: 'c1', ok: true, output }),
    ],
    'sess_parent',
  );
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.childSessionId, 'sess_child_1');
  assert.equal(nodes[0]?.status, 'truncated', 'truncated 必须优先于 ok');
  assert.equal(nodes[0]?.steps, 18);
  assert.equal(nodes[0]?.durationMs, 1200);
  assert.deepEqual(nodes[0]?.changedFiles, ['src/a.ts', 'src/b.ts']);
  assert.equal(nodes[0]?.patchPath, '.omniharness/subagent-patches/sess_child_1.patch');
});

test('FleetLaneParser：运行中的 lane 不补 0，保留未上报语义', () => {
  const nodes = FleetLaneParser.parse(
    [event(0, 'tool_call', { callId: 'c1', name: 'subagent', args: { task: '还在跑' } })],
    'sess_parent',
  );
  assert.equal(nodes[0]?.status, 'running');
  assert.equal(nodes[0]?.steps, undefined);
  assert.equal(nodes[0]?.tokens, undefined);
  assert.equal(nodes[0]?.changedFiles, undefined);
});

test('FleetLaneParser：非 subagent 调用不产生车道', () => {
  const nodes = FleetLaneParser.parse(
    [event(0, 'tool_call', { callId: 'c1', name: 'read_file', args: { path: 'a' } })],
    'sess_parent',
  );
  assert.equal(nodes.length, 0);
});
