// 设置面清单（**单一事实源**，2026-11-20 从 SettingsModel.ts 目录化拆出）：
// 哪些键可改、取值域是什么、归在哪一栏。三层语义严格区分：
//   ① 键（key）：`Config` 的字段名；② 字段（Field）：面板里的一行；③ 分栏（TAB）：归哪一屏。
//   一个键只出现在一个字段里；一个字段只属于一个分栏。断言钉在 web/test/settingsPane.test.ts。
// 本文件零逻辑零状态（纯声明 + 查表函数）；读写通道在 SettingsModel.ts。

import type { Config } from '../../../types/models.ts';
import type { IconName } from '../../kit/Icon.tsx';

/** 设置分栏 key。 */
export type SettingsTabKey =
  | 'general'
  | 'model'
  | 'runtime'
  | 'permission'
  | 'desktop'
  | 'shortcuts';

/** 一个分栏。 */
export interface SettingsTabDef {
  /** 分栏 key（路由 `#settings=<key>` 与 `openSettings(tab)` 同值）。 */
  key: SettingsTabKey;
  /** 分栏标题。 */
  label: string;
  /** 一句话说明这一栏管什么（空态/引导用，避免用户靠猜）。 */
  hint: string;
  /** 控制台左导航用的线性图标（`model../Icon.ts` 的图标名）。 */
  icon: IconName;
}

/**
 * 分栏清单：顺序即设置类页面的默认顺序。
 *
 * 2026-10-26 控制台重构后，设置不再是独立模态的六个分栏，而是「工作台控制台」里的
 * 基础设置组；配置集（profiles）移出设置，回到它自己的完整管理面板（避免"设置里只能
 * 应用、面板里才能增删"的两套入口）。
/** 字段类型。 */
export type SettingsFieldKind = 'select' | 'text' | 'switch' | 'number';

/** 一个设置字段（行）。 */
export interface SettingsField {
  /** `Config` 的字段名（结构化段时是段名，如 `retrievalContext`）。 */
  key: keyof Config;
  /**
   * 结构化段内的路径（如 `['degradeLadder','shapersAggressive']`）。
   *
   * 缺省 = 字段值就是顶层键本身；声明后 `key` 指向整个段，本字段只编辑段内一个叶子。
   * 同一段可有多行字段（共用 `key`、不同 `path`），唯一性由 {@link fieldId} 保证。
   */
  path?: readonly string[];
  /** 所属分栏。 */
  tab: SettingsTabKey;
  /** 行标签。 */
  label: string;
  /** 控件类型。 */
  kind: SettingsFieldKind;
  /** 下拉取值域（kind==='select'）。 */
  options?: readonly string[];
  /** 占位提示（kind==='text'）。 */
  placeholder?: string;
  /** 一行说明。 */
  hint?: string;
  /**
   * 改动需重启才生效（2026-11-17 i18n 修复）：行尾常驻「需重启」标记的**结构化真源**。
   * 此前 ConsoleUI 用 `hint.includes('重启')` 在 t() 翻译**后**的文案上做中文子串判断——
   * en 词条不含「重启」二字，标记静默失效。声明在字段上，渲染层不再猜文案。
   */
  needRestart?: boolean;
  /**
   * 同栏内的卡片分组（`fieldsOfGroup(tab, group)` 过滤；缺省进该栏的默认卡）。
   * 2026-11-14 设置页补全后运行时栏一张卡装不下（存储/成本熔断/长期记忆各自成卡）。
   */
  group?: string;
  /**
   * 路径选择入口（2026-11-14 用户口径：路径不要手输粘贴）：'dir' = 目录选择（FolderPicker），
   * 'file' = 文件选择（FilePicker）。声明后行内渲染「选择…」按钮弹起统一资源选择面板，
   * 手输通道保留。判据 pickerUniformity 钉住「路径字段必须有 browse」。
   */
  browse?: 'dir' | 'file';
  /**
   * 落盘时把值写成"清除"（服务端约定 `null` = 显式清除）而不是 no-op。
   * 目前只有 `baseUrl` 需要：留空＝回落厂商默认端点。
   */
  clearWhenEmpty?: boolean;
  /**
   * [只在服务端配置里出现、但本面板不编辑] 的键（如 providerKeys 由厂商卡片管）不在此声明。
   * 需要额外输入的字段（如 API Key）用 `custom` 承载，见 MODEL_KEY_FIELDS。
   */
}

/**
 * number 字段的前端取值范围（先挡明显非法值；内核 normalizeConfig 是最终裁决，
 * 范围口径见 docs/design/settings-completion §3.1）。导出供判据对齐（settingsPane）。
 */
export const NUMBER_RANGES: Readonly<Record<string, { desc: string; check: (n: number) => boolean }>> = {
  maxSteps: { desc: '≥ 0（0 为内核语义）', check: (n) => Number.isInteger(n) && n >= 0 },
  costBudgetUsd: { desc: '> 0（USD）', check: (n) => Number.isFinite(n) && n > 0 },
  costBudgetSoftRatio: { desc: '0 < r ≤ 1', check: (n) => Number.isFinite(n) && n > 0 && n <= 1 },
  modelCircuitBreakerThreshold: { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  modelCircuitBreakerOpenMs: { desc: '≥ 1000 的整数（毫秒）', check: (n) => Number.isInteger(n) && n >= 1000 },
  // 结构化段内的数字行：键 = fieldId（段名.路径），不是顶层 Config 键。
  'retrievalContext.maxSnippets': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'retrievalContext.maxTokens': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'contextPolicy.cacheGuard.hitRateFloor': { desc: '0 < r ≤ 1', check: (n) => Number.isFinite(n) && n > 0 && n <= 1 },
  // alpha.21：读缓存 LRU 上限（正整数）。
  'toolCache.maxEntries': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  // 2026-11-20 settings-completion v2 专家面（四结构段的数字叶子）。
  'evolutionRlvr.maxCandidates': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'evolutionRlvr.samplesPerPrompt': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'evolutionRlvr.minReward': { desc: '≥ 0', check: (n) => Number.isFinite(n) && n >= 0 },
  'evolutionRlvr.minGain': { desc: '≥ 0', check: (n) => Number.isFinite(n) && n >= 0 },
  'decisionEngine.timeoutMs': { desc: '≥ 1000 的整数（毫秒）', check: (n) => Number.isInteger(n) && n >= 1000 },
  'calibratedAutonomy.minCalibration': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'calibratedAutonomy.alpha.readOnly': { desc: '0 < r < 1', check: (n) => Number.isFinite(n) && n > 0 && n < 1 },
  'calibratedAutonomy.alpha.stateMutating': { desc: '0 < r < 1', check: (n) => Number.isFinite(n) && n > 0 && n < 1 },
  'calibratedAutonomy.alpha.privilegedActuate': { desc: '0 < r < 1', check: (n) => Number.isFinite(n) && n > 0 && n < 1 },
};

/**
 * 字段的唯一 id：顶层键为键名，结构段字段为「段名.路径」（如 `retrievalContext.mode`）。
 *
 * 为什么需要：同一段可拆成多行（共用 `key`），渲染 key 与测试断言都必须按 id 而不是
 * 按 key 去重——否则 React 会因重复 key 复用错行，判据也会互相覆盖。
 * @param field 字段定义
 * @returns 稳定唯一 id
 */
export function fieldId(field: SettingsField): string {
  return [String(field.key), ...(field.path ?? [])].join('.');
}

/**
 * 设置表单全部字段（**单一事实源**）。
 *
 * 顺序 = 分栏内渲染顺序。新增设置项时只改这里 + `SettingsModel` 的读写分支；

/**
 * 改动后需要刷新厂商目录（`model.catalog`）的键：
 * 模型下拉与厂商标题随之刷新，否则 UI 与生效配置会漂移一屏。
 */
export const CATALOG_KEYS: readonly string[] = ['model', 'modelAdapter'];

/** 已保存提示的自动消隐时长（ms）。 */
export const SAVED_HINT_MS = 1500;
