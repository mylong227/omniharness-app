import { flatApiStub } from './rtlHarness.ts';
// 远端回合（打开「正在运行」的会话）的生命周期判据（2026-11-17 全面 review）。
//
// ## 缺陷形态
//
// `loadThread` 打开在跑会话时把磁盘态 running 写进 busy（2026-11-06 审计 P2），但这个回合
// 不是本页面发起的：`ComposerController.inFlight=false`，于是——
//   ① `stop()` 首行 `if (!this.inFlight) return` 直接吞掉：停止按钮点了没反应；
//   ② `send()` 落到「空闲」分支直接 runRound：同一会话并出第二个回合，收尾还会互相踩；
//   ③ 远端回合自然收尾时本地 busy 无人复位：停止按钮一直挂着。
//
// ## 判据
//
// ① 打开在跑会话 ⇒ busy=true 且 remoteBusyThread 记录；随后 sessions.list 回报不在跑 ⇒
//    busy 自动解除 + `onRemoteBusyCleared` 恰好触发一次（队列续发接力）。
// ② 远端忙碌期间自动解除不得误伤本地回合：本地 runRound 在飞时（busy 同样为 true）不受
//    refreshSessions 的运行态摆布。
//
// 直跑（web 测试统一入口）：npm run web:test
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { AppHost, AppServices } from '../src/ui/controllers/AppController.ts';

const { SessionController } = await import('../src/ui/controllers/SessionController.ts');

/** 一条测试事件（ThreadEvent 的最小可用子集）。 */
interface TestEvent {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
  sessionId?: string;
}

/** 最小状态形状（本判据实际读写的字段）。 */
interface TestState {
  currentThreadId: string | null;
  sessions: { id: string; running?: boolean }[];
  events: TestEvent[];
  toolResults: Record<string, unknown>;
  liveInputs: unknown[];
  streamText: string;
  finalizedStreamText: string;
  busy: boolean;
  activeTool: string | null;
  historyHasMore: boolean;
  oldestEventId: string | null;
  historyLoading: boolean;
  sessionTick: number;
  [key: string]: unknown;
}

/**
 * 构造控制器环境：真 SessionController + 桩 host/api。
 * @param threadId 初始当前会话
 * @param sessions 侧栏在册会话（含运行态）
 * @param listResult `listSessions` 的回包（running 态真源）
 * @returns 控制器、状态与收尾钩子的触发记录
 */
function makeEnv(
  threadId: string | null,
  sessions: { id: string; running?: boolean }[],
  listResult: { sessionId: string; running: boolean }[],
) {
  const state: TestState = {
    currentThreadId: threadId,
    sessions,
    events: [],
    toolResults: {},
    liveInputs: [],
    streamText: '',
    finalizedStreamText: '',
    busy: false,
    activeTool: null,
    historyHasMore: false,
    oldestEventId: null,
    historyLoading: false,
    sessionTick: 0,
  };
  const host = {
    patch(action: Partial<TestState> | ((prev: TestState) => Partial<TestState>)) {
      Object.assign(state, typeof action === 'function' ? action(state) : action);
    },
    getState: () => state,
  };
  const services = {
    api: flatApiStub({
      getThread: async () => ({ items: [] as TestEvent[], hasMore: false }),
      listSessions: async () => ({ sessions: listResult }),
      modesSet: async () => ({ ok: true }),
    }),
    toast: () => {},
    navigate: () => {},
    reducers: {
      appendTextDelta: (text: string, delta: string) => text + delta,
      ingestEvent: (s: TestState, ev: TestEvent) => ({ events: [...s.events, ev] }),
      mergeToolResult: (prev: Record<string, unknown>) => prev,
      // 列表合并：测试里直接用服务端回包覆盖（mergeSessions 的真实合并另有判据）。
      mergeSessions: (_prev: { id: string }[], fromDisk: { id: string; running?: boolean }[]) => fromDisk,
    },
  };
  const ctrl = new SessionController(host as unknown as AppHost, services as unknown as AppServices);
  const cleared: number[] = [];
  ctrl.onRemoteBusyCleared = () => cleared.push(Date.now());
  return { ctrl, state, cleared };
}

test('远端回合：打开在跑会话进 busy，服务端收尾后 busy 自动解除且钩子触发一次', async () => {
  const { ctrl, state, cleared } = makeEnv(null, [{ id: 't1', running: true }], [
    { sessionId: 't1', running: true },
  ]);
  await ctrl.loadThread('t1');
  assert.strictEqual(state.busy, true, '打开在跑会话必须进 busy（2026-11-06 口径）');

  // 远端回合仍在跑：例行 refreshSessions 不得解除 busy。
  await ctrl.refreshSessions();
  assert.strictEqual(state.busy, true, '服务端还在跑时 busy 不得被误清');
  assert.strictEqual(cleared.length, 0, '未收尾不得触发钩子');

  // 服务端收尾（running:false）：busy 自动解除 + 钩子恰好一次。
  const env2 = makeEnv('t1', [{ id: 't1', running: true }], [{ sessionId: 't1', running: false }]);
  await env2.ctrl.loadThread('t1');
  assert.strictEqual(env2.state.busy, true);
  await env2.ctrl.refreshSessions();
  assert.strictEqual(env2.state.busy, false, '服务端收尾后 busy 必须自动解除');
  assert.strictEqual(env2.cleared.length, 1, 'onRemoteBusyCleared 恰好触发一次（队列续发接力）');
});

test('远端忙碌登记不误伤本地回合：打开空闲会话不登记，本地 runRound 的 busy 不被 refresh 清掉', async () => {
  // 打开**空闲**会话：不进 busy、不登记远端忙碌。
  const { ctrl, state, cleared } = makeEnv(null, [{ id: 't1', running: false }], [
    { sessionId: 't1', running: false },
  ]);
  await ctrl.loadThread('t1');
  assert.strictEqual(state.busy, false, '空闲会话不得进 busy');
  await ctrl.refreshSessions();
  assert.strictEqual(state.busy, false);
  assert.strictEqual(cleared.length, 0, '空闲会话没有远端收尾可言');

  // 模拟「本地回合在飞」的 busy（busy=true 但不是 loadThread 写的）：refreshSessions 看到
  // 列表里没有 running 的当前线程，也不得清 busy——本地回合由 runRound 自己的 finally 收口。
  state.busy = true;
  await ctrl.refreshSessions();
  assert.strictEqual(state.busy, true, '非远端登记的 busy 不得被 refreshSessions 清除');
});
