import { PluginLoader } from '../../../host/kernel/plugin.js';
import { PluginProfileStore, type PluginProfile } from '../../../host/kernel/plugin.js';
import { PluginBundler } from '../../../host/kernel/plugin.js';
import type { PluginRegistry } from '../../../host/kernel/plugin.js';
import type { ServerModule } from '../core/serverModule.ts';
import type { ServerServices } from '../core/serverServices.ts';

/**
 * 插件生态模块（原 Handlers 层三族合一）：插件市场（`plugins.*`）、插件集 Profile
 * （`profile.*`，G-E 5.1 命名插件组合）、Bundle 发布单元（`bundle.*`，G-E 5.2/5.3）。
 *
 * 插件市场在注册表未注入时不暴露（保持可选依赖）——`register` 里直接不注册那些方法。
 */
export function pluginsModule(): ServerModule {
  return {
    name: 'plugins',
    register(ctx) {
      const s = ctx.services;
      registerProfileHandlers(s, ctx);
      registerBundleHandlers(s, ctx);
      registerMarketHandlers(s, ctx);
    },
  };
}

/**
 * 插件集 Profile RPC（G-E 5.1，命名插件组合）：增删查 + 应用 + 当前激活集。
 */
function registerProfileHandlers(
  s: ServerServices,
  ctx: import('../core/serverModule.ts').ServerModuleContext,
): void {
  const workspaceRoot = () => s.displayConfig['workspace'] ?? process.cwd();
  const storeOf = () => new PluginProfileStore(workspaceRoot());

  ctx.rpc('profile.list', async () => storeOf().list());
  ctx.rpc('profile.save', async (params) => {
    const profile = params['profile'] as PluginProfile | undefined;
    if (profile === undefined || typeof profile.name !== 'string') {
      throw new Error('profile.save 需要 profile.name');
    }
    return { id: storeOf().save(profile) };
  });
  ctx.rpc('profile.delete', async (params) => {
    const id = params['id'];
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('profile.delete 需要 id');
    }
    return { ok: storeOf().delete(id) };
  });
  ctx.rpc('profile.active', async () => {
    await s.plugins.ensure();
    return { plugins: s.pluginManager?.names() ?? [] };
  });
  ctx.rpc('profile.apply', async (params) => {
    await s.plugins.ensure();
    const registry = s.options.registry;
    const manager = s.pluginManager;
    const pluginsDir = s.pluginsDir;
    if (registry === undefined || manager === undefined || pluginsDir === undefined) {
      throw new Error('插件系统未初始化（serve 需注入 registry/pluginsDir）');
    }
    // 解析 profile：优先 store 内按 id，其次内联 profile 对象
    let profile: PluginProfile | undefined;
    const idOrName = params['id'];
    if (typeof idOrName === 'string' && idOrName.length > 0) {
      profile = storeOf().get(idOrName);
    }
    if (
      profile === undefined &&
      (params['profile'] as PluginProfile | undefined)?.name !== undefined
    ) {
      profile = params['profile'] as PluginProfile;
    }
    if (profile === undefined) {
      throw new Error('profile.apply 需要有效的 id 或内联 profile');
    }
    const result = await PluginProfileStore.applyProfile(manager, pluginsDir, registry, profile, {
      onInstall: (name) => ctx.notify('profile.event', { type: 'install', name }),
      onLoad: (name) => ctx.notify('profile.event', { type: 'load', name }),
      onUnload: (name) => ctx.notify('profile.event', { type: 'unload', name }),
      onError: (name, error) =>
        ctx.notify('profile.error', { name, error: ctx.messageOf(error) }),
    });
    ctx.notify('profile.applied', { name: profile.name, ...result });
    return result;
  });
}

/**
 * Bundle 发布单元 RPC（G-E 5.2/5.3，可 patch 插件叠层 + 发布单元）。
 */
function registerBundleHandlers(
  s: ServerServices,
  ctx: import('../core/serverModule.ts').ServerModuleContext,
): void {
  const workspaceRoot = () => s.displayConfig['workspace'] ?? process.cwd();
  const storeOf = () => new PluginProfileStore(workspaceRoot());

  ctx.rpc('bundle.pack', async (params) => {
    const registry = s.options.registry;
    const pluginsDir = s.pluginsDir;
    if (registry === undefined || pluginsDir === undefined) {
      throw new Error('插件系统未初始化（serve 需注入 registry/pluginsDir）');
    }
    // 解析 profile：store 内按 id，或内联 profile 对象
    let profile: PluginProfile | undefined;
    const idOrName = params['id'];
    if (typeof idOrName === 'string' && idOrName.length > 0) {
      profile = storeOf().get(idOrName);
    }
    if (
      profile === undefined &&
      (params['profile'] as PluginProfile | undefined)?.name !== undefined
    ) {
      profile = params['profile'] as PluginProfile;
    }
    if (profile === undefined) {
      throw new Error('bundle.pack 需要有效的 id 或内联 profile');
    }
    const keyFile = typeof params['keyFile'] === 'string' ? params['keyFile'] : undefined;
    const result = await PluginBundler.packBundle({
      workspaceDir: workspaceRoot(),
      profile,
      registry,
      pluginsDir,
      keyFile,
    });
    return { path: result.path, manifest: result.manifest };
  });
  ctx.rpc('bundle.unpack', async (params) => {
    const zipPath = params['zipPath'];
    const pluginsDir = s.pluginsDir;
    if (typeof zipPath !== 'string' || zipPath.length === 0) {
      throw new Error('bundle.unpack 需要 zipPath');
    }
    if (pluginsDir === undefined) {
      throw new Error('插件系统未初始化（serve 需注入 pluginsDir）');
    }
    const keyFile = typeof params['keyFile'] === 'string' ? params['keyFile'] : undefined;
    const result = await PluginBundler.unpackBundle({
      zipPath,
      pluginsDir,
      workspaceDir: workspaceRoot(),
      keyFile,
    });
    return {
      manifest: result.manifest,
      installed: result.installed,
      patchFile: result.patchFile,
    };
  });
}

/**
 * 插件市场 RPC：registry 未注入则不暴露（保持可选依赖）。
 */
function registerMarketHandlers(
  s: ServerServices,
  ctx: import('../core/serverModule.ts').ServerModuleContext,
): void {
  const registry: PluginRegistry | undefined = s.options.registry;
  if (registry === undefined) {
    return;
  }
  ctx.rpc('plugins.list', async () => {
    // 启动优化后插件在 listen 之后加载：市场列表必须等 Profile 也应用完，避免“加载中空库”。
    await s.awaitPlugins();
    await s.plugins.ensure();
    const list = await registry.list();
    const loaded = new Set(s.pluginManager?.names() ?? []);
    return list.map((m) => ({ ...m, loaded: loaded.has(m.name) }));
  });
  ctx.rpc('plugins.search', async (params) => {
    await s.awaitPlugins();
    await s.plugins.ensure();
    const query = typeof params['query'] === 'string' ? params['query'] : undefined;
    const all = await registry.search(query);
    const loaded = new Set(s.pluginManager?.names() ?? []);
    return all.map((d) => ({
      ...d,
      manifest: { ...d.manifest, loaded: loaded.has(d.manifest.name) },
    }));
  });
  ctx.rpc('plugins.install', (params) => {
    const name = params['name'];
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('plugins.install 需要 name');
    }
    return registry.install(name);
  });
  ctx.rpc('plugins.remove', (params) => {
    const name = params['name'];
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('plugins.remove 需要 name');
    }
    return registry.remove(name).then(() => ({ ok: true, name }));
  });
  ctx.rpc('plugins.reload', async () => {
    await s.plugins.ensure();
    if (s.pluginManager === undefined || s.pluginsDir === undefined) {
      return { ok: false, reason: '插件目录未配置' };
    }
    const loaded = await PluginLoader.loadInstalledPlugins(
      s.pluginManager,
      s.pluginsDir,
      (name, error) => ctx.notify('plugin.loadError', { name, error: ctx.messageOf(error) }),
      undefined,
      s.displayConfig['workspace'] ?? process.cwd(),
    );
    if (loaded.length > 0) {
      ctx.notify('plugin.loaded', { names: loaded, reloaded: true });
    }
    return { ok: true, loaded };
  });
}
