// 输入区下拉选项构建：模型清单 / 推理档位。
// 纯静态逻辑、零 React 依赖，便于在 node 环境直接单测。
//
// 权限说明**不在这里**（2026-10-07 删除）：它原本在这里再存一份「档位 → 一句话」的映射表，与后端
// `ApprovalTierCatalog`、`PermissionTierModel` 的兜底表构成同一句话的第三份副本。现在悬浮提示
// 直接读档位表的 `description`（见 `PermissionPicker`）。

import { t } from '../i18n/i18n.ts';

/** 下拉项。 */
export interface OptionItem {
  value: string;
  label: string;
  /**
   * 该档位**不在服务端下发的合法集合**里（仅出现在序数阶梯 `ladder()` 的返回值上）。
   *
   * 为什么需要这个标记：换厂商/换模型后，用户已保存的档位可能不属于新厂商的字典
   * （实测：夹具与真实配置里都有 `reasoning:'medium'` 而 `reasoningEffort:['low','high']`）。
   * 此时阶梯会把它追加在末尾——它是"当前值"，但不是"这一档强度"。
   * 进度条若照常把它当普通档位填满，读数会**虚高**（3/3 段看起来比 2/3 强），
   * 所以调用方要按本标记把它画成"不属于当前模型"的样子。
   */
  unsupported?: boolean;
}

/** 兜底模型候选：服务端 model.catalog 下发当前厂商清单时不再使用；仅作离线回退。 */
const KNOWN_MODELS: readonly string[] = [
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o1-mini',
  'o3-mini',
  'o4-mini',
  'gpt-4.1',
  'claude-3.5-sonnet',
  'claude-3.7-sonnet',
  'deepseek-chat',
  'deepseek-reasoner',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
];

/** 推理强度兜底档位：model.catalog 未下发 reasoningEffort 时使用。 */
const REASONING_LEVELS: readonly string[] = ['minimal', 'low', 'medium', 'high', 'xhigh'];

/** 推理档位中文标签：对服务端下发的未知档位（如 deepseek 的 none/max）也能给出合理标签。 */
const REASONING_LABELS: Readonly<Record<string, string>> = {
  none: t('无'),
  minimal: t('极简'),
  low: t('弱'),
  medium: t('中'),
  high: t('强'),
  xhigh: t('极强'),
  max: t('极致'),
};

/** 模型级档位表（model.catalog 下发的 `effortsByModel`）：模型 id → 该模型实际接受的档位。 */
export type EffortsByModel = Readonly<Record<string, readonly string[]>>;

/**
 * 档位的**标准强度序**（由弱到强）：仅用于「服务端未给顺序」或「顺序不可信」时把已知档位排好。
 * 为什么需要它：进度条形态的档位选择器把"档位"画成"填充比例"，顺序即读数；
 * 而 `reasoningEffort` 只保证是合法集合，不保证有序（各厂商自有字典）。
 */
const REASONING_ORDER: readonly string[] = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
];

/** 输入区选项构建器。 */
export class ComposerOptions {
  /**
   * 模型候选：只列当前厂商可用清单（服务端下发优先，否则兜底内置清单），
   * 并保证当前值一定在列表里（否则下拉显示空白）。去重且去空。
   */
  public static models(current: string, providerModels?: readonly string[]): string[] {
    const pool = providerModels && providerModels.length > 0 ? providerModels : KNOWN_MODELS;
    return Array.from(new Set([current, ...pool].filter((m) => typeof m === 'string' && m !== '')));
  }

  /**
   * 推理档位：
   * - 服务端下发非空清单 → 用之；
   * - 下发空数组 → 无档位可挑（只留占位项由调用方添加）；
   * - 未下发（undefined）→ 用内置 5 档兜底；
   * 当前值不在清单里时补到最前，防止换厂商后用户已选值丢失。
   */
  public static reasoning(current: string, levels?: readonly string[]): OptionItem[] {
    const pool: readonly string[] = levels !== undefined ? levels : REASONING_LEVELS;
    const seen = new Set<string>();
    const out: OptionItem[] = [];
    for (const v of pool) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push({ value: v, label: REASONING_LABELS[v] ?? v });
    }
    if (current !== '' && !seen.has(current)) {
      out.unshift({ value: current, label: REASONING_LABELS[current] ?? current });
    }
    return out;
  }

  /**
   * 推理档位的"强度阶梯"：由弱到强的**有序**清单，供进度条形态的档位选择器使用。
   *
   * 与 `reasoning()` 的区别（两者都需要，不要合并）：
   *   `reasoning()`   给下拉列表用，语义是"候选集合"——顺序不重要，当前值缺失时补最前；
   *   `ladder()`      给进度条用，语义是"有序刻度"——**顺序即强度**，进度条靠下标算填充比例，
   *                    所以顺序错了整条读数就是错的（这正是不能复用前者返回顺序的原因）。
   *
   * 顺序来源（2026-10-17 决策）：
   *   1. **已知档位一律按 `REASONING_ORDER` 的标准强度序排列**——`reasoningEffort` 的契约
   *      只保证"是合法集合"，不保证有序；若直接采信数组顺序，同一组档位换个下发顺序就会
   *      画出不同的强度读数（high 可能显示成比 low 弱）。词表本身是有序的，所以常态下
   *      结果与厂商下发顺序一致；不一致时以"强度语义"为准而不是以"数组顺序"为准。
   *   2. 清单里的**未知档位**（未来新增）排在已知项之后、保持彼此相对顺序（稳定排序，
   *      不猜它的强度）。
   *   3. 当前值缺失时追加到末尾（同上，强度未知）。
   *
   * @param levels 服务端下发的档位（可为空）
   * @param current 当前选中值（缺失时补进阶梯，因其强度未知故追加在末尾）
   * @returns 由弱到强的档位清单
   */
  public static ladder(levels?: readonly string[], current?: string): OptionItem[] {
    const source = levels !== undefined && levels.length > 0 ? Array.from(levels) : Array.from(REASONING_LEVELS);
    // 1) 稳定排序：已知档位按强度序，未知档位整体排后并保持下发顺序。
    const ordered = source
      .map((v, i) => ({ v, i }))
      .sort((a, b) => {
        const ra = REASONING_ORDER.indexOf(a.v);
        const rb = REASONING_ORDER.indexOf(b.v);
        if (ra >= 0 && rb >= 0) return ra - rb;
        if (ra >= 0) return -1;
        if (rb >= 0) return 1;
        return a.i - b.i;
      })
      .map((x) => x.v);
    // 2) 去重（保序）。
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const v of ordered) {
      if (seen.has(v)) continue;
      seen.add(v);
      unique.push(v);
    }
    // 3) 当前值不在阶梯里时追加到末尾：它的强度未知，猜一个位置会让进度条读数错误。
    //    同时打上 unsupported 标记——调用方要据此把它画成"当前值但不属于该模型"，
    //    否则进度条会把它当成最高档填满，读数虚高。
    const unsupported = current !== undefined && current !== '' && !seen.has(current);
    if (unsupported && current !== undefined) unique.push(current);
    return unique.map((v) => {
      const item: OptionItem = { value: v, label: REASONING_LABELS[v] ?? v };
      if (unsupported && v === current) item.unsupported = true;
      return item;
    });
  }

  /**
   * 单个档位的中文标签（未知档位原样返回，便于服务端新增档位时不必同步改前端）。
   * @param level 档位值
   * @returns 展示标签
   */
  public static reasoningLabel(level: string): string {
    return REASONING_LABELS[level] ?? level;
  }

  /**
   * 按模型解析档位集合（adaptive-reasoning，2026-11-14）：进度条与钳制的**档位源**。
   *
   * 优先级：模型级真值（含空数组）> 厂商级档位。两级语义刻意不相通：
   *   - 模型级 `[]` = 服务端确证该模型不接收 effort ⇒ 调用方据此隐藏进度条；
   *   - 厂商级 `[]`/undefined = 旧语义 ⇒ `ladder()` 回落内置兜底。
   * 模型不在表里（服务端未下发该模型，或缓存清单滞后）→ 回落厂商档，不瞎猜。
   * @param model 当前模型 id
   * @param effortsByModel 服务端下发的模型级档位表（undefined = 旧服务端）
   * @param providerEffort 厂商级档位（回落源）
   * @returns 该模型的档位集合；两端都未知时为 undefined（走内置兜底）
   */
  public static effortsFor(
    model: string,
    effortsByModel?: EffortsByModel,
    providerEffort?: readonly string[],
  ): readonly string[] | undefined {
    const hit = effortsByModel?.[model];
    if (hit !== undefined) return hit;
    return providerEffort;
  }

  /**
   * 把当前值**钳制**到档位集合里最接近的档（adaptive-reasoning：切模型后越界值的自动落点）。
   *
   * 距离口径：按 `REASONING_ORDER` 的强度序数取 |距离| 最小者；**距离相同取更强一档**
   * （用户设了高值的意图更可能是"要强"，钳向下会悄悄降级）。当前值自身强度未知
   * （不在词表）时视为最强档处理——钳到集合里最强的一档。
   * @param levels 合法档位集合（契约只保证是集合，不保证有序；空集合 = 该模型无档位）
   * @param current 当前值（不在集合里的才有钳制的必要）
   * @returns 钳制后的档位；`levels` 为空或当前值本就未设置（''）时返回 `''`
   */
  public static closestLevel(levels: readonly string[], current: string): string {
    // '' 是"未设置/已清空"而不是"越界"：钳到最强档等于替用户悄悄开启推理（review P1-1）。
    if (levels.length === 0 || current === '') return '';
    const rank = (v: string): number => {
      const i = REASONING_ORDER.indexOf(v);
      // 未知档位排在词表末尾之后：参与"最强档"判定而不破坏已知档位的相对序。
      return i >= 0 ? i : REASONING_ORDER.length;
    };
    const cur = rank(current);
    let best = levels[0];
    let bestDist = Number.MAX_SAFE_INTEGER;
    for (const v of levels) {
      const d = Math.abs(rank(v) - cur);
      // 距离相等时取更强：仅当新档严格更近、或同距且更强时才替换 best。
      if (d < bestDist || (d === bestDist && rank(v) > rank(best))) {
        best = v;
        bestDist = d;
      }
    }
    return best;
  }
}
