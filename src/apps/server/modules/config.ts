import type { ServerModule } from '../core/serverModule.ts';
// 内核价表单一真源（routePricing.js）：出货默认族在表内或有明确「故意不定价」登记
// （UNPRICED_DEFAULT_FAMILIES，兜底价方向性问题的诚实面）——下发即服务端事实，前端
// 内置表只做拉取失败时的兜底（2026-11-20 遗留 #9 收口）。
import {
  DEFAULT_FALLBACK_PRICE,
  DEFAULT_ROUTE_PRICING,
  UNPRICED_DEFAULT_FAMILIES,
  modelAdapterRegistry,
} from '../../../host/kernel/adapters-model.ts';
import { endpointDefaults } from '../../../host/kernel/util.ts';

/**
 * 配置与模型模块：`config.get/update`、`model.catalog/probe/pricing/adapters`、`usage.stats`。
 * （skills.* 已迁独立域模块 `skills.ts`，2026-11-20 Skill Lab v1。）
 */
export function configModule(): ServerModule {
  return {
    name: 'config',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('config.get', () => Promise.resolve(s.configStore.get()));
      ctx.rpc('config.update', (params) => Promise.resolve(s.configStore.update(params)));
      ctx.rpc('model.catalog', () => Promise.resolve(s.modelCatalog.catalog()));
      // 单价表下发（#S29/#9）：纯静态内核常量，零 service 解引用；会话成本估算由前端
      // ModelPricing 消费（服务端表优先、内置表兜底），路由卡条目单价同源。
      ctx.rpc('model.pricing', () =>
        Promise.resolve({
          pricing: DEFAULT_ROUTE_PRICING,
          unpricedFamilies: UNPRICED_DEFAULT_FAMILIES,
          fallback: DEFAULT_FALLBACK_PRICE,
        }),
      );
      ctx.rpc('model.probe', (params) => s.modelCatalog.probe(params));
      // 适配器凭据面（2026-11-21 P2，Router 卡保存时 env 预检）：registry.ids() 逐个走
      // endpointDefaults.resolveAdapter（env=进程环境），credentialReady=false = 该适配器
      // requiresApiKey 且 env 缺钥——路由条目落到它时 serve 下次装配 fail-closed。
      // 只回布尔与 env 名，不回凭据值。
      ctx.rpc('model.adapters', () =>
        Promise.resolve({
          adapters: modelAdapterRegistry.ids().map((id) => {
            const resolved = endpointDefaults.resolveAdapter(id);
            return {
              id,
              ...(resolved === undefined
                ? { requiresApiKey: false, credentialReady: true }
                : {
                    requiresApiKey: resolved.requiresApiKey,
                    credentialReady: !(resolved.requiresApiKey && resolved.apiKey === undefined),
                    ...(resolved.apiKeyEnv === undefined ? {} : { apiKeyEnv: resolved.apiKeyEnv }),
                  }),
            };
          }),
        }),
      );
      ctx.rpc('usage.stats', () => s.sessionArchive.usage());
    },
  };
}
