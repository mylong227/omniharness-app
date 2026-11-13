/**
 * 决策账本类型（`decision.*` RPC 的返回体与内部投影）。
 *
 * 诚实边界（设计 §6）：
 *  - 结构复核失败一律 `status:'fail'`，没有「部分通过」的绿灯；
 *  - 审计未开启 / 已关闭 / 无记录用不同状态，不把「没记录」伪装成「没有决策」；
 *  - 共形未运行（`not_run`）与共形不适用（`not_applicable`）都不是「通过」。
 */

/** 用户级决策审计设置（app 自有，不写内核 omniharness.json）。 */
export interface DecisionSettings {
  /** 是否记录执行前决策。 */
  readonly enabled: boolean;
  /** 授权主体（可选；不填则 AAT 不写 principal）。 */
  readonly principal?: string | undefined;
}

/** 审计状态视图（`decision.session` 的 `audit` 字段）。 */
export interface DecisionAuditView {
  /** 当前设置是否开启。 */
  readonly enabled: boolean;
  /** 当前配置的主体（仅提示；不回填历史记录）。 */
  readonly configuredPrincipal?: string | undefined;
  /** 第一条 audit 事件时间（无记录时省略）。 */
  readonly startedAt?: string | undefined;
  /** 当前设置已关闭，但会话里仍有历史审计记录。 */
  readonly closed: boolean;
}

/** 覆盖范围：链完整不等于覆盖完整。 */
export interface DecisionCoverage {
  /** 会话全部回合数。 */
  readonly turnsTotal: number;
  /** 至少有一条决策记录的回合数。 */
  readonly turnsRecorded: number;
  /** 第一条有记录的回合（displayIndex；无记录时省略）。 */
  readonly firstRecordedTurn?: number | undefined;
  /** 是否有回合没有记录（审计中途开启 / 关闭过）。 */
  readonly partial: boolean;
}

/** 摘要计数：allow/escalate/deny 互斥，conformal 是属性、可与 deny 重叠。 */
export interface DecisionCounts {
  /** AAT 记录数。 */
  readonly records: number;
  /** 执行前决策数。 */
  readonly decisions: number;
  /** 最终放行数。 */
  readonly allow: number;
  /** 待审批 / 无最终结果数。 */
  readonly escalate: number;
  /** 最终拒绝数。 */
  readonly deny: number;
  /** 带共形证据的决策数。 */
  readonly conformal: number;
}

/** 最终去向（服务端计算，前端只渲染）。 */
export type DecisionDisposition =
  | 'allowed'
  | 'allowed_by_conformal'
  | 'allowed_by_approval'
  | 'denied'
  | 'denied_after_conformal'
  | 'escalated_pending'
  | 'approved_not_executed'
  | 'unavailable';

/** 依据分类。 */
export type DecisionBasis = 'conformal' | 'human' | 'rule' | 'default' | 'unavailable' | 'unknown';

/** 效果类（无 CTA 记录时省略，不猜）。 */
export type DecisionEffectClass = 'READ_ONLY' | 'STATE_MUTATING' | 'PRIVILEGED_ACTUATE';

/** 执行前决策结果（内核 `AuditDecisionResult` 子集）。 */
export type DecisionAuditResult = 'allow' | 'deny' | 'require_approval' | 'no_rule' | 'unavailable';

/** 列表行（紧凑；详情另取）。 */
export interface DecisionRow {
  /** AAT 记录 id（深链 / 详情键）。 */
  readonly recordId: string;
  /** 回合下标（0 起，按 user 事件切分）。 */
  readonly turnIndex: number;
  /** 用户回合序号（1 起；系统回合为 0）。 */
  readonly displayIndex: number;
  /** 决策时间（ISO）。 */
  readonly at: string;
  /** 工具名。 */
  readonly toolName: string;
  /** 内核裁决结果。 */
  readonly result: DecisionAuditResult;
  /** 最终去向。 */
  readonly disposition: DecisionDisposition;
  /** 依据分类。 */
  readonly basis: DecisionBasis;
  /** 效果类（有 CTA 记录 / 共形证据时才写）。 */
  readonly effectClass?: DecisionEffectClass | undefined;
  /** 共形风险分（仅共形放行）。 */
  readonly riskScore?: number | undefined;
  /** 共形阈值（仅共形放行）。 */
  readonly threshold?: number | undefined;
  /** 单次授权 id（allow 时可能存在）。 */
  readonly authorizationId?: string | undefined;
  /** 授权主体（记录级；不回填）。 */
  readonly principal?: string | undefined;
}

/** 回合摘要（列表分组头）。 */
export interface DecisionTurnSummary {
  readonly turnIndex: number;
  readonly displayIndex: number;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly decisions: number;
}

/** 单项结构 / 共形复核结论。 */
export interface DecisionCheck {
  readonly code:
    | 'AUDIT_CHAIN'
    | 'AAT_CHAIN'
    | 'SEQUENCE'
    | 'SESSION'
    | 'AUTHORIZATION'
    | 'PRINCIPAL'
    | 'CONFORMAL_UNITS'
    | 'CONFORMAL_DIGEST'
    | 'CONFORMAL_THRESHOLD'
    | 'CONFORMAL_RISK_SCORE'
    | 'CONFORMAL_MODEL'
    | 'CONFORMAL_ABOVE_THRESHOLD';
  readonly status: 'pass' | 'warn' | 'fail';
  readonly detail: string;
}

/** 结构复核视图（原始 audit 链 + AAT 链）。 */
export interface DecisionStructuralView {
  readonly status: 'pass' | 'fail' | 'disabled' | 'empty' | 'not_run';
  readonly checks: readonly DecisionCheck[];
  /** 原始 audit 事件数。 */
  readonly auditCount: number;
  /** AAT 记录数。 */
  readonly aatCount: number;
  /** 失败问题（可读 + 问题码）。 */
  readonly problems: readonly { readonly code: string; readonly detail: string }[];
}

/** 共形复核视图。 */
export interface DecisionConformalView {
  readonly status: 'pass' | 'fail' | 'not_applicable' | 'not_run';
  readonly checkedDecisions: number;
  readonly snapshots: number;
  readonly checks: readonly DecisionCheck[];
  readonly problems: readonly { readonly code: string; readonly detail: string }[];
}

/** 诚实边界（固定文本，前端直接渲染）。 */
export interface DecisionBoundaryView {
  readonly signed: false;
  readonly trustLevel: 'L0';
  readonly argsIncluded: false;
  readonly draft: 'AAT-09-subset';
}

/** `decision.session` 成功返回体。 */
export interface DecisionSessionView {
  readonly sessionId: string;
  readonly audit: DecisionAuditView;
  readonly coverage: DecisionCoverage;
  readonly counts: DecisionCounts;
  readonly turns: readonly DecisionTurnSummary[];
  readonly rows: readonly DecisionRow[];
  readonly structural: DecisionStructuralView;
  readonly conformal: DecisionConformalView;
  readonly boundary: DecisionBoundaryView;
  /** 列表是否被截断（导出仍覆盖全会话，除非超限）。 */
  readonly truncated: boolean;
  readonly generatedAt: string;
}

/** 一条审批轨迹。 */
export interface DecisionApprovalView {
  readonly at: string;
  readonly phase: 'request' | 'answer' | 'override';
  readonly result: 'pending' | 'approved' | 'rejected' | 'expired' | 'override';
  readonly by?: string | undefined;
  readonly reason?: string | undefined;
}

/** 策略快照（只给规则摘要，不给规则正文）。 */
export interface DecisionPolicyView {
  readonly snapshotHash: string;
  readonly rules: readonly {
    readonly ruleId: string;
    readonly ruleVersion: string;
    readonly digest: string;
  }[];
}

/** 共形证据视图（字段与内核 `ConformalDecisionRecord` 同形）。 */
export interface DecisionConformalEvidence {
  readonly alpha: number;
  readonly threshold: number;
  readonly riskScore: number;
  readonly effectClass: DecisionEffectClass;
  readonly calibrationDigest: string;
  readonly classDigest: string;
  readonly calibrationSnapshotId: string;
  readonly unitCount: number;
  readonly riskFeatures: {
    readonly toolName: string;
    /** 参数键数（0 = 无参数；不是键名数组）。 */
    readonly argKeys: number;
    readonly intentKind: string;
    readonly intentRisk: string;
    readonly mutating: boolean;
  };
  readonly riskModelDigest: string;
}

/** `decision.detail` 成功返回体。 */
export interface DecisionDetailView {
  readonly row: DecisionRow;
  readonly decision: {
    readonly decisionId: string;
    readonly requestDigest: string;
    readonly policySnapshotHash: string;
    readonly result: DecisionAuditResult;
    readonly defaultApplied: 'allow' | 'deny';
    readonly failClosed: boolean;
    readonly evaluatorId: string;
    readonly authorizationId?: string | undefined;
    readonly validUntil?: string | undefined;
    readonly principal?: string | undefined;
  };
  readonly policy?: DecisionPolicyView | undefined;
  readonly approvals: readonly DecisionApprovalView[];
  readonly authorization?: {
    readonly id: string;
    readonly validUntil?: string | undefined;
    readonly reused: boolean;
  } | undefined;
  readonly conformal?: DecisionConformalEvidence | undefined;
  readonly chain: {
    readonly recordId: string;
    readonly sequenceNumber: number;
    readonly prevHash: string | null;
    readonly hash: string;
  };
  readonly toolCall?: {
    readonly at: string;
    readonly toolName: string;
    readonly parametersHash: string;
  } | undefined;
  readonly toolResult?: {
    readonly at: string;
    readonly ok: boolean;
    readonly durationMs?: number | undefined;
    readonly error?: string | undefined;
  } | undefined;
  readonly neighbors: {
    readonly previousRecordId?: string | undefined;
    readonly nextRecordId?: string | undefined;
  };
}

/** `decision.export` 成功返回体。 */
export interface DecisionExportResult {
  readonly filename: string;
  readonly content: string;
  readonly digest: string;
  readonly sessionHash: string;
  readonly size: number;
  readonly recordCount: number;
}

/** 失败码。 */
export type DecisionFailureCode =
  | 'no_session'
  | 'aat_unavailable'
  | 'audit_chain_broken'
  | 'record_not_found'
  | 'export_too_large'
  | 'export_blocked'
  | 'confirm_required'
  | 'config_write_failed';

/** 判别失败。 */
export interface DecisionFailure {
  readonly ok: false;
  readonly code: DecisionFailureCode;
  readonly message: string;
}

/** 返回体联合。 */
export type DecisionResult<T> = T | DecisionFailure;
