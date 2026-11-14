// 按分栏筛选设置字段（模型 / 运行时 / 权限三页共用）。
//
// 2026-11-02 从 `SettingsSurface` 抽出：原实现每页各写一份
// `SETTINGS_FIELDS.filter((field) => field.tab === which)`。抽成单一实现后，
// 新增分栏时不会出现「某一页忘了过滤」的漂移。

import { SETTINGS_FIELDS, type SettingsField, type SettingsTabKey } from '../../models/SettingsModel.ts';

/**
 * 取某分栏的全部设置字段（顺序即声明顺序，也就是渲染顺序）。
 * @param which 分栏 key
 * @returns 该分栏的字段清单
 */
export function fieldsOf(which: SettingsTabKey): SettingsField[] {
  return SETTINGS_FIELDS.filter((field) => field.tab === which);
}

/**
 * 取某分栏内指定卡片分组的字段（2026-11-14 设置页补全：运行时栏按存储/成本熔断/记忆分卡）。
 * @param which 分栏 key
 * @param group 卡片分组（字段声明里的 `group`）
 * @returns 该组的字段清单（顺序即声明顺序）
 */
export function fieldsOfGroup(which: SettingsTabKey, group: string): SettingsField[] {
  return SETTINGS_FIELDS.filter((field) => field.tab === which && field.group === group);
}
