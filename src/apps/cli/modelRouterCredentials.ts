import type { FileConfig, ModelRouterConfig } from '../../host/kernel/contracts.ts';
import { providerPresets } from '../../host/kernel/config.ts';

/** 厂商预设（`providerPresets.resolve` 的元素类型；不在应用侧另抄一份结构）。 */
type ProviderPreset = ReturnType<typeof providerPresets.resolve>[number];

/**
 * 模型路由条目的**凭据/端点物化**（2026-11-27 真机故障的根因修复 · 应用侧一半）。
 *
 * ## 为什么需要
 *
 * 内核路由条目此前的凭据来源只有「适配器环境变量」，而桌面/Web 用户的主配置走的是
 * `providerKeys`（DPAPI 加密落盘）。于是「主配置用 deepseek 的 Key、路由条目写 deepseek-flash」
 * 这种完全正常的组合在启动期就 fail-closed，还会把端点错指到 api.openai.com。
 *
 * 本类在**装配期**把条目补成内核能直接消费的形状（`baseUrl` / `apiKey` / `adapter`）：
 * - 解析顺序与主模型 `ArgParser.fillProviderCredentials` 同口径：显式值 > 条目 `provider` 指定的
 *   厂商 > 该适配器下「有 Key」的厂商预设；顶层 `apiKey` 仍可回退给活动厂商；
 * - 只在内存里补，**不落盘**：`apiKey` 不写回配置文件（配置持久化只认 UI 草稿字段）。
 *
 * 解析不到凭据时保持原条目，交给内核的占位模型/fail-closed 分支报可行动错误——本类不做二次决策。
 */
export class ModelRouterCredentials {
  /**
   * 物化整段路由配置（条目逐个补全；无变化时返回原对象，保持引用稳定）。
   * @param router 配置文件里的 `modelRouter` 段（可能 undefined）。
   * @param file 分层合并后的文件配置（读 `providerKeys` / `providerPresets` / 顶层 apiKey）。
   * @returns 物化后的路由配置；未配置时为 undefined。
   */
  public static materialize(
    router: ModelRouterConfig | undefined,
    file: FileConfig,
  ): ModelRouterConfig | undefined {
    if (router === undefined) {
      return undefined;
    }
    const presets = providerPresets.resolve(file.providerPresets);
    let changed = false;
    const entries = router.entries.map((entry) => {
      const next = ModelRouterCredentials.materializeEntry(entry, file, presets);
      if (next !== entry) changed = true;
      return next;
    });
    return changed ? { ...router, entries } : router;
  }

  /**
   * 物化单个条目。
   * @param entry 原条目。
   * @param file 文件配置（凭据/预设来源）。
   * @param presets 已解析的厂商目录（含用户覆盖）。
   * @returns 新条目；无变化时返回原引用。
   */
  private static materializeEntry(
    entry: ModelRouterConfig['entries'][number],
    file: FileConfig,
    presets: readonly ProviderPreset[],
  ): ModelRouterConfig['entries'][number] {
    const preset = ModelRouterCredentials.presetOf(entry, file, presets);
    const apiKey = ModelRouterCredentials.apiKeyOf(entry, file, preset);
    const baseUrl = entry.baseUrl ?? preset?.baseUrl;
    const adapter = entry.adapter ?? preset?.adapter;
    if (apiKey === undefined && baseUrl === undefined && adapter === entry.adapter) {
      return entry;
    }
    return {
      ...entry,
      ...(adapter === undefined ? {} : { adapter }),
      ...(baseUrl === undefined ? {} : { baseUrl }),
      ...(apiKey === undefined ? {} : { apiKey }),
    };
  }

  /**
   * 取条目对应的厂商预设：显式 `provider` 优先；否则在该适配器下找「有 Key」的预设，
   * 优先命中 `models` 里包含该模型名的那一家。
   * @param entry 路由条目。
   * @param file 文件配置。
   * @param presets 生效厂商目录。
   * @returns 命中的预设；无从判断时 undefined。
   */
  private static presetOf(
    entry: ModelRouterConfig['entries'][number],
    file: FileConfig,
    presets: readonly ProviderPreset[],
  ): ProviderPreset | undefined {
    if (entry.provider !== undefined) {
      return presets.find((preset) => preset.id === entry.provider);
    }
    if (entry.adapter === undefined) {
      return undefined;
    }
    const candidates = providerPresets
      .forAdapter(entry.adapter, presets)
      .filter((preset) => ModelRouterCredentials.keyCandidateOf(preset, file) !== undefined);
    return (
      candidates.find((preset) => preset.models?.includes(entry.model) === true) ?? candidates[0]
    );
  }

  /**
   * 解析条目可用的 Key：条目显式 `apiKey` > 厂商的 `providerKeys` > 活动厂商的顶层 `apiKey`。
   * @param entry 路由条目。
   * @param file 文件配置。
   * @param preset 命中的厂商预设（可能 undefined）。
   * @returns Key；解析不到时 undefined。
   */
  private static apiKeyOf(
    entry: ModelRouterConfig['entries'][number],
    file: FileConfig,
    preset: ProviderPreset | undefined,
  ): string | undefined {
    if (entry.apiKey !== undefined) {
      return entry.apiKey;
    }
    if (preset === undefined) {
      return undefined;
    }
    return ModelRouterCredentials.keyCandidateOf(preset, file);
  }

  /**
   * 某厂商在配置里可用的 Key（`providerKeys` 优先；活动适配器回退到顶层 `apiKey`，兼容老配置）。
   * @param preset 厂商预设。
   * @param file 文件配置。
   * @returns Key；没有时 undefined。
   */
  private static keyCandidateOf(
    preset: ProviderPreset,
    file: FileConfig,
  ): string | undefined {
    const fromProviders = file.providerKeys?.[preset.id];
    if (fromProviders !== undefined && fromProviders !== '') {
      return fromProviders;
    }
    const adapters = preset.cliAdapters ?? [preset.adapter];
    const activeAdapter = file.modelAdapter;
    if (
      activeAdapter !== undefined &&
      adapters.includes(activeAdapter) &&
      file.apiKey !== undefined &&
      file.apiKey !== ''
    ) {
      return file.apiKey;
    }
    return undefined;
  }
}
