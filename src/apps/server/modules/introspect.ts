import type { ServerModule } from '../core/serverModule.ts';

/**
 * 自描述内省模块（2026-11 打磨轮）：`rpc.list` —— 服务端 RPC 面的运行时自述。
 *
 * 为什么要有它：「这个服务端到底提供哪些方法、各归谁管」不该靠翻源码——嵌入方、SDK 用户、
 * 调试者与未来的代码生成器都只需要一次调用。返回**内置模块台账**（方法 → 域模块）与
 * **插件贡献面**（rpc.register 注册的方法 → 插件名）两个来源，与分发顺序（内置 → 插件）同构。
 *
 * 本模块本身也是「加能力 = 1 个模块文件」的示范：新文件 + index.ts 登记 1 行 + parity 快照
 * 有意识地 +1，共三步，其余零改动。
 */
export function introspectModule(): ServerModule {
  return {
    name: 'introspect',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('rpc.list', async () => {
        const builtin = [...s.rpcOwners.entries()].map(([method, owner]) => ({
          method,
          owner,
          source: 'builtin' as const,
        }));
        const plugin = s.plugins.pluginRpcMethods().map(({ method, plugin }) => ({
          method,
          owner: plugin,
          source: 'plugin' as const,
        }));
        return { count: builtin.length + plugin.length, methods: [...builtin, ...plugin] };
      });
    },
  };
}
