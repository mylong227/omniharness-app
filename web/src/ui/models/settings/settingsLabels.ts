// 设置字段的显示名与缺省名查表（W2 拆分）。
import type { SettingsField } from './settingsTypes.ts';
import { fieldId } from './settingsTypes.ts';


/**
 * 下拉字段的显示名（机读值 → 人话）。键 = `fieldId`，值 = 选项映射。
 *
 * 为什么单独一张表：枚举机读值必须原样提交（内核校验），但中文界面直接显示
 * `openai / policy / max` 等于让用户读代码。渲染层只查这张表，提交值不变。
 */
export const OPTION_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  modelAdapter: {
    mock: 'Mock（测试）',
    openai: 'OpenAI 兼容',
    anthropic: 'Anthropic',
    responses: 'OpenAI Responses',
    llamacpp: 'llama.cpp',
    gemini: 'Google Gemini',
  },
  sandbox: {
    passthrough: '完全放行',
    policy: '策略拦截',
    restricted: '严格限制',
    'windows-native': 'Windows 原生隔离',
    landlock: 'Landlock',
    seatbelt: 'Seatbelt',
    bwrap: 'bwrap',
    unshare: 'unshare',
    'wsl-bwrap': 'WSL bwrap',
    container: '容器',
  },
  elevatedSandbox: { passthrough: '完全放行', policy: '策略拦截', restricted: '严格限制' },
  storageAdapter: { memory: '内存（重启丢）', jsonl: 'JSONL', sqlite: 'SQLite' },
  costBudgetOnExceed: { fail: '中止回合', warn: '仅提示' },
  approval: {
    auto: '全部放行',
    deny: '全部拒绝',
    rules: '按规则',
    guardian: '守护裁决',
    ask: '每次询问',
    plan: '只读规划',
  },
  escalation: { deny: '拒绝提权', ask: '询问', auto: '自动提权' },
  reasoning: { none: '无', minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '极高', max: '最高' },
  'retrievalContext.mode': { off: '关闭', bm25: 'BM25 检索' },
  'retrievalContext.rewriter': { off: '关闭', model: '模型' },
  'retrievalContext.rerank': { off: '关闭', model: '模型' },
  'semanticRecall.mode': { off: '关闭', on: '开启' },
  'capflow.mode': { off: '关闭', shadow: '只留证（放行）', enforce: '生效（拒绝）' },
  'decisionEngine.mode': { off: '关闭', shadow: '影子模式（跑记不改行为）', enforce: '生效' },
};

/**
 * 未设置时**实际生效**的内核出厂值（仅展示；提交空值仍表示「用默认」）。
 *
 * 与 `CliDefaults` / 内核出厂值同步：只收 UI 可解释的少数键，不猜测未知默认。
 */
export const DEFAULT_LABELS: Readonly<Record<string, string>> = {
  storageAdapter: 'JSONL',
  sandbox: '策略拦截',
  elevatedSandbox: '策略拦截',
  approval: '按规则',
  escalation: '拒绝提权',
  costBudgetOnExceed: '中止回合',
  'retrievalContext.mode': '关闭',
  'retrievalContext.rewriter': '关闭',
  'retrievalContext.rerank': '关闭',
  'semanticRecall.mode': '关闭',
  'capflow.mode': '关闭',
};

/**
 * 取某个下拉值的显示名（未登记时回退机读值，保证不出现空白）。
 * @param field 字段
 * @param value 机读值
 * @returns 显示名（中文原文，渲染时再过 `t()`）
 */
export function optionLabelOf(field: SettingsField, value: string): string {
  return OPTION_LABELS[fieldId(field)]?.[value] ?? value;
}

/**
 * 取字段未设置时的生效值显示名（未登记返回 undefined，占位回退「未设置」）。
 * @param field 字段
 * @returns 生效值文案或 undefined
 */
export function defaultLabelOf(field: SettingsField): string | undefined {
  return DEFAULT_LABELS[fieldId(field)];
}

