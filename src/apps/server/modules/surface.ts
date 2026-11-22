import type { ServerModule } from '../core/serverModule.ts';
import { stringOf } from './rpcParams.ts';

/**
 * 工作台界面模块（2026-11-20 批次三清仓后）：只剩**跨切查询**三件——权限档位表
 * （）、子代理清单（）与全局搜索（）。
 * 原先混装的按域方法已归位：context.usage→contextStudio、quota.→observability、
 * modes.→threads、sessions.setWorkspace→sessions（parity owner 判据同步）。
 *
 * 本模块只做参数校验后转发；领域逻辑在协作者里（各自可单测）。
 */
export function surfaceModule(): ServerModule {
  return {
    name: 'surface',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('approval.tiers', async () => ({ tiers: s.approvalTiers.all() }));
      ctx.rpc('agents.list', async () => s.agents.list());
      ctx.rpc('search.all', async (params) => {
        const query = stringOf(params['query']);
        const limit = typeof params['limit'] === 'number' ? (params['limit'] as number) : undefined;
        return s.search.search(query, limit);
      });
    },
  };
}
