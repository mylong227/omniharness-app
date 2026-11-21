// observability 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** observability 域的 RPC 面。 */
export class ObservabilityApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public usageStats(): Promise<{
    source: 'disk' | 'live';
    dir: string;
    byModel: Record<string, { calls: number; prompt: number; completion: number; total: number }>;
    total: { calls: number; prompt: number; completion: number; total: number };
    sessions: { sessionId: string; calls: number; total: number }[];
  }> {
    return this.rpc('usage.stats', {});
  }
  /** 厂商连通探测：真实请求 /models，返回实测状态与模型清单。 */
  public daemonStatus(): Promise<{ running: boolean; pid?: number }> {
    return this.rpc('daemon.status', {});
  }
  /**
   * 环境诊断报告（只读，2026-10-11 Web 交付）。
   *
   * 注意返回体是**判别联合**：`ok:false` 表示服务端**未接线**（serve 未注入实现），
   * 面板必须如实显示"未接线"，**不得**把它渲染成"一切正常"。
   * @param workspaceRoot 可选工作区（缺省由服务端取自身工作区）。
   * @returns `{ok:true, report}` 或 `{ok:false, reason}`。
   */
  public doctorReport(workspaceRoot?: string): Promise<
    | { ok: true; report: import('../../types/models.ts').DoctorReportLike }
    | { ok: false; reason: string }
  > {
    return this.rpc('doctor.report', workspaceRoot === undefined ? {} : { workspaceRoot });
  }

  /**
   * 内核健康快照（只读，2026-11-15 alpha.19 哨兵桥）。
   *
   * 服务端聚合**本进程实际可观测**的分区；未装配的分区如实报 `absent`（不是故障）。
   * @returns 七分区健康报告（含人读 summary）
   */
  public kernelHealth(): Promise<import('../../types/models.ts').KernelHealthSnapshotLike> {
    return this.rpc('kernel.health', {});
  }

  /**
   * 审计事件查询（只读，2026-10-11 Web 交付）。
   *
   * 返回体是**判别联合**：`ok:false` 表示服务端**未接线 audit sink**，面板必须如实显示"未接线"，
   * **不得**把空数组渲染成"审计无记录"。
   * @param params 过滤条件（时间窗 / 类型 / 会话 / actor / 条数上限）
   * @returns `{ok:true, events}` 或 `{ok:false, reason}`
   */
  public auditQuery(params: {
    since?: string;
    until?: string;
    type?: string;
    session?: string;
    actor?: string;
    limit?: number;
  }): Promise<import('../../types/models.ts').AuditQueryResult> {
    return this.rpc('audit.query', params);
  }

  /**
   * 保险库凭据名列表（只读名字，**不含值**；2026-10-11 Web 交付）。
   * @returns `{ok:true, names}` 或 `{ok:false, reason}`（未接线）
   */
  public traceRead(params: {
    session: string;
    limit?: number;
    kind?: string;
  }): Promise<import('../../types/models.ts').TraceReadResultLike> {
    return this.rpc('trace.read', params);
  }
  /**
   * 全部会话存档列表（含工作区标记），供按项目收纳。running = 服务端真实运行态。
   * @param opts `includeArchived=false` 时服务端**跳过归档文件的逐个扫描**（快速路径）
   * @returns 存档目录与有序会话列表
   */
  public quotaGet(): Promise<import('../../types/models.ts').QuotaStatus> {
    return this.rpc('quota.get', {});
  }
  /** 调整配额档位与基础日预算。 */
  public quotaSet(patch: {
    plan?: string;
    dailyTokens?: number;
  }): Promise<import('../../types/models.ts').QuotaStatus> {
    return this.rpc('quota.set', patch);
  }
  /** 读当前会话的模式（目标 / 计划 / 绘图）。 */
}
