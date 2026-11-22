// 编队运行态接线判据（alpha.21/22）：内核 SubagentTree → FleetRegistry 的运行中子会话 id 链路。
//
// 背景：这条链路早已接线，但注释一度写着「接线待排期」，审计时容易被读成未实现。这里同时钉住
// ① 端口契约（父子树登记后，结果回传前就能查到子会话 id）与 ② 组合根的三处接线，防止将来某次
// 重构把 childOfCall 悄悄摘掉而判据仍然全绿。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';
import { SubagentTree } from '../src/host/kernel/core.ts';
import { FleetRegistry } from '../src/apps/server/services/fleet/fleetRegistry.ts';

/** 仓库根（本文件在 tests/ 下）。 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 构造一条 subagent 工具调用事件。
 * @param callId 工具调用 id
 * @param task 任务原文
 * @returns 最小合法会话事件
 */
function subagentCall(callId: string, task: string): SessionEvent {
  return {
    id: 'evt_1',
    sessionId: 'sess_parent',
    type: 'tool_call',
    timestamp: '2026-11-22T00:00:00.000Z',
    payload: { callId, name: 'subagent', args: { task } },
  };
}

test('父子树契约：link 之后 FleetRegistry 在结果回传前就给出 childSessionId', async () => {
  const tree = new SubagentTree();
  tree.link('sess_parent', 'sess_child_1', 'call_1');
  const registry = new FleetRegistry({
    events: () => Promise.resolve([subagentCall('call_1', '还在跑')]),
    workspaceRoot: () => 'D:/work',
    childOfCall: (callId) => tree.childOfCall(callId),
  });
  const snapshot = await registry.snapshotOf('sess_parent');
  assert.equal(snapshot.nodes.length, 1);
  assert.equal(snapshot.nodes[0]?.childSessionId, 'sess_child_1', '启动即登记，不必等 tool_result');
  assert.equal(snapshot.nodes[0]?.status, 'running');
  // 运行态指标内核不上报：必须保持未知，绝不能被填成 0。
  assert.equal(snapshot.nodes[0]?.steps, undefined);
  assert.equal(snapshot.nodes[0]?.tokens, undefined);
});

test('接线钉：ServerServices 把共享父子树接到 FleetRegistry.childOfCall', () => {
  const source = readFileSync(join(ROOT, 'src/apps/server/core/serverServices.ts'), 'utf8');
  assert.match(
    source,
    /childOfCall:\s*\(callId\)\s*=>\s*this\.subagentTree\.childOfCall\(callId\)/u,
    'FleetRegistry 必须从同一父子树取运行中子会话 id',
  );
});

test('接线钉：AgentRuntimeHost 把同一父子树注入内核配置', () => {
  const source = readFileSync(join(ROOT, 'src/apps/server/core/agentRuntimeHost.ts'), 'utf8');
  assert.match(source, /subagentTree:\s*this\.deps\.subagentTree/u, '编排器与编队必须共用同一实例');
});

test('接线钉：serve 组合根在 buildConfig 之前创建父子树并注入', () => {
  const source = readFileSync(join(ROOT, 'src/apps/cli/cliServerCmds.ts'), 'utf8');
  assert.match(source, /const subagentTree = new SubagentTree\(\)/u, '必须在 buildConfig 前创建');
  assert.match(source, /subagentTree,/u, '必须随配置传给内核');
});
