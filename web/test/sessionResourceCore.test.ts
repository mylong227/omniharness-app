// useSessionResource 核心的行为判据（W5，2026-11-22）。
//
// 背景：本 hook 原先只承担「seq 守卫 + sessionTick 跟随」，W5 把编队（轮询 + TTL + 切会话复位）、
// 决策账本（列表/详情两流 + 静默刷新）、上下文工作室（tab 活跃门控）、变更清单等变体收编进来，
// 新增 pollMs / cacheTtlMs / resetKey / refreshing / settled / updatedAt。新增能力必须有独立判据，
// 否则「收编」只是把各自的隐式行为搬进一个没人验证的大 hook。
//
// 钉住的行为：
//   ① 首取：loading=true → 成功后 data/updatedAt/settled，loading=false；
//   ② 失败保留已渲染数据（tick 高频重入时不许闪回错误页）；
//   ③ enabled=false 清空数据并弃掉在飞响应（迟到响应不得复活）；
//   ④ resetKey 变化立即清空旧数据（切会话不串数据）；
//   ⑤ cacheTtlMs 窗口内 effect 不重复请求，手动 refresh 仍然发；
//   ⑥ pollMs 按间隔重取，卸载后停表。

// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import * as React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { AppContext } from '../src/ui/context.ts';
import type { AppContextValue } from '../src/ui/context.ts';
import { useSessionResource } from '../src/ui/hooks/useSessionResource.ts';
import type { SessionResourceOptions } from '../src/ui/hooks/useSessionResource.ts';
import { flatApiStub } from './rtlHarness.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** 最小 App 上下文（本 hook 只消费 sessionTick）。 */
const APP: AppContextValue = {
  api: flatApiStub({}),
  toast: () => {},
  dialog: {} as AppContextValue['dialog'],
  refreshModelCatalog: () => {},
  sessionId: null,
  sessionTick: 0,
};

/** 渲染被测 hook。 */
function renderResource(initialProps: SessionResourceOptions<string>) {
  return renderHook(
    (props: SessionResourceOptions<string>) => useSessionResource<string>(props),
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(AppContext.Provider, { value: APP }, children),
      initialProps,
    },
  );
}

test('① 首取：loading → 数据落地后 settled/updatedAt 就绪', async () => {
  let resolveFirst: ((value: string) => void) | undefined;
  const first = new Promise<string>((resolve) => {
    resolveFirst = resolve;
  });
  const load = (): Promise<string> => first;

  const { result } = renderResource({ enabled: true, load, followTick: false });
  assert.equal(result.current.loading, true, '首取必须 loading');
  assert.equal(result.current.settled, false, '未落地前 settled=false');
  assert.equal(result.current.updatedAt, 0);

  await act(async () => {
    resolveFirst?.('first');
    await Promise.resolve();
  });
  assert.equal(result.current.data, 'first');
  assert.equal(result.current.loading, false);
  assert.equal(result.current.settled, true);
  assert.ok(result.current.updatedAt > 0, '成功必须记录 updatedAt');
});

test('② 失败保留已渲染数据、loading 不闪回，settled 为 true', async () => {
  let mode: 'ok' | 'fail' = 'ok';
  const load = (): Promise<string> =>
    mode === 'ok' ? Promise.resolve('data') : Promise.reject(new Error('boom'));

  const { result } = renderResource({ enabled: true, load, followTick: false });
  await act(async () => {
    await Promise.resolve();
  });
  assert.equal(result.current.data, 'data');

  mode = 'fail';
  await act(async () => {
    await result.current.refresh();
  });
  assert.equal(result.current.data, 'data', '失败不得清掉已渲染数据');
  assert.equal(result.current.error, 'boom');
  assert.equal(result.current.loading, false, '已有数据时不回骨架屏');
  assert.equal(result.current.settled, true);
});

test('③ enabled=false：清空数据并弃掉在飞响应（迟到响应不复活）', async () => {
  let resolveSlow: ((value: string) => void) | undefined;
  let mode: 'slow' | 'fast' = 'slow';
  const load = (): Promise<string> => {
    if (mode === 'fast') return Promise.resolve('fast');
    return new Promise<string>((resolve) => {
      resolveSlow = resolve;
    });
  };

  const { result, rerender } = renderResource({ enabled: true, load, followTick: false });
  rerender({ enabled: false, load, followTick: false });
  assert.equal(result.current.data, null, '禁用即清空');

  mode = 'fast';
  await act(async () => {
    resolveSlow?.('slow');
    await Promise.resolve();
  });
  assert.equal(result.current.data, null, '禁用后迟到的响应必须被弃掉');
});

test('④ resetKey 变化立即清空旧数据（切会话不串数据）', async () => {
  let current = 'a-data';
  const load = (): Promise<string> => Promise.resolve(current);

  const { result, rerender } = renderResource({
    enabled: true,
    load,
    followTick: false,
    resetKey: 'a',
  });
  await act(async () => {
    await Promise.resolve();
  });
  assert.equal(result.current.data, 'a-data');

  current = 'b-data';
  rerender({ enabled: true, load, followTick: false, resetKey: 'b' });
  await act(async () => {
    await Promise.resolve();
  });
  assert.equal(result.current.data, 'b-data');
});

test('⑤ cacheTtlMs：窗口内 effect 不重复请求，手动 refresh 仍发', async () => {
  let calls = 0;
  const load = (): Promise<string> => {
    calls += 1;
    return Promise.resolve(`v${calls}`);
  };

  const { result, rerender } = renderResource({
    enabled: true,
    load,
    followTick: false,
    cacheTtlMs: 60_000,
  });
  await act(async () => {
    await Promise.resolve();
  });
  assert.equal(calls, 1);

  // 触发 effect（reloadTick 变化）：TTL 窗口内不得再发。
  rerender({ enabled: true, load, followTick: false, cacheTtlMs: 60_000, reloadTick: 1 });
  await act(async () => {
    await Promise.resolve();
  });
  assert.equal(calls, 1, 'TTL 窗口内 effect 必须跳过');

  await act(async () => {
    await result.current.refresh();
  });
  assert.equal(calls, 2, '手动 refresh 不受 TTL 约束');
  assert.equal(result.current.data, 'v2');
});

test('⑥ pollMs：按间隔重取；卸载后停表', async () => {
  vi.useFakeTimers();
  let calls = 0;
  const load = (): Promise<string> => {
    calls += 1;
    return Promise.resolve(`v${calls}`);
  };

  const { result, unmount } = renderResource({ enabled: true, load, followTick: false, pollMs: 2_000 });
  await act(async () => {
    await Promise.resolve();
  });
  assert.equal(calls, 1);

  await act(async () => {
    vi.advanceTimersByTime(2_000);
    await Promise.resolve();
  });
  assert.equal(calls, 2, '轮询必须按间隔发请求');
  assert.equal(result.current.data, 'v2');

  unmount();
  await act(async () => {
    vi.advanceTimersByTime(6_000);
    await Promise.resolve();
  });
  assert.equal(calls, 2, '卸载后不得继续轮询');
});

test('⑦ keepDataWhenDisabled：暂不活跃保留旧快照（与「未选会话」的禁用区分）', async () => {
  const load = (): Promise<string> => Promise.resolve('kept');
  const { result, rerender } = renderResource({
    enabled: true,
    load,
    followTick: false,
    keepDataWhenDisabled: true,
  });
  await act(async () => {
    await Promise.resolve();
  });
  assert.equal(result.current.data, 'kept');

  rerender({ enabled: false, load, followTick: false, keepDataWhenDisabled: true });
  assert.equal(result.current.data, 'kept', '暂不活跃不得清空旧快照');
  assert.equal(result.current.loading, false);

  // 对照：同样禁用但 keepDataWhenDisabled=false（未选会话）必须清空。
  rerender({ enabled: false, load, followTick: false });
  assert.equal(result.current.data, null, '无上下文禁用必须清空');
});
