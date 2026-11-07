// SSE 流自愈判据（2026-11-08 审计）：EventSource 的自动重连永远复用构造时的 URL——
// 服务端重启换令牌后它会拿旧 ?token= 无限重试，且 connect() 的幂等闸门拦住一切重试入口。
// reconnect() 是唯一确定性自愈入口：close 后用**当前**令牌重建。
//
// 直跑（web 测试统一入口）：npm run web:test

import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';

const { EventStream } = await import('../src/core/EventStream.ts');
const { authToken } = await import('../src/core/authToken.ts');

/** 记录实例的 EventSource 替身（Node 环境 window 不存在也无所谓：EventStream 不碰 DOM）。 */
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

function installFake(): void {
  FakeEventSource.instances = [];
  globalAsAny.EventSource = FakeEventSource;
}

afterEach(() => {
  authToken.set('');
});

test('connect：无令牌时 URL 不带 ?token=；connect 幂等（不重复建连）', () => {
  installFake();
  const stream = new EventStream();
  stream.connect();
  stream.connect();
  stream.connect();
  assert.equal(FakeEventSource.instances.length, 1, '幂等闸门必须拦住重复 connect');
  assert.equal(FakeEventSource.instances[0]!.url, '/events');
});

test('reconnect：close 旧连接后用**当前**令牌重建（旧 URL 不得复用）', () => {
  installFake();
  const stream = new EventStream();
  authToken.set('t1');
  stream.connect();
  assert.equal(FakeEventSource.instances[0]!.url, '/events?token=t1');

  authToken.set('t2');
  stream.reconnect();
  assert.equal(FakeEventSource.instances.length, 2);
  assert.equal(FakeEventSource.instances[0]!.closed, true, '旧连接必须被显式关闭');
  assert.equal(FakeEventSource.instances[1]!.url, '/events?token=t2', '必须带当前令牌重建');
});

test('close 后 connect 允许重开（卸载→重挂路径）', () => {
  installFake();
  const stream = new EventStream();
  stream.connect();
  stream.close();
  assert.equal(FakeEventSource.instances[0]!.closed, true);
  stream.connect();
  assert.equal(FakeEventSource.instances.length, 2);
  assert.equal(stream.isOpen, true, 'isOpen 读新实例的 readyState');
});
