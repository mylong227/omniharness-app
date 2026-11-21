// 技能实验室（2026-11-20 Skill Lab v1，docs/design/skill-lab）：技能目录 + 编辑面。
//
// 目录：skills.list 双真源归并（config 内联可编辑 / bundled·workspace 只读 / 覆盖态徽标），
// 修复了旧「组合根未注入 options.skills → 生产态恒空」的前置 bug（服务端侧）。
// 编辑面：选中技能 → 编辑 instructions/description/tags → 本地行级 diff 预览（SkillDiff）
// → skills.diff 结构差异测试（fail-closed）→ skills.apply 落 config.skills 整段。
// 生效 = 下一会话（registry 为 boot 装配，与设置页其余段同语义）。
// 新建 = config 追加（撞 bundled/workspace 名 = 覆盖编辑语义，撞 config 名被服务端拒绝）。

import * as React from 'react';
import { useApp } from '../../context.ts';
import { useSessionResource } from '../../hooks/useSessionResource.ts';
import { t } from '../../i18n/i18n.ts';
import { diffLines, diffStats } from '../../models/SkillDiff.ts';
// 面板级 antd 一律子路径导入（不走 'antd' 桶文件，理由见 vite.config.ts「分块改造」注释）。
import Input from 'antd/es/input';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Button from 'antd/es/button';
import Alert from 'antd/es/alert';
import Flex from 'antd/es/flex';
import type { SkillDiffLine, SkillListRow } from '../../../types/models.ts';

/** 技能目录列定义（2026-10-30 W4：act-list → antd Table；2026-11-20 增来源与编辑/删除列）。 */
function skillColumns(onEdit: (row: SkillListRow) => void, onDelete: (row: SkillListRow) => void): ColumnsType<SkillListRow> {
  return [
    {
      title: t('技能'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, row) => (
        <span className="slash-name">
          /{name}
          {row.overridden === true ? (
            <Tag className="skill-src-tag" title={t('覆盖编辑：config 版本生效后取代原同技能')}>
              {t('覆盖')}
            </Tag>
          ) : null}
        </span>
      ),
    },
    { title: t('描述'), dataIndex: 'description', key: 'description' },
    {
      title: t('标签'),
      dataIndex: 'tags',
      key: 'tags',
      width: 160,
      render: (tags: string[]) => (tags.length === 0 ? null : tags.map((tg) => <Tag key={tg}>{tg}</Tag>)),
    },
    {
      title: t('来源'),
      dataIndex: 'source',
      key: 'source',
      width: 110,
      render: (source: SkillListRow['source']) => (
        <span className="skill-src">
          {source === 'config' ? t('配置内联') : source === 'workspace' ? t('工作区') : t('随包')}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 150,
      render: (_, row) =>
        row.editable ? (
          <Flex gap={4}>
            <Button size="small" onClick={() => onEdit(row)}>
              {t('编辑')}
            </Button>
            <Button size="small" danger onClick={() => onDelete(row)}>
              {t('删除')}
            </Button>
          </Flex>
        ) : (
          <span className="skill-src" title={t('随包/工作区技能随包只读，config 同名可覆盖')}>
            {t('只读')}
          </span>
        ),
    },
  ];
}

/** 编辑器状态（create = 新建，name 可输；edit = 覆盖既有 config 条目，name 锁定）。 */
interface EditorState {
  mode: 'create' | 'edit';
  name: string;
  description: string;
  instructions: string;
  tags: string;
  /** 编辑态的原文（diff 基准；create 为空串）。 */
  originalInstructions: string;
  busy: boolean;
  issues: readonly string[];
}

/** 空编辑器（新建态）。 */
const EMPTY_EDITOR: EditorState = {
  mode: 'create',
  name: '',
  description: '',
  instructions: '',
  tags: '',
  originalInstructions: '',
  busy: false,
  issues: [],
};

/** tags 输入串 → 数组（逗号分隔，去空）。 */
function parseTags(raw: string): string[] {
  return raw
    .split(/[,，]/u)
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
}

/**
 * 差异预览块（本地行级 diff；服务端结构差异测试通过与否见 issues 区）。
 * @param props 原文与改文
 * @returns 差异块节点；无差异时给一句「无差异」
 */
function DiffPreview(props: { original: string; patched: string }): React.ReactElement {
  const lines: readonly SkillDiffLine[] = diffLines(props.original, props.patched);
  const { added, removed } = diffStats(lines);
  if (added === 0 && removed === 0) {
    return <p className="skill-diff-empty">{t('无差异')}</p>;
  }
  return (
    <div className="skill-diff" aria-label={t('差异预览')}>
      <div className="skill-diff-head">
        {t('差异预览')} · {t('{n} 处', { n: added + removed })}
      </div>
      {lines.map((line, i) => (
        <div key={i} className={`skill-diff-line skill-diff-line--${line.kind}`}>
          <span className="skill-diff-sign">{line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '}</span>
          <span>{line.text === '' ? ' ' : line.text}</span>
        </div>
      ))}
    </div>
  );
}

/** 技能实验室面板。 */
export function SkillsTab(): React.ReactElement {
  const { api, toast, dialog } = useApp();
  const [query, setQuery] = React.useState('');
  const [editor, setEditor] = React.useState<EditorState | null>(null);

  // 目录装载（2026-11-21 批次六 A1 收编 useSessionResource）：data=null=装载中、
  // error=整页错误态、refresh=应用/删除后的重拉（返回在飞 Promise）。
  const load = React.useCallback(async (): Promise<SkillListRow[]> => {
    const r = await api.listSkills();
    return r.skills ?? [];
  }, [api]);
  const { data: fetchedSkills, error: loadError, refresh: reload } = useSessionResource({
    enabled: true,
    load,
    followTick: false,
  });
  const skills = fetchedSkills;
  const error = loadError ?? '';

  /** 进入编辑态：拉单条完整视图回填表单。 */
  const startEdit = (row: SkillListRow): void => {
    api
      .getSkill(row.name)
      .then((skill) => {
        setEditor({
          mode: 'edit',
          name: skill.name,
          description: skill.description,
          instructions: skill.instructions,
          tags: skill.tags.join(', '),
          originalInstructions: skill.instructions,
          busy: false,
          issues: [],
        });
      })
      .catch((cause: unknown) => {
        toast(t('读取技能失败：{msg}', { msg: cause instanceof Error ? cause.message : String(cause) }), 'err');
      });
  };

  /** 应用（先服务端结构差异测试，通过才落盘；生效 = 下一会话）。 */
  const apply = async (): Promise<void> => {
    if (editor === null) return;
    const draft = {
      name: editor.name.trim(),
      description: editor.description.trim(),
      instructions: editor.instructions,
      ...(parseTags(editor.tags).length > 0 ? { tags: parseTags(editor.tags) } : {}),
    };
    setEditor({ ...editor, busy: true, issues: [] });
    try {
      const report = await api.diffSkill(draft);
      if (report.issues !== undefined && report.issues.length > 0) {
        setEditor({ ...editor, busy: false, issues: report.issues });
        return;
      }
      await api.applySkill(draft);
      toast(t('已应用，下一会话生效'), 'ok');
      setEditor(null);
      reload();
    } catch (cause: unknown) {
      setEditor({ ...editor, busy: false, issues: [cause instanceof Error ? cause.message : String(cause)] });
    }
  };

  /** 删除（先经 DialogService 确认，决策不静默产生）。 */
  const remove = async (row: SkillListRow): Promise<void> => {
    const ok = await dialog.confirm(t('确认删除技能 {name}？', { name: row.name }), {
      title: t('删除技能'),
      confirmLabel: t('删除'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteSkill(row.name);
      toast(t('已删除，下一会话生效'), 'ok');
      reload();
    } catch (cause: unknown) {
      toast(t('删除失败：{msg}', { msg: cause instanceof Error ? cause.message : String(cause) }), 'err');
    }
  };

  if (error !== '') {
    return <p className="act-error" role="alert">{t('读取技能失败：{msg}', { msg: error })}</p>;
  }
  if (skills === null) return <p className="act-muted">{t('读取中…')}</p>;

  const q = query.trim().toLowerCase();
  const shown =
    q === ''
      ? skills
      : skills.filter((s) =>
          [s.name, s.description, ...s.tags].join(' ').toLowerCase().includes(q),
        );

  return (
    <div className="act">
      <section className="act-card">
        <div className="pm-head">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('搜索技能')}
            aria-label={t('搜索技能')}
          />
          <Button
            onClick={() => setEditor({ ...EMPTY_EDITOR })}
          >
            {t('新建技能')}
          </Button>
        </div>
        {shown.length === 0 ? (
          <p className="act-muted">{t('没有匹配的技能')}</p>
        ) : (
          <Table<SkillListRow>
            className="skills-table"
            size="small"
            bordered={false}
            pagination={false}
            columns={skillColumns(startEdit, (row) => void remove(row))}
            dataSource={[...shown]}
            rowKey="name"
            scroll={{ x: 'max-content' }}
          />
        )}
      </section>
      {editor === null ? null : (
        <section className="act-card skill-editor" aria-label={t('编辑技能')}>
          <div className="pm-title">
            {editor.mode === 'create' ? t('新建技能') : t('编辑技能')}
            {editor.mode === 'edit' ? (
              <span className="skill-src">/{editor.name}</span>
            ) : null}
          </div>
          <div className="form">
            <label>
              {t('名称')}
              {editor.mode === 'create' ? (
                <Input
                  aria-label={t('名称')}
                  placeholder={t('如：commit-style（非空、无空白、≤64 字符）')}
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                />
              ) : (
                <Input value={editor.name} disabled aria-label={t('名称')} />
              )}
            </label>
            <label>
              {t('描述')}
              <Input
                aria-label={t('描述')}
                placeholder={t('一句话说明技能何时用')}
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
              />
            </label>
            <label>
              {t('技能正文')}
              <Input.TextArea
                aria-label={t('技能正文')}
                rows={8}
                value={editor.instructions}
                onChange={(e) => setEditor({ ...editor, instructions: e.target.value })}
              />
            </label>
            <label>
              {t('标签')}
              <Input
                aria-label={t('标签')}
                placeholder={t('逗号分隔，可留空')}
                value={editor.tags}
                onChange={(e) => setEditor({ ...editor, tags: e.target.value })}
              />
            </label>
          </div>
          {editor.issues.length > 0 ? (
            <Alert
              type="error"
              showIcon
              message={editor.issues.map((issue, i) => <div key={i}>{issue}</div>)}
            />
          ) : null}
          <DiffPreview original={editor.originalInstructions} patched={editor.instructions} />
          <Flex gap={8} className="skill-editor-actions">
            <Button type="primary" disabled={editor.busy} onClick={() => void apply()}>
              {t('应用（下一会话生效）')}
            </Button>
            <Button disabled={editor.busy} onClick={() => setEditor(null)}>
              {t('取消编辑')}
            </Button>
          </Flex>
        </section>
      )}
    </div>
  );
}
