// 面向对象的服务层：封装与后端的所有 JSON-RPC 2.0 通信与 /metrics 拉取。
// 组件层只依赖本类，不直接 fetch，便于替换与单测。

import { authToken } from './authToken.ts';
import {
  AutomationsApi,
  ConfigApi,
  ContextApi,
  ControlApi,
  DecisionApi,
  FleetApi,
  GovernanceApi,
  GraphApi,
  MemoryApi,
  ObservabilityApi,
  PluginsApi,
  ProfileApi,
  ProofApi,
  ReviewApi,
  SessionsApi,
  SkillsApi,
  ThreadsApi,
  VaultApi,
  WorkspaceApi,
} from './api/index.ts';
import type { Metrics } from '../types/models.ts';
import { L } from './localize.ts';

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * 后端桥接超时的稳定 JSON-RPC 错误码（协议面单一真源在后端
 * `src/apps/server/transport/httpBridgeTransport.ts` 的 errorCodeFor）：
 * `turns.run` 等长 RPC 超出桥接等待窗（缺省 60s）时后端回 `-32002`——
 * **回合可能仍在后台继续**。此前前端用正则匹配翻译后文案（`/RPC 超时/`）来识别
 * 这个场景：en 词条一变就静默失效（2026-11-18 硬编码清理批次改为码位判定）。
 */
export const SERVER_WAIT_TIMEOUT_CODE = -32002;

/**
 * 调用方参数问题码（JSON-RPC 2.0 标准 Invalid params；语义单一真源在后端
 * `src/apps/server/core/rpcErrorCodes.ts`——域模块「X 需要 Y / 未找到 X / 拒绝」形态的
 * 错误判此码，错误信息本身已说明缺什么）。
 */
export const INVALID_PARAMS_CODE = -32602;

/** RPC 失败的稳定种类（渲染层据此给**可执行**建议；文案与判定解耦）。 */
export type RpcErrorKind = 'rpc-error' | 'auth' | 'http-status' | 'bad-json' | 'network';

/** 带稳定种类的 RPC 错误：`kind`/`status`/`code` 供调用方分类，`message` 是已本地化的展示文案。 */
export class RpcError extends Error {
  /** 稳定种类。 */
  public readonly kind: RpcErrorKind;
  /** HTTP 状态码（kind = 'http-status' 时存在）。 */
  public readonly status: number | undefined;
  /** JSON-RPC 协议错误码（后端回 error 对象时存在；如桥接超时 -32002）。 */
  public readonly code: number | undefined;

  /**
   * @param kind 稳定种类。
   * @param message 已本地化的展示文案。
   * @param status HTTP 状态码（可选）。
   * @param code JSON-RPC 协议错误码（可选）。
   */
  public constructor(kind: RpcErrorKind, message: string, status?: number, code?: number) {
    super(message);
    this.name = 'RpcError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }

  /**
   * 把任意抛出值分类成稳定种类（非 RpcError 的未知错误返回 undefined）。
   * @param error 抛出值。
   * @returns 稳定种类；未知错误 undefined。
   */
  public static kindOf(error: unknown): RpcErrorKind | undefined {
    return error instanceof RpcError ? error.kind : undefined;
  }
}

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: JsonRpcError;
}

/**
 * ApiClient（W4 域拆分后 = **传输本体 + 域组合根**）：
 *  - 传输本体：统一 JSON-RPC 2.0 入口 `rpc()`（错误分类 RpcError / 鉴权头 / nextId）
 *    与两个非 RPC 面（`/healthz` 预览端口探针、`/metrics` 拉取解析）；
 *  - 域组合根：19 个域对象（threads/control/config/observability/workspace/sessions/review/
 *    profile/memory/plugins/skills/automations/vault/governance/graph/context/fleet/proof/decision），
 *    方法自本类原样迁移到 `core/api/<domain>Api.ts`（`this.rpc` 字面量形态保留，
 *    apiClientParity 提取源已同步扩到 core/api/ 目录）。
 *
 * 组件层只依赖本类，不直接 fetch；调用形态从 `api.listSessions(...)` 变为
 * `api.sessions.listSessions(...)`（与服务端模块域对齐，W4 一次性改写）。
 */
export class ApiClient {
  private nextId = 0;

  // ---- 域组合（W4）----
  /** threads 域 RPC 面（W4 域拆分）。 */
  public readonly threads = new ThreadsApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** control 域 RPC 面（W4 域拆分）。 */
  public readonly control = new ControlApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** config 域 RPC 面（W4 域拆分）。 */
  public readonly config = new ConfigApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** observability 域 RPC 面（W4 域拆分）。 */
  public readonly observability = new ObservabilityApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** workspace 域 RPC 面（W4 域拆分）。 */
  public readonly workspace = new WorkspaceApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** sessions 域 RPC 面（W4 域拆分）。 */
  public readonly sessions = new SessionsApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** review 域 RPC 面（W4 域拆分）。 */
  public readonly review = new ReviewApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** profile 域 RPC 面（W4 域拆分）。 */
  public readonly profile = new ProfileApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** memory 域 RPC 面（W4 域拆分）。 */
  public readonly memory = new MemoryApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** plugins 域 RPC 面（W4 域拆分）。 */
  public readonly plugins = new PluginsApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** skills 域 RPC 面（W4 域拆分）。 */
  public readonly skills = new SkillsApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** automations 域 RPC 面（W4 域拆分）。 */
  public readonly automations = new AutomationsApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** vault 域 RPC 面（W4 域拆分）。 */
  public readonly vault = new VaultApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** governance 域 RPC 面（W4 域拆分）。 */
  public readonly governance = new GovernanceApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** graph 域 RPC 面（W4 域拆分）。 */
  public readonly graph = new GraphApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** context 域 RPC 面（W4 域拆分）。 */
  public readonly context = new ContextApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** fleet 域 RPC 面（W4 域拆分）。 */
  public readonly fleet = new FleetApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** proof 域 RPC 面（W4 域拆分）。 */
  public readonly proof = new ProofApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );
  /** decision 域 RPC 面（W4 域拆分）。 */
  public readonly decision = new DecisionApi(
    <T = unknown>(method: string, params?: Record<string, unknown>) => this.rpc<T>(method, params),
  );


  /**
   * 构造请求头：基础 Content-Type 之外，当配置了访问令牌时附带 `Authorization: Bearer <token>`，
   * 使服务端启用 OMNI_SERVE_TOKEN 门禁后前端仍能正常通信（#A10 修复）。
   * @returns 合并后的请求头。
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = authToken.resolve();
    if (token !== '') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /** 统一的 JSON-RPC 2.0 调用入口；失败时抛出带稳定 kind 的 RpcError（见 RpcErrorKind）。 */
  public async rpc<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.nextId;
    let res: Response;
    try {
      res = await fetch('/rpc', {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
    } catch (error) {
      // fetch 自身失败 = 传输层不可达（服务未运行 / 断网 / 代理拒答）。此前落进通用
      // 「检查 API Key」提示是误导（2026-11-18 硬编码清理批次：网络失败首次可分类）。
      const reason = error instanceof Error ? error.message : String(error);
      throw new RpcError('network', L('无法连接服务端（服务未运行或网络不可达）：{reason}', { reason }));
    }
    // 归因必须保住：只有「JSON-RPC error **对象**」才当作协议错误读它的 message。
    // 曾经无条件 `data.error.message || 'RPC 错误'`，而 HTTP 500 的兜底体是 `{"error":"internal"}`
    // ——`error` 是字符串，`.message` 为 undefined，于是任何服务端异常在界面上都退化成同一句
    // 无归因的「RPC 错误」（2026-09-27 用户报的那句就是这么来的）。此处按「协议层 → 传输层」顺序
    // 逐级报出真实原因；`res.ok === false` 才判传输失败，以便轻量桩（只给 json()）继续可用。
    const data = (await Promise.resolve(res.json()).catch(() => undefined)) as
      | JsonRpcResponse<T>
      | undefined;
    if (data !== undefined && typeof data.error === 'object' && data.error !== null) {
      throw new RpcError(
        'rpc-error',
        data.error.message || L('RPC 错误（code {code}）', { code: data.error.code }),
        undefined,
        data.error.code,
      );
    }
    if (res.ok === false) {
      // 401 单列（2026-11-06 审计 P2）：令牌失效/服务端重启换令牌时，用户需要的不是
      // 一面板「HTTP 401」报错，而是一句「重新用带 token 的地址打开」。发全局事件供
      // App 挂授权提示横幅；SSE 的 EventSource 不暴露状态码，401 提示只能由 RPC 路径触发。
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omni:auth-required'));
        throw new RpcError(
          'auth',
          L('需要授权：令牌缺失或已失效——请重新用服务端打印的带 token 地址打开'),
          res.status,
        );
      }
      throw new RpcError('http-status', L('RPC 请求失败：HTTP {status}', { status: res.status }), res.status);
    }
    if (data === undefined) {
      throw new RpcError('bad-json', L('RPC 响应不是合法 JSON'));
    }
    return data.result as T;
  }

  /**
   * 取服务端「工作区网页预览源」的端口（`/healthz` 的可选字段 `previewPort`）。
   *
   * 为什么走探针而不是 RPC：预览源由 HTTP 层在绑定主端口之后启动，它的端口是**运行时事实**；
   * `/healthz` 本来就是公开的运行时自述，加一个可选字段即可，不必为一个只读端口新增 RPC 方法
   * （新增 RPC 要改协议面、SDK 与稳定性基线）。
   * @returns 有效端口；未启用 / 探针不可达 / 字段非法时 null（调用方按"本地预览不可用"处理）
   */
  public async getPreviewPort(): Promise<number | null> {
    let res: Response;
    try {
      res = await fetch('/healthz', { headers: this.buildHeaders() });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const body = (await Promise.resolve(res.json()).catch(() => undefined)) as
      | { previewPort?: unknown }
      | undefined;
    const port = body?.previewPort;
    return typeof port === 'number' && Number.isInteger(port) && port > 0 && port <= 65535
      ? port
      : null;
  }

  /**
   * 拉取 /metrics 并解析。服务端返回 Prometheus 文本格式（# HELP / metric lines），
   * 此处做轻量解析：omni_sessions gauge → sessions；omni_events_total{type="x"} → eventsByType。
   * 早期版本误用 res.json() 解析必挂，导致指标面板永远停在「读取中…」。
   */
  public async fetchMetrics(): Promise<Metrics> {
    let res: Response;
    try {
      res = await fetch('/metrics', { headers: this.buildHeaders() });
    } catch (error) {
      // 传输层不可达与其他 rpc() 路径同一分类口径（kind=network），消费方据此给
      // 「服务端不可达」类建议而不是误导性的换模型/查 Key（2026-11-18 硬编码清理批次延续）。
      const reason = error instanceof Error ? error.message : String(error);
      throw new RpcError('network', L('无法连接服务端（服务未运行或网络不可达）：{reason}', { reason }));
    }
    if (!res.ok) throw new RpcError('http-status', L('metrics 请求失败：{status}', { status: res.status }), res.status);
    const text = await res.text();
    const metrics: Metrics = { sessions: 0, eventsByType: {} };
    const labelOf = (line: string, key: string): string | undefined => {
      const m = line.match(new RegExp(key + '="([^"]*)"'));
      return m?.[1];
    };
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line === '' || line.startsWith('#')) continue;
      const sp = line.lastIndexOf(' ');
      if (sp <= 0) continue;
      const name = line.slice(0, sp).replace(/\{.*\}$/, '').trim();
      const value = Number(line.slice(sp + 1).trim());
      if (!Number.isFinite(value)) continue;
      if (name === 'omni_sessions') {
        metrics.sessions = Math.round(value);
      } else if (name === 'omni_events_total') {
        const type = labelOf(line, 'type');
        if (type !== undefined) metrics.eventsByType![type] = Math.round(value);
      }
    }
    return metrics;
  }
}
