import type { ContextUsageReport } from '../contextUsageService.ts';

/**
 * 上下文工作室快照（`context.studio` RPC 的返回体，设计 §5.2）。
 *
 * 诚实边界（设计 §1.6 / §5.6，实现口径）：
 *  - 压缩记录从**事件流**的 `OMNI_COMPACTION_V1` system 事件解码（内核 `stepContextBuilder`
 *    在压缩落游标时写入）——这是本应用唯一持久化的事实源；
 *  - `stateAudit` / `signals` 是内核压缩时的 shadow 返回值，alpha.16 **不落事件流**，
 *    因此历史压缩记录一律 `auditRecorded: false`（UI 显示「未记录审计」，绝不显示「全部通过」）；
 *  - 交接便签：内核 `ScratchpadPort` 在 serve 路径没有注入点 ⇒ v1 无数据，
 *    `handoff` 恒空 + `handoffAvailable: false`（UI 显示「未接线」，不伪造便签）。
 */

/** 一条压缩记录（事件流里的一次压缩游标落盘）。 */
export interface CompactionMark {
  /** 压缩游标事件时间戳（ISO 8601）。 */
  readonly at: string;
  /** 该事件之前 user 事件数（第几轮之后发生的压缩，0 起）。 */
  readonly turnIndex: number;
  /** 被摘要覆盖的前缀消息数（`compactedUpTo`）。 */
  readonly compactedUpTo: number;
  /** 前缀指纹（djb2 hex）。 */
  readonly headHash: string;
  /** 摘要正文（可折叠预览）。 */
  readonly summary: string;
  /** 是否有持久化的状态审计（alpha.16 恒 false：审计不落事件流）。 */
  readonly auditRecorded: boolean;
  /** 状态审计（有 sidecar 的记录才有；当前版本恒 undefined）。 */
  readonly stateAudit?: {
    readonly ok: boolean;
    readonly checked: { readonly editedFiles: number; readonly commands: number; readonly openTodos: number };
    readonly missing: readonly string[];
  };
  /** 触发信号（同上，当前版本恒 undefined）。 */
  readonly signals?: { readonly budgetRatio: number; readonly rounds: number; readonly toolResultShare: number };
}

/** 一条交接便签（v1 恒无数据：scratchpad 未接线）。 */
export interface HandoffNote {
  /** 便签 id。 */
  readonly id: string;
  /** 正文。 */
  readonly text: string;
  /** 标签。 */
  readonly tags: readonly string[];
  /** 写入时刻（ISO 8601）。 */
  readonly createdAt: string;
  /** 来源。 */
  readonly source: 'user' | 'agent';
}

/** 上下文工作室快照。 */
export interface ContextStudioSnapshot {
  /** 会话 id。 */
  readonly threadId: string;
  /** 六类构成与缓存报告（与 `context.usage` 同源，实测/估算标注透传）。 */
  readonly report: ContextUsageReport;
  /** 压缩记录（按时间升序）。 */
  readonly compactions: readonly CompactionMark[];
  /** 交接便签（最新在前；v1 恒空）。 */
  readonly handoff: readonly HandoffNote[];
  /** scratchpad 是否已接线（v1 恒 false）。 */
  readonly handoffAvailable: boolean;
  /** 快照采集时刻（ISO 8601）。 */
  readonly collectedAt: string;
}
