/**
 * 内核健康桥判据（2026-11-15）：`kernel.health` 的七分区必须"诚实"——
 *
 * 1. 状态词表与内核哨兵一致（ok / degraded / absent），且 **absent ≠ degraded**；
 * 2. 未装配的分区如实报 absent + 原因（不得拿配置值冒充运行时值）；
 * 3. 越预算 / 语义召回请求了但嵌入不在位 ⇒ degraded + 机读问题码；
 * 4. fail-soft：单个探针抛错不许拖垮其它分区，且错误必须留码（不静默）。
 */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { KernelHealthBridge } from '../src/apps/server/services/kernelHealthBridge.ts';
import type { KernelHealthDeps, RuntimeHealthProbe } from '../src/apps/server/services/kernelHealthBridge.ts';
import type { ResolvedConfig } from '../src/host/kernel/contracts.ts';

/** 装配桥：只给判据关心的依赖，其余用空实现。 */
function bridgeOf(over: Partial<KernelHealthDeps> = {}): KernelHealthBridge {
  const base: KernelHealthDeps = {
    config: () => ({}) as unknown as ResolvedConfig,
    probe: () => undefined,
    runningSessions: () => [],
    pluginNames: () => [],
    ...over,
  };
  return new KernelHealthBridge(base);
}

/** 取某分区（不存在则抛错——分区固定序是契约的一部分）。 */
function section(report: ReturnType<KernelHealthBridge['report']>, name: string) {
  const found = report.sections.find((item) => item.name === name);
  assert.ok(found !== undefined, `健康报告必须包含分区 ${name}`);
  return found;
}

test('七分区固定序；全 absent 时摘要为 ok（absent 不是病）', () => {
  const report = bridgeOf().report();
  assert.deepEqual(
    report.sections.map((item) => item.name),
    ['receipts', 'telemetry', 'budget', 'sessions', 'plugins', 'sandbox', 'context'],
  );
  assert.strictEqual(report.summary, 'ok');
  assert.strictEqual(section(report, 'receipts').status, 'absent');
  assert.strictEqual(section(report, 'telemetry').status, 'absent');
  assert.strictEqual(section(report, 'budget').status, 'absent');
  assert.strictEqual(section(report, 'sandbox').status, 'absent');
  assert.match(String(section(report, 'sandbox').detail?.['reason']), /运行时尚未装配/u);
});

test('运行时装配后：沙箱/会话/插件/预算取实值；预算越限 ⇒ degraded + BUDGET_EXCEEDED', () => {
  const probe: RuntimeHealthProbe = {
    sandboxName: 'policy',
    semanticRecallActive: false,
    spentUsd: 5,
    limitUsd: 5,
  };
  const report = bridgeOf({
    config: () => ({ costBudgetUsd: 5 }) as unknown as ResolvedConfig,
    probe: () => probe,
    runningSessions: () => ['s1', 's2'],
    pluginNames: () => ['demo'],
  }).report();
  assert.deepEqual(section(report, 'sandbox').detail, { name: 'policy' });
  assert.deepEqual(section(report, 'sessions').detail, { running: ['s1', 's2'] });
  assert.deepEqual(section(report, 'plugins').detail, { count: 1 });
  const budget = section(report, 'budget');
  assert.strictEqual(budget.status, 'degraded');
  assert.strictEqual(budget.problems[0]?.code, 'BUDGET_EXCEEDED');
  assert.strictEqual(budget.detail?.['remainingUsd'], 0);
  assert.match(report.summary, /degraded\(budget:BUDGET_EXCEEDED\)/u);
});

test('语义召回：请求了但嵌入端口不在位 ⇒ degraded（BM25-only 降档不静默）', () => {
  const report = bridgeOf({
    config: () => ({ semanticRecall: { mode: 'on' } }) as unknown as ResolvedConfig,
    probe: () => ({
      sandboxName: 'policy',
      semanticRecallActive: false,
      spentUsd: undefined,
      limitUsd: undefined,
    }),
  }).report();
  const context = section(report, 'context');
  assert.strictEqual(context.status, 'degraded');
  assert.strictEqual(context.problems[0]?.code, 'SEMANTIC_RECALL_DEGRADED');
});

test('probe 抛错：该分区 degraded + HEALTH_SECTION_FAILED，其它分区不受影响', () => {
  const deps: KernelHealthDeps = {
    config: () => ({}) as unknown as ResolvedConfig,
    probe: () => {
      throw new Error('boom');
    },
    runningSessions: () => ['s1'],
    pluginNames: () => [],
  };
  const report = new KernelHealthBridge(deps).report();
  // budget / sandbox / context 都会读 probe → 三个分区各自降级；sessions/plugins 仍 ok。
  for (const name of ['budget', 'sandbox', 'context']) {
    const item = section(report, name);
    assert.strictEqual(item.status, 'degraded');
    assert.strictEqual(item.problems[0]?.code, 'HEALTH_SECTION_FAILED');
    assert.match(item.problems[0]?.detail ?? '', /boom/u, '错误细节必须留痕（不静默）');
  }
  assert.strictEqual(section(report, 'sessions').status, 'ok');
  assert.strictEqual(section(report, 'plugins').status, 'ok');
});
