import type { ServerModule } from '../core/serverModule.ts';
import { numberOf, stringOf } from './rpcParams.ts';

/**
 * 凭证模块（2026-11-20 批次三从 control.ts 按域拆出）：回合凭证的读 / 构建 / 导出 / 验证。
 * 入参校验在模块层（服务层保持纯数据）；非法回合下标透传给服务层报 proof_invalid。
 */
export function proofModule(): ServerModule {
  return {
    name: 'proof',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('proof.turns', async (params) => {
        const threadId = stringOf(params['threadId']);
        return s.proof.turnsOf(threadId);
      });
      ctx.rpc('proof.build', async (params) => {
        const threadId = stringOf(params['threadId']);
        return s.proof.buildOf(threadId, numberOf(params['turnIndex']));
      });
      ctx.rpc('proof.export', async (params) => {
        const threadId = stringOf(params['threadId']);
        return s.proof.exportOf(threadId, numberOf(params['turnIndex']));
      });
      ctx.rpc('proof.verify', async (params) => {
        return s.proofVerifier.verifyOf(params['bundle']);
      });
    },
  };
}
