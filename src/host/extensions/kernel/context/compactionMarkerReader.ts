import { COMPACTION_MARKER } from '../../../kernel/context.ts';

/**
 * 应用侧压缩游标解码器（`CompactionMarkerReader`）——**自有件，内核未承诺**。
 *
 * ## 为什么自有而不是经对接面消费
 *
 * 解码的规范实现是内核 `CompactionStateCodec.decode`，但 alpha.16 的 `exports` 承诺面
 * **没有** `kernel/context/compactionStateCodec.js` 深路径（context 域只承诺 8 条深路径，
 * codec 不在其中；contextCompactor.js 只再导出 `CompactionState` 类型，不再导出 codec）。
 * 按边界门禁第 9 条口径（2026-11-11 登记）：内核未承诺的实现 app 只能自有。
 *
 * ## 解码口径（与内核 `CompactionStateCodec.encode` 逐字节对齐）
 *
 * 格式：`OMNI_COMPACTION_V1 upTo=<n> hash=<hex>\n<summary>`（V1 前缀是格式版本号）。
 * fail-closed：前缀不符 / 字段缺失 / upTo 非非负整数 / hash 非十六进制一律 `undefined`，
 * **绝不把坏记录当「没压缩」**（调用方按「记录不可解析」单独提示，设计 §5.6）。
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
    const headPattern = new RegExp(`^${COMPACTION_MARKER} upTo=(\\d+) hash=([0-9a-f]+)$`);
    const match = headPattern.exec(head);
    if (match === null) return undefined;
    return { compactedUpTo: Number(match[1]), headHash: match[2]!, summary };
  }

  /**
   * 编码压缩游标为内核可解码的文本（与 `CompactionStateCodec.encode` 同格式）。
   * @param state 压缩游标。
   * @returns `OMNI_COMPACTION_V1 upTo=<n> hash=<hex>\n<summary>`。
   */
  public static encode(state: CompactionCursor): string {
    return `${COMPACTION_MARKER} upTo=${String(state.compactedUpTo)} hash=${state.headHash}\n${state.summary}`;
  }
}

/** 解码产物（内核 `CompactionState` 的应用侧形状：同字段、只读）。 */
export interface CompactionCursor {
  /** 被摘要覆盖的前缀消息数。 */
  readonly compactedUpTo: number;
  /** 前缀指纹（djb2 hex）。 */
  readonly headHash: string;
  /** 摘要正文。 */
  readonly summary: string;
}
