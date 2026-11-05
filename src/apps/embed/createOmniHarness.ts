import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { ConfigFactory } from '../../host/kernel/config.ts';
import type {
  ApprovalPort,
  EventPort,
  ModelPort,
  ResolvedConfig,
  SandboxPort,
  StoragePort,
} from '../../host/kernel/contracts.ts';
import { MockModel } from '../../host/kernel/adapters-model.ts';
import { AutoApproval } from '../../host/kernel/adapters-approval.ts';
import { PassthroughSandbox } from '../../host/kernel/adapters-sandbox.ts';
import { MemoryStorage, SilentEventPort } from '../../host/kernel/adapters-misc.ts';
import { OmniHome } from '../../host/kernel/util.ts';
import { AppServer } from '../server/core/appServer.ts';
import type { AppServerOptions } from '../server/core/appServerState.ts';
import { defineModule, type ServerModule } from '../server/core/serverModule.ts';
import { HttpBridgeTransport } from '../server/transport/httpBridgeTransport.ts';
import { ServerEventBridge } from '../server/core/serverEventBridge.ts';
import { HttpServer } from '../server/transport/httpServer.ts';
import { LineTransport, type Transport } from '../server/transport/lineTransport.ts';

export { defineModule };
export type { ServerModule };

/**
 * createOmniHarness —— 嵌入方「3 行跑起来」的唯一入口（2026-11 模块化重构的对外门面）。
 *
 * ```ts
 * import { createOmniHarness } from '@omniharness/app';
 * const harness = await createOmniHarness({ transport: { http: { port: 0 } } });
 * console.log(harness.url);            // http://127.0.0.1:<port>/?token=…
 * await harness.run();                 // 常驻（http 或 stdio）
 * ```
 *
 * 缺省即安全可用：MockModel（零凭据）+ MemoryStorage + AutoApproval + PassthroughSandbox，
 * 与内核 `examples/headless.mjs` 同一口径；给真实 `ModelPort` 即接任意厂商。
 * 自定义能力经 `modules: [defineModule({ name, register(ctx) { ctx.rpc(...) } })]`
 * 与内置 91 个 RPC 同权注册（同名冲突启动即抛错）。
 */
export interface OmniHarnessInput {
  /** 工作区根（缺省 `process.cwd()`）。 */
  readonly workspace?: string;
  /** 模型端口（缺省 `MockModel`：脚本化应答，零凭据可跑）。 */
  readonly model?: ModelPort;
  /** 存储端口（缺省 `MemoryStorage`：进程内；要持久化给 `JsonlStorage`）。 */
  readonly storage?: StoragePort;
  /** 审批端口（缺省 `AutoApproval`：自动放行——生产环境请换 `RuleApproval`）。 */
  readonly approvals?: ApprovalPort;
  /** 沙箱端口（缺省 `PassthroughSandbox`：不隔离——生产环境请换 `PolicySandbox`）。 */
  readonly sandbox?: SandboxPort;
  /** 事件端口（缺省：http 模式走 SSE 桥，stdio 模式静默）。 */
  readonly events?: EventPort;
  /**
   * 传输：`'stdio'`（逐行 JSON-RPC，缺省）或 `{ http: { port?, host?, token? } }`
   * （HTTP + SSE + 静态工作台），或直接给一个 `Transport` 实现。
   */
  readonly transport?:
    | 'stdio'
    | {
        readonly http?: {
          readonly port?: number;
          readonly host?: string;
          readonly token?: string;
        };
      }
    | Transport;
  /** 嵌入方自定义模块（与本表同权注册 RPC；同名冲突启动即抛错）。 */
  readonly modules?: readonly ServerModule[];
  /** 插件目录（缺省 `~/.omniharness/plugins`）。 */
  readonly pluginsDir?: string;
  /** 工作台静态目录（http 模式；缺省仓库内 `web/dist`，嵌入方可指向自己的构建产物）。 */
  readonly webDir?: string;
  /** 完整接管配置的高级口（给了则忽略上面各端口语）。 */
  readonly config?: ResolvedConfig;
}

/** createOmniHarness 的句柄：常驻与收尾。 */
export interface OmniHarnessHandle {
  readonly app: AppServer;
  /** http 模式：带 token 的工作台地址（stdio 模式 undefined）。 */
  readonly url: string | undefined;
  /** http 模式：实际监听端口。 */
  readonly port: number | undefined;
  /** 常驻：http 模式挂起在服务器上；stdio 模式挂起在 stdin 上。 */
  run(): Promise<void>;
  /** 优雅收尾（取消在跑回合 → 关服务器/传输）。 */
  close(): Promise<void>;
}

/** 传输模式的解析结果。 */
type TransportMode =
  | { readonly kind: 'stdio' }
  | { readonly kind: 'injected'; readonly transport: Transport }
  | {
      readonly kind: 'http';
      readonly host: string;
      readonly port: number;
      readonly token: string;
    };

/** 解析传输模式（有 onMessage 的对象视为注入的 Transport；否则视为 http 规格容器）。 */
function resolveTransport(input: OmniHarnessInput): TransportMode {
  const t = input.transport;
  if (t === undefined || t === 'stdio') return { kind: 'stdio' };
  const candidate = t as Partial<Transport>;
  if (typeof candidate.onMessage === 'function') {
    return { kind: 'injected', transport: t as Transport };
  }
  const http = (t as { http?: { port?: number; host?: string; token?: string } }).http ?? {};
  return {
    kind: 'http',
    host: http.host ?? '127.0.0.1',
    port: http.port ?? 0,
    token: http.token ?? randomBytes(24).toString('hex'),
  };
}

/** stdio 逐行传输（与 CLI `runServer` 同一形态：一行一条 JSON-RPC）。 */
function makeLineTransport(): Transport {
  return new LineTransport(
    (onLine) => {
      createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', onLine);
    },
    (line) => process.stdout.write(`${line}\n`),
  );
}

/**
 * 装配一个完整 OmniHarness 服务端（配置 → AppServer → 传输）。
 * @param input 见 {@link OmniHarnessInput}。
 * @returns 句柄（run/close）。
 */
export async function createOmniHarness(input: OmniHarnessInput = {}): Promise<OmniHarnessHandle> {
  const workspaceRoot = resolve(input.workspace ?? process.cwd());
  const pluginsDir = input.pluginsDir ?? join(OmniHome.dir(), 'plugins');
  const mode = resolveTransport(input);
  const basePorts = {
    workspaceRoot,
    model: input.model ?? new MockModel(),
    storage: input.storage ?? new MemoryStorage(),
    approvals: input.approvals ?? new AutoApproval(),
    sandbox: input.sandbox ?? new PassthroughSandbox(),
  };

  // ── HTTP 模式：桥 + 静态工作台 + token 门禁 ───────────────────────────────────
  if (mode.kind === 'http') {
    const bridge = new HttpBridgeTransport();
    // 与 serve 组合根同一形态：事件桥包住传输（SSE 广播 + 审批/提问上行），同一实例
    // 既进 config.events（工具问询）也进 options.eventBridge（question.respond 的挂起表）。
    const eventBridge = new ServerEventBridge({ transport: bridge });
    const config =
      input.config ??
      ConfigFactory.build({
        ...basePorts,
        maxSteps: 0, // 0 = 不限（与 CLI CliDefaults.maxSteps 同口径）
        events: input.events ?? eventBridge.eventPort(),
      });
    const options: AppServerOptions = {
      config,
      transport: bridge,
      eventBridge,
      pluginsDir,
      workspaceRoot,
      modules: input.modules,
    };
    const app = new AppServer(options);
    const server = new HttpServer({
      app,
      bridge,
      webDir: input.webDir ?? defaultWebDir(),
      workspaceRoot: () => app.effectiveWorkspace(),
      host: mode.host,
      authToken: mode.token,
    });
    const actualPort = await server.start(mode.port);
    const shownHost = mode.host === '0.0.0.0' ? '127.0.0.1' : mode.host;
    return {
      app,
      url: `http://${shownHost}:${actualPort}/?token=${mode.token}`,
      port: actualPort,
      run: () => new Promise(() => undefined),
      close: async () => {
        await app.shutdown();
        await server.close();
      },
    };
  }

  // ── stdio / 注入 Transport 模式 ──────────────────────────────────────────────
  const transport =
    mode.kind === 'injected' ? mode.transport : makeLineTransport();
  const config =
    input.config ??
    ConfigFactory.build({
      ...basePorts,
      maxSteps: 0, // 0 = 不限（与 CLI CliDefaults.maxSteps 同口径）
      events: input.events ?? new SilentEventPort(),
    });
  const options: AppServerOptions = {
    config,
    transport,
    pluginsDir,
    workspaceRoot,
    modules: input.modules,
  };
  const app = new AppServer(options);
  await app.loadPlugins();
  return {
    app,
    url: undefined,
    port: undefined,
    run: () => new Promise(() => undefined),
    close: async () => {
      await app.shutdown();
    },
  };
}

/** 缺省工作台目录：仓库内 `web/dist`（存在才给；否则 HttpServer 只服务 RPC 面）。 */
function defaultWebDir(): string {
  const candidates = [resolve('web/dist'), resolve(import.meta.dirname, '../../../../web/dist')];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return candidates[0]!;
}
