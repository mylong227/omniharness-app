import type { ServerModule } from '../core/serverModule.ts';

/**
 * 控制室模块（2026-11-10）：编队 / 上下文 / 凭证域的 RPC 注册（设计 §7.1 v1 + P2 交付闭环）。
 *
 * **只读**：`fleet.list` / `fleet.patch` / `context.studio` / `proof.turns` / `proof.build` /
 * `proof.export` / `proof.verify`。不触碰任何写路径：
 *  - `fleet.patch`：只读 patch 目录内普通文件，512 KB 上限；
 *  - `proof.verify`：只复核外部 AuditBundle，不写会话、不信任包内签名。
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
      ctx.rpc('fleet.patch', async (params) => {
        const path = stringOf(params['path']);
        return s.fleetPatch.read(path);
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
      ctx.rpc('proof.verify', async (params) => {
        return s.proofVerifier.verifyOf(params['bundle']);
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
