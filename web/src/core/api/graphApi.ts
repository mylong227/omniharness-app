// graph 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type {
  GraphSummary,
  GraphGetResult,
  GraphDef,
  GraphRunResult,
  GraphStatusResult,
} from '../../types/models.ts';
import type { ApiTransport } from './rpcTransport.ts';

/** graph 域的 RPC 面。 */
export class GraphApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listGraphs(): Promise<GraphSummary[]> {
    return this.rpc('graph.list', {});
  }
  public getGraph(id: string): Promise<GraphGetResult> {
    return this.rpc('graph.get', { id });
  }
  public deleteGraph(id: string): Promise<unknown> {
    return this.rpc('graph.delete', { id });
  }
  public saveGraph(def: GraphDef): Promise<{ id: string }> {
    return this.rpc('graph.save', { def });
  }
  public runGraphById(id: string): Promise<GraphRunResult> {
    return this.rpc('graph.run', { id });
  }
  public runGraph(def: GraphDef): Promise<GraphRunResult> {
    return this.rpc('graph.run', { def });
  }
  public graphStatus(runId: string): Promise<GraphStatusResult> {
    return this.rpc('graph.status', { runId });
  }
  /**
   * 续跑既有图运行（`graph.resume`）：服务端从该运行的存档读回规格与已完成步骤，
   * **已完成步骤复用产出、其余重跑**。返回与首跑同型的 `{ runId, nodeCount }`
   * （沿用同一个 runId ⇒ 后续 `graph.progress` / `graph.done` / `graphStatus` 的 id 不变）。
   *
   * 存在的意义：客户端此前只有 `runGraph`（能发起）而没有续跑（跑坏了没法接着跑），
   * 服务端 2026-10-08 已提供该 RPC ⇒ 客户端补上同型方法，避免「半边接线」。
   * @param runId 上次 `graph.run` 返回的运行 ID（续跑的定义取自该运行的存档首行）
   * @returns 该次续跑的 `{ runId, nodeCount }`（runId 与传入值相同）
   */
  public resumeGraph(runId: string): Promise<GraphRunResult> {
    return this.rpc('graph.resume', { runId });
  }

  // ---- 工作台界面能力（上下文容量 / 配额 / 会话模式 / 权限档位 / 检索） ----
  // 一组 RPC 支撑三块 UI：上下文容量面板、输入区「+」添加菜单、权限档位面板。

  /** 上下文容量报告：六类 token 分解 + 窗口占比 + 提示缓存命中率。 */
}
