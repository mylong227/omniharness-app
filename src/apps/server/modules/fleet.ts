import type { ServerModule } from '../core/serverModule.ts';
import { stringOf } from './rpcParams.ts';

/**
 * 编队模块（2026-11-20 批次三从 control.ts 按域拆出）：编队快照读 + 补丁读写 + 取消。
 *
 * **写（全部要求显式确认）**：`fleet.cancel`（只 abort 单条子调用）、`fleet.applyPatch`
 * （git apply 主工作区）。入参校验在模块层（服务层保持纯数据）；会话 id 一律原样透传给
 * 服务，由服务 fail-soft 返回空快照，**绝不抛 JSON-RPC 错误打断面板**。
 */
export function fleetModule(): ServerModule {
  return {
    name: 'fleet',
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
    },
  };
}
