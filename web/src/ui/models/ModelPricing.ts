// 会话成本估算的内置参考价（2026-11-17，账本「下一批候选 2」的最小落地）。
//
// 口径与边界（先说清楚再谈实现）：
//   · 这是**量级参考**，不是账单——单价是各家公开发布的标准档（无折扣/订阅/阶梯），
//     随厂商调价会陈旧，故所有展示必须带「≈」并在 title 里注明参考价日期；
//   · 只收录有公开置信单价的主流模型族；查不到的模型一律返回 null（**宁缺毋滥**，
//     绝不用猜测价凑数），会话摘要只累计「有价」的调用；
//   · 匹配用**最长前缀**（大小写不敏感）：`claude-sonnet-4-5-20260101` 命中
//     `claude-sonnet-4` 族价——带日期后缀的变体天然覆盖；同族不同代（如 haiku-3.5
//     与 haiku-4.5）各自建条目，前缀更长者优先命中；
//   · 缓存输入按各家缓存档单独计价（`cachedInputUsd`，缺省=输入价不打折）；
//     `promptTokens` 含缓存命中时，未命中部分按输入价、命中部分按缓存价。

/** 单档参考价（USD / 每 1M token）。 */
export interface ModelPrice {
  /** 输入单价（USD / 1M token）。 */
  readonly inputUsd: number;
  /** 输出单价（USD / 1M token；推理模型的重 reasoning token 计入输出）。 */
  readonly outputUsd: number;
  /** 缓存命中输入单价（USD / 1M token；缺省 = 输入价不打折）。 */
  readonly cachedInputUsd?: number;
}

/** 内置参考价表（各家公开标准档；调价时人工更新并同步 PRICES_AS_OF）。 */
const TABLE: ReadonlyArray<{ readonly prefix: string; readonly price: ModelPrice }> = [
  // OpenAI（2026-11 公开标准档）
  { prefix: 'gpt-4o-mini', price: { inputUsd: 0.15, outputUsd: 0.6, cachedInputUsd: 0.075 } },
  { prefix: 'gpt-4o', price: { inputUsd: 2.5, outputUsd: 10, cachedInputUsd: 1.25 } },
  { prefix: 'gpt-4.1-mini', price: { inputUsd: 0.4, outputUsd: 1.6, cachedInputUsd: 0.1 } },
  { prefix: 'gpt-4.1-nano', price: { inputUsd: 0.1, outputUsd: 0.4, cachedInputUsd: 0.025 } },
  { prefix: 'gpt-4.1', price: { inputUsd: 2, outputUsd: 8, cachedInputUsd: 0.5 } },
  { prefix: 'o3', price: { inputUsd: 2, outputUsd: 8, cachedInputUsd: 0.5 } },
  { prefix: 'o4-mini', price: { inputUsd: 1.1, outputUsd: 4.4, cachedInputUsd: 0.275 } },
  // Anthropic（4 代族与 3.5/3.7 各自建条目；带日期后缀按最长前缀归族）
  { prefix: 'claude-opus-4', price: { inputUsd: 15, outputUsd: 75 } },
  { prefix: 'claude-sonnet-4', price: { inputUsd: 3, outputUsd: 15 } },
  { prefix: 'claude-haiku-4', price: { inputUsd: 1, outputUsd: 5 } },
  { prefix: 'claude-3-7-sonnet', price: { inputUsd: 3, outputUsd: 15 } },
  { prefix: 'claude-3-5-sonnet', price: { inputUsd: 3, outputUsd: 15 } },
  { prefix: 'claude-3-5-haiku', price: { inputUsd: 0.8, outputUsd: 4 } },
  // Google
  { prefix: 'gemini-2.5-pro', price: { inputUsd: 1.25, outputUsd: 10 } },
  { prefix: 'gemini-2.5-flash-lite', price: { inputUsd: 0.1, outputUsd: 0.4 } },
  { prefix: 'gemini-2.5-flash', price: { inputUsd: 0.3, outputUsd: 2.5 } },
  { prefix: 'gemini-2.0-flash', price: { inputUsd: 0.1, outputUsd: 0.4 } },
  // DeepSeek / GLM
  { prefix: 'deepseek-reasoner', price: { inputUsd: 0.28, outputUsd: 0.42, cachedInputUsd: 0.028 } },
  { prefix: 'deepseek-chat', price: { inputUsd: 0.28, outputUsd: 0.42, cachedInputUsd: 0.028 } },
  { prefix: 'glm-4.6', price: { inputUsd: 0.6, outputUsd: 2.2 } },
  { prefix: 'glm-4.5', price: { inputUsd: 0.6, outputUsd: 2.2 } },
];

/** 参考价快照日期（展示在估算 title 里，调价时同步更新）。 */
export const PRICES_AS_OF = '2026-11-17';

/** 一次调用的成本估算结果（USD）。 */
export interface CostEstimate {
  /** 输入成本（含缓存命中部分按缓存价）。 */
  readonly inputUsd: number;
  /** 输出成本。 */
  readonly outputUsd: number;
  /** 合计（input + output）。 */
  readonly totalUsd: number;
}

/** 模型调用 usage 的最小形状（与内核 `model` 事件 payload.usage 同形）。 */
export interface UsageLike {
  /** 提示 token（含缓存命中部分）。 */
  readonly promptTokens: number;
  /** 补全 token。 */
  readonly completionTokens: number;
  /** 缓存命中的提示 token（端点未上报时缺省）。 */
  readonly cachedPromptTokens?: number;
}

/** 单价估算：内置参考价 + 最长前缀匹配，查不到的模型一律 null。 */
export class ModelPricing {
  private constructor() {}

  /**
   * 按模型名取参考价（最长前缀命中，大小写不敏感）。
   * @param model 模型名（如 `claude-sonnet-4-5-20260101`）
   * @returns 命中的单档；不在表内为 null
   */
  public static priceOf(model: string): ModelPrice | null {
    const name = model.trim().toLowerCase();
    if (name === '') return null;
    let best: ModelPrice | null = null;
    let bestLen = 0;
    for (const { prefix, price } of TABLE) {
      if (name.startsWith(prefix) && prefix.length > bestLen) {
        best = price;
        bestLen = prefix.length;
      }
    }
    return best;
  }

  /**
   * 估算一次调用的成本。
   * @param model 模型名
   * @param usage 调用 usage（负数 / 非有限值按 0）
   * @returns 成本；模型无参考价为 null
   */
  public static estimate(model: string, usage: UsageLike): CostEstimate | null {
    const price = ModelPricing.priceOf(model);
    if (price === null) return null;
    const prompt = ModelPricing.finite(usage.promptTokens);
    const completion = ModelPricing.finite(usage.completionTokens);
    const cached = Math.min(ModelPricing.finite(usage.cachedPromptTokens ?? 0), prompt);
    const uncachedPrompt = prompt - cached;
    const cachedInputUsd = price.cachedInputUsd ?? price.inputUsd;
    const inputUsd = (uncachedPrompt * price.inputUsd + cached * cachedInputUsd) / 1_000_000;
    const outputUsd = (completion * price.outputUsd) / 1_000_000;
    return { inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
  }

  /**
   * 成本展示格式：量级感知优先（<1 美元保留 4 位，<100 保留 2 位，其余整数）。
   * @param usd 美元金额
   * @returns 如 `$0.0123` / `$3.45` / `$120`
   */
  public static formatUsd(usd: number): string {
    const abs = Math.abs(usd);
    const digits = abs < 1 ? 4 : abs < 100 ? 2 : 0;
    return '$' + usd.toFixed(digits);
  }

  /**
   * 安全读取非负有限数（脏数据按 0）。
   * @param value 未知值
   * @returns 非负有限数
   */
  private static finite(value: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  }
}
