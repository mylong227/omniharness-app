/**
 * 内核上下文读模型判据（2026-11-15）：`context.studio.kernel` 与健康桥 context 分区
 * 共用同一份解析，必须钉死三条语义：
 *
 * 1. 未配置的段如实回落内核默认（off），不猜测用户意图；
 * 2. `semanticRecall.requested && !active` ⇒ `degraded`（BM25 降档），不得读成关闭；
 * 3. 运行时未装配时 `active` 为 false（不拿配置值冒充在位）。
 */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  KernelContextViewBuilder,
  kernelContextOff,
} from '../src/apps/server/services/context/kernelContextView.ts';
import type { ResolvedConfig } from '../src/host/kernel/contracts.ts';

/** 造一个只承载本测试关心字段的解析配置。 */
function configOf(partial: Record<string, unknown>): ResolvedConfig {
  return partial as unknown as ResolvedConfig;
}

test('默认全关：空配置 + 运行时未装配 ⇒ 三段全部 off（不伪造开启态）', () => {
  const view = new KernelContextViewBuilder({
    config: () => configOf({}),
    probe: () => undefined,
  }).build();
  assert.deepEqual(view, kernelContextOff());
});

test('配置映射：检索五项 + 降档两级 + 缓存守卫如实透传', () => {
  const view = new KernelContextViewBuilder({
    config: () =>
      configOf({
        retrievalContext: {
          mode: 'bm25',
          rewriter: 'model',
          rerank: 'model',
          maxSnippets: 6,
          maxTokens: 900,
        },
        contextPolicy: {
          degradeLadder: { shapersAggressive: true, compactionForce: false },
          cacheGuard: { hitRateFloor: 0.7 },
        },
      }),
    probe: () => ({
      sandboxName: 'policy',
      semanticRecallActive: false,
      spentUsd: undefined,
      limitUsd: undefined,
    }),
  }).build();
  assert.deepEqual(view.retrievalContext, {
    mode: 'bm25',
    rewriter: 'model',
    rerank: 'model',
    maxSnippets: 6,
    maxTokens: 900,
  });
  assert.deepEqual(view.contextPolicy, {
    shapersAggressive: true,
    compactionForce: false,
    cacheGuardFloor: 0.7,
  });
  assert.deepEqual(view.semanticRecall, { requested: false, active: false, degraded: false });
});

test('语义召回：请求了但嵌入不在位 ⇒ degraded（BM25 降档）；在位 ⇒ active 且不降级', () => {
  const offProbe = new KernelContextViewBuilder({
    config: () => configOf({ semanticRecall: { mode: 'on' } }),
    probe: () => undefined,
  }).build();
  assert.deepEqual(offProbe.semanticRecall, { requested: true, active: false, degraded: true });

  const onProbe = new KernelContextViewBuilder({
    config: () => configOf({ semanticRecall: { mode: 'on' } }),
    probe: () => ({
      sandboxName: 'policy',
      semanticRecallActive: true,
      spentUsd: undefined,
      limitUsd: undefined,
    }),
  }).build();
  assert.deepEqual(onProbe.semanticRecall, { requested: true, active: true, degraded: false });
});
