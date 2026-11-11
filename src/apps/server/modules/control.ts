import type { ServerModule } from '../core/serverModule.ts';

/**
 * 控制室模块（2026-11-10）：编队 / 上下文 / 凭证域 RPC（v1/P2/P3）。
 *
 * **读**：`fleet.list` / `fleet.patch` / `context.studio` / `proof.turns` / `proof.build` /
 * `proof.export` / `proof.verify`。
 * **写（全部要求显式确认）**：`fleet.cancel`（只 abort 单条子调用）、`fleet.applyPatch`
 * （git apply 主工作区）、`context.handoff.add/clear`（工作区便签）、`context.compact`
 * （写回压缩游标）。
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
      ctx.rpc('fleet.applyPatch', async (params) => {
        const path = stringOf(params['path']);
        return s.fleetPatchApplier.apply(path, params['confirm'] === true);
      });
      ctx.rpc('fleet.cancel', async (params) => {
        return s.fleetControl.cancel(stringOf(params['callId']));
      });
      ctx.rpc('context.studio', async (params) => {
        const threadId = stringOf(params['threadId']);
        return s.contextStudio.snapshotOf(threadId);
      });
      ctx.rpc('context.handoff.add', async (params) => {
        const text = stringOf(params['text']);
        const tags = tagsOf(params['tags']);
        return s.contextStudio.appendHandoff(text, tags) ?? null;
      });
      ctx.rpc('context.handoff.clear', async () => {
        return { ok: s.contextStudio.clearHandoff() };
      });
      ctx.rpc('context.compact', async (params) => {
        if (params['confirm'] !== true) {
          return {
            ok: false,
            code: 'confirm_required',
            message: '手动压缩会改写历史游标；必须显式确认。',
          };
        }
        return s.contextCompaction.compactOf(stringOf(params['threadId']));
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

/**
 * 取标签数组（只保留字符串项；非数组返回 undefined）。
 * @param raw 原始参数。
 * @returns 标签数组或 undefined。
 */
function tagsOf(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((item): item is string => typeof item === 'string');
}
