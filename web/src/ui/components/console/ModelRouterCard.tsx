// 设置页「模型与厂商」栏的「模型角色路由」卡（2026-11-19，内核 #B4 接入）。
//
// 与 ProviderEditor 同思路：结构化段不走 SETTINGS_FIELDS 行字段，而是自带草稿编辑器、
// 整段提交（服务端对 modelRouter 按段替换，见 appServerState.SECTION_REPLACE_KEYS）。
// 纯逻辑（草稿翻译/校验）在 models/ModelRouterDraft.ts，本组件只做编排：
//   · 未启用（cfg 无 modelRouter）→ 引导语 + 「启用」种子（默认模型 + 当前适配器做 entries[0]）；
//   · 已启用 → 策略 / 条目（模型名 + 适配器）/ 角色映射（仅 by-role 策略）编辑 + 预挡校验；
//   · 停用 → 整段发 null（显式清除，服务端删键）。
// 诚实边界（内核装配语义）：条目凭据取自**对应适配器的环境变量**（与 CLI 一致），
// 主配置的 API Key 不用于路由条目——卡片脚注如实说明，pricing/maxContextTokens 走配置文件。

import * as React from 'react';
import { t } from '../../i18n/i18n.ts';
import type { Config } from '../../../types/models.ts';
import type { SettingsModel } from '../../models/SettingsModel.ts';
import {
  MODEL_ROLES,
  ROUTER_ADAPTERS,
  ROUTER_STRATEGIES,
  draftFromSection,
  seedDraft,
  validateDraft,
  sectionFromDraft,
  type RouterDraft,
  type RouterDraftIssue,
} from '../../models/ModelRouterDraft.ts';
import { ConsoleCard, ConsoleInput, ConsoleRow, ConsoleSelect } from './ConsoleUI.tsx';
import { ModelPricing } from '../../models/ModelPricing.ts';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Flex from 'antd/es/flex';
import Typography from 'antd/es/typography';

/** ModelRouterCard 的入参。 */
export interface ModelRouterCardProps {
  /** 当前服务端配置（读 modelRouter 段；装载中为 null）。 */
  cfg: Config | null;
  /** 设置模型（统一落盘通道：整段 save + 已保存徽标）。 */
  settings: SettingsModel;
}

/** 校验问题 → 可读文案（角色名带出标签）。 */
function issueText(issue: RouterDraftIssue): string {
  if (issue.code === 'entries-empty') return t('至少需要一个路由条目');
  if (issue.code === 'entry-model-empty') {
    return t('条目 {n} 缺模型名', { n: issue.arg ?? '' });
  }
  if (issue.code === 'entry-model-duplicate') {
    return t('模型名重复：{model}', { model: issue.arg ?? '' });
  }
  const roleLabel = MODEL_ROLES.find((role) => role.id === issue.arg)?.label ?? issue.arg ?? '';
  return t('角色「{role}」映射的模型不在条目里', { role: t(roleLabel) });
}

/**
 * 一条路由条目的编辑行：模型名 + 适配器 + 删除。
 * @param props 行入参（index 为条目序号，1 起）
 * @returns 行节点
 */
function EntryRow(props: {
  draft: RouterDraft;
  index: number;
  onChange: (next: RouterDraft) => void;
}): ReactElement {
  const { draft, index, onChange } = props;
  const entry = draft.entries[index];
  const update = (patch: { model?: string; adapter?: string }): void => {
    const entries = draft.entries.map((e, i) =>
      i === index ? { model: patch.model ?? e.model, adapter: patch.adapter ?? e.adapter } : e,
    );
    onChange({ ...draft, entries });
  };
  return (
    <Flex className="mr-entry" align="center" gap={8}>
      <span className="mr-entry-index">{index + 1}</span>
      <ConsoleInput
        value={entry.model}
        ariaLabel={t('条目 {n} 模型名', { n: String(index + 1) })}
        placeholder={t('模型名（如 deepseek-v4-flash）')}
        mono
        onChange={(model) => update({ model })}
      />
      <ConsoleSelect
        value={entry.adapter}
        ariaLabel={t('条目 {n} 适配器', { n: String(index + 1) })}
        options={ROUTER_ADAPTERS.map((adapter) => ({ value: adapter, label: adapter }))}
        onChange={(adapter) => update({ adapter })}
      />
      <EntryPriceHint model={entry.model} />
      <Button
        size="small"
        disabled={draft.entries.length <= 1}
        onClick={() =>
          onChange({ ...draft, entries: draft.entries.filter((_, i) => i !== index) })
        }
      >
        {t('删除')}
      </Button>
    </Flex>
  );
}

/**
 * 条目单价提示：服务端价表命中的 ≈ 单价（成本差一栏的兑现；未命中如实说「未收录」）。
 * @param props 模型名
 * @returns 提示节点；模型名为空时 null
 */
function EntryPriceHint(props: { model: string }): ReactElement | null {
  const model = props.model.trim();
  if (model === '') return null;
  const price = ModelPricing.priceOf(model);
  if (price === null) {
    return (
      <span className="mr-entry-price mr-entry-price--unknown" title={t('价表未收录该模型族')}>
        {t('未收录单价')}
      </span>
    );
  }
  const pair = `$${trim(price.inputUsd)}/$${trim(price.outputUsd)}`;
  return (
    <span
      className="mr-entry-price"
      title={t('每 1M token 参考单价（≈，服务端价表）：输入/输出')}
    >
      ≈{pair}
    </span>
  );
}

/** 去尾零的单价格式（0.28→"0.28"，2.5→"2.5"，10→"10"）。 */
function trim(value: number): string {
  return String(Number(value.toFixed(4)));
}

/**
 * 「模型角色路由」卡：策略 / 条目 / 角色映射编辑，整段提交。
 * @param props 组件入参
 * @returns 卡片节点
 */
export function ModelRouterCard(props: ModelRouterCardProps): ReactElement {
  const { settings } = props;
  const snapshot = settings.getSnapshot();
  // committed 以引用参与同步：cfg 重拉（装载/保存后）才换新对象，编辑中的草稿不被清。
  const committed = React.useMemo(() => draftFromSection(props.cfg?.modelRouter), [props.cfg]);
  const [draft, setDraft] = React.useState<RouterDraft | null>(committed);
  React.useEffect(() => {
    setDraft(committed);
  }, [committed]);
  const issues = draft === null ? [] : validateDraft(draft);
  const disabled = issues.length > 0 || snapshot.saving;
  const strategyHint =
    draft === null
      ? undefined
      : ROUTER_STRATEGIES.find((option) => option.value === draft.strategy)?.hint;

  const save = (): void => {
    if (draft === null) return;
    void settings.save({ modelRouter: sectionFromDraft(draft) }, 'modelRouter');
  };
  const disableRouting = (): void => {
    void settings.save({ modelRouter: null }, 'modelRouter');
  };

  return (
    <ConsoleCard
      title={t('模型角色路由')}
      meta={draft === null ? t('未启用') : `${t('已启用')} · ${draft.strategy}`}
      description={t('按角色给规划、执行、审查、压缩等工作负载分配不同模型；未配置时所有请求走默认模型。')}
      footer={t('路由条目的凭据取自对应适配器的环境变量（与 CLI 一致），主配置的 API Key 不用于路由条目；定价与上下文上限经配置文件设置。')}
    >
      {draft === null ? (
        <>
          <p className="csl-empty">
            {t('启用后按角色映射选模型：同一会话里规划要强、执行要稳、压缩要便宜。')}
          </p>
          <Flex gap={8}>
            <Button type="primary" onClick={() => setDraft(seedDraft(props.cfg ?? {}))}>
              {t('启用角色路由')}
            </Button>
          </Flex>
        </>
      ) : (
        <>
          <ConsoleRow
            label={t('策略')}
            hint={strategyHint === undefined ? undefined : t(strategyHint)}
            dataFieldId="modelRouter.strategy"
          >
            <ConsoleSelect
              ariaLabel={t('策略')}
              value={draft.strategy}
              options={ROUTER_STRATEGIES.map((option) => ({
                value: option.value,
                label: t(option.label),
              }))}
              onChange={(strategy) => setDraft({ ...draft, strategy })}
            />
          </ConsoleRow>
          <ConsoleRow
            label={t('路由条目')}
            hint={t('模型名 + 底层适配器；角色未映射或非 by-role 策略时用第一个条目。')}
            dataFieldId="modelRouter.entries"
          >
            <Button size="small" onClick={() => setDraft({ ...draft, entries: [...draft.entries, { model: '', adapter: draft.entries[draft.entries.length - 1]?.adapter ?? 'openai' }] })}>
              {t('添加条目')}
            </Button>
          </ConsoleRow>
          <Flex vertical gap={6} className="mr-entries">
            {draft.entries.map((_, index) => (
              <EntryRow key={index} draft={draft} index={index} onChange={setDraft} />
            ))}
          </Flex>
          {draft.strategy === 'by-role' ? (
            <>
              <ConsoleRow
                label={t('角色映射')}
                hint={t('仅「按角色」策略消费；留空的角色回退首个条目。')}
                dataFieldId="modelRouter.roles"
              />
              <Flex vertical gap={6} className="mr-roles">
                {MODEL_ROLES.map((role) => (
                  <Flex key={role.id} className="mr-role" align="center" gap={8}>
                    <Typography.Text className="mr-role-label" title={t(role.hint)}>
                      {t(role.label)}
                    </Typography.Text>
                    <ConsoleInput
                      value={draft.roles[role.id] ?? ''}
                      ariaLabel={t('{role} 的模型', { role: t(role.label) })}
                      placeholder={t('留空回退首个条目')}
                      mono
                      onChange={(model) =>
                        setDraft({ ...draft, roles: { ...draft.roles, [role.id]: model } })
                      }
                    />
                  </Flex>
                ))}
              </Flex>
            </>
          ) : null}
          {issues.length > 0 ? (
            <Alert
              type="error"
              showIcon
              message={issues.map((issue, i) => <div key={i}>{issueText(issue)}</div>)}
            />
          ) : null}
          <Flex gap={8} className="mr-actions">
            <Button type="primary" disabled={disabled} onClick={save}>
              {t('保存')}
            </Button>
            <Button disabled={snapshot.saving} onClick={disableRouting}>
              {t('停用角色路由')}
            </Button>
          </Flex>
        </>
      )}
    </ConsoleCard>
  );
}
