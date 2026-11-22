import { AppText } from '../../i18n/AppText.ts';
import type { ServerModule } from '../core/serverModule.ts';
import {
  applyDraft,
  deleteSkill,
  getSkillView,
  listSkillsView,
  validateDraft,
  type SkillDraft,
} from '../services/skillEditor.ts';

/**
 * 技能实验室模块（2026-11-20，docs/design/skill-lab v1）：`skills.list/get/diff/apply/delete`。
 *
 * 数据源双真源归并：`skillRegistry`（boot 装配真值，含 bundled/workspace 发现）与
 * `fileConfig().skills`（内联编辑面，configStore 落盘后即为最新）——修复了旧 skills.list
 * 读 `AppServerOptions.skills` 而组合根从未注入、生产态恒空的前置 bug。
 * 写路径 = config.skills 整段替换（SECTION_REPLACE 语义），生效 = 下一会话
 * （registry 为 boot 装配，与设置页其余段同语义）。
 */
export function skillsModule(): ServerModule {
  return {
    name: 'skills',
    register(ctx) {
      const s = ctx.services;
      /** registry 全量（boot 装配真值；端口恒有）。 */
      const registrySkills = (): readonly {
        name: string;
        description: string;
        instructions: string;
        tags?: readonly string[] | undefined;
        trust?: string | undefined;
      }[] => s.options.config.skillRegistry.list();
      /** config 内联全量（编辑面最新态）。 */
      const configSkills = (): readonly {
        name: string;
        description: string;
        instructions: string;
        tags?: readonly string[] | undefined;
      }[] => s.configStore.fileConfig().skills ?? [];

      ctx.rpc('skills.list', () =>
        // 形状兼容：保持旧 `{skills: [...]}` 包装（composer `/` 选择器与 SkillsTab 同消费），
        // 行字段做增量扩展（source/editable/overridden）——消费方零破坏。
        Promise.resolve({ skills: listSkillsView(registrySkills(), configSkills()) }),
      );
      ctx.rpc('skills.get', (params) => {
        const name = params['name'];
        if (typeof name !== 'string' || name.trim() === '') {
          throw new Error(AppText.t('skills.get 需要 name'));
        }
        return Promise.resolve(getSkillView(registrySkills(), configSkills(), name));
      });
      ctx.rpc('skills.diff', (params) => {
        const draft = draftOf(params);
        const mode = configSkills().some((s) => s.name === draft.name) ? 'edit' : 'create';
        const issues = validateDraft(draft, mode, configSkills());
        return Promise.resolve({
          applied: false,
          dryRun: true,
          skillName: draft.name,
          mode,
          ...(issues.length === 0 ? {} : { reason: 'differential-test-failed', issues }),
        });
      });
      ctx.rpc('skills.apply', (params) => {
        const draft = draftOf(params);
        const mode = configSkills().some((s) => s.name === draft.name) ? 'edit' : 'create';
        const issues = validateDraft(draft, mode, configSkills());
        if (issues.length > 0) {
          // fail-closed：差异测试不过不落盘（回滚 = 无副作用），逐条回传问题。
          throw new Error(issues[0]);
        }
        const next = applyDraft(configSkills(), draft);
        s.configStore.update({ skills: next });
        ctx.notify('skills.changed', {});
        return Promise.resolve({ applied: true, skillName: draft.name, count: next.length });
      });
      ctx.rpc('skills.delete', (params) => {
        const name = params['name'];
        if (typeof name !== 'string' || name.trim() === '') {
          throw new Error(AppText.t('skills.delete 需要 name'));
        }
        const next = deleteSkill(configSkills(), name);
        if (next === null) {
          throw new Error(`skills.delete 拒绝：config 内没有技能 ${name}（bundled/workspace 技能随包只读）`);
        }
        s.configStore.update({ skills: next });
        ctx.notify('skills.changed', {});
        return Promise.resolve({ applied: true, skillName: name, count: next.length });
      });
    },
  };
}

/**
 * 从 RPC 参数提取草稿（守卫收敛：diff/apply 同一段检查；fail-closed 形态走 -32602）。
 * @param params RPC 参数
 * @returns 草稿（name/instructions trim；tags 只收字符串数组）
 */
function draftOf(params: Record<string, unknown>): SkillDraft {
  const name = params['name'];
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(AppText.t('skills.apply 需要 name'));
  }
  const instructions = params['instructions'];
  if (typeof instructions !== 'string' || instructions.trim() === '') {
    throw new Error(AppText.t('skills.apply 需要 instructions'));
  }
  const description = params['description'];
  if (typeof description !== 'string' || description.trim() === '') {
    throw new Error(AppText.t('skills.apply 需要 description'));
  }
  const rawTags = params['tags'];
  const tags = Array.isArray(rawTags)
    ? rawTags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
    : undefined;
  return { name: name.trim(), instructions, description, ...(tags !== undefined ? { tags } : {}) };
}
