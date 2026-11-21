import type { ContextUsageReport } from '../contextUsageService.ts';
import type { KernelContextView } from './kernelContextView.ts';

/** 压缩状态审计证据的应用侧形状（镜像内核 `CompactionAuditEvidence`——UI 契约面）。 */
export interface CompactionAuditLike {
  /** 四类关键状态是否全部在场。 */
  readonly ok: boolean;
  /** 缺失项（可读描述）。 */
  readonly missing: readonly string[];
  /** 各类被核对的状态条数。 */
  readonly checked: {
    readonly editedFiles: number;
    readonly commands: number;
    readonly openTodos: number;
  };
}

/** 压缩触发信号证据的应用侧形状（镜像内核 `CompactionSignalEvidence`——UI 契约面）。 */
export interface CompactionSignalsLike {
  /** 估算 token / 生效预算。 */
  readonly budgetRatio: number;
  /** user 消息条数（轮数下界）。 */
  readonly turns: number;
  /** 工具消息字符数 / 全部消息字符数。 */
  readonly toolResultShare: number;
  /** 重复（工具 + 目标）调用数 / 总调用数。 */
  readonly repetitionRate: number;
  /** 组合规则（参考实现）是否建议触发。 */
  readonly combinedWouldTrigger: boolean;
}

/**
 * 上下文工作室快照（`context.studio` RPC 的返回体，设计 §5.2）。
 *
 * 诚实边界（设计 §1.6 / §5.6，实现口径）：
 *  - 压缩记录从**事件流**的 `OMNI_COMPACTION_V1` system 事件解码（内核 `stepContextBuilder`
 *    在压缩落游标时写入）——这是本应用唯一持久化的事实源；
 *  - alpha.21 起内核把 `stateAudit` / `signals` 随游标持久化（header `evidence=`）；
 *    有证据的压缩记录 `auditRecorded: true`，旧游标仍为 false（UI 显示「未记录审计」，
 *    绝不把「没证据」显示成「审计通过」）；
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
  /** 是否有持久化的状态审计（alpha.21 起压缩证据随游标落盘；旧游标为 false）。 */
  readonly auditRecorded: boolean;
  /** 状态审计证据（有证据才有；缺省 = 旧游标，UI 如实显示「未记录审计」）。 */
  readonly audit?: CompactionAuditLike;
  /** 触发信号证据（同上）。 */
  readonly signals?: CompactionSignalsLike;
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
  /**
   * 内核上下文策略（alpha.19：检索供给 / 语义召回 / 降档阶梯 + 缓存守卫）。
   *
   * 与健康桥的 context 分区同一读模型（`KernelContextViewBuilder`），不在 UI 侧重解析
   * 配置；`degraded` 必须渲染成降级，不得与「关闭」混为一谈。
   */
  readonly kernel: KernelContextView;
  /** 六类构成与缓存报告（与 `context.usage` 同源，实测/估算标注透传）。 */
  readonly report: ContextUsageReport;
  /** 压缩记录（按时间升序）。 */
  readonly compactions: readonly CompactionMark[];
  /** 交接便签（最新在前；v1 恒空）。 */
  readonly handoff: readonly HandoffNote[];
  /** scratchpad 是否已接线（v1 恒 false）。 */
  readonly handoffAvailable: boolean;
  /** 事件流不可读等快照级错误；有值时压缩记录为空，UI 必须显示错误而不是「尚未压缩」。 */
  readonly error?: string;
  /** 快照采集时刻（ISO 8601）。 */
  readonly collectedAt: string;
}
