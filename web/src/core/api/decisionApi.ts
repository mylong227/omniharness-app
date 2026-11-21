// decision 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** decision 域的 RPC 面。 */
export class DecisionApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public decisionSession(
    threadId: string,
  ): Promise<import('../../types/models.ts').DecisionResultLike<import('../../types/models.ts').DecisionSessionViewLike>> {
    return this.rpc('decision.session', { threadId });
  }

  /** 单条决策详情。 */
  public decisionDetail(
    threadId: string,
    recordId: string,
  ): Promise<import('../../types/models.ts').DecisionResultLike<import('../../types/models.ts').DecisionDetailViewLike>> {
    return this.rpc('decision.detail', { threadId, recordId });
  }

  /** 导出标准 AAT（JSON + sha256 由前端下载；确认由 UI 承担、RPC 再校验）。 */
  public decisionExport(
    threadId: string,
  ): Promise<import('../../types/models.ts').DecisionResultLike<import('../../types/models.ts').DecisionExportResultLike>> {
    return this.rpc('decision.export', { threadId, confirm: true });
  }

  /** 保存决策审计设置（用户级；开启前的回合不补造）。 */
  public decisionConfigure(
    enabled: boolean,
    principal: string | undefined,
  ): Promise<import('../../types/models.ts').DecisionConfigureResultLike | import('../../types/models.ts').DecisionFailureLike> {
    return this.rpc('decision.configure', {
      enabled,
      ...(principal !== undefined ? { principal } : {}),
      confirm: true,
    });
  }

}
