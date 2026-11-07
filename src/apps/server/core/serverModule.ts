import { jsonRpc } from '../../../host/kernel/runtime.ts';
import type { AppServerOptions } from './appServerState.ts';
import type { ServerServices } from './serverServices.ts';

/** RPC 处理器签名（与 handlers 表同形）。 */
export type RpcHandler = (params: Record<string, unknown>) => Promise<unknown>;

/**
 * 服务端能力模块契约 —— 「加一个能力 = 新建一个模块文件」的唯一入口。
 *
 * 一个模块 = 一个业务域：在 `register` 里用 `ctx.rpc` 声明自己提供的 RPC 方法，
 * 经 `ctx.services` 取用共享协作者（配置/会话存档/运行时宿主/…）。模块**不做**装配
 * （协作者统一在 {@link ServerServices} 按原顺序构建），**不做**分发（AppServer 统一分发）。
 *
 * 内置模块见 `../modules/index.ts`；嵌入方经 `createOmniHarness({ modules })` 或
 * `new AppServer({ ..., modules })` 追加自定义模块，与本表同权注册（同名冲突启动即抛错）。
 */
export interface ServerModule {
  /** 模块名（诊断与 parity 快照用）。 */
  readonly name: string;
  /**
   * 注册本模块的 RPC 方法与（未来的）订阅。
   * @param ctx 注册上下文（rpc 注册器 + 共享服务 + 通知/错误工具）
   */
  register(ctx: ServerModuleContext): void;
}

/** 模块注册上下文。 */
export interface ServerModuleContext {
  /** 共享协作者与运行态（强类型门面，装配顺序见 ServerServices 构造器）。 */
  readonly services: ServerServices;
  /**
   * 声明一个 RPC 方法。同名方法重复注册（无论来自哪个模块）立即抛错——
   * 「两处各自以为自己在管同一个方法」是静默覆盖缺陷的温床，必须在启动期暴露。
   * @param method RPC 方法名（如 `threads.create`）
   * @param handler 处理器
   */
  rpc(method: string, handler: RpcHandler): void;
  /**
   * 向所有客户端广播一条 JSON-RPC 通知（SSE/stdio 同路）。
   * @param event 通知名（如 `memory.changed`）
   * @param params 通知载荷
   */
  notify(event: string, params: Record<string, unknown>): void;
  /** 提取错误消息（Error 取 message，其余 String() 化）。 */
  messageOf(error: unknown): string;
}

/**
 * 标识模块（恒等函数）：给嵌入方一个显式的类型锚点。
 * @param module 模块定义。
 * @returns 原模块。
 */
export function defineModule(module: ServerModule): ServerModule {
  return module;
}

/**
 * 把模块依次注册进方法表。
 * @param modules 模块列表（顺序即注册顺序；后注册者撞名即抛错）。
 * @param services 共享服务。
 * @param options 服务端选项（通知与可注入面）。
 * @returns `handlers` 分发方法表 + `owners` 注册台账（方法 → 模块名，供 parity 快照测试）。
 */
export function registerModules(
  modules: readonly ServerModule[],
  services: ServerServices,
  options: AppServerOptions,
): { handlers: Map<string, RpcHandler>; owners: Map<string, string> } {
  const handlers = new Map<string, RpcHandler>();
  const owners = new Map<string, string>();
  for (const module of modules) {
    const ctx: ServerModuleContext = {
      services,
      rpc: (method, handler) => {
        const previous = owners.get(method);
        if (previous !== undefined) {
          throw new Error(
            `RPC 方法 ${method} 被重复注册：模块 ${previous} 与 ${module.name} 冲突（fail-closed）`,
          );
        }
        owners.set(method, module.name);
        handlers.set(method, handler);
      },
      notify: (event, params) => options.transport.send(jsonRpc.notify(event, params)),
      messageOf: (error) => (error instanceof Error ? error.message : String(error)),
    };
    module.register(ctx);
  }
  return { handlers, owners };
}
