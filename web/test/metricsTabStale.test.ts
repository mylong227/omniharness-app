// 指标面板端点健康提示判据（2026-11-01 前端性能批附带修复）。
//
// ## 缺陷形态
//
// 轮询失败「静默保持上一帧」是刻意设计（端点不可用不该让面板空白），但用户对着的是一份
// **无限陈旧的快照**而毫无感知；首次拉取就失败时更是一句「读取中…」永远挂在那里。
//
// ## 修法与判据
//
// MetricsTab 增加 `metricsFailed` 标记（成功即清）：首拉失败 ⇒ 明确报「端点不可用」；
// 有过成功帧后再失败 ⇒ 数据保留（旧快照不清空）＋顶部一行陈旧快照提示。
//
// ## 时序（2026-11-20 硬化）
//
// 组件按 POLL_MS=2s 真实 setInterval 轮询——满载并发（223 worker）下 interval 可在
// settle 微任务窗口内开火，多打一次失败调用让「健康时无陈旧提示」偶发翻车。
// 判据改 **fake timers**：冻结轮询、断言后用 `advanceTimersByTime(POLL_MS)` 显式推进
// 恰好一档——轮询次数确定化，负载不再影响判定（隔离/满载同绿）。
// 判据直跑：npx vitest run web/test/metricsTabStale.test.ts
// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import * as React from 'react';
import { act, render } from './rtlHarness.ts';
import { AppContext } from '../src/ui/context.ts';
import type { AppContextValue } from '../src/ui/context.ts';

const { MetricsTab, POLL_MS } = await import('../src/ui/components/tabs/MetricsTab.tsx');

/** 最小指标/用量载荷（渲染路径真的读到的字段）。 */
const METRICS = { sessions: 3, eventsByType: { user: 5 } };
const USAGE = { total: { total: 10 }, sessions: [], byModel: {} };

/** 构造上下文（api 注入 + 指定 sessionTick，tick 变化即触发重拉）。 */
function ctxOf(api: unknown, sessionTick: number): AppContextValue {
  return {
    api: api as AppContextValue['api'],
    toast: () => {},
    dialog: { confirm: async () => true, prompt: async () => null } as never,
    sessionId: null,
    sessionTick,
    workspaceEpoch: 0,
  };
}

function tree(api: unknown, sessionTick: number): React.ReactElement {
  return React.createElement(
    AppContext.Provider,
    { value: ctxOf(api, sessionTick) },
    React.createElement(MetricsTab as never),
  );
}

/** 冲一轮微任务让 effect 里的取数落地。 */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  vi.useRealTimers();
});

test('MetricsTab：首拉即失败必须报「端点不可用」，不得永远停在「读取中…」', async () => {
  vi.useFakeTimers();
  const api = {
    fetchMetrics: async () => {
      throw new Error('endpoint down');
    },
    usageStats: async () => USAGE,
  };
  const ui = render(tree(api, 0));
  assert.match(ui.container.textContent ?? '', /读取中/, '首帧是读取中');
  await settle();
  assert.match(ui.container.textContent ?? '', /指标端点不可用（刷新失败）/, '失败后必须给明确提示');
  ui.unmount();
});

test('MetricsTab：成功后再失败降级为陈旧快照提示，旧数据保留不清空', async () => {
  vi.useFakeTimers();
  let calls = 0;
  const api = {
    fetchMetrics: async () => {
      calls += 1;
      if (calls > 1) throw new Error('endpoint down');
      return METRICS;
    },
    usageStats: async () => USAGE,
  };
  const ui = render(tree(api, 0));
  await settle();
  const okText = ui.container.textContent ?? '';
  assert.match(okText, /会话/, '成功帧渲染出指标卡');
  assert.doesNotMatch(okText, /上次成功拉取的快照/, '健康时无陈旧提示（轮询已被冻结，不可能提前失败）');
  // 显式推进恰好一档 POLL_MS ⇒ 轮询开火 ⇒ 第二次调用失败：旧快照必须还在，且出现陈旧提示。
  await act(async () => {
    vi.advanceTimersByTime(POLL_MS);
    await Promise.resolve();
  });
  await settle();
  const staleText = ui.container.textContent ?? '';
  assert.match(staleText, /上次成功拉取的快照/, '失败后必须提示当前是陈旧快照');
  assert.match(staleText, /会话/, '旧快照数据保留（静默保持上一帧的刻意设计不变）');
  ui.unmount();
});
