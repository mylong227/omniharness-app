/**
 * 内核对接面 · adapters-model 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { AnthropicModel } from '@omniharness/kernel/kernel/adapters/model/anthropicModel.js';
export type { AnthropicModelConfig } from '@omniharness/kernel/kernel/adapters/model/anthropicModel.js';
export { BudgetedModel } from '@omniharness/kernel/kernel/adapters/model/budgetedModel.js';
export { CostBudget } from '@omniharness/kernel/kernel/adapters/model/costBudget.js';
export type { BudgetSnapshot } from '@omniharness/kernel/kernel/adapters/model/costBudget.js';
export { LlamaCppModel } from '@omniharness/kernel/kernel/adapters/model/llamaCppModel.js';
export type { LlamaCppConfig } from '@omniharness/kernel/kernel/adapters/model/llamaCppModel.js';
export { MockModel } from '@omniharness/kernel/kernel/adapters/model/mockModel.js';
export { MOCK_ADAPTER_ID, modelAdapterRegistry } from '@omniharness/kernel/kernel/adapters/model/modelAdapterRegistry.js';
export { OpenAiCompatibleModel } from '@omniharness/kernel/kernel/adapters/model/openAiCompatibleModel.js';
export type { OpenAiCompatibleConfig } from '@omniharness/kernel/kernel/adapters/model/openAiCompatibleModel.js';
export { ResponsesModel } from '@omniharness/kernel/kernel/adapters/model/responsesModel.js';
export type { ResponsesConfig } from '@omniharness/kernel/kernel/adapters/model/responsesModel.js';
export { DEFAULT_RETRY_POLICY, RetryingModel } from '@omniharness/kernel/kernel/adapters/model/retryingModel.js';
export type { DelayFn, RetryPolicy } from '@omniharness/kernel/kernel/adapters/model/retryingModel.js';
export { DEFAULT_FALLBACK_PRICE, DEFAULT_ROUTE_PRICING, RoutePricing } from '@omniharness/kernel/kernel/adapters/model/routePricing.js';
export { SseParser } from '@omniharness/kernel/kernel/adapters/model/sseParser.js';
export type { SseEvent } from '@omniharness/kernel/kernel/adapters/model/sseParser.js';
