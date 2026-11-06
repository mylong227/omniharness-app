// 会话回退（时间旅行）门禁：确认 → 服务端 threads.rewind → 重新加载 → 回填输入框。
//
// 这条能力是内核 append-only 事件流的用户面：必须走服务端真回退，不能只截视图；
// 且确认文案要如实区分「事件回退」与「文件回滚」。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { AppHost, AppServices } from '../src/ui/controllers/AppController.ts';
import type { ThreadEvent } from '../src/types/models.ts';

const { SessionController } = await import('../src/ui/controllers/SessionController.ts');
const { RewindImpact } = await import('../src/ui/models/RewindImpact.ts');

/** 造一条事件。 */
function ev(id: string, type = 'user'): ThreadEvent {
  return { id, type, payload: { content: id } } as ThreadEvent;
}

/**
 * 最小环境：只覆盖 rewindTo 用到的 host / dialog / api / toast。
 * @param confirm 确认框返回值
 * @param rewind 服务端回退结果
 * @param checkpoint 回退前检查点：ok 成功 / fail 抛错
 * @returns 控制器、状态、调用记录与重新加载标记
 */
function makeEnv(
  confirm: boolean,
  rewind: { ok: boolean; kept?: number; dropped?: number; error?: string },
  checkpoint: 'ok' | 'fail' = 'ok',
) {
  const state = {
    currentThreadId: 't1',
    busy: false,
    events: [ev('u1'), ev('a1', 'assistant'), ev('u2')],
  };
  const calls: {
    rewind: Array<[string, string]>;
    checkpoints: Array<[string, string]>;
    toasts: string[];
    confirm: string[];
  } = { rewind: [], checkpoints: [], toasts: [], confirm: [] };
  let reloaded = false;
  const host = {
    patch(action: Partial<typeof state> | ((prev: typeof state) => Partial<typeof state>)) {
      Object.assign(state, typeof action === 'function' ? action(state) : action);
    },
    getState: () => state,
  };
  const services = {
    api: {
      createCheckpoint: async (threadId: string, label: string) => {
        calls.checkpoints.push([threadId, label]);
        if (checkpoint === 'fail') throw new Error('snapshot failed');
        return {
          ok: true,
          checkpoint: { label, ts: '', eventCount: 3, hasFileSnapshot: true },
        };
      },
      rewindThread: async (threadId: string, eventId: string) => {
        calls.rewind.push([threadId, eventId]);
        return rewind;
      },
    },
    toast: (message: string) => calls.toasts.push(message),
    dialogSvc: {
      confirm: async (message: string) => {
        calls.confirm.push(message);
        return confirm;
      },
    },
  };
  const ctrl = new SessionController(host as unknown as AppHost, services as unknown as AppServices);
  // 不跑真实 loadThread（它需要完整 api/路由）；只记录是否被调用。
  (ctrl as unknown as { loadThread: (id: string) => Promise<void> }).loadThread = async () => {
    reloaded = true;
  };
  return { ctrl, state, calls, reloaded: () => reloaded };
}

test('确认后调用服务端回退并重新加载；取消则不发请求', async () => {
  const yes = makeEnv(true, { ok: true, kept: 1, dropped: 2 });
  assert.equal(await yes.ctrl.rewindTo('u1'), true);
  assert.deepStrictEqual(yes.calls.rewind, [['t1', 'u1']]);
  assert.equal(yes.calls.checkpoints.length, 1, '回退前必须尝试落检查点');
  assert.match(yes.calls.checkpoints[0]![1], /^rewind-/u, '检查点名应可辨识来源');
  assert.equal(yes.reloaded(), true);
  assert.ok(yes.calls.toasts.some((m) => m.includes('已回到这条消息')), JSON.stringify(yes.calls.toasts));
  assert.ok(
    yes.calls.toasts.some((m) => m.includes('回退前检查点')),
    `成功 toast 应带上检查点名，实测 ${JSON.stringify(yes.calls.toasts)}`,
  );
  assert.ok(
    yes.calls.confirm.some((m) => m.includes('助手回复') && m.includes('用户消息')),
    `确认文案必须拆出被丢弃的事件构成，实测 ${JSON.stringify(yes.calls.confirm)}`,
  );

  const no = makeEnv(false, { ok: true });
  assert.equal(await no.ctrl.rewindTo('u1'), false);
  assert.deepStrictEqual(no.calls.rewind, [], '取消后不得发回退请求');
  assert.deepStrictEqual(no.calls.checkpoints, [], '取消后不得落检查点');

  const checkpointFailed = makeEnv(true, { ok: true, kept: 1, dropped: 2 }, 'fail');
  assert.equal(await checkpointFailed.ctrl.rewindTo('u1'), true, '检查点失败不应阻断回退');
  assert.deepStrictEqual(checkpointFailed.calls.rewind, [['t1', 'u1']]);
  assert.ok(
    checkpointFailed.calls.toasts.some((m) => m.includes('自动检查点未创建')),
    `检查点失败必须在 toast 里如实说明，实测 ${JSON.stringify(checkpointFailed.calls.toasts)}`,
  );
});

test('RewindImpact：按事件类型拆出被丢弃的构成', () => {
  const events = [
    ev('u1'),
    ev('a1', 'assistant'),
    ev('r1', 'reasoning'),
    ev('c1', 'tool_call'),
    ev('x1', 'tool_result'),
    ev('s1', 'system'),
  ];
  const impact = RewindImpact.of(events, 0);
  assert.deepStrictEqual(impact, {
    total: 5,
    toolCalls: 1,
    toolResults: 1,
    assistant: 1,
    reasoning: 1,
    user: 0,
    other: 1,
  });
  assert.strictEqual(RewindImpact.of(events, events.length - 1).total, 0, '末条之后无可丢弃事件');
});

test('运行中 / 最后一条 / 服务端拒绝：都不发请求，并给出可执行提示', async () => {
  const busy = makeEnv(true, { ok: true });
  busy.state.busy = true;
  assert.equal(await busy.ctrl.rewindTo('u1'), false);
  assert.deepStrictEqual(busy.calls.rewind, []);
  assert.ok(busy.calls.toasts.some((m) => m.includes('先中止')));

  const last = makeEnv(true, { ok: true });
  assert.equal(await last.ctrl.rewindTo('u2'), false, '最后一条无需回退');
  assert.deepStrictEqual(last.calls.rewind, []);

  const rejected = makeEnv(true, { ok: false, error: '该会话有回合正在运行：请先中止再回退' });
  assert.equal(await rejected.ctrl.rewindTo('u1'), false);
  assert.deepStrictEqual(rejected.calls.rewind, [['t1', 'u1']], '确认后仍应尝试服务端回退');
  assert.ok(rejected.calls.toasts.some((m) => m.includes('回退失败')), JSON.stringify(rejected.calls.toasts));
});
