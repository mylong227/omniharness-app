import type { ServerModule } from '../core/serverModule.ts';

/**
 * 工作台界面模块（原 Surface 层）：为 UI 的上下文容量面板、添加菜单与权限面板提供 RPC
 * ——`context.usage`、`quota.*`、`modes.*`、`approval.tiers`、`agents.list`、`search.all`
 * 与「归入项目」（`sessions.setWorkspace`）。
 *
 * 本模块只做参数校验后转发；领域逻辑在协作者里（各自可单测）。
 */
export function surfaceModule(): ServerModule {
  return {
    name: 'surface',
    register(ctx) {
      const s = ctx.services;
      const stringParam = (params: Record<string, unknown>, key: string): string => {
        const value = params[key];
        return typeof value === 'string' ? value : '';
      };
      ctx.rpc('context.usage', async (params) =>
        s.contextUsage.usage(s.usageThreadId(stringParam(params, 'threadId'))),
      );
      ctx.rpc('quota.get', async () => s.quota.status());
      ctx.rpc('quota.set', async (params) => {
        const patch: { dailyTokens?: number } = {};
        // `plan` 不再受理（2026-10-17）：档位由当前模型自动识别（QuotaPlans.forModel）。
        // 旧客户端若仍传 plan，这里**忽略并照常返回状态**——而不是报错打断它：
        // 档位本来就不是它能决定的东西，回给它的 status.plan 已经是识别结果。
        const daily = params['dailyTokens'];
        if (typeof daily === 'number') patch.dailyTokens = daily;
        return s.quota.update(patch);
      });
      ctx.rpc('modes.get', async (params) => s.modes.get(stringParam(params, 'threadId')));
      ctx.rpc('modes.set', async (params) => {
        const threadId = stringParam(params, 'threadId');
        if (threadId === '') throw new Error('modes.set 需要 threadId');
        const patch: { goal?: string; planMode?: boolean; sketchMode?: boolean } = {};
        const goal = params['goal'];
        if (typeof goal === 'string') patch.goal = goal;
        const planMode = params['planMode'];
        if (typeof planMode === 'boolean') patch.planMode = planMode;
        const sketchMode = params['sketchMode'];
        if (typeof sketchMode === 'boolean') patch.sketchMode = sketchMode;
        return s.modes.set(threadId, patch);
      });
      // 把会话**归入指定项目**（侧栏右键「归入当前项目」）：只改存档首行 session_meta.workspace；
      // 目标目录先经 configStore 校验存在（fail-closed），运行中的会话由存档的 runningChecker 拒绝。
      ctx.rpc('sessions.setWorkspace', async (params) => {
        const sessionId = stringParam(params, 'sessionId');
        // 运行中的会话不允许改写归属（存档正被 write-behind 追加）；注释与实现必须一致。
        if (s.activeTurns.has(sessionId)) {
          throw new Error('会话正在运行，暂不能修改归属（结束后再试）');
        }
        return s.assignSessionWorkspace(
          sessionId,
          s.requireDirectory(stringParam(params, 'workspace')),
        );
      });
      ctx.rpc('approval.tiers', async () => ({ tiers: s.approvalTiers.all() }));
      ctx.rpc('agents.list', async () => s.agents.list());
      ctx.rpc('search.all', async (params) => {
        const query = stringParam(params, 'query');
        const limit = typeof params['limit'] === 'number' ? (params['limit'] as number) : undefined;
        return s.search.search(query, limit);
      });
    },
  };
}
