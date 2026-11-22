// 设置字段合并视图（W2 拆分）：按栏聚合的三个域文件在此保序合并，
// 消费侧（SettingsModel）语义与拆分前完全一致（顺序也是渲染顺序）。
import { SETTINGS_FIELDS_PRIMARY } from './settingsFieldsPrimary.ts';
import { SETTINGS_FIELDS_RUNTIME } from './settingsFieldsRuntime.ts';
import type { SettingsField } from './settingsTypes.ts';

/** 全部设置字段（原 settingsCatalog.SETTINGS_FIELDS，顺序不变）。 */
export const SETTINGS_FIELDS: readonly SettingsField[] = [
  ...SETTINGS_FIELDS_PRIMARY,
  ...SETTINGS_FIELDS_RUNTIME,
];
