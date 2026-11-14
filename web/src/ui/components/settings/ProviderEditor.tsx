// 厂商编辑抽屉内容（2026-11-14 重设计，docs/design/provider-settings-redesign 方案 A）：
// 一个厂商的全部写操作集中在此——API Key、保存并检测（合并主按钮）、可用模型、启用。
//
// 动线合并（设计 §5 Q5）：Key 草稿非空时主按钮 = 「保存并检测」（保存 → 检测串行）；
// 草稿为空时按钮 = 「检测」。状态机仍三段：未配置 → 已保存 → 已实测。
// 检测成功在编辑面内显示「可用 · N 个模型」与模型下拉（总览层不显示这些）。

import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Typography from 'antd/es/typography';
import { isActiveProvider } from '../console/useProviderCatalog.ts';
import { providerBadgeOf } from './ProviderTile.tsx';
import type { ProviderPreset } from '../../../types/models.ts';
import { t } from '../../i18n/i18n.ts';

/** ProviderEditor 的入参。 */
export interface ProviderEditorProps {
  /** 厂商预设。 */
  preset: ProviderPreset;
  /** 目录下发的当前生效厂商 id（单一真源）。 */
  activeId: string | undefined;
  /** 已保存（打码）的 Key；未配置为 undefined。 */
  maskedKey?: string | undefined;
  /** 该厂商的检测结果。 */
  probe?: ProviderProbeResultProp | undefined;
  /** Key 输入草稿。 */
  draft: string;
  /** 形如 `<id>:<action>` 的忙碌标记；空串表示空闲。 */
  busy: string;
  /** 卡片内当前选中的模型。 */
  selectedModel?: string | undefined;
  /** 草稿变更。 */
  onDraft: (value: string) => void;
  /** 模型下拉变更。 */
  onModelPick: (value: string) => void;
  /** 保存 Key（仅保存，不检测）。 */
  onSaveKey: () => Promise<void>;
  /** 连通检测。 */
  onProbe: () => Promise<void>;
  /** 启用该厂商。 */
  onEnable: () => Promise<void>;
}

/** 检测结果（与 ProviderProbeResult 同形的最小面）。 */
type ProviderProbeResultProp = {
  ok: boolean;
  models: string[];
  error?: string;
};

/**
 * 厂商编辑抽屉内容：Key + 保存并检测 + 模型 + 启用。
 * @param props 组件入参
 * @returns 编辑表单节点
 */
export function ProviderEditor(props: ProviderEditorProps): ReactElement {
  const { preset, activeId, maskedKey, probe, draft, busy, selectedModel } = props;
  const models = probe?.ok === true ? probe.models : [];
  const active = isActiveProvider(preset.id, activeId);
  const disabled = busy !== '';
  const failed = probe !== undefined && !probe.ok;
  // 动线合并：草稿非空 = 保存并检测；空 = 仅检测。保存内部已有"未修改"守卫。
  const saveAndProbe = async (): Promise<void> => {
    if (draft.trim() !== '') await props.onSaveKey();
    await props.onProbe();
  };

  return (
    <Flex vertical gap={14}>
      <Flex align="center" gap={10}>
        <span className="sp-tile-badge" aria-hidden="true">
          {providerBadgeOf(preset.label)}
        </span>
        <Typography.Text strong>{preset.label}</Typography.Text>
        {active ? (
          <Typography.Text type="secondary" className="sp-tile-status ok">
            <span className="sp-tile-glyph" aria-hidden="true">
              ●
            </span>
            {t('当前使用')}
          </Typography.Text>
        ) : null}
      </Flex>
      <Typography.Text type="secondary" className="mono sp-tile-sub" style={{ fontSize: 12 }}>
        {preset.baseUrl}
      </Typography.Text>

      <Flex vertical gap={6}>
        <Typography.Text>{t('API Key')}</Typography.Text>
        <Input.Password
          aria-label={`${preset.label} API Key`}
          placeholder={
            maskedKey !== undefined
              ? t('已保存 {key}，输入新值覆盖', { key: maskedKey })
              : t('输入 API Key')
          }
          visibilityToggle={false}
          value={draft}
          onChange={(e) => props.onDraft(e.target.value)}
        />
      </Flex>

      <Button
        type="primary"
        disabled={disabled}
        loading={disabled}
        onClick={() => void saveAndProbe()}
      >
        {draft.trim() !== '' ? t('保存并检测') : t('检测')}
      </Button>

      {probe?.ok === true && models.length > 0 ? (
        <Flex vertical gap={6}>
          <Typography.Text>{t('可用模型')}</Typography.Text>
          <Select
            aria-label={t('{name} 可用模型', { name: preset.label })}
            value={selectedModel ?? models[0]}
            onChange={(value: string) => props.onModelPick(value)}
            options={models.map((m) => ({ value: m, label: m }))}
            style={{ width: '100%' }}
          />
          <Button
            type="primary"
            disabled={disabled || !selectedModel}
            loading={busy === `${preset.id}:enable`}
            onClick={() => void props.onEnable()}
          >
            {active ? t('重新启用（切换模型）') : t('启用此厂商')}
          </Button>
        </Flex>
      ) : null}

      {failed ? (
        <Alert
          type="error"
          showIcon
          message={t('检测未通过：{msg}（保存有效 Key 后重试）', {
            msg: probe?.error ?? t('未知原因'),
          })}
        />
      ) : null}
      {probe === undefined && maskedKey !== undefined ? (
        <Typography.Text type="secondary">
          {t('已保存 Key，点「检测」拉取真实可用模型清单')}
        </Typography.Text>
      ) : null}
      {probe === undefined && maskedKey === undefined ? (
        <Typography.Text type="secondary">
          {t('未配置 Key：保存 → 检测 → 启用后才会显示可用模型')}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}
