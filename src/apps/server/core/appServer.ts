import { jsonRpc, type RpcMessage } from '../../../host/kernel/runtime.ts';
import type { AppServerOptions } from './appServerState.ts';
import { registerModules, type RpcHandler, type ServerModule } from './serverModule.ts';
import { ServerServices } from './serverServices.ts';
import { coreModules } from '../modules/index.ts';
import type { ServerAutomations } from '../services/serverAutomations.ts';
import { providerPresets } from '../services/providerPresets.ts';
import type { PluginProfile, ApplyProfileResult } from '../../../host/kernel/plugin.js';

export type { AppServerOptions } from './appServerState.ts';

/**
 * app-server：JSON-RPC 原语（threads/turns/items）+ 事件推送 + 审批上行。
 *
 * ## 2026-11 模块化重构（取代原 7 层继承链）
 *
 * 原结构 `AppServerBase → Handlers → Surface → Governance → Observability → Vault → AppServer`
 * 是被「上帝类」行数门禁逼出来的分层，91 个 `handlers.set` 散布 6 个文件，加一个能力要改 6~9 个文件。
 * 现在的结构：
 *   - **装配**：全部协作者在 {@link ServerServices} 按原顺序构建（逐字节等价搬移）；
 *   - **注册**：93 个 RPC 方法按业务域拆进 `../modules/*`（每域一个模块文件，见 `coreModules()`）；
 *   - **本类**只剩三件事——组装（services + modules + 传输挂钩 + 调度器）、分发（`handle`）、
 *     生命周期（`loadPlugins` / `setPluginsReady` / `applyPluginProfile` / `shutdown` / `effectiveWorkspace`）。
 *
 * 嵌入方追加自定义模块：`new AppServer({ ..., modules: [defineModule(...)] })`
 * 或经 `createOmniHarness({ modules })`；与本表同权注册，同名冲突启动即抛错。
 */
export class AppServer {
  /** 共享服务门面（协作者 + 运行态 + 跨域操作）。 */
  private readonly services: ServerServices;
  /** RPC 方法表（模块注册产出；分发唯一事实源）。 */
  private readonly handlers: Map<string, RpcHandler>;
  /** 自动化调度器（仅注入 automations 存储时启用）。 */
  private readonly automationScheduler?: ServerAutomations;

  /**
   * 装配共享服务与全部模块，注册传输层监听并启动可选调度器。
   * @param options app-server 选项（transport、config、workspaceRoot、audit、modules 等）
   */
  public constructor(options: AppServerOptions) {
    this.services = new ServerServices(options);
    const registered = registerModules(
      [...coreModules(), ...(options.modules ?? [])],
      this.services,
      options,
    );
    this.handlers = registered.handlers;
    // 台账交给共享服务（rpc.list 内省模块在请求期读取）。
    this.services.rpcOwners = registered.owners;
    // 插件 RPC 面（2026-11 能力开放）：内置方法表为保留面——插件注册同名即加载失败；
    // 分发顺序：内置模块 → 插件贡献 → 404。提供器是惰性的（插件在 listen 后才加载）。
    this.services.plugins.setReservedRpcProvider(() => new Set(this.handlers.keys()));
    if (options.automations !== undefined) {
      // M30 双定时器统一：注入的 ServerAutomations 自带调度核心（RoutineScheduler，
      // scope='server'）与执行语义（先落 lastRun / 单条失败可观测 / 防重入）。
      this.automationScheduler = options.automations;
      this.automationScheduler.start(async (automation) => {
        await this.services.turns.createThread({ prompt: automation.prompt });
      });
    }
    options.transport.onMessage((message) => void this.handle(message));
    // 启动时异步探测一次当前 active 厂商（fire-and-forget，不阻塞 listen）。
    // 解决「页面刷新时模型下拉只有当前选中那一个」#OBS-4：探测拿到真实 /v1/models 后
    // 注入 probeCache，UI 重新拉 model.catalog 就能列出厂商全部模型。
    void this.warmActiveProvider();
  }

  /**
   * 处理入站消息。
   * @param message 入站 RPC 消息（非请求或未知方法按协议回错误响应）。
   * @returns 处理完成（响应已写回传输层）后 resolve，无载荷。
   */
  protected async handle(message: RpcMessage): Promise<void> {
    if (!jsonRpc.isRequest(message)) {
      return;
    }
    // 分发顺序：内置模块 → 插件贡献（rpc.register 面）→ 404。
    const handler = this.handlers.get(message.method) ?? this.pluginHandlerOf(message.method);
    if (handler === undefined) {
      this.services.options.transport.send(
        jsonRpc.errorResponse(message.id, -32601, `方法不存在: ${message.method}`),
      );
      return;
    }
    try {
      const result = await handler(message.params ?? {});
      this.services.options.transport.send(jsonRpc.response(message.id, result));
    } catch (error) {
      this.services.options.transport.send(
        jsonRpc.errorResponse(message.id, -32000, this.services.messageOf(error)),
      );
    }
  }

  /** 插件贡献的 RPC 处理器（内置模块未命中时兜底；无插件面则 undefined）。 */
  private pluginHandlerOf(method: string): RpcHandler | undefined {
    return this.services.plugins.rpcHandlerOf(method);
  }

  /**
   * 暖当前 active 厂商的 /v1/models 缓存。失败静默（probeCache 不被覆盖，UI 用兜底清单）。
   * @returns 探测完成后 resolve，无载荷（结果写入 modelCatalog 的 probeCache）
   */
  private async warmActiveProvider(): Promise<void> {
    try {
      // 只探测当前 active 厂商（按 baseUrl 严格匹配 → 否则按 modelAdapter 匹配第一个有 key 的预设），
      // 不全表扫 7 个厂商，避免启动慢、流量浪费。
      const file = this.services.configStore.fileConfig();
      const keys = file.providerKeys ?? {};
      const topKey = typeof file.apiKey === 'string' ? file.apiKey : undefined;
      // 生效目录含用户 `providerPresets` 覆盖：自建厂商配了 Key 也应被暖一遍。
      const presets = providerPresets.resolve(file.providerPresets);
      const matched =
        presets.find((p) => typeof file.baseUrl === 'string' && file.baseUrl === p.baseUrl) ??
        // 注意：必须要求该厂商在 providerKeys 或顶层 apiKey 中有 key，否则探测无意义（无凭据）。
        presets.find(
          (p) =>
            p.adapter === file.modelAdapter && (topKey !== undefined || keys[p.id] !== undefined),
        );
      const target = matched?.id;
      // 没匹配到厂商（纯 mock 或无凭据）就什么都不做，避免无意义探测。
      if (target === undefined) return;
      await this.services.modelCatalog.probe({ provider: target });
    } catch {
      // 静默失败：探测走 HTTP，UI 后台再点「检测」按钮也能补。
    }
  }

  /**
   * 启动阶段加载已安装插件（闭环 G-B：市场安装 → 运行时可用）。
   * @returns 加载完成后 resolve，无载荷。
   */
  public async loadPlugins(): Promise<void> {
    await this.services.plugins.load();
  }

  /**
   * 登记插件就绪 Promise（启动优化，2026-10-25）：把加载放到 listen 之后并行跑，
   * 真正需要插件的回合在开始时 await 这道闸门，语义不变。
   * @param ready 插件与 Profile 都完成的 Promise（失败应自行 catch，闸门不向回合抛错）。
   */
  public setPluginsReady(ready: Promise<void>): void {
    this.services.setPluginsReady(ready);
  }

  /**
   * 应用插件集 Profile（CLI --plugin-profile / 编程入口复用）。
   * @param profile 插件集档案（启用的插件与来源配置）。
   * @returns 应用结果（成功 / 失败明细）。
   */
  public async applyPluginProfile(profile: PluginProfile): Promise<ApplyProfileResult> {
    return this.services.applyPluginProfile(profile);
  }

  /**
   * 当前生效的工作区根（#OBS-11）：HTTP /files 路由与 RPC fs.read 共用。
   * @returns 当前工作区根目录路径。
   */
  public effectiveWorkspace(): string {
    return this.services.effectiveWorkspace();
  }

  /**
   * 优雅收尾：取消全部在跑回合并等待其落盘（最多 5s）。
   *
   * 2026-10-21：`serve` 的 SIGINT 收尾此前只 `server.close()`，在飞回合被直接掐断，
   * EventPersister 的 200ms write-behind 窗口与回合末 flush 都来不及跑。这里先发
   * `'shutdown'` 取消（模型 fetch 被 abort → 回合走 finally flush + save），再等
   * runningSessionIds 清空；超时则如实放弃等待（不无限挂住 Ctrl-C）。
   * @returns 等待结束（无论是否全部收尾）后 resolve。
   */
  public async shutdown(): Promise<void> {
    this.automationScheduler?.stop();
    const agent = this.services.runtime.agent();
    agent.cancelCurrentRun('shutdown');
    const deadline = Date.now() + 5_000;
    while (agent.runningSessionIds().length > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await this.services.plugins.shutdown();
  }
}

// 类型面提示：模块经 AppServerOptions.modules 注入（见 appServerState.ts）。
export type { ServerModule };
