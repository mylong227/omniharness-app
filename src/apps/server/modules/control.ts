import type { ServerModule } from '../core/serverModule.ts';

/**
 * 控制室模块（2026-11-10）：编队 / 上下文 / 凭证三个只读域的 RPC 注册（设计 §7.1 v1 范围）。
 *
 * **v1 只加 5 个只读方法**，不触碰任何写路径：
 *  - `fleet.list`：父会话的子代理车道快照（运行中 + 已回传）；
 *  - `context.studio`：六类构成 + 压缩记录 + 便签（v1 只读，便签未接线如实标注）；
 *  - `proof.turns` / `proof.build` / `proof.export`：回合列表 / 证书+六项复核 / 证据包导出。
 *
 * 入参校验在模块层（服务层保持纯数据）；会话 id 一律原样透传给服务，由服务 fail-soft 返回
 * 空快照或判别失败，**绝不抛 JSON-RPC 错误打断面板**。
 */
export function controlModule(): ServerModule {
  return {
    name: 'control',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('fleet.list', async (params) => {
        const threadId = stringOf(params['threadId']);
        const traceExists = async (sessionId: string): Promise<boolean> =>
          s.sessionTraceExists(sessionId);
        return s.fleet.snapshotOf(threadId, traceExists);
      });
      ctx.rpc('context.studio', async (params) => {
        const threadId = stringOf(params['threadId']);
        return s.contextStudio.snapshotOf(threadId);
      });
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
    },
  };
}

/**
 * 取字符串参数（缺省空串——服务层按「未选会话」处理，与 `context.usage` 口径一致）。
 * @param raw 原始参数值。
 * @returns 字符串；非字符串时为空串。
 */
function stringOf(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

/**
 * 取数字参数（回合下标；非法值由服务层报 proof_invalid，不在此猜默认值）。
 * @param raw 原始参数值。
 * @returns 数字；非有限数时为 NaN（透传给服务层校验）。
 */
function numberOf(raw: unknown): number {
  return typeof raw === 'number' ? raw : Number.NaN;
}
