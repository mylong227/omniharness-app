// ModelPricing：内置参考价 + 最长前缀匹配 + 缓存折扣的纯模型判据。
// 口径：查不到的模型一律 null（宁缺毋滥）；估算结果是量级参考不是账单。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ModelPricing, PRICES_AS_OF } from '../src/ui/models/ModelPricing.ts';

test('priceOf：最长前缀命中（同族不同代不串价），大小写不敏感', () => {
  // claude-haiku-4-5 命中 4 代族（1/5），而不是 3.5 代的 0.8/4
  const haiku45 = ModelPricing.priceOf('claude-haiku-4-5-20251001');
  assert.equal(haiku45?.inputUsd, 1);
  assert.equal(haiku45?.outputUsd, 5);
  // claude-haiku-3-5 命中 3.5 代条目（真实 API 形态 claude-3-5-haiku-<date>）
  const haiku35 = ModelPricing.priceOf('claude-3-5-haiku-20241022');
  assert.equal(haiku35?.inputUsd, 0.8);
  // gemini-2.5-flash-lite 比 gemini-2.5-flash 更长，必须优先命中（0.1 而不是 0.3）
  assert.equal(ModelPricing.priceOf('gemini-2.5-flash-lite-preview')?.inputUsd, 0.1);
  // 大小写与空白：OpenAI 兼容端点常回大写/带空格的模型名
  assert.equal(ModelPricing.priceOf('  GPT-4O ')?.inputUsd, 2.5);
  // 查不到的模型一律 null（宁缺毋滥）
  assert.equal(ModelPricing.priceOf('qwen-max-2026-01-25'), null);
  assert.equal(ModelPricing.priceOf(''), null);
});

test('estimate：未命中输入/缓存命中/输出三段分开计，合计为和', () => {
  // deepseek-chat：输入 0.28 / 缓存 0.028 / 输出 0.42（每 1M）
  const e = ModelPricing.estimate('deepseek-chat', {
    promptTokens: 1_000_000,
    completionTokens: 500_000,
    cachedPromptTokens: 400_000,
  });
  assert.ok(e !== null);
  // 未命中 60 万 × 0.28 + 缓存 40 万 × 0.028 = 0.168 + 0.0112
  assert.ok(Math.abs(e.inputUsd - 0.1792) < 1e-9);
  assert.ok(Math.abs(e.outputUsd - 0.21) < 1e-9);
  assert.ok(Math.abs(e.totalUsd - (e.inputUsd + e.outputUsd)) < 1e-12);
});

test('estimate：缓存价缺省按输入价不打折；缓存超出 prompt 按上限钳制；脏数据按 0', () => {
  // claude-sonnet-4 无 cachedInputUsd：缓存命中按输入价
  const noDiscount = ModelPricing.estimate('claude-sonnet-4', {
    promptTokens: 1_000_000,
    completionTokens: 0,
    cachedPromptTokens: 1_000_000,
  });
  assert.ok(noDiscount !== null);
  assert.ok(Math.abs(noDiscount.inputUsd - 3) < 1e-9);
  // 缓存 > prompt：按 prompt 钳制，绝不出现负的未命中段
  const clamped = ModelPricing.estimate('gpt-4o', {
    promptTokens: 100,
    completionTokens: 0,
    cachedPromptTokens: 9_999,
  });
  assert.ok(clamped !== null && clamped.inputUsd > 0);
  // 负数 / NaN / 无穷按 0 → 输入输出都是 0
  const dirty = ModelPricing.estimate('gpt-4o', {
    promptTokens: Number.NaN,
    completionTokens: -5,
  });
  assert.ok(dirty !== null && dirty.totalUsd === 0);
  // 未知模型：null（会话摘要据此不累计）
  assert.equal(ModelPricing.estimate('unknown-model-x', { promptTokens: 100, completionTokens: 10 }), null);
});

test('formatUsd：量级感知位数（<1 四位 / <100 两位 / 其余整数）', () => {
  assert.equal(ModelPricing.formatUsd(0.01234), '$0.0123');
  assert.equal(ModelPricing.formatUsd(3.456), '$3.46');
  assert.equal(ModelPricing.formatUsd(120.4), '$120');
});

test('PRICES_AS_OF 是日期形态快照（展示侧会引用它声明参考价时效）', () => {
  assert.match(PRICES_AS_OF, /^\d{4}-\d{2}-\d{2}$/);
});
