// proof 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** proof 域的 RPC 面。 */
export class ProofApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public proofTurns(threadId: string): Promise<import('../../types/models.ts').ProofResult<readonly import('../../types/models.ts').ProofTurnSummaryLike[]>> {
    return this.rpc('proof.turns', { threadId });
  }
  /** 构造一回合执行证书并复核（六项矩阵一次返回；不导出文件）。 */
  public proofBuild(
    threadId: string,
    turnIndex: number,
  ): Promise<import('../../types/models.ts').ProofResult<import('../../types/models.ts').ProofBundleViewLike>> {
    return this.rpc('proof.build', { threadId, turnIndex });
  }
  /** 导出一回合证据包（JSON 文本由前端下载；超过 2 MB 返回 export_too_large）。 */
  public proofExport(
    threadId: string,
    turnIndex: number,
  ): Promise<import('../../types/models.ts').ProofResult<import('../../types/models.ts').ProofExportResultLike>> {
    return this.rpc('proof.export', { threadId, turnIndex });
  }
  /** 离线复核外部 AuditBundle（只读；不自动信任签名）。 */
  public proofVerify(
    bundle: unknown,
  ): Promise<import('../../types/models.ts').ProofVerifyResultLike> {
    return this.rpc('proof.verify', { bundle });
  }

  /** 决策账本会话视图（列表 + 摘要 + 结构/共形复核）。 */
}
