import type { ServerModule } from '../core/serverModule.ts';

/**
 * 会话检查点 / 回滚模块：`checkpoint.list` / `checkpoint.create` / `checkpoint.rollback`
 * （对话 + 代码；委托 {@link SessionCheckpoints}）。
 */
export function checkpointsModule(): ServerModule {
  return {
    name: 'checkpoints',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('checkpoint.list', (params) => s.checkpoints.list(params));
      ctx.rpc('checkpoint.create', (params) => s.checkpoints.create(params));
      ctx.rpc('checkpoint.rollback', (params) => s.checkpoints.rollback(params));
    },
  };
}
