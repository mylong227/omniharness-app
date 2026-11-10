import type { ExecutionCertificate } from '../../../../host/kernel/util.ts';

/**
 * 凭证类型（`proof.*` RPC 的返回体，设计 §6.2）。
 *
 * 诚实边界（设计 §6.6）：
 *  - 未配置 `ReceiptSigner` ⇒ 状态只能是 `structural`（结构自洽，未签名），**不是**「已验证/可信」；
 *  - 本地审计链（app 的 HMAC 事件链）与内核回执链（`ActionReceipt`）是两回事，
 *    `AUDIT_CHAIN` 检查只对前者负责，文案里分开命名；
 *  - 选择性披露不证明未披露事件不存在（v1 不提供 disclose，export 全量）。
 */

/** 单回合凭证摘要。 */
export interface ProofTurnSummary {
  /** 会话 id。 */
  readonly sessionId: string;
  /** 回合下标（0 起，按 user 事件切分；系统回合也占一个下标）。 */
  readonly turnIndex: number;
  /** 用户回合序号（1 起；系统回合为 0，不占用用户轮次）。 */
  readonly displayIndex: number;
  /** 回合起点事件时间戳。 */
  readonly startedAt: string;
  /** 回合终点事件时间戳。 */
  readonly endedAt: string;
  /** 回合事件条数。 */
  readonly eventCount: number;
  /** 工具调用条数。 */
  readonly toolCalls: number;
  /** 本回合 turn_diff 报告的变更文件数（无 turn_diff 为 0）。 */
  readonly changedFiles: number;
  /** 是否系统回合（回合开头没有 user 事件：自动化 / 续跑引导）。 */
  readonly systemTurn: boolean;
}

/** 单项复核结论。 */
export interface ProofCheck {
  /** 检查项代码（六项矩阵）。 */
  readonly code: 'EVENT_COUNT' | 'EVENT_ROOT' | 'SESSION' | 'TOOL_SURFACE' | 'AUDIT_CHAIN' | 'SIGNATURE';
  /** 结论：pass（通过）/ warn（如实标注的未证明）/ fail（复核失败）。 */
  readonly status: 'pass' | 'warn' | 'fail';
  /** 一句话说明（可读，含具体数字）。 */
  readonly detail: string;
  /** 内核问题码（复核失败时，如 `EVENT_ROOT_MISMATCH`）。 */
  readonly kernelCode?: string;
}

/** 一回合的凭证视图（`proof.build` 返回体）。 */
export interface ProofBundleView {
  /** 会话 id。 */
  readonly sessionId: string;
  /** 回合下标。 */
  readonly turnIndex: number;
  /** 用户回合序号（1 起；系统回合为 0）。 */
  readonly displayIndex: number;
  /** 执行证书（未签名；签名是 v3 能力）。 */
  readonly certificate?: ExecutionCertificate;
  /** 六项复核结论（与 certificate 同次构造，无需二次请求）。 */
  readonly checks: readonly ProofCheck[];
  /** 总体状态：structural（结构自洽，未签名）/ signed / failed / unverified。 */
  readonly state: 'unverified' | 'structural' | 'signed' | 'failed';
  /** 事件条数（与证书 eventCount 一致）。 */
  readonly eventCount: number;
  /** 本地审计链覆盖该回合的记录条数（未接线为 0）。 */
  readonly auditRecords: number;
  /** 构造时刻（ISO 8601）。 */
  readonly collectedAt: string;
}

/** 导出结果（`proof.export` 返回体；前端下载为文件）。 */
export interface ProofExportResult {
  /** 建议文件名（含会话 / 回合 / 时间）。 */
  readonly filename: string;
  /** 包内容（JSON 文本）。 */
  readonly content: string;
  /** 字节数。 */
  readonly size: number;
}

/** 凭证 RPC 的判别失败（设计 §7.5 错误码）。 */
export interface ProofFailure {
  readonly ok: false;
  readonly code: 'proof_empty' | 'proof_invalid' | 'export_too_large' | 'no_session';
  readonly message: string;
}
