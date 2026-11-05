import type { ServerModule } from '../core/serverModule.ts';

/**
 * 线程与回合模块：`threads.*`（创建/续跑/分叉/读取/回退）与 `turns.*`（运行/steering/插话/中断）。
 * 编排逻辑在 {@link TurnOrchestration}（自动化模块共享同一事实源），本模块只做方法注册。
 */
export function threadsModule(): ServerModule {
  return {
    name: 'threads',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('threads.create', (params) => s.turns.createThread(params));
      ctx.rpc('threads.continue', (params) => s.turns.continueThread(params));
      ctx.rpc('threads.fork', (params) => s.turns.forkThread(params));
      ctx.rpc('threads.get', (params) => s.turns.getThread(params));
      ctx.rpc('threads.rewind', (params) => s.turns.rewindThread(params));
      ctx.rpc('turns.run', (params) => s.turns.runTurn(params));
      // A8 steering；2026-10-31 插话分流：相关并入当前回合，无关则取消当前回合、客户端转新任务。
      ctx.rpc('turns.steer', (params) => s.turns.steerTurn(params));
      ctx.rpc('turns.interject', (params) => s.turns.interjectTurn(params));
      ctx.rpc('turns.abort', async (params) => s.turns.abortTurns(params));
    },
  };
}
