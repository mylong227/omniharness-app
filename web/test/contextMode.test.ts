/**
 * 上下文模式「内核上下文策略」判据（2026-11-15，alpha.19 三段 UI 对齐）：
 *
 * 1. 面板必须把内核三段的**生效值**摆出来（检索供给 / 语义召回 / 降档阶梯 / 缓存守卫）；
 * 2. 语义召回「请求了但嵌入不在位」必须显示为降档，**不得**读成「未启用」；
 * 3. 三段全关时徽标显示「全部关闭」，不伪装成正常/已启用。
 *
 * 渲染口径与仓内其它 tab 判据一致（真实 React + jsdom，假 api 即时 resolve）。
 */

// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { renderFacadeAsync } from './rtlHarness.ts';
import { allText as facadeAllText } from './domFacade.ts';
import type { ContextStudioSnapshotLike } from '../src/types/models.ts';

const { ContextMode } = await import('../src/ui/components/tabs/control/ContextMode.tsx');

/** 最小用量报告（缓存统计齐全，便于断言「当前命中率」）。 */
const REPORT = {
  threadId: 'sess_1',
  windowTokens: 128000,
  usedTokens: 32000,
  percent: 25,
  rows: [{ key: 'systemPrompt' as const, label: '系统', tokens: 1000, percent: 3 }],
  mcpToolCount: 0,
  systemToolCount: 1,
  source: 'measured' as const,
  cache: {
    promptTokens: 2000,
    cachedPromptTokens: 1500,
    calls: 2,
    hitRate: 75,
    lastCall: {
      cause: 'hit' as const,
      reason: 'hit',
      evidence: {},
      promptTokens: 1000,
      cachedPromptTokens: 900,
    },
  },
  collectedAt: '2026-11-15T00:00:00.000Z',
};

/** 造一份快照（kernel 三段按用例覆盖）。 */
function snapshotOf(kernel: ContextStudioSnapshotLike['kernel']): ContextStudioSnapshotLike {
  return {
    threadId: 'sess_1',
    report: REPORT,
    kernel,
    compactions: [],
    handoff: [],
    handoffAvailable: false,
    collectedAt: '2026-11-15T00:00:00.000Z',
  };
}

/**
 * 渲染上下文面板并等一次取数落地。
 * @param snapshot 快照
 * @returns 面板文本
 */
async function textWith(snapshot: ContextStudioSnapshotLike): Promise<string> {
  const ui = await renderFacadeAsync(ContextMode, {
    props: { threadId: 'sess_1', active: true },
    responses: { contextStudio: snapshot },
  });
  return facadeAllText(ui.node);
}

test('检索供给 + 降档阶梯 + 缓存守卫：生效值逐项可见', async () => {
  const text = await textWith(
    snapshotOf({
      retrievalContext: {
        mode: 'bm25',
        rewriter: 'model',
        rerank: 'off',
        maxSnippets: 4,
        maxTokens: 600,
      },
      semanticRecall: { requested: false, active: false, degraded: false },
      contextPolicy: { shapersAggressive: true, compactionForce: false, cacheGuardFloor: 0.8 },
    }),
  );
  assert.match(text, /内核上下文策略/u);
  assert.match(text, /BM25 · 单步 ≤4 条 \/ ≤600 token/u);
  assert.match(text, /改写 模型 · 精排 未启用/u);
  assert.match(text, /激进裁剪 已启用 · 强制压缩 未启用/u);
  assert.match(text, /命中率下限 0\.8 · 当前 75%/u);
  assert.match(text, /按配置启用/u, '有开关生效时徽标必须与内容一致');
});

test('语义召回请求但嵌入不在位：显示降档，不得读成「未启用」', async () => {
  const text = await textWith(
    snapshotOf({
      retrievalContext: { mode: 'off', rewriter: 'off', rerank: 'off' },
      semanticRecall: { requested: true, active: false, degraded: true },
      contextPolicy: { shapersAggressive: false, compactionForce: false },
    }),
  );
  assert.match(text, /已请求，嵌入不可用（BM25 降档）/u);
  assert.match(text, /降档运行/u, '降档时徽标必须警告');
  assert.doesNotMatch(text, /全部关闭/u, '有请求的语义召回不能读成全部关闭');
});

test('三段全关：徽标如实显示「全部关闭」', async () => {
  const text = await textWith(
    snapshotOf({
      retrievalContext: { mode: 'off', rewriter: 'off', rerank: 'off' },
      semanticRecall: { requested: false, active: false, degraded: false },
      contextPolicy: { shapersAggressive: false, compactionForce: false },
    }),
  );
  assert.match(text, /全部关闭/u);
  assert.match(text, /未启用/u);
});
