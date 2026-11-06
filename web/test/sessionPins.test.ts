// 会话置顶（2026-11-06：服务端侧车唯一真源）的算术与接线门禁（零 DOM、确定性）。
//
// ## 覆盖什么
//
// ① `SessionGrouper`：置顶组浮在最前、置顶行从原工作区/时间桶摘出（跨项目可见）；
// ② `SessionController.refreshSessions`：`sessions.list` 的 `pinned` 字段必须进 SessionEntry；
// ③ `SessionController.setPinned`：乐观更新 + RPC 失败如实回滚并 toast；
// ④ 接线守卫：App → SessionPanel → 行菜单，且面板不再持 localStorage 副本。
//
// 直跑：npm run web:test
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { AppHost, AppServices } from '../src/ui/controllers/AppController.ts';
import type { SessionEntry } from '../src/ui/shared.ts';

const { SessionGrouper, PINNED_KEY } = await import('../src/ui/models/SessionGrouper.ts');
const { WorkspacePath } = await import('../src/ui/models/WorkspacePath.ts');
const { SessionController } = await import('../src/ui/controllers/SessionController.ts');

/** 分组键是**归一化**后的工作区路径（Windows 上 `D:/ws-a` → `D:\ws-a`）。 */
const WS_A = WorkspacePath.normalize('D:/ws-a');

test('按项目分组：置顶组最前，置顶行从原项目组摘出（跨项目浮出）', () => {
  const rows = [
    { id: 'a', workspace: 'D:/ws-a' },
    { id: 'b', workspace: 'D:/ws-b' },
    { id: 'c', workspace: 'D:/ws-a' },
  ];
  const groups = SessionGrouper.group(rows, 'D:/ws-a', new Set(['b', 'c']));
  assert.equal(groups[0]?.key, PINNED_KEY, '置顶组必须最前');
  assert.equal(groups[0]?.name, '置顶');
  assert.deepEqual(
    groups[0]?.items.map((x) => x.id),
    ['b', 'c'],
    '置顶组内保持输入顺序（b 在别的项目、c 在当前项目）',
  );
  assert.deepEqual(
    groups.find((g) => g.key === WS_A)?.items.map((x) => x.id),
    ['a'],
    '置顶行不得同时留在原项目组（否则同一条会话出现两次）',
  );
  assert.equal(groups.find((g) => g.key === WorkspacePath.normalize('D:/ws-b')), undefined, 'b 已被摘走且组内无其它行 ⇒ 不再产出空组');
});

test('按项目分组：未传置顶集合时行为与旧版一致（无置顶组）', () => {
  const rows = [
    { id: 'a', workspace: 'D:/ws-a' },
    { id: 'b', workspace: 'D:/ws-b' },
  ];
  const groups = SessionGrouper.group(rows, 'D:/ws-a');
  assert.deepEqual(groups.map((g) => g.key), [WS_A, WorkspacePath.normalize('D:/ws-b')]);
  assert.equal(groups.some((g) => g.key === PINNED_KEY), false);
});

test('按时间分组：置顶组最前，且压过「已归档」桶（置顶语义是永远看得见）', () => {
  const now = new Date(2026, 10, 6, 15, 0, 0).getTime();
  const today = new Date(2026, 10, 6, 9, 0, 0).toISOString();
  const rows = [
    { id: 'pin-arch', updatedAt: today, archived: true },
    { id: 'arch', updatedAt: today, archived: true },
    { id: 'today', updatedAt: today },
  ];
  const groups = SessionGrouper.groupByTime(rows, now, new Set(['pin-arch']));
  assert.deepEqual(groups.map((g) => g.key), [PINNED_KEY, 'today', 'archived']);
  assert.deepEqual(groups[0]?.items.map((x) => x.id), ['pin-arch']);
  assert.deepEqual(groups.find((g) => g.key === 'archived')?.items.map((x) => x.id), ['arch']);
});

/** 造一条线格式会话（服务端 sessions.list 用 sessionId）。 */
function disk(sessionId: string, pinned = false) {
  return { sessionId, label: sessionId, workspace: 'w', updatedAt: '', turns: 1, running: false, pinned };
}

/** 造一个最小 host/services 环境（api 的置顶结果可注入）。 */
function makeEnv(diskSessions: ReturnType<typeof disk>[], pinResult: { ok: boolean; error?: string }) {
  const calls: Array<{ id: string; pinned: boolean }> = [];
  const toasts: string[] = [];
  const state = {
    currentThreadId: 's1',
    sessions: [
      { id: 's1', label: '甲', workspace: 'w', updatedAt: '', turns: 1, running: false, pinned: false },
      { id: 's2', label: '乙', workspace: 'w', updatedAt: '', turns: 1, running: false, pinned: true },
    ] as SessionEntry[],
    events: [],
    toolResults: {},
    liveInputs: [],
    streamText: '',
  };
  const host = {
    patch(action: Record<string, unknown> | ((prev: typeof state) => Partial<typeof state>)) {
      Object.assign(state, typeof action === 'function' ? action(state) : action);
    },
    getState: () => state,
  };
  const services = {
    api: {
      listSessions: async () => ({ sessions: diskSessions }),
      setSessionPinned: async (id: string, pinned: boolean) => {
        calls.push({ id, pinned });
        return pinResult;
      },
    },
    toast: (m: string) => toasts.push(m),
    navigate: () => {},
    reducers: { mergeSessions: (_prev: SessionEntry[], fromDisk: SessionEntry[]) => [...fromDisk] },
  };
  return {
    ctrl: new SessionController(host as unknown as AppHost, services as unknown as AppServices),
    state,
    calls,
    toasts,
  };
}

test('refreshSessions：服务端 pinned 字段必须映射进会话条目（否则侧栏永远看不到置顶）', async () => {
  const env = makeEnv([disk('s1', true), disk('s2', false)], { ok: true });
  await env.ctrl.refreshSessions();
  const byId = new Map(env.state.sessions.map((s) => [s.id, s]));
  assert.equal(byId.get('s1')?.pinned, true);
  assert.equal(byId.get('s2')?.pinned, false);
});

test('setPinned：先乐观更新（置顶组即时浮起），成功后保留新状态', async () => {
  const env = makeEnv([], { ok: true });
  const pending = env.ctrl.setPinned('s1', true);
  // 未 await：RPC 还没回来时本地必须已经翻好（用户点完不等待网络）。
  assert.equal(env.state.sessions.find((s) => s.id === 's1')?.pinned, true);
  await pending;
  assert.deepEqual(env.calls, [{ id: 's1', pinned: true }]);
  assert.equal(env.state.sessions.find((s) => s.id === 's1')?.pinned, true);
  assert.deepEqual(env.toasts, []);
});

test('setPinned：RPC 业务失败 ⇒ 回滚到点击前的完整列表并 toast 原因', async () => {
  const env = makeEnv([], { ok: false, error: 'bad_session_id' });
  const snapshot = JSON.parse(JSON.stringify(env.state.sessions));
  await env.ctrl.setPinned('s1', true);
  assert.deepEqual(JSON.parse(JSON.stringify(env.state.sessions)), snapshot, '失败必须回滚（不得留下假的置顶角标）');
  assert.ok(env.toasts.some((m) => m.includes('置顶失败') && m.includes('bad_session_id')), JSON.stringify(env.toasts));
});

test('setPinned：网络异常 ⇒ 同样回滚并 toast 异常消息', async () => {
  const toasts: string[] = [];
  const state = {
    currentThreadId: 's1',
    sessions: [{ id: 's1', label: '甲', workspace: 'w', updatedAt: '', turns: 1, running: false }] as SessionEntry[],
    events: [],
    toolResults: {},
    liveInputs: [],
    streamText: '',
  };
  const host = {
    patch(action: Record<string, unknown> | ((prev: typeof state) => Partial<typeof state>)) {
      Object.assign(state, typeof action === 'function' ? action(state) : action);
    },
    getState: () => state,
  };
  const services = {
    api: {
      setSessionPinned: async () => {
        throw new Error('network down');
      },
    },
    toast: (m: string) => toasts.push(m),
    navigate: () => {},
    reducers: { mergeSessions: (_prev: SessionEntry[], fromDisk: SessionEntry[]) => [...fromDisk] },
  };
  const ctrl = new SessionController(host as unknown as AppHost, services as unknown as AppServices);
  await ctrl.setPinned('s1', true);
  assert.equal(state.sessions[0]?.pinned, undefined, '异常后必须回滚');
  assert.ok(toasts.some((m) => m.includes('network down')), JSON.stringify(toasts));
});

test('接线守卫：服务端唯一真源（面板不再读 localStorage），App 与行菜单都接上', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (p: string) => readFileSync(join(here, '..', 'src', 'ui', p), 'utf8');
  const panel = read('components/SessionPanel.tsx');
  const app = read('App.ts');
  const api = readFileSync(join(here, '..', 'src', 'core', 'ApiClient.ts'), 'utf8');
  assert.doesNotMatch(panel, /SessionPins/u, '面板不得再持 localStorage 置顶副本（服务端侧车为唯一真源）');
  assert.match(panel, /sessions\.filter\(\(x\) => x\.pinned === true\)/u, '置顶集合必须从会话条目的 pinned 字段派生');
  assert.match(app, /onTogglePin: \(id, pinned\) => void ctrl\.sessions\.setPinned\(id, pinned\)/u, 'App 必须把置顶接到控制器');
  assert.match(api, /rpc\('sessions\.setPinned'/u, 'ApiClient 必须调用服务端 setPinned');
});
