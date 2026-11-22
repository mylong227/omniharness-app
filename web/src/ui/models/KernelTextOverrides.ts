// 内核单语数据的**前端本地化映射层**（2026-11-14 i18n 补全）。
//
// 三类数据由服务端/内核下发中文标签，前端透传导致 English UI 混排（用户实测截图）：
//   ① 上下文构成图例（kernel `contextBreakdownEstimator` 的 `CONTEXT_CATEGORIES`）——
//      row 带稳定的 `key`（messages/mcpTools/…），按 key 重映射、原 label 只做兜底；
//   ② 配额档位名（quotaPlans 的 `label`，如「免费/升级/专业」）——按 plan id 重映射；
//   ③ 内置智能体名/描述（kernel `agentPersonas`，id 稳定）——按 id 重映射。
// 统一走 t() 现场（切语言即生效），未知 key/id 回落服务端原文（fail-open，不因新增
// 数据挡显示）。

import { t } from '../i18n/i18n.ts';

/** 上下文构成 row.key → 中文标签键（与内核 CONTEXT_CATEGORIES 六类一一对应）。 */
const CONTEXT_ROW_KEYS: Readonly<Record<string, string>> = {
  messages: '消息',
  mcpTools: 'MCP 工具',
  systemTools: '系统工具',
  systemPrompt: '系统提示词',
  skills: '技能',
  other: '其他',
};

/**
 * 上下文构成行的展示标签。
 * @param key 行稳定键（messages/mcpTools/…）
 * @param fallback 服务端下发的原 label（未知 key 时原样透传）
 * @returns 本地化标签
 */
export function contextRowLabelOf(key: string, fallback: string): string {
  const labelKey = CONTEXT_ROW_KEYS[key];
  return labelKey !== undefined ? t(labelKey) : fallback;
}

/** 配额档位 id → 中文标签键。 */
// 键用「档」后缀避免与『升级审批』的『升级』撞键（decision.ts 里同键义为 Escalated）。
const QUOTA_PLAN_KEYS: Readonly<Record<string, string>> = {
  free: '免费档',
  plus: '升级档',
  pro: '专业档',
};

/**
 * 配额档位展示名。
 * @param id 档位 id（free/plus/pro）
 * @param fallback 服务端下发的原 label
 * @returns 本地化档位名
 */
export function quotaPlanLabelOf(id: string, fallback: string): string {
  const labelKey = QUOTA_PLAN_KEYS[id];
  return labelKey !== undefined ? t(labelKey) : fallback;
}

/** 内置智能体 id → 中文标签键（与内核 agentPersonas 的四个内置角色对应）。 */
const PERSONA_NAME_KEYS: Readonly<Record<string, string>> = {
  explore: '探索者',
  reviewer: '审查者',
  planner: '规划者',
  writer: '文档撰写者',
};

/** 内置智能体 id → 中文描述键。 */
const PERSONA_DESC_KEYS: Readonly<Record<string, string>> = {
  explore: '先摸清代码与数据全貌，再下结论',
  reviewer: '找缺陷、找回归风险，不给风格意见',
  planner: '产出可执行方案与验收标准',
  writer: '把实现整理成可读的文档与示例',
};

/**
 * 内置智能体展示名（未知 id 原样透传服务端 name）。
 * @param id 智能体 id
 * @param fallback 服务端下发的原 name
 * @returns 本地化名称
 */
export function personaNameOf(id: string, fallback: string): string {
  const nameKey = PERSONA_NAME_KEYS[id];
  return nameKey !== undefined ? t(nameKey) : fallback;
}

/**
 * 内置智能体描述（未知 id 原样透传服务端 description）。
 * @param id 智能体 id
 * @param fallback 服务端下发的原描述
 * @returns 本地化描述
 */
export function personaDescriptionOf(id: string, fallback: string): string {
  const descKey = PERSONA_DESC_KEYS[id];
  return descKey !== undefined ? t(descKey) : fallback;
}
