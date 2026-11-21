// control 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type {
  QuestionAnswerSubmission,
  ApprovalRequest,
  QuestionRequest,
} from '../../types/models.ts';
import type { ApiTransport } from './rpcTransport.ts';

/** control 域的 RPC 面。 */
export class ControlApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public respondApproval(requestId: string, decision: string): Promise<unknown> {
    return this.rpc('approval.respond', { requestId, decision });
  }

  /**
   * 提交提问作答（`question.respond`）：把用户在提问卡上的选择送回等待中的 `ask_user`。
   *
   * 服务端对答案做严格校验（题 id / 选项标签 / 单选多选 / 长度），不合法时返回
   * `{ ok: false, error }` 且**保留挂起**——故调用方必须看 `ok` 而不是只看「有没有抛错」。
   * @param requestId 提问请求 id（来自 `question.request` 通知）
   * @param answers 逐题作答（`selected` 必须是该题提供过的选项标签）
   * @returns 服务端受理结果
   */
  public respondQuestion(
    requestId: string,
    answers: readonly QuestionAnswerSubmission[],
  ): Promise<{ ok: boolean; error?: string }> {
    return this.rpc('question.respond', { requestId, answers });
  }

  /**
   * 拉取当前**在途审批**（`approval.pending`，断连恢复用，2026-11-01）。
   *
   * `approval.request` 是 live-only 通知（不进 SSE 重放历史）：页面刷新后新连接收不到
   * 「正在等待审批」这件事。重连后调用本方法即可重建审批卡；服务端有断连宽限期，
   * 宽限期内复联 ⇒ 挂起仍在。
   * @returns 在途审批清单（形状与 `approval.request` 通知一致；可能为空）。
   */
  public pendingApprovals(): Promise<ApprovalRequest[]> {
    return this.rpc('approval.pending', {});
  }

  /**
   * 拉取当前**在途提问**（`question.pending`，断连恢复用，2026-11-01）。语义同
   * {@link pendingApprovals}。
   * @returns 在途提问清单（形状与 `question.request` 通知一致；可能为空；`threadId` 为会话归属）。
   */
  public pendingQuestions(): Promise<(QuestionRequest & { threadId?: string | null })[]> {
    return this.rpc('question.pending', {});
  }

  /** 列出某会话的全部检查点（label/时间/事件数/是否含文件快照）。 */
  public approvalTiers(): Promise<{ tiers: import('../../types/models.ts').ApprovalTier[] }> {
    return this.rpc('approval.tiers', {});
  }
  /** 可选智能体清单（内置角色 + 编排图 + 插件）。 */
  public agentsList(): Promise<{ agents: import('../../types/models.ts').AgentCatalogEntry[] }> {
    return this.rpc('agents.list', {});
  }
  /** 一条查询同时搜工作区文件与历史会话。 */
}
