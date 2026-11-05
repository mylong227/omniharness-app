/**
 * 内核对接面 · adapters-model 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { AnthropicModel } from '@omniharness/kernel/kernel/adapters/model/anthropicModel.js';
export type { AnthropicModelConfig } from '@omniharness/kernel/kernel/adapters/model/anthropicModel.js';
export { BudgetedModel } from '@omniharness/kernel/kernel/adapters/model/budgetedModel.js';
export { CostBudget, DEFAULT_SOFT_RATIO } from '@omniharness/kernel/kernel/adapters/model/costBudget.js';
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
