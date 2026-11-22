/**
 * 每模型推理档位表（adaptive-reasoning，2026-11-14 设计，见 docs/design/adaptive-reasoning）：
 *   同一厂商里**不同模型**实际接受的 reasoning_effort 档位范围并不相同——`deepseek-chat`
 *   根本不接收该参数、`o3` 只接受 low–high、`gpt-5` 才有 minimal–xhigh。厂商级清单
 *   （内核 providerPresets 的 `reasoningEffort`）把这些差异全部掩盖成同一份档位。
 *
 * 单一真源仍是内核的厂商级 `reasoningEffort`；本表只做**收窄**——只登记"已确证比厂商档
 * 更窄"的差异（2026-11 公开 API 口径），未命中的模型一律回落厂商档。宁可多显示（选中后
 * 上游报错可读），不可瞎收窄（把真支持的档藏掉）。
 *
 * **空数组的语义在模型级与厂商级不同**（由下发字段不同保证不相通）：
 *   - 模型级 `[]` = 确证该模型不接收 reasoning_effort（UI 据此隐藏进度条与强度副文案）；
 *   - 厂商级 `[]` = 旧语义，UI 回落内置兜底 5 档。
 */

/** 单条模型档位规则。 */
export interface EffortRule {
  /** 模型 id 匹配串：`exact` 为 true 时全等，否则按前缀。 */
  readonly match: string;
  /** 全等匹配标记（缺省按前缀，命中 `match` 开头的任意模型 id）。 */
  readonly exact?: boolean;
  /** 该模型的合法档位（空数组 = 确证不接收 reasoning_effort）。 */
  readonly efforts: readonly string[];
}

/**
 * 内置规则表（按厂商 id 分组）。
 *
 * 只登记**收窄**项：与厂商档相同的档位集合不写（如 openai 的 gpt-5*、deepseek 的
 * deepseek-reasoner）——写了反而会在用户覆盖 providerPresets 调整厂商档时与之冲突。
 */
const RULES: Readonly<Record<string, readonly EffortRule[]>> = {
  openai: [
    // 非推理模型族：请求体带 reasoning_effort 会被上游拒绝。
    { match: 'gpt-4o', efforts: [] },
    { match: 'gpt-4.1', efforts: [] },
    { match: 'chatgpt', efforts: [] },
    // o 系列只接受 low–high（无 minimal，更无 xhigh）。
    { match: 'o1', efforts: ['low', 'medium', 'high'] },
    { match: 'o3', efforts: ['low', 'medium', 'high'] },
    { match: 'o4-mini', efforts: ['low', 'medium', 'high'] },
  ],
  deepseek: [
    // deepseek-chat 是非推理模型；reasoner 沿用厂商档（none–max）故不登记。
    { match: 'deepseek-chat', exact: true, efforts: [] },
  ],
};

/**
 * 每模型档位解析（纯静态、零 IO，node 直测）。
 */
export class ModelEffortTable {
  /**
   * 解析某厂商某模型的推理档位。
   * @param providerId 厂商 preset id（RULES 的分组键）
   * @param model 模型 id（大小写不敏感比对）
   * @param providerEffort 厂商级档位（未命中时的回落；undefined 原样透传）
   * @returns 模型档位（含确证的空数组）；未命中时为厂商档（可能 undefined）
   */
  public static effortsFor(
    providerId: string,
    model: string,
    providerEffort?: readonly string[],
  ): readonly string[] | undefined {
    const rule = ModelEffortTable.hitFor(providerId, model);
    if (rule !== undefined) return rule.efforts;
    return providerEffort;
  }

  /**
   * 目录下发用的批量合成：**只写命中规则的模型**，产出 `effortsByModel`。
   *
   * 为什么不能把厂商档兜底也写进 map（2026-11-14 review P0-1）：厂商级与模型级的空数组
   * 语义不同——厂商级 `[]` = "该厂商无档位概念，UI 回落内置兜底"（anthropic/dashscope/
   * ollama 的预设就是 `[]`）；若升格写进模型级 map，UI 会把它读成"该模型确证不支持"，
   * 整条进度条消失。未命中的模型**缺字段**才是正确的"回落厂商档"表达。
   * @param providerId 厂商 preset id
   * @param models 模型清单（实测 ∪ 当前值，调用方已去重去空）
   * @returns 模型 id → 档位（仅命中规则的条目，含确证的空数组）
   */
  public static mapFor(
    providerId: string,
    models: readonly string[],
  ): Record<string, readonly string[]> {
    const out: Record<string, readonly string[]> = {};
    for (const model of models) {
      const rule = ModelEffortTable.hitFor(providerId, model);
      if (rule !== undefined) out[model] = rule.efforts;
    }
    return out;
  }

  /**
   * 命中规则：精确匹配优先，其次**最长前缀**（避免 `o1` 抢走本应更精确的条目）。
   * @param providerId 厂商 id
   * @param model 模型 id
   * @returns 命中的规则；无命中为 undefined
   */
  private static hitFor(providerId: string, model: string): EffortRule | undefined {
    const rules = RULES[providerId];
    if (rules === undefined) return undefined;
    const id = model.toLowerCase();
    let best: EffortRule | undefined;
    for (const rule of rules) {
      const hit =
        rule.exact === true ? id === rule.match : id.startsWith(rule.match.toLowerCase());
      if (!hit) continue;
      if (best === undefined || rule.match.length > best.match.length) best = rule;
    }
    return best;
  }
}
