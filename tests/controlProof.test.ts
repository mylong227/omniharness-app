import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SessionEvent, ToolDefinition } from '../src/host/kernel/contracts.ts';
import { ProofService } from '../src/apps/server/services/proof/proofService.ts';

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

/** 无工具 / 无审计链的依赖桩。 */
function serviceOf(events: readonly SessionEvent[], tools: readonly ToolDefinition[] = []): ProofService {
  return new ProofService({
    events: () => Promise.resolve(events),
    tools: () => tools,
    audit: () => undefined,
  });
}

test('ProofService：未签名时只报结构自洽，并完成事件/根/会话三项实测', async () => {
  const events = [event(0, 'user', { content: 'do it' }), event(1, 'assistant', { content: 'done' })];
  const service = serviceOf(events);
  const turns = await service.turnsOf('sess_test');
  assert.ok(Array.isArray(turns));
  assert.equal(turns.length, 1);
  assert.equal(turns[0]?.eventCount, 2);
  assert.equal(turns[0]?.displayIndex, 1);

  const bundle = await service.buildOf('sess_test', 0);
  assert.ok(!('ok' in bundle));
  assert.equal(bundle.state, 'structural');
  assert.equal(bundle.checks.find((c) => c.code === 'EVENT_COUNT')?.status, 'pass');
  assert.equal(bundle.checks.find((c) => c.code === 'EVENT_ROOT')?.status, 'pass');
  assert.equal(bundle.checks.find((c) => c.code === 'SESSION')?.status, 'pass');
  assert.equal(bundle.checks.find((c) => c.code === 'SIGNATURE')?.status, 'warn');
  assert.equal(bundle.certificate?.sessionId, 'sess_test');
});

test('ProofService：事件流不可读返回判别失败，不伪装成空回合列表', async () => {
  const service = new ProofService({
    events: () => Promise.reject(new Error('disk unavailable')),
    tools: () => [],
    audit: () => undefined,
  });
  const result = await service.turnsOf('sess_test');
  assert.ok('ok' in result && result.ok === false);
  assert.equal(result.code, 'proof_invalid');
  assert.match(result.message, /disk unavailable/u);
});

test('ProofService：非法回合下标返回判别失败，不抛 RPC 错误', async () => {
  const service = serviceOf([event(0, 'user', { content: 'x' })]);
  const result = await service.buildOf('sess_test', 9);
  assert.ok('ok' in result && result.ok === false);
  assert.equal(result.code, 'proof_invalid');
});

test('ProofService：导出包是本地 JSON 文本且文件名含回合', async () => {
  const service = serviceOf([event(0, 'user', { content: 'x' })]);
  const result = await service.exportOf('sess_test', 0);
  assert.ok(!('ok' in result));
  assert.match(result.filename, /^proof-sess_test-turn0-/u);
  assert.ok(result.size > 0);
  assert.doesNotThrow(() => JSON.parse(result.content));
});
