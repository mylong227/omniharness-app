import { AppText } from '../../i18n/AppText.ts';
// 技能实验室编辑服务（2026-11-20，docs/design/skill-lab v1）：
// 纯逻辑层（零 IO / 零 RPC 依赖，node 直测）——CRISPR SPI 语义的 app 侧落地：
// 定点编辑（精确点名）+ 差异测试（fail-closed）+ 回滚（不写盘即无副作用）。
//
// 存储面 = config.skills[] 内联数组（用户级 omniharness.json，三条组合根通用、无信任闸；
// 工作区文件面在 serve 默认不装配——须 --trust-workspace，见设计稿 §1.3）。
// 内核语义复用：显式配置同名优先（config 覆盖 bundled/workspace 发现）= 覆盖编辑通道；
// Report 用本地同构类型（crisprEditReport.js 不在内核 exports 承诺清单，不 import）。

/** 技能草稿（apply/diff 的编辑面；tags 缺省 = 不改/不带）。 */
export interface SkillDraft {
  name: string;
  description: string;
  instructions: string;
  tags?: readonly string[] | undefined;
}

/** 技能列表行（skills.list 响应）：归并 registry（boot 装配真值）与 config（编辑面最新态）。 */
export interface SkillListRow {
  name: string;
  description: string;
  tags: readonly string[];
  /** 来源：config=内联可编辑 / bundled=随包只读 / workspace=工作区只读。 */
  source: 'config' | 'bundled' | 'workspace';
  /** 是否可在 Skill Lab 编辑/删除（config 侧 true）。 */
  editable: boolean;
  /** 同名技能同时存在于 config 与 registry（覆盖编辑态，registry 旧值待下一会话生效）。 */
  overridden?: boolean;
}

/** 单条完整视图（skills.get 响应）。 */
export interface SkillGetView {
  name: string;
  description: string;
  instructions: string;
  tags: readonly string[];
  source: SkillListRow['source'];
  editable: boolean;
}

/** 技能名规则：非空、无空白与路径分隔符、≤64（配置内联数组键即名字，fail-closed 防写坏）。 */
const NAME_RE = /^[^\s/\\]{1,64}$/u;

/** config 内联技能的最小形状（FileConfig.skills 元素的本服务消费面）。 */
export interface ConfigSkillLike {
  name: string;
  description: string;
  instructions: string;
  tags?: readonly string[] | undefined;
}

/** registry 技能的最小形状（SkillRegistryPort.list() 元素的本服务消费面）。 */
export interface RegistrySkillLike {
  name: string;
  description: string;
  instructions: string;
  tags?: readonly string[] | undefined;
  trust?: string | undefined;
}

/**
 * skills.list 归并：registry（boot 装配）∪ config（编辑面），按 name 归并；
 * config 侧可编辑；同名双现 = 覆盖编辑态（overridden）。
 * @param registrySkills 装配期 registry 全量
 * @param configSkills 配置内联全量（fileConfig().skills）
 * @returns 列表行（config 优先在前，各自组内按名字典序）
 */
export function listSkillsView(
  registrySkills: readonly RegistrySkillLike[],
  configSkills: readonly ConfigSkillLike[],
): readonly SkillListRow[] {
  const configNames = new Set(configSkills.map((s) => s.name));
  const configRows: readonly SkillListRow[] = configSkills.map((s) => ({
    name: s.name,
    description: s.description,
    tags: s.tags ?? [],
    source: 'config',
    editable: true,
    ...(registrySkills.some((r) => r.name === s.name) ? { overridden: true } : {}),
  }));
  const registryRows: readonly SkillListRow[] = registrySkills
    .filter((r) => !configNames.has(r.name))
    .map((r) => ({
      name: r.name,
      description: r.description,
      tags: r.tags ?? [],
      source: r.trust === 'workspace' ? 'workspace' : 'bundled',
      editable: false,
    }));
  const byName = (a: SkillListRow, b: SkillListRow): number => a.name.localeCompare(b.name);
  return [...configRows].sort(byName).concat([...registryRows].sort(byName));
}

/**
 * skills.get：config 优先，回落 registry；两侧都没有报「未找到」（-32602 形态）。
 * @param registrySkills 装配期 registry 全量
 * @param configSkills 配置内联全量
 * @param name 目标名（精确点名）
 * @returns 完整视图
 */
export function getSkillView(
  registrySkills: readonly RegistrySkillLike[],
  configSkills: readonly ConfigSkillLike[],
  name: string,
): SkillGetView {
  const configHit = configSkills.find((s) => s.name === name);
  if (configHit !== undefined) {
    return {
      name: configHit.name,
      description: configHit.description,
      instructions: configHit.instructions,
      tags: configHit.tags ?? [],
      source: 'config',
      editable: true,
    };
  }
  const regHit = registrySkills.find((s) => s.name === name);
  if (regHit !== undefined) {
    return {
      name: regHit.name,
      description: regHit.description,
      instructions: regHit.instructions,
      tags: regHit.tags ?? [],
      source: regHit.trust === 'workspace' ? 'workspace' : 'bundled',
      editable: false,
    };
  }
  throw new Error(`未找到技能: ${name}`);
}

/**
 * 差异测试（结构判据，fail-closed）：非空 + 名字规则 + config 内唯一。
 * @param draft 编辑草稿
 * @param mode create=新增（config 内名不得存在）/ edit=覆盖编辑（config 内名必须存在）
 * @param configSkills 配置内联全量
 * @returns 问题清单（空 = 通过）
 */
export function validateDraft(
  draft: SkillDraft,
  mode: 'create' | 'edit',
  configSkills: readonly ConfigSkillLike[],
): readonly string[] {
  const issues: string[] = [];
  if (!NAME_RE.test(draft.name)) {
    issues.push(AppText.t('skills.apply 需要合法 name（非空、无空白与路径分隔符、≤64 字符）'));
  }
  if (draft.description.trim() === '') {
    issues.push(AppText.t('skills.apply 需要 description（一句话说明技能何时用）'));
  }
  if (draft.instructions.trim() === '') {
    issues.push(AppText.t('skills.apply 需要 instructions（技能正文，不能为空）'));
  }
  const exists = configSkills.some((s) => s.name === draft.name);
  if (mode === 'create' && exists) {
    issues.push(`skills.apply 拒绝：config 内已有同名技能 ${draft.name}（编辑请走覆盖语义）`);
  }
  if (mode === 'edit' && !exists) {
    issues.push(`未找到技能: ${draft.name}（config 内无此名；新增请走 create 语义）`);
  }
  return issues;
}

/**
 * apply：把草稿并进 config.skills（edit=按名替换 / create=追加），返回整段新数组。
 * 调用方契约：先过 validateDraft，issues 非空不得调用（fail-closed 回滚 = 不落盘）。
 * @param configSkills 配置内联全量
 * @param draft 已通过差异测试的草稿
 * @returns 新的整段数组（深拷贝，避免引用共享）
 */
export function applyDraft(
  configSkills: readonly ConfigSkillLike[],
  draft: SkillDraft,
): readonly ConfigSkillLike[] {
  const next = configSkills
    .filter((s) => s.name !== draft.name)
    .map((s) => ({ ...s, ...(s.tags === undefined ? {} : { tags: [...s.tags] }) }));
  const entry: ConfigSkillLike = {
    name: draft.name,
    description: draft.description.trim(),
    instructions: draft.instructions,
    ...(draft.tags !== undefined && draft.tags.length > 0 ? { tags: [...draft.tags] } : {}),
  };
  next.push(entry);
  return next;
}

/**
 * delete：从 config.skills 移除；registry-only 技能不可删（bundled/workspace 随包只读）。
 * @param configSkills 配置内联全量
 * @param name 目标名
 * @returns 新数组；目标不在 config 内返回 null（调用方报 not-editable）
 */
export function deleteSkill(
  configSkills: readonly ConfigSkillLike[],
  name: string,
): readonly ConfigSkillLike[] | null {
  if (!configSkills.some((s) => s.name === name)) return null;
  return configSkills.filter((s) => s.name !== name);
}