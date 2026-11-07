// 并行会话审批/提问单槽纪律 + SSE 自愈接线判据（2026-11-08 审计）。
//
// ## 缺陷形态
//
// ① `approval.request` / `question.request` 无条件 patch 单槽——服务端可同时挂起多条
//    （多线程并行回合），后到的 B 卡把用户正在看的 A 卡静默顶掉，A 的工具一直挂起而无人可见；
// ② 断连宽限期满后没有任何「带当前令牌重建」的入口——EventSource 拿旧 URL 无限重试。
//
// ## 判据
//
// ① A 卡在显示时 B 卡到达 ⇒ A 保持不动 + 排队 toast；提问同纪律；
// ② onerror 后推满 4s 宽限 ⇒ 必须用当前令牌重建 EventSource（实例数 +1，旧连接 closed）；
// ③ omni:token-updated（401 横幅就地换令牌）⇒ 立即重建；unmount 后事件不再引发重建。
//
// 直跑（web 测试统一入口）：npm run web:test
// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import type { AppHost } from '../src/ui/controllers/AppController.ts';

const { AppController } = await import('../src/ui/controllers/AppController.ts');
const { authToken } = await import('../src/core/authToken.ts');

/** 记录实例的 EventSource 替身（AppController 走 connectStream → stream.connect）。 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  public url: string;
  public closed = false;
  public readyState = 1;
  public onopen: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((e: { data: string }) => void) | null = null;
  public constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  public close(): void {
    this.closed = true;
  }
}

const globalAsAny = globalThis as unknown as { EventSource?: unknown };

/** 最小状态宿主：connectStream / routeStreamMessage / toast 只用到这些字段。 */
function makeHost() {
  const state = {
    approval: null as unknown,
    question: null as unknown,
    connected: false,
    streamState: 'closed' as string,
    toastState: { seq: 0, message: '', kind: 'info', visible: false },
  };
  const host = {
    patch(action: Partial<typeof state> | ((prev: typeof state) => Partial<typeof state>)) {
      Object.assign(state, typeof action === 'function' ? action(state) : action);
    },
    getState: () => state,
  };
  return { host: host as unknown as AppHost, state };
}

/** 本文件创建的控制器：omni:token-updated 是 window 级订阅，跨测试必须卸载（否则一次派发会
 *  触发所有存活控制器同时重连，实例计数全乱）。 */
const created: Array<InstanceType<typeof AppController>> = [];

/** 建控制器并登记卸载。 */
function makeCtrl(host: AppHost): InstanceType<typeof AppController> {
  const ctrl = new AppController(host);
  created.push(ctrl);
  return ctrl;
}

/** 直发一条 SSE 信封（绕过真实网络层，驱动 onMessage 回调）。 */
function fire(es: FakeEventSource, method: string, params: Record<string, unknown>): void {
  es.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', method, params }) });
}

function lastToast(state: ReturnType<typeof makeHost>['state']): string {
  return state.toastState.message;
}

afterEach(() => {
  for (const ctrl of created) ctrl.unmount();
  created.length = 0;
  authToken.set('');
  vi.useRealTimers();
});

test('审批单槽：A 卡显示时 B 卡到达 ⇒ A 保持不动 + 排队提示', () => {
  globalAsAny.EventSource = FakeEventSource;
  FakeEventSource.instances = [];
  const { host, state } = makeHost();
  const ctrl = makeCtrl(host);
  ctrl.connectStream();
  const es = FakeEventSource.instances[0]!;

  fire(es, 'approval.request', { requestId: 'r1', toolName: 'write_file' });
  assert.equal((state.approval as { requestId: string }).requestId, 'r1');

  fire(es, 'approval.request', { requestId: 'r2', toolName: 'bash' });
  assert.equal(
    (state.approval as { requestId: string }).requestId,
    'r1',
    '单槽占用时后到请求不得覆盖（服务端挂起表为真源，处置后 restorePendingCards 接续）',
  );
  assert.match(lastToast(state), /排队/, '排队必须对用户可见');
});

test('提问单槽：同一纪律（占用不覆盖 + 提示）', () => {
  globalAsAny.EventSource = FakeEventSource;
  FakeEventSource.instances = [];
  const { host, state } = makeHost();
  const ctrl = makeCtrl(host);
  ctrl.connectStream();
  const es = FakeEventSource.instances[0]!;

  fire(es, 'question.request', { requestId: 'q1', questions: [] });
  assert.equal((state.question as { requestId: string }).requestId, 'q1');
  fire(es, 'question.request', { requestId: 'q2', questions: [] });
  assert.equal((state.question as { requestId: string }).requestId, 'q1');
  assert.match(lastToast(state), /排队/);
});

test('宽限期满：必须用当前令牌重建 EventSource（旧连接 closed）', () => {
  globalAsAny.EventSource = FakeEventSource;
  FakeEventSource.instances = [];
  vi.useFakeTimers();
  const { host, state } = makeHost();
  authToken.set('tok-1');
  const ctrl = makeCtrl(host);
  ctrl.connectStream();
  assert.equal(FakeEventSource.instances.length, 1);
  assert.match(FakeEventSource.instances[0]!.url, /token=tok-1/);

  FakeEventSource.instances[0]!.onerror?.();
  assert.equal(state.streamState, 'connecting', '宽限期内是「重连中」');
  vi.advanceTimersByTime(4_000);
  assert.equal(state.streamState, 'closed', '宽限期满认定断开');
  assert.equal(FakeEventSource.instances.length, 2, '宽限期满必须触发 reconnect');
  assert.equal(FakeEventSource.instances[0]!.closed, true);
  assert.match(FakeEventSource.instances[1]!.url, /token=tok-1/);
});

test('omni:token-updated（401 横幅就地换令牌）⇒ 立即用新令牌重建；unmount 后不再响应', () => {
  globalAsAny.EventSource = FakeEventSource;
  FakeEventSource.instances = [];
  const { host } = makeHost();
  const ctrl = makeCtrl(host);
  ctrl.connectStream();
  assert.equal(FakeEventSource.instances.length, 1);

  authToken.set('fresh-token');
  window.dispatchEvent(new CustomEvent('omni:token-updated'));
  assert.equal(FakeEventSource.instances.length, 2, '换令牌必须立即重建 SSE 流');
  assert.match(FakeEventSource.instances[1]!.url, /token=fresh-token/);

  ctrl.unmount();
  window.dispatchEvent(new CustomEvent('omni:token-updated'));
  assert.equal(FakeEventSource.instances.length, 2, 'unmount 后订阅必须已移除');
  assert.equal(FakeEventSource.instances[0]!.closed, true, 'unmount 必须关闭流');
});
