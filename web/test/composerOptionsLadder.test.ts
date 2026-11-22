// 模型选择弹窗的档位逻辑单测：验证「进度条口径」的强度阶梯。
//
// 为什么单开一份而不是塞进 uiModels.test.mjs：这里检验的是**顺序语义**——
// 进度条把档位画成填充比例，顺序即读数，顺序错了整条进度就是错的。
// 而它依赖服务端下发的 `reasoningEffort`（各厂商字典不同），所以必须把
// 「厂商给了顺序」「厂商没给顺序」「出现未知档位」三种情况都钉住。
// 全部为纯逻辑，node 直跑 web/dist 编译产物。

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ComposerOptions } from '../src/ui/models/ComposerOptions.ts';

test('ladder：厂商下发的顺序即强度序（不得被内置表重排）', () => {
  // deepseek 风格：none → max，且不含 minimal/xhigh。
  const out = ComposerOptions.ladder(['none', 'low', 'medium', 'high', 'max']);
  assert.deepStrictEqual(
    out.map((o) => o.value),
    ['none', 'low', 'medium', 'high', 'max'],
  );
});

test('ladder：同厂商词表顺序被打乱时，按内置强度序纠正（进度条读数不能依赖下发顺序）', () => {
  // 口径说明（2026-10-17 决策）：进度条把档位画成**填充比例**，而 `reasoningEffort`
  // 的契约只保证"是合法集合"，**不保证有序**。若直接采信数组顺序，同一组档位换个下发顺序
  // 就会画出不同的强度读数（high 可能显示成比 low 弱），这是不可接受的。
  // 所以：**已知档位一律按内置标准强度序排列**（词表相同 ⇒ 结果与厂商顺序一致，
  // 因为约定的词表本身就是有序的）；只有**未知档位**才退回"按下发顺序追加到末尾"。
  const out = ComposerOptions.ladder(['high', 'medium', 'low']);
  assert.deepStrictEqual(
    out.map((o) => o.value),
    ['low', 'medium', 'high'],
  );
});

test('ladder：厂商词表顺序与内置强度序一致时，结果不变（这是常态）', () => {
  const out = ComposerOptions.ladder(['none', 'low', 'medium', 'high', 'max']);
  assert.deepStrictEqual(
    out.map((o) => o.value),
    ['none', 'low', 'medium', 'high', 'max'],
  );
});

test('ladder：未下发时用内置兜底阶梯', () => {
  const out = ComposerOptions.ladder(undefined);
  assert.deepStrictEqual(
    out.map((o) => o.value),
    ['minimal', 'low', 'medium', 'high', 'xhigh'],
  );
});

test('ladder：空数组不下发 ≠ 无档位（按未下发处理，避免进度条消失）', () => {
  // 契约与 reasoning() 一致：空数组语义是"没有档位可挑"，此处用于进度条，
  // 故按兜底阶梯渲染，而不是渲染出 0 段（0 段的进度条是坏 UI）。
  const out = ComposerOptions.ladder([]);
  assert.ok(out.length > 0, '空数组不应产出 0 段进度条');
});

test('ladder：未知档位排到已知档位之后，且保持彼此相对顺序', () => {
  const out = ComposerOptions.ladder(['turbo', 'low', 'hyper', 'high']);
  const values = out.map((o) => o.value);
  assert.deepStrictEqual(values.slice(0, 2), ['low', 'high'], '已知档位按内置强度序在前');
  assert.deepStrictEqual(values.slice(2), ['turbo', 'hyper'], '未知档位按下发顺序排后');
});

test('ladder：当前值不在阶梯里时追加到末尾（不猜它的强度）', () => {
  const out = ComposerOptions.ladder(['low', 'medium'], 'weird');
  assert.deepStrictEqual(
    out.map((o) => o.value),
    ['low', 'medium', 'weird'],
  );
});

test('ladder：不属于该厂商的当前值被标记 unsupported（防进度条读数虚高）', () => {
  // 真实场景：换模型后 config.get 仍是 reasoning:'medium'，而新厂商只给 ['low','high']。
  // 进度条若不标记，会把 medium 当第 3 段填满 ⇒ 看起来比 high 还强（读数虚高）。
  const out = ComposerOptions.ladder(['low', 'high'], 'medium');
  assert.deepStrictEqual(
    out.map((o) => o.value),
    ['low', 'high', 'medium'],
  );
  assert.strictEqual(out[0].unsupported, undefined, '厂商支持的档位不得带标记');
  assert.strictEqual(out[1].unsupported, undefined);
  assert.strictEqual(out[2].unsupported, true, '不在合法集合里的当前值必须带标记');
});

test('ladder：当前值属于该厂商时不带 unsupported 标记', () => {
  const out = ComposerOptions.ladder(['low', 'medium', 'high'], 'medium');
  assert.ok(
    out.every((o) => o.unsupported === undefined),
    '全部档位都合法时不应出现任何 unsupported 标记',
  );
});

test('ladder：当前值已在阶梯里时不重复追加', () => {
  const out = ComposerOptions.ladder(['low', 'medium'], 'low');
  assert.deepStrictEqual(
    out.map((o) => o.value),
    ['low', 'medium'],
  );
});

test('ladder：去重且保序', () => {
  const out = ComposerOptions.ladder(['low', 'low', 'high', 'high']);
  assert.deepStrictEqual(
    out.map((o) => o.value),
    ['low', 'high'],
  );
});

test('reasoningLabel：已知档位给中文标签，未知档位原样返回', () => {
  assert.strictEqual(ComposerOptions.reasoningLabel('none'), '无');
  assert.strictEqual(ComposerOptions.reasoningLabel('medium'), '中');
  assert.strictEqual(ComposerOptions.reasoningLabel('xhigh'), '极强');
  assert.strictEqual(ComposerOptions.reasoningLabel('brand-new-level'), 'brand-new-level');
});

test('ladder 的标签与 reasoning() 的标签同源（两处不得漂移）', () => {
  const levels = ['none', 'low', 'medium', 'high', 'max'];
  const ladder = ComposerOptions.ladder(levels);
  const list = ComposerOptions.reasoning('', levels);
  for (const l of ladder) {
    const hit = list.find((o) => o.value === l.value);
    assert.ok(hit !== undefined, `ladder 档位 ${l.value} 必须也在候选清单里`);
    assert.strictEqual(l.label, hit.label, `档位 ${l.value} 的标签两处必须一致`);
  }
});

test('progress 口径：下标即填充段数（前端据此判断"第几段高亮"）', () => {
  const ladder = ComposerOptions.ladder(['none', 'low', 'medium', 'high']);
  const step = ladder.findIndex((o) => o.value === 'medium');
  assert.strictEqual(step, 2, 'medium 在第 3 段 ⇒ 前 3 段填实心');
  assert.strictEqual(ladder.length, 4);
});

// ---- adaptive-reasoning（2026-11-14，docs/design/adaptive-reasoning/ §5）----

test('effortsFor：模型级真值优先（含确证的空数组）', () => {
  const byModel = { 'gpt-4o': [], o3: ['low', 'medium', 'high'] };
  // 空数组必须**原样返回**：它是"该模型确证不接收 effort"的真值，
  // 回落厂商档会让不支持 effort 的模型重新渲染出假进度条。
  assert.deepStrictEqual(ComposerOptions.effortsFor('gpt-4o', byModel, ['minimal', 'high']), []);
  assert.deepStrictEqual(ComposerOptions.effortsFor('o3', byModel, ['minimal', 'high']), ['low', 'medium', 'high']);
});

test('effortsFor：模型不在表里回落厂商档；表整体未下发（旧服务端）同', () => {
  const provider = ['low', 'medium', 'high'];
  assert.deepStrictEqual(ComposerOptions.effortsFor('unknown-model', { o3: provider }, provider), provider);
  assert.deepStrictEqual(ComposerOptions.effortsFor('o3', undefined, provider), provider, '旧服务端无 effortsByModel');
  assert.strictEqual(ComposerOptions.effortsFor('o3', undefined, undefined), undefined, '两端都未知 → UI 内置兜底');
});

test('closestLevel：越界值钳到最近的强度档（序数距离）', () => {
  assert.strictEqual(ComposerOptions.closestLevel(['low', 'medium', 'high'], 'xhigh'), 'high', '超上限 → 钳到 max 端');
  assert.strictEqual(ComposerOptions.closestLevel(['low', 'medium', 'high'], 'minimal'), 'low', '低于下限 → 钳到 min 端');
  assert.strictEqual(ComposerOptions.closestLevel(['low', 'high'], 'medium'), 'high', '居中 → 距离相同取更强（用户要强的意图）');
  assert.strictEqual(ComposerOptions.closestLevel(['none', 'low', 'medium'], 'max'), 'medium');
});

test('closestLevel：值已在集合内原样返回；空集合与未设置值都返回空串（守卫）', () => {
  assert.strictEqual(ComposerOptions.closestLevel(['low', 'medium', 'high'], 'medium'), 'medium');
  // changeModel 对"确证不支持"的模型根本不调 closestLevel（保留原值偏好）；
  // 这两条是防御性守卫：空集合/未设置值都不产生钳制结果。
  assert.strictEqual(ComposerOptions.closestLevel([], 'xhigh'), '');
  assert.strictEqual(ComposerOptions.closestLevel(['low', 'medium', 'high'], ''), '');
});

test('closestLevel：当前值为空串（未设置）不钳到最强档——未设置不是越界（review P1-1）', () => {
  // 若把 '' 当未知强度钳到最强，等于替用户悄悄开启推理。
  assert.strictEqual(ComposerOptions.closestLevel(['low', 'medium', 'high'], ''), '');
});

test('closestLevel：当前值强度未知时钳到集合最强档；未知档位参与排序不破坏已知序', () => {
  assert.strictEqual(ComposerOptions.closestLevel(['low', 'medium'], 'weird'), 'medium', '未知强度按最强处理');
  // 集合含未知档位（'turbo' 排在词表末尾之后）：已知档位距离照常计算。
  assert.strictEqual(ComposerOptions.closestLevel(['turbo', 'low'], 'medium'), 'low');
  assert.strictEqual(ComposerOptions.closestLevel(['low', 'turbo'], 'weird2'), 'turbo', '两个未知强度互比取集合靠后项（同为未知，先到先得）');
});
