// 设置目录结构判据（2026-11-21 W2）：settingsCatalog 曾是 816 行纯数据 + 全仓零判据——
// 控制台是用户最高频触达面，本文件钉住目录的**结构不变量**（与 settingsPane.test 的
// 「内核差集对账」互补：那边对账"与内核枚举一致"，这边对账"目录自身自洽"）。
// 直跑（web 测试统一入口）：npm run web:test（node 环境，零 DOM）。
import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import {
  CATALOG_KEYS,
  DEFAULT_LABELS,
  NUMBER_RANGES,
  OPTION_LABELS,
  SAVED_HINT_MS,
  SETTINGS_FIELDS,
  SETTINGS_TABS,
  fieldId,
} from '../src/ui/models/SettingsModel.ts';
import type { SettingsField } from '../src/ui/models/SettingsModel.ts';

const FIELD_IDS = SETTINGS_FIELDS.map((field: SettingsField) => fieldId(field));

describe('设置目录结构不变量（settings/ 域模块）', () => {
  it('fieldId 全局唯一（一个键只出现在一个字段里；同段多行靠 path 区分）', () => {
    const duplicates = FIELD_IDS.filter((id, index) => FIELD_IDS.indexOf(id) !== index);
    expect(duplicates, `重复 fieldId：${duplicates.join(', ')}`).toEqual([]);
  });

  it('每个字段的 tab 必须是已声明分栏（防拼错 tab 名静默丢行）', () => {
    const tabKeys = new Set(SETTINGS_TABS.map((tab) => tab.key));
    const invalid = SETTINGS_FIELDS.filter((field) => !tabKeys.has(field.tab));
    expect(
      invalid.map((field) => `${fieldId(field)} → ${field.tab}`),
      '字段归到了未声明的分栏',
    ).toEqual([]);
  });

  it('SETTINGS_TABS key 唯一且非空（左导航与路由 #settings=<key> 同源）', () => {
    const keys = SETTINGS_TABS.map((tab) => tab.key);
    expect(new Set(keys).size, '分栏 key 重复').toBe(keys.length);
    for (const key of keys) assert.ok(key !== '', '分栏 key 不得为空');
  });

  it('group 仅 runtime 栏使用且非空串（栏内卡片分组键）', () => {
    const bad = SETTINGS_FIELDS.filter(
      (field) => field.group !== undefined && (field.tab !== 'runtime' || field.group === ''),
    );
    expect(bad.map((field) => fieldId(field)), 'group 只属于 runtime 栏且非空').toEqual([]);
  });

  it('NUMBER_RANGES 的每个键都对应一个 number 字段（防表与字段脱钩）', () => {
    const numberIds = new Set(
      SETTINGS_FIELDS.filter((field) => field.kind === 'number').map((field) => fieldId(field)),
    );
    const orphans = Object.keys(NUMBER_RANGES).filter((key) => !numberIds.has(key));
    expect(orphans, `NUMBER_RANGES 孤儿键：${orphans.join(', ')}`).toEqual([]);
  });

  it('NUMBER_RANGES 每个键声明为 number kind 的字段必须登记范围（防漏校验）', () => {
    const missing = SETTINGS_FIELDS
      .filter((field) => field.kind === 'number')
      .map((field) => fieldId(field))
      .filter((id) => !(id in NUMBER_RANGES));
    expect(missing, `number 字段缺 NUMBER_RANGES：${missing.join(', ')}`).toEqual([]);
  });

  it('OPTION_LABELS 的每个键都对应存在的 fieldId（防孤儿显示名表）', () => {
    const known = new Set(FIELD_IDS);
    const orphans = Object.keys(OPTION_LABELS).filter((key) => !known.has(key));
    expect(orphans, `OPTION_LABELS 孤儿键：${orphans.join(', ')}`).toEqual([]);
  });

  it('DEFAULT_LABELS 的每个键都对应存在的 fieldId（防孤儿缺省名表）', () => {
    const known = new Set(FIELD_IDS);
    const orphans = Object.keys(DEFAULT_LABELS).filter((key) => !known.has(key));
    expect(orphans, `DEFAULT_LABELS 孤儿键：${orphans.join(', ')}`).toEqual([]);
  });

  it('select 字段必须给 options（下拉没有取值域就是死控件）', () => {
    const empty = SETTINGS_FIELDS.filter(
      (field) => field.kind === 'select' && (field.options === undefined || field.options.length === 0),
    );
    expect(empty.map((field) => fieldId(field)), 'select 字段缺 options').toEqual([]);
  });

  it('CATALOG_KEYS ⊆ 字段 key 集（改目录刷新键不得指向不存在的键）', () => {
    const fieldKeys = new Set(SETTINGS_FIELDS.map((field) => String(field.key)));
    const orphans = CATALOG_KEYS.filter((key) => !fieldKeys.has(key));
    expect(orphans, `CATALOG_KEYS 孤儿键：${orphans.join(', ')}`).toEqual([]);
  });

  it('规模快照（有意识地增减并更新数字；防整表被静默清空/截断）', () => {
    expect(SETTINGS_FIELDS.length).toBeGreaterThanOrEqual(54);
    expect(SETTINGS_TABS.length).toBe(6);
  });

  it('SAVED_HINT_MS 为正数（已保存提示自动消隐）', () => {
    assert.ok(SAVED_HINT_MS > 0);
  });
});
