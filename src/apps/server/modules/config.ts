import type { ServerModule } from '../core/serverModule.ts';

/**
 * 配置与模型模块：`config.get/update`、`model.catalog/probe`、`skills.list`、`usage.stats`。
 */
export function configModule(): ServerModule {
  return {
    name: 'config',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('config.get', () => Promise.resolve(s.configStore.get()));
      ctx.rpc('config.update', (params) => Promise.resolve(s.configStore.update(params)));
      ctx.rpc('model.catalog', () => Promise.resolve(s.modelCatalog.catalog()));
      // 技能选择器（Web 输入框 `/`）：只读名称/描述/标签，不回传完整 instructions。
      ctx.rpc('skills.list', () =>
        Promise.resolve({
          skills: (s.options.skills?.list() ?? []).map((skill) => ({
            name: skill.name,
            description: skill.description,
            tags: skill.tags ?? [],
          })),
        }),
      );
      ctx.rpc('model.probe', (params) => s.modelCatalog.probe(params));
      ctx.rpc('usage.stats', () => s.sessionArchive.usage());
    },
  };
}
