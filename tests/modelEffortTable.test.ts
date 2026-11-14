// 每模型推理档位判据（2026-11-14，docs/design/adaptive-reasoning/ §6）：
// 解析优先级（精确 > 最长前缀 > 厂商档）/ 模型级空数组语义 / 大小写不敏感 /
// 未知厂商与未知模型回落 / catalog() 的 effortsByModel 批量合成。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ModelEffortTable } from '../src/apps/server/services/modelEffortTable.ts';
import { ModelCatalogService } from '../src/apps/server/services/modelCatalogService.ts';

test('effortsFor：openai o 系列收窄到 low–high（比厂商 5 档窄）', () => {
  const provider = ['minimal', 'low', 'medium', 'high', 'xhigh'];
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'o3', provider), ['low', 'medium', 'high']);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'o3-mini', provider), ['low', 'medium', 'high']);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'o4-mini-2025-04-16', provider), ['low', 'medium', 'high']);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'o1-preview', provider), ['low', 'medium', 'high']);
});

test('effortsFor：确证不接收 effort 的模型返回空数组（模型级语义）', () => {
  const provider = ['minimal', 'low', 'medium', 'high', 'xhigh'];
  // 空数组必须**原样返回**而不是回落厂商档——UI 靠它区分"不支持"与"未下发"。
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'gpt-4o', provider), []);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'gpt-4o-mini-2024-07-18', provider), []);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'gpt-4.1', provider), []);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'chatgpt-4o-latest', provider), []);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('deepseek', 'deepseek-chat', ['none', 'max']), []);
});

test('effortsFor：未命中的模型回落厂商档（保守原则：不瞎收窄）', () => {
  const provider = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
  // deepseek-reasoner 与 gpt-5 的档位恰为厂商档，故不登记——改厂商档即跟随。
  assert.deepStrictEqual(ModelEffortTable.effortsFor('deepseek', 'deepseek-reasoner', provider), provider);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'gpt-5.1', provider.slice(1)), provider.slice(1));
  // 完全陌生的厂商/模型：原样透传（undefined 时 UI 走内置兜底）。
  assert.deepStrictEqual(ModelEffortTable.effortsFor('acme', 'acme-1', provider), provider);
  assert.strictEqual(ModelEffortTable.effortsFor('acme', 'acme-1', undefined), undefined);
});

test('effortsFor：精确命中优先于前缀，大小写不敏感', () => {
  // deepseek-chat 是 exact 规则：deepseek-chat-v2 之类前缀变体**不**继承 []（保守回落厂商档）。
  assert.deepStrictEqual(ModelEffortTable.effortsFor('deepseek', 'deepseek-chat', ['none']), []);
  assert.deepStrictEqual(
    ModelEffortTable.effortsFor('deepseek', 'deepseek-chat-v2', ['none', 'low']),
    ['none', 'low'],
  );
  // 模型 id 大小写混写（用户手填自定义端点时常见）也必须命中。
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'GPT-4O', ['low']), []);
  assert.deepStrictEqual(ModelEffortTable.effortsFor('openai', 'O3-Mini', ['low']), ['low', 'medium', 'high']);
});

test('mapFor：批量合成 effortsByModel（空数组进表、未命中不进表）', () => {
  const out = ModelEffortTable.mapFor('openai', ['gpt-4o', 'gpt-5', 'o3']);
  assert.deepStrictEqual(out['gpt-4o'], [], '确证不支持的模型必须显式出现在表里');
  assert.deepStrictEqual(out['o3'], ['low', 'medium', 'high']);
  // 未命中规则（gpt-5 等与厂商档相同的模型）不进 map：UI 据缺字段回落厂商档。
  assert.strictEqual('gpt-5' in out, false);
  assert.strictEqual('deepseek-reasoner' in ModelEffortTable.mapFor('deepseek', ['deepseek-reasoner']), false);
  // 陌生厂商全不进 map。
  assert.deepStrictEqual(ModelEffortTable.mapFor('acme', ['acme-1']), {});
});

test('mapFor：厂商级 [] 不得升格为模型级 []（review P0-1，anthropic/dashscope/ollama 回归防线）', () => {
  // anthropic 等厂商的预设 reasoningEffort 就是 []——若写进模型级 map，UI 会读成
  // "该模型确证不支持"而把整条进度条藏掉。厂商兜底一律不进 map。
  assert.deepStrictEqual(ModelEffortTable.mapFor('anthropic', ['claude-sonnet-4']), {});
});

test('catalog()：active 下发 effortsByModel（与 models 同一清单口径）', () => {
  const service = new ModelCatalogService({
    // baseUrl 必须精确匹配 openai 预设：openai 兼容适配器下 deepseek 排在前面，
    // 只给 modelAdapter='openai' 会按 adapter 匹配命中 deepseek。
    fileConfig: () =>
      ({
        modelAdapter: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'o3',
        providerKeys: { openai: 'sk-test' },
      }) as never,
    adapterOverride: () => undefined,
  });
  const cat = service.catalog() as {
    active?: { id: string; models: string[]; reasoningEffort?: string[]; effortsByModel?: Record<string, string[]> };
  };
  assert.ok(cat.active !== undefined);
  assert.strictEqual(cat.active.id, 'openai');
  // 当前值 o3 一定在 models 里（catalog 契约），effortsByModel 必须覆盖它。
  assert.ok(cat.active.models.includes('o3'));
  assert.deepStrictEqual(cat.active.effortsByModel?.['o3'], ['low', 'medium', 'high']);
});
