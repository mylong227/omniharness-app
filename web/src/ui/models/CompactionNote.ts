// 上下文压缩（OMNI_COMPACTION_V1）系统事件的解析（纯逻辑，零 React 依赖）。
//
// 背景（2026-10-13 用户反馈）：压缩游标事件此前在对话流里按 `— 全文 —` 平铺，
// 数千字摘要直接糊满一屏。应收纳成一行简报（游标位置 + 摘要字数），点击再展开摘要全文。
//
// 编码格式与后端 `ContextCompactor.encodeCompactionState` 严格对齐：
//   `OMNI_COMPACTION_V1 upTo=<n> hash=<hex>[ evidence=<base64url-json>]\n<摘要正文>`
// 解析失败一律返回 null（fail-closed）——调用方回落到普通 sysnote 渲染，绝不猜。
//
// ## 2026-11-16：header 尾巴的 `evidence=` 是**可选字段**，不是格式漂移
//
// 内核 alpha.21 起把审计/触发信号以 base64url JSON 附在 header 末尾。Web 侧旧正则要求
// header **恰好以 hash 结尾**，于是新游标一律解析失败 ⇒ 回落到 `— 全文 —` 平铺，摘要连同
// 几 KB 的证据 blob 一起糊满一屏（用户截图反馈的正是这一形态）。
// 现在的口径与后端 `CompactionMarkerReader` 一致：
//   · 证据在场且可解 ⇒ 解出审计/信号，供折叠卡显示「关键状态是否齐全」；
//   · 证据损坏 ⇒ **只丢证据、保留摘要游标**（可选字段坏掉不该让整段压缩历史失忆）；
//   · upTo / hash 不合形态 ⇒ 仍然 null（坏记录不猜）。
//
// 证据只解**展示所需**的字段（条数与布尔），形状不合约当解码失败——这是纯展示层，
// 不承担"压缩是否可信"的裁决（那份裁决在后端）。

/** 压缩审计证据：四类关键状态是否全部在场（只解展示所需字段）。 */
export interface CompactionAuditParts {
  /** 关键状态是否齐全。 */
  readonly ok: boolean;
  /** 缺失项说明（为空表示齐全）。 */
  readonly missing: readonly string[];
  /** 已核对条数。 */
  readonly checked: {
    readonly editedFiles: number;
    readonly commands: number;
    readonly openTodos: number;
  };
}

/** 压缩触发信号（只解展示所需字段）。 */
export interface CompactionSignalsParts {
  /** 估算 token / 生效预算。 */
  readonly budgetRatio: number;
  /** user 消息条数。 */
  readonly turns: number;
  /** 工具结果字符占比。 */
  readonly toolResultShare: number;
  /** 重复调用占比。 */
  readonly repetitionRate: number;
  /** 组合规则是否建议触发。 */
  readonly combinedWouldTrigger: boolean;
}

/** 压缩证据（审计 / 信号任选其一，都可缺省）。 */
export interface CompactionEvidenceParts {
  /** 状态审计证据。 */
  readonly audit?: CompactionAuditParts;
  /** 触发信号证据。 */
  readonly signals?: CompactionSignalsParts;
}

/** 解析结果：游标位置、摘要正文与（可选的）压缩证据。 */
export interface CompactionNoteParts {
  /** 已压缩到的事件序号（upTo）。 */
  readonly upTo: number;
  /** 压缩前缀指纹（hash）。 */
  readonly hash: string;
  /** 摘要正文（标记行之后的部分）。 */
  readonly summary: string;
  /** header 尾巴的原始证据串（未附带时为 undefined）。 */
  readonly evidenceRaw?: string;
  /** 已解码的证据；未附带 / 解码失败时为 undefined。 */
  readonly evidence?: CompactionEvidenceParts;
}

/** 压缩事件解析器。 */
export class CompactionNote {
  /** 标记行格式（与后端 `CompactionMarkerReader` 的解码口径对齐：evidence 可选）。 */
  private static readonly HEADER =
    /^OMNI_COMPACTION_V1 upTo=(\d+) hash=([0-9a-f]+)(?: evidence=(\S+))?$/;

  /**
   * 判定并解析一条系统事件文本是否为压缩游标事件。
   * @param content 系统事件 payload.content
   * @returns 解析结果；非压缩事件 / 格式不符 / 摘要为空时为 null
   */
  public static parse(content: string): CompactionNoteParts | null {
    if (!content) return null;
    const nl = content.indexOf('\n');
    if (nl < 0) return null;
    // 只对 header 行做首尾去空白：`^` 仍锚定行首，但容忍行长被工具链带入的空格/制表符——
    // 这类空白曾让整条事件回落到「全文平铺」，代价远大于严格（upTo/hash/证据仍逐字校验）。
    const m = this.HEADER.exec(content.slice(0, nl).trim());
    if (m === null) return null;
    const summary = content.slice(nl + 1);
    if (summary === '') return null;
    const evidenceRaw = m[3];
    if (evidenceRaw === undefined) {
      return { upTo: Number(m[1]), hash: m[2] ?? '', summary };
    }
    const evidence = this.decodeEvidence(evidenceRaw);
    return {
      upTo: Number(m[1]),
      hash: m[2] ?? '',
      summary,
      evidenceRaw,
      ...(evidence === undefined ? {} : { evidence }),
    };
  }

  /**
   * 解码 header 尾巴的证据串（base64url JSON）——坏形状一律 undefined。
   * @param encoded base64url 编码的证据
   * @returns 可展示的证据；不可解码 / 形状不符时为 undefined
   */
  private static decodeEvidence(encoded: string): CompactionEvidenceParts | undefined {
    let raw: unknown;
    try {
      raw = JSON.parse(this.decodeBase64Url(encoded));
    } catch {
      return undefined;
    }
    if (!this.isRecord(raw)) return undefined;
    const audit = this.auditOf(raw['audit']);
    const signals = this.signalsOf(raw['signals']);
    if (audit === undefined && signals === undefined) return undefined;
    return { ...(audit === undefined ? {} : { audit }), ...(signals === undefined ? {} : { signals }) };
  }

  /**
   * base64url → UTF-8 文本（`atob` 在浏览器与 Node ≥16 均为全局，故无环境分支）。
   * @param encoded base64url 文本
   * @returns 解码后的 UTF-8 字符串；编码非法时抛错（由调用方兜住）
   */
  private static decodeBase64Url(encoded: string): string {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
  }

  /**
   * 审计证据形状校验（只认展示用到的字段；缺一即 undefined）。
   * @param raw 原始值
   * @returns 合法证据或 undefined
   */
  private static auditOf(raw: unknown): CompactionAuditParts | undefined {
    if (!this.isRecord(raw)) return undefined;
    const checked = raw['checked'];
    const missing = raw['missing'];
    if (typeof raw['ok'] !== 'boolean' || !this.isRecord(checked)) return undefined;
    if (!Array.isArray(missing) || !missing.every((item) => typeof item === 'string')) return undefined;
    const editedFiles = checked['editedFiles'];
    const commands = checked['commands'];
    const openTodos = checked['openTodos'];
    if (!this.isCount(editedFiles) || !this.isCount(commands) || !this.isCount(openTodos)) return undefined;
    return {
      ok: raw['ok'],
      missing: missing as readonly string[],
      checked: { editedFiles, commands, openTodos },
    };
  }

  /**
   * 触发信号形状校验（只认展示用到的字段；缺一即 undefined）。
   * @param raw 原始值
   * @returns 合法证据或 undefined
   */
  private static signalsOf(raw: unknown): CompactionSignalsParts | undefined {
    if (!this.isRecord(raw)) return undefined;
    const budgetRatio = raw['budgetRatio'];
    const turns = raw['turns'];
    const toolResultShare = raw['toolResultShare'];
    const repetitionRate = raw['repetitionRate'];
    if (
      typeof budgetRatio !== 'number' ||
      typeof turns !== 'number' ||
      typeof toolResultShare !== 'number' ||
      typeof repetitionRate !== 'number'
    ) {
      return undefined;
    }
    if (typeof raw['combinedWouldTrigger'] !== 'boolean') return undefined;
    return { budgetRatio, turns, toolResultShare, repetitionRate, combinedWouldTrigger: raw['combinedWouldTrigger'] };
  }

  /**
   * 记录型收窄（数组与 null 都不算记录）。
   * @param value 任意值
   * @returns 是普通对象则 true
   */
  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * 非负整数条数？
   * @param value 任意值
   * @returns 是有限非负整数则 true
   */
  private static isCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }
}
