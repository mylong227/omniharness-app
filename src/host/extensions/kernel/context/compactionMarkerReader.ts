import { COMPACTION_MARKER } from '../../../kernel/context.ts';

/**
 * 应用侧压缩游标解码器（`CompactionMarkerReader`）——**自有件，内核未承诺**。
 *
 * ## 为什么自有而不是经对接面消费
 *
 * 解码的规范实现是内核 `CompactionStateCodec.decode`，但 vendored alpha.21 的 `exports` 承诺面
 * **没有** `kernel/context/compactionStateCodec.js` 深路径（context 域只承诺 8 条深路径，
 * alpha.21 新增的 `evidence=` 字段已在本解码器对齐）
 * codec 不在其中；contextCompactor.js 只再导出 `CompactionState` 类型，不再导出 codec）。
 * 按边界门禁第 9 条口径（2026-11-11 登记）：内核未承诺的实现 app 只能自有。
 *
 * ## 解码口径（与内核 `CompactionStateCodec.encode` 逐字节对齐）
 *
 * 格式：`OMNI_COMPACTION_V1 upTo=<n> hash=<hex>[ evidence=<base64url-json>]\n<summary>`
 * （V1 前缀是格式版本号；alpha.21 起 header 尾部可带压缩证据）。
 * fail-closed：前缀不符 / 字段缺失 / upTo 非非负整数 / hash 非十六进制一律 `undefined`，
 * **绝不把坏记录当「没压缩」**（调用方按「记录不可解析」单独提示，设计 §5.6）。
 * 证据是可选字段：形状不符只丢证据、保留摘要游标（可选字段损坏不得让整段压缩历史失忆）。
 * 内核未来升 V2 ⇒ 前缀不匹配 → 本解码器如实返回 undefined，不会解析出假数据。
 */
export class CompactionMarkerReader {
  private constructor() {}

  /**
   * 解码一条压缩游标文本。
   * @param text system 事件文本（应以 `COMPACTION_MARKER` 开头）。
   * @returns 压缩状态；格式不符 / 字段非法时 undefined。
   */
  public static decode(text: string): CompactionCursor | undefined {
    const newline = text.indexOf('\n');
    const head = (newline === -1 ? text : text.slice(0, newline)).trim();
    const summary = newline === -1 ? '' : text.slice(newline + 1);
    // 锚定正则含版本前缀（单一来源 = COMPACTION_MARKER）与字段形态；不匹配 = 坏记录或
    // 未来的 V2 格式，如实返回 undefined。marker 无正则特殊字符，插值安全。
    const headPattern = new RegExp(`^${COMPACTION_MARKER} upTo=(\\d+) hash=([0-9a-f]+)(?: evidence=(\\S+))?$`);
    const match = headPattern.exec(head);
    if (match === null) return undefined;
    const evidence = match[3] === undefined ? undefined : CompactionMarkerReader.decodeEvidence(match[3]);
    return {
      compactedUpTo: Number(match[1]),
      headHash: match[2]!,
      summary,
      ...(evidence?.audit !== undefined ? { audit: evidence.audit } : {}),
      ...(evidence?.signals !== undefined ? { signals: evidence.signals } : {}),
    };
  }

  /**
   * 编码压缩游标为内核可解码的文本（与 `CompactionStateCodec.encode` 同格式）。
   * @param state 压缩游标。
   * @returns `OMNI_COMPACTION_V1 upTo=<n> hash=<hex>[ evidence=…]\n<summary>`。
   */
  public static encode(state: CompactionCursor): string {
    const evidence = CompactionMarkerReader.encodeEvidence(state);
    const suffix = evidence === undefined ? '' : ` evidence=${evidence}`;
    return `${COMPACTION_MARKER} upTo=${String(state.compactedUpTo)} hash=${state.headHash}${suffix}\n${state.summary}`;
  }

  /**
   * 证据编码（alpha.21）：审计/信号以 base64url JSON 附在 header 尾部。
   * @param state 压缩游标
   * @returns base64url 字符串；无证据时 undefined
   */
  private static encodeEvidence(state: CompactionCursor): string | undefined {
    if (state.audit === undefined && state.signals === undefined) return undefined;
    const payload: Record<string, unknown> = {};
    if (state.audit !== undefined) payload['audit'] = state.audit;
    if (state.signals !== undefined) payload['signals'] = state.signals;
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  /**
   * 证据解码：形状不符时只丢证据（保留摘要游标）。
   * @param encoded base64url JSON
   * @returns 审计/信号（可缺省）；不可解析为 undefined
   */
  private static decodeEvidence(
    encoded: string,
  ): { readonly audit?: CompactionAuditLike; readonly signals?: CompactionSignalsLike } | undefined {
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return undefined;
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
    const source = raw as Record<string, unknown>;
    const audit = CompactionMarkerReader.auditOf(source['audit']);
    const signals = CompactionMarkerReader.signalsOf(source['signals']);
    if (audit === undefined && signals === undefined) return undefined;
    return { ...(audit !== undefined ? { audit } : {}), ...(signals !== undefined ? { signals } : {}) };
  }

  /**
   * 审计证据形状校验（坏形状 ⇒ undefined）。
   * @param raw 原始值
   * @returns 合法证据或 undefined
   */
  private static auditOf(raw: unknown): CompactionAuditLike | undefined {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
    const value = raw as Record<string, unknown>;
    const checked = value['checked'];
    const missing = value['missing'];
    if (typeof checked !== 'object' || checked === null || Array.isArray(checked)) return undefined;
    const counts = checked as Record<string, unknown>;
    if (
      typeof value['ok'] !== 'boolean' ||
      !Array.isArray(missing) ||
      !missing.every((item) => typeof item === 'string') ||
      !Number.isInteger(counts['editedFiles']) ||
      !Number.isInteger(counts['commands']) ||
      !Number.isInteger(counts['openTodos'])
    ) {
      return undefined;
    }
    return {
      ok: value['ok'],
      missing: missing as readonly string[],
      checked: {
        editedFiles: counts['editedFiles'] as number,
        commands: counts['commands'] as number,
        openTodos: counts['openTodos'] as number,
      },
    };
  }

  /**
   * 信号证据形状校验（坏形状 ⇒ undefined）。
   * @param raw 原始值
   * @returns 合法证据或 undefined
   */
  private static signalsOf(raw: unknown): CompactionSignalsLike | undefined {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
    const value = raw as Record<string, unknown>;
    const keys = ['budgetRatio', 'turns', 'toolResultShare', 'repetitionRate'] as const;
    if (!keys.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))) {
      return undefined;
    }
    if (typeof value['combinedWouldTrigger'] !== 'boolean') return undefined;
    return {
      budgetRatio: value['budgetRatio'] as number,
      turns: value['turns'] as number,
      toolResultShare: value['toolResultShare'] as number,
      repetitionRate: value['repetitionRate'] as number,
      combinedWouldTrigger: value['combinedWouldTrigger'],
    };
  }
}

/** 压缩状态审计证据（内核 alpha.21 `CompactionAuditEvidence` 应用侧形状）。 */
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

/** 压缩触发信号证据（内核 alpha.21 `CompactionSignalEvidence` 应用侧形状）。 */
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

/** 解码产物（内核 `CompactionState` 的应用侧形状：同字段、只读）。 */
export interface CompactionCursor {
  /** 被摘要覆盖的前缀消息数。 */
  readonly compactedUpTo: number;
  /** 前缀指纹（djb2 hex）。 */
  readonly headHash: string;
  /** 摘要正文。 */
  readonly summary: string;
  /** 状态审计证据（alpha.21 起；旧游标没有）。 */
  readonly audit?: CompactionAuditLike | undefined;
  /** 触发信号证据（alpha.21 起；旧游标没有）。 */
  readonly signals?: CompactionSignalsLike | undefined;
}
