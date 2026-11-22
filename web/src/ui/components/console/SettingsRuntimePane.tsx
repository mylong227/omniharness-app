// 设置页「运行时」栏：执行环境 / 存储 / 步数与成本（含模型熔断）/ 上下文与检索 / 长期记忆 五卡。
//
// 2026-11-02 从 `SettingsSurface` 抽出（`check.mjs` 函数体行数铁律：原 `renderRuntime`
// 一个箭头函数 22 行；抽出的目的只是让容器保持薄组合，展示内容逐字未改）。
// 2026-11-14 内核能力补全（docs/design/settings-completion §3.2）：同栏按 `group`
// 拆卡——一张卡装下二十余行会失去扫读结构。
// 2026-11-15 alpha.19 上下文三段（检索供给/语义召回/降档阶梯）按 `context` 组独立成卡。

import { t } from '../../i18n/i18n.ts';
import type { SettingsModel } from '../../models/SettingsModel.ts';
import { ConsoleCard, ConsoleInfoRow, ConsoleSettingRow } from './ConsoleUI.tsx';
import { fieldsOfGroup } from './settingsFields.ts';
import { fieldId } from '../../models/SettingsModel.ts';
import type { Config } from '../../../types/models.ts';

/** 「运行时」栏的入参。 */
export interface SettingsRuntimePaneProps {
  /** 当前服务端配置（未装载时为 null）。 */
  cfg: Config | null;
  /** 设置模型（字段行读写通道）。 */
  settings: SettingsModel;
}

/**
 * 「运行时」栏：适配器与执行环境 / 存储 / 步数与成本 / 上下文与检索 / 长期记忆 + 工作区。
 * @param props 组件入参
 * @returns 运行时页节点
 */
export function SettingsRuntimePane(props: SettingsRuntimePaneProps): ReactElement {
  const { cfg, settings } = props;
  return (
    <>
      <ConsoleCard
        title={t('适配器与执行环境')}
        description={t('适配器决定请求协议；沙箱决定命令在什么隔离层里执行。')}
      >
        {fieldsOfGroup('runtime', 'exec').map((field) => (
          <ConsoleSettingRow key={fieldId(field)} field={field} model={settings} />
        ))}
      </ConsoleCard>
      <ConsoleCard
        title={t('存储')}
        description={t('会话与事件的落盘方式与位置；改动在重启后生效。')}
      >
        {fieldsOfGroup('runtime', 'storage').map((field) => (
          <ConsoleSettingRow key={fieldId(field)} field={field} model={settings} />
        ))}
      </ConsoleCard>
      <ConsoleCard
        title={t('步数与成本')}
        description={t('限制单回合的执行步数与 token 成本；熔断在模型连续失败时暂停调用。')}
      >
        {fieldsOfGroup('runtime', 'budget').map((field) => (
          <ConsoleSettingRow key={fieldId(field)} field={field} model={settings} />
        ))}
      </ConsoleCard>
      <ConsoleCard
        title={t('上下文与检索')}
        description={t(
          '推入式检索、语义召回与预算降档阶梯；全部缺省关闭，改动在下一回合生效。',
        )}
      >
        {fieldsOfGroup('runtime', 'context').map((field) => (
          <ConsoleSettingRow key={fieldId(field)} field={field} model={settings} />
        ))}
      </ConsoleCard>
      <ConsoleCard
        title={t('缓存与防火墙')}
        description={t('确定性读缓存与能力数据流防火墙；缺省全关，开启后按段生效。')}
      >
        {fieldsOfGroup('runtime', 'guard').map((field) => (
          <ConsoleSettingRow key={fieldId(field)} field={field} model={settings} />
        ))}
      </ConsoleCard>
      <ConsoleCard
        title={t('长期记忆')}
        description={t('跨会话记忆的加密与治理；未配密钥文件时加密使用派生默认密钥。')}
      >
        {fieldsOfGroup('runtime', 'memory').map((field) => (
          <ConsoleSettingRow key={fieldId(field)} field={field} model={settings} />
        ))}
      </ConsoleCard>
      <ConsoleCard
        title={t('专家能力')}
        description={t(
          '进化闭环、决策引擎、校准自主性与角色门禁；面向进阶场景，缺省全关，改动重启生效。',
        )}
      >
        {fieldsOfGroup('runtime', 'expert').map((field) => (
          <ConsoleSettingRow key={fieldId(field)} field={field} model={settings} />
        ))}
      </ConsoleCard>
      <ConsoleCard
        title={t('工作区')}
        description={t(
          '工作区由启动参数或用户级配置决定（--workspace / ~/.omniharness/omniharness.json），界面内不提供切换。',
        )}
      >
        <ConsoleInfoRow
          label={t('当前工作区')}
          value={cfg?.workspace !== undefined && cfg.workspace !== '' ? String(cfg.workspace) : '—'}
        />
      </ConsoleCard>
    </>
  );
}
