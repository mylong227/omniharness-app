import type { ServerModule } from '../core/serverModule.ts';

/**
 * 自动化任务模块：`automations.*`（列表/创建/删除/启停/立即运行）。
 *
 * 存储来自组合根注入（`options.automations`）——**仅 HTTP serve 路径接线**（见
 * composedServerCore 的 serve-only 边界登记）：stdio 面下 `automations.list` 回空表、其余方法
 * 经 `requireStore` fail-closed，这是登记过的边界而非缺陷。`automations.run` 经
 * {@link TurnOrchestration.createThread} 触发真回合（与 `threads.create` 同一事实源）。
 */
export function automationsModule(): ServerModule {
  return {
    name: 'automations',
    register(ctx) {
      const s = ctx.services;
      const store = s.options.automations;
      const requireStore = () => {
        if (store === undefined) throw new Error('自动化未接线');
        return store;
      };
      ctx.rpc('automations.list', () => Promise.resolve(store?.list() ?? []));
      ctx.rpc('automations.create', (params) => Promise.resolve(requireStore().create(params)));
      ctx.rpc('automations.delete', (params) =>
        Promise.resolve(requireStore().delete(String(params['id'] ?? ''))),
      );
      ctx.rpc('automations.setEnabled', (params) => {
        const id = String(params['id'] ?? '');
        return Promise.resolve(requireStore().setEnabled(id, params['enabled'] === true));
      });
      ctx.rpc('automations.run', async (params) => {
        const target = requireStore();
        const id = String(params['id'] ?? '');
        const automation = target.get(id);
        if (automation === undefined) throw new Error('自动化不存在');
        const result = await s.turns.createThread({ prompt: automation.prompt });
        target.markRun(id);
        return result;
      });
    },
  };
}
