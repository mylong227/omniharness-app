import type { ServerModule } from '../core/serverModule.ts';

/**
 * 工作区与文件模块：`workspace.*`（列表/添加/切换）、`fs.*`（树/读/浏览/建目录）、
 * `attach.read` 与 `changes.list`。
 *
 * fs.* / attach.read 自 2026-10-18 起是**异步 IO**（不再 `*Sync` 堵事件循环）：
 * handler 直接返回 Promise。
 */
export function workspaceModule(): ServerModule {
  return {
    name: 'workspace',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('workspace.list', () => Promise.resolve(s.configStore.workspaces()));
      ctx.rpc('workspace.add', (params) =>
        Promise.resolve(s.configStore.addWorkspace(params['path'])),
      );
      ctx.rpc('workspace.switch', (params) =>
        Promise.resolve(s.switchWorkspace(params['path'])),
      );
      ctx.rpc('fs.list', (params) => Promise.resolve(s.workspaceTree.list(params)));
      ctx.rpc('fs.read', (params) => Promise.resolve(s.workspaceTree.readFile(params)));
      ctx.rpc('changes.list', (params) => Promise.resolve(s.workspaceChanges.list(params)));
      ctx.rpc('fs.browse', (params) => s.fsExplorer.browse(params));
      ctx.rpc('fs.mkdir', (params) => s.fsExplorer.mkdir(params));
      ctx.rpc('attach.read', (params) => s.fsExplorer.readAttachments(params));
    },
  };
}
