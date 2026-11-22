// 上下文余量预测（2026-11-17 粘性批次）纯逻辑判据。
//
// 语义：按轮取「该轮最后一条 model 事件 context.usedTokens」，相邻轮正增量取中位数，
// 除剩余窗口得「还能撑几轮」。压缩导致的下降不参与；可比对轮 <2 或非正增量返回 null
// （估算的估算没有意义，展示层宁缺毋滥）。
// 直跑：npx vitest run web/test/contextForecast.test.ts
import assert from 'node:assert/strict';
import { test } from 'vitest';

const { ContextForecast } = await import('../src/ui/models/ContextForecast.ts');
type ThreadEvent = import('../src/types/models.ts').ThreadEvent;

/** 造一条事件。 */
function ev(
  type: 'user' | 'model',
  id: string,
  usedTokens?: number,
): ThreadEvent {
  return {
    id,
    type,
    timestamp: 0,
    payload: usedTokens === undefined ? { content: 'x' } : { context: { usedTokens } },
  } as unknown as ThreadEvent;
}

/** 稳定增速场景：4 轮各 +1000。 */
function steady(): ThreadEvent[] {
  const out: ThreadEvent[] = [];
  for (let turn = 0; turn < 5; turn++) {
    out.push(ev('user', 'u' + String(turn)));
    out.push(ev('model', 'm' + String(turn), 1000 + turn * 1000));
  }
  return out;
}

test('预测：稳定增速 → 中位数增量与剩余轮数', () => {
  const r = ContextForecast.estimate(steady(), 20000, 5000);
  assert.ok(r !== null);
  assert.strictEqual(r.medianDelta, 1000, '相邻轮差值全为 1000');
  assert.strictEqual(r.remainingTokens, 15000);
  assert.strictEqual(r.remainingTurns, 15);
  assert.strictEqual(r.samples, 4, '只看最近 4 轮');
});

test('预测：压缩导致的下降不参与中位数', () => {
  // 第 4 轮被压缩（骤降），第 5 轮回到增长。
  const events = [
    ev('user', 'u0'),
    ev('model', 'm0', 1000),
    ev('user', 'u1'),
    ev('model', 'm1', 2000),
    ev('user', 'u2'),
    ev('model', 'm2', 3000),
    ev('user', 'u3'),
    ev('model', 'm3', 800), // 压缩后骤降
    ev('user', 'u4'),
    ev('model', 'm4', 1800),
  ];
  const r = ContextForecast.estimate(events, 10000, 1800);
  assert.ok(r !== null);
  // 最近 4 个相邻差值：+1000, +1000, -2200(丢弃), +1000 → 3 个正样本中位 1000。
  assert.strictEqual(r.medianDelta, 1000);
  assert.strictEqual(r.samples, 3);
});

test('预测：数据不足 / 增量为零 / 窗口满 返回 null', () => {
  assert.strictEqual(ContextForecast.estimate([], 20000, 5000), null, '无事件');
  assert.strictEqual(
    ContextForecast.estimate([ev('user', 'u0'), ev('model', 'm0', 1000)], 20000, 1000),
    null,
    '只有一个可观测轮，无可比对',
  );
  assert.strictEqual(
    ContextForecast.estimate(
      [ev('user', 'u0'), ev('model', 'm0', 1000), ev('user', 'u1'), ev('model', 'm1', 1000)],
      20000,
      1000,
    ),
    null,
    '增量为 0（不涨就不编一个「无限撑」的数）',
  );
  assert.strictEqual(ContextForecast.estimate(steady(), 20000, 20000), null, '窗口已满');
  assert.strictEqual(ContextForecast.estimate(steady(), 0, 5000), null, '窗口未知');
});
