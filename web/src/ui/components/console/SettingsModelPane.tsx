// 设置页「模型与厂商」栏：厂商**网格总览** + 编辑抽屉（2026-11-14 重设计，方案 A）。
//
// 设计稿：docs/design/provider-settings-redesign/README.md。总览层零输入框——
// 每厂商一张 ProviderTile（徽标 + 名称 + 单一状态档 + 摘要），点卡弹 Drawer 进入
// ProviderEditor（Key/保存并检测/模型/启用全部集中在抽屉）。修掉的旧版问题：
//   · 标题行与卡体头部信息重复（两套头部合并成总览卡）；
//   · 三套状态并存（归一为四档：● 当前 / ✓ 已配置 / ○ 未配置 / ! 检测失败）；
//   · 「当前」徽标多行同亮（isActiveProvider 收敛到 catalog active.id 单一真源）；
//   · 折叠条默认全展开导致页面超长（网格恒定 ~3 行高度）。
// 「默认模型与端点」卡不动。

import { t } from '../../i18n/i18n.ts';
import type { SettingsModel } from '../../models/SettingsModel.ts';
import { ConsoleCard, ConsoleSettingRow } from './ConsoleUI.tsx';
import { ProviderTile } from '../settings/ProviderTile.tsx';
import { ProviderEditor } from '../settings/ProviderEditor.tsx';
import { fieldsOf } from './settingsFields.ts';
import {
  selectedModelFor,
  type CatalogStatus,
  type ProviderCatalogState,
} from './useProviderCatalog.ts';
import type { Config, ProviderPreset } from '../../../types/models.ts';
import Drawer from 'antd/es/drawer';
import Button from 'antd/es/button';

/** 目录提示条的入参。 */
interface CatalogNoticeProps {
  /** 目录装载态。 */
  status: CatalogStatus;
  /** 读取失败原因。 */
  error: string;
  /** 厂商清单是否为空（只有空清单才显示「读取中 / 目录为空」）。 */
  empty: boolean;
  /** 重试回调。 */
  onRetry: () => void;
}

/**
 * 目录提示条：失败原因 + 重试 / 目录为空 / 读取中。
 * @param props 组件入参
 * @returns 提示条；无需提示时为 null
 */
function CatalogNotice(props: CatalogNoticeProps): ReactElement | null {
  if (props.status === 'error') {
    return (
      <div className="sp-load-error" role="alert">
        <span>{t('读取厂商目录失败：{msg}', { msg: props.error })}</span>
        <Button onClick={props.onRetry}>
          {t('重试')}
        </Button>
      </div>
    );
  }
  if (!props.empty) return null;
  if (props.status === 'ready') {
    return (
      <div className="sp-load-error" role="alert">
        <span>{t('厂商目录为空：defaults/providers.json 可能缺失或不可读。')}</span>
        <Button onClick={props.onRetry}>
          {t('重试')}
        </Button>
      </div>
    );
  }
  return <p className="csl-empty">{t('读取厂商目录…')}</p>;
}

/** 「模型与厂商」栏的入参（只包含这一栏真正用到的字段）。 */
export interface SettingsModelPaneProps {
  /** 厂商目录状态与动作。 */
  catalog: ProviderCatalogState;
  /** 当前服务端配置（用于判断生效厂商 / 生效模型 / 工作区展示）。 */
  cfg: Config | null;
  /** 设置模型（字段行读写通道）。 */
  settings: SettingsModel;
}

/**
 * 厂商网格：目录就绪时按目录顺序渲染总览卡（点击开编辑抽屉）。
 * @param props 目录状态
 * @returns 网格节点
 */
function ProviderGrid(props: { catalog: ProviderCatalogState }): ReactElement {
  const { catalog } = props;
  return (
    <div className="sp-grid" role="list" aria-label={t('厂商列表')}>
      {catalog.providers.map((preset) => (
        <ProviderTile
          key={preset.id}
          preset={preset}
          activeId={catalog.activeId}
          {...(catalog.maskedKeys[preset.id] !== undefined
            ? { maskedKey: catalog.maskedKeys[preset.id] }
            : {})}
          {...(catalog.probes[preset.id] !== undefined
            ? { probe: catalog.probes[preset.id] }
            : {})}
          onOpen={() => catalog.setEditorOpen(preset.id)}
        />
      ))}
    </div>
  );
}

/**
 * 「模型与厂商」栏：厂商接入（网格 + 抽屉）+ 默认模型与端点。
 * @param props 组件入参
 * @returns 模型页节点
 */
export function SettingsModelPane(props: SettingsModelPaneProps): ReactElement {
  const { catalog } = props;
  /** 当前打开编辑抽屉的厂商（null = 关闭）。 */
  const editing: ProviderPreset | null =
    catalog.editorOpenId === null
      ? null
      : (catalog.providers.find((p) => p.id === catalog.editorOpenId) ?? null);
  const configured = catalog.providers.filter(
    (preset) => catalog.maskedKeys[preset.id] !== undefined,
  ).length;
  return (
    <>
      <ConsoleCard
        title={t('厂商接入')}
        meta={
          catalog.providers.length === 0
            ? undefined
            : t('{done}/{total} 已配置 Key', { done: configured, total: catalog.providers.length })
        }
        description={t('点厂商卡编辑 Key / 检测 / 启用；凭据由服务端打码存储，界面不回显原文。')}
        actions={
          <Button onClick={catalog.reloadProviders}>
            {t('刷新')}
          </Button>
        }
      >
        <CatalogNotice
          status={catalog.catalogStatus}
          error={catalog.catalogError}
          empty={catalog.providers.length === 0}
          onRetry={catalog.reloadProviders}
        />
        <ProviderGrid catalog={catalog} />
      </ConsoleCard>
      <ConsoleCard
        title={t('默认模型与端点')}
        description={t('默认模型用于新会话；自定义端点留空即回落厂商默认端点。')}
      >
        {fieldsOf('model').map((field) => (
          <ConsoleSettingRow key={String(field.key)} field={field} model={props.settings} />
        ))}
      </ConsoleCard>
      <Drawer
        open={editing !== null}
        onClose={() => catalog.setEditorOpen(null)}
        title={editing?.label ?? ''}
        width={440}
        destroyOnHidden
      >
        {editing === null ? null : (
          <ProviderEditor
            preset={editing}
            activeId={catalog.activeId}
            {...(catalog.maskedKeys[editing.id] !== undefined
              ? { maskedKey: catalog.maskedKeys[editing.id] }
              : {})}
            {...(catalog.probes[editing.id] !== undefined
              ? { probe: catalog.probes[editing.id] }
              : {})}
            draft={catalog.drafts[editing.id] ?? ''}
            busy={catalog.busyById[editing.id] ?? ''}
            selectedModel={selectedModelFor(
              editing,
              catalog.probes[editing.id]?.models ?? [],
              catalog.modelSel,
              props.cfg?.model ?? '',
            )}
            onDraft={(value) => catalog.setDraft(editing.id, value)}
            onModelPick={(value) => catalog.setModelChoice(editing.id, value)}
            onSaveKey={() => catalog.saveKey(editing)}
            onProbe={() => catalog.probe(editing)}
            onEnable={() => catalog.enable(editing)}
          />
        )}
      </Drawer>
    </>
  );
}
