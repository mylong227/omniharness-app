// 模型角色路由草稿模型：路由卡（ModelRouterCard）的**纯逻辑层**（零 React，node 可直测）。
//
// 内核语义（vendor alpha.48 `kernel/adapters/model/modelRouter.js` + `kernel/config/configBuilder.js`）：
//   · `by-role` 按 request.role 查 roles 映射；未映射回退 entries[0]（行为与不路由一致的前提
//     是 entries[0] 就是默认模型）；
//   · roles 指到的模型名必须在 entries 里——映射到不存在的条目时内核 fail-closed 抛错
//     （配置错误不能静默换成别的模型）；
//   · entries 的 adapter 缺省 mock；条目可声明 `provider`（厂商预设 id）/ `baseUrl` / `apiKey`，
//     端点优先级 baseUrl > 厂商预设 > 适配器兜底；凭据由服务端从 `providerKeys` 物化，
//     不再要求用户额外设 OPENAI_API_KEY。常驻服务下缺凭据只会得到「未配置占位」，不再阻塞启动。
//
// 分层与 SettingsModel 一致：这里只管「草稿 ⇄ 配置段」的翻译与预挡校验，落盘统一走
// SettingsModel.save（整段提交，服务端按段替换；内核 normalizeConfig 是最终裁决）。

import type { Config, ModelRouterConfig } from '../../types/models.ts';

/** 路由策略清单（内核 RouterStrategy 全集，kernel #B4）。 */
export interface RouterStrategyOption {
  /** 内核策略名（原样落盘）。 */
  value: string;
  /** 行标签（t() 查表键）。 */
  label: string;
  /** 一句用途说明（t() 查表键）。 */
  hint: string;
}

export const ROUTER_STRATEGIES: readonly RouterStrategyOption[] = [
  { value: 'by-role', label: '按角色', hint: '按请求角色查 roles 映射选条目；未映射回退首个条目' },
  { value: 'least-cost', label: '最低成本', hint: '选累计花费最低的条目（条目需配 pricing，未配则退化为轮询）' },
  { value: 'round-robin', label: '轮询', hint: '按顺序轮流使用条目' },
  { value: 'by-task', label: '按任务', hint: '按消息里的任务关键词分派（写/代码 vs 推理/分析）' },
  { value: 'by-context', label: '按上下文', hint: '估算请求 token 后装得下的条目里取窗口最小者' },
  { value: 'health-fallback', label: '健康回退', hint: '首选条目失败时按序回退到下一个' },
  { value: 'ucb1', label: '自适应（UCB1）', hint: '按成功与延迟自适应学习（多臂老虎机）' },
];

/** 路由角色清单（内核 ModelRole 全集，2026-10-22 P1-4）。 */
export interface ModelRoleOption {
  /** 内核角色名（roles 的键，原样落盘）。 */
  id: string;
  /** 行标签（t() 查表键）。 */
  label: string;
  /** 一句角色说明（t() 查表键）。 */
  hint: string;
}

export const MODEL_ROLES: readonly ModelRoleOption[] = [
  { id: 'executor', label: '执行', hint: '工具调用与编码主力，要求稳' },
  { id: 'planner', label: '规划', hint: '任务拆解与方案，要求强' },
  { id: 'reviewer', label: '审查', hint: '独立复核产出，与执行分离' },
  { id: 'compactor', label: '压缩', hint: '上下文压缩改写，要便宜' },
  { id: 'memory', label: '记忆', hint: '长期记忆抽取与治理' },
  { id: 'guardian', label: '守卫', hint: '安全审查与风险判定' },
  { id: 'goal', label: '目标', hint: 'goal 循环的模型' },
  { id: 'subagent', label: '子代理', hint: 'subagent 派生的模型' },
];

/** 路由条目适配器清单（内核 modelAdapterId 全集；凭据走各自环境变量）。 */
export const ROUTER_ADAPTERS: readonly string[] = ['mock', 'openai', 'anthropic', 'responses', 'llamacpp', 'gemini'];

/** 条目草稿：只保留 UI 可编辑面（模型名 + 适配器 + 厂商；pricing/maxContextTokens 经配置文件设置）。 */
interface RouterEntryDraft {
  model: string;
  adapter: string;
  /** 厂商预设 id（可选）：空串 = 跟随服务端按适配器/Key 推断（alpha.48 起）。 */
  provider?: string;
}

/** 路由卡编辑器草稿（null 语义不进草稿：未启用 = 不渲染编辑器）。 */
export interface RouterDraft {
  strategy: string;
  entries: readonly RouterEntryDraft[];
  roles: Readonly<Record<string, string>>;
}

/** 预挡校验错误码（组件侧映射成 t() 文案；内核 normalizeConfig 是最终裁决）。 */
type RouterDraftError =
  | 'entries-empty'
  | 'entry-model-empty'
  | 'entry-model-duplicate'
  | 'role-target-missing';

/** 校验结果：错误码 + 定位参数（渲染成可读文案）。 */
export interface RouterDraftIssue {
  code: RouterDraftError;
  /** 定位参数：entry-model-empty/duplicate 用条目序号（1 起），role-target-missing 用角色 id。 */
  arg?: string;
}

/**
 * 配置段 → 编辑器草稿；未配置返回 null（卡片显示「未启用」态）。
 * @param section 服务端下发的 modelRouter 段（可能 undefined）
 * @returns 草稿；未配置时 null
 */
export function draftFromSection(section: ModelRouterConfig | undefined): RouterDraft | null {
  if (section === undefined) return null;
  return {
    strategy: section.strategy,
    entries: (section.entries ?? []).map((entry) => ({
      model: entry.model,
      adapter: entry.adapter ?? 'mock',
      ...(entry.provider === undefined || entry.provider === ''
        ? {}
        : { provider: entry.provider }),
    })),
    roles: { ...(section.roles ?? {}) },
  };
}

/**
 * 启用种子：用当前默认模型与适配器生成首个条目（未映射角色回退到它 = 行为先与不路由一致，
 * 用户再按角色改模型逐步接管）。
 * @param cfg 当前服务端配置
 * @returns 初始草稿（策略 by-role、空 roles）
 */
export function seedDraft(cfg: Config): RouterDraft {
  return {
    strategy: 'by-role',
    entries: [{ model: cfg.model ?? '', adapter: cfg.modelAdapter ?? 'openai' }],
    roles: {},
  };
}

/**
 * 前端预挡校验：只拦「内核必 fail-closed 或明显输错」的形态，不发请求。
 * 条目模型名去空格后必须非空且互不重复；roles 指到的模型必须在条目里。
 * @param draft 编辑器草稿
 * @returns 问题清单（空 = 可提交）
 */
export function validateDraft(draft: RouterDraft): readonly RouterDraftIssue[] {
  const issues: RouterDraftIssue[] = [];
  if (draft.entries.length === 0) {
    return [{ code: 'entries-empty' }];
  }
  const seen = new Set<string>();
  draft.entries.forEach((entry, index) => {
    const model = entry.model.trim();
    if (model === '') {
      issues.push({ code: 'entry-model-empty', arg: String(index + 1) });
      return;
    }
    if (seen.has(model)) {
      issues.push({ code: 'entry-model-duplicate', arg: model });
      return;
    }
    seen.add(model);
  });
  const models = new Set(draft.entries.map((entry) => entry.model.trim()));
  for (const role of MODEL_ROLES) {
    const target = draft.roles[role.id];
    if (target !== undefined && target.trim() !== '' && !models.has(target.trim())) {
      issues.push({ code: 'role-target-missing', arg: role.id });
    }
  }
  return issues;
}

/**
 * 草稿 → 配置段（整段提交面）：模型名 trim；空 roles 不落键；条目只带 model/adapter。
 * @param draft 编辑器草稿（假定已过 validateDraft）
 * @returns 可直接 config.update 的整段
 */
export function sectionFromDraft(draft: RouterDraft): ModelRouterConfig {
  const roles: Record<string, string> = {};
  for (const role of MODEL_ROLES) {
    const target = draft.roles[role.id];
    if (target !== undefined && target.trim() !== '') {
      roles[role.id] = target.trim();
    }
  }
  return {
    strategy: draft.strategy,
    entries: draft.entries.map((entry) => ({
      model: entry.model.trim(),
      adapter: entry.adapter,
      ...(entry.provider === undefined || entry.provider.trim() === ''
        ? {}
        : { provider: entry.provider.trim() }),
    })),
    ...(Object.keys(roles).length === 0 ? {} : { roles }),
  };
}
