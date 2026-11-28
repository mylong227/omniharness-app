// 设置模型：设置面板的**唯一状态与读写通道**（零 React，可在 node 下单测）。
//
// 为什么抽出来（2026-10-17 设置面板重构）：
//   旧 SettingsTab 把三件事混在一个组件里——取数、落盘、渲染。结果是**只有渲染能被测**，
//   而真正容易坏的是「改动 → 落盘 → 重拉回填 → 命中模型相关键时刷新厂商目录」这条闭环。
//   抽成模型后，这条闭环在 node 里可直测（判据见 web/test/configWiring.test.ts），
//   组件退化成薄视图。
//
// 同时它承载「设置面清单」：哪些键可改、取值域是什么、归在哪一栏。单一事实源，
// 避免"文档写一套、面板写一套、测试再写一套"（本仓历史上漂移过一次，见 §2 的教训）。
//
// 三层语义严格区分（这是本文件最容易写错的地方）：
//   ① 键（key）：`Config` 的字段名——`sandbox` / `autoApprove` / `baseUrl` …
//   ② 字段（Field）：设置面板里的**一行**，带类型与取值域，负责"怎么编辑"
//   ③ 分栏（TAB）：字段归到哪一屏，负责"去哪找"
//   一个键只出现在一个字段里；一个字段只属于一个分栏。断言钉在 web/test/settingsPane.test.ts。

// 目录（类型/分栏/字段/标签表）已拆到 ./settings/ 域模块（2026-11-20 目录化，2026-11-21 W2 按栏拆分）——
// 本文件只保留**读写通道**（SettingsModel 类）。全部目录符号经下方重导出保持既有导入面。

import { errorMessageOf } from '../../core/errorText.ts';
import type { Config } from '../../types/models.ts';
import { desktopBridge } from '../../core/desktop/DesktopBridge.ts';
import { t } from '../i18n/i18n.ts';
import {
  CATALOG_KEYS,
  NUMBER_RANGES,
  SAVED_HINT_MS,
  fieldId,
  type SettingsField,
} from './settings/settingsTypes.ts';

// 目录符号重导出（既有消费面 settingsFields/ConsoleRegistry/判据等零改动；按域取自拆分模块）。
export {
  CATALOG_KEYS,
  NUMBER_RANGES,
  SAVED_HINT_MS,
  fieldId,
  type SettingsField,
  type SettingsTabKey,
} from './settings/settingsTypes.ts';
export { SETTINGS_TABS } from './settings/settingsTabs.ts';
export {
  DEFAULT_LABELS,
  OPTION_LABELS,
  defaultLabelOf,
  optionLabelOf,
} from './settings/settingsLabels.ts';
export { SETTINGS_FIELDS } from './settings/settingsFields.ts';

/** 普通对象判定（结构化段取值/合并用；数组与 null 不算）。 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 设置面板渲染所需的快照。 */
export interface SettingsSnapshot {
  /** 服务端配置（未加载时为 null）。 */
  cfg: Config | null;
  /** 自定义 base-url 的受控草稿（留空＝清除覆盖）。 */
  baseUrl: string;
  /** 配置集清单。 */
  profiles: readonly { id: string; name: string }[];
  /** 当前生效插件（已 join）。 */
  activePlugins: string;
  /** 「已保存」提示文案（空串＝不显示）。 */
  savedHint: string;
  /** 最近一次保存成功的字段 id（`fieldId`；空串＝无）——行级「已保存」用小徽标。 */
  savedField: string;
  /** 是否正在保存（用于按钮 disabled 与提示）。 */
  saving: boolean;
  /** 最近一次错误文案（空串＝无）。 */
  error: string;
  /**
   * 首次装载失败的原因（空串＝无）。
   *
   * 为什么单独一档：`reload()` 在保存后重拉失败时必须**静默保留用户输入**（否则表单会被
   * 回填成服务端旧值）；但首次装载失败时 `cfg` 还是 null、整页都是占位符，静默会让用户
   * 只看到"空"，不知道是配置读挂了。这条只在 `cfg === null` 时写入，成功装载后清空。
   */
  loadError: string;
}

/** 设置模型依赖的服务端能力。 */
export interface SettingsModelDeps {
  /** 读运行时配置。 */
  getConfig: () => Promise<Config>;
  /** 写运行时配置（补丁语义见 SettingsModel.save）。 */
  updateConfig: (patch: Record<string, unknown>) => Promise<unknown>;
  /** 配置集清单。 */
  listProfiles: () => Promise<readonly { id: string; name: string }[]>;
  /** 当前生效的配置集/插件。 */
  getActiveProfile: () => Promise<{ plugins?: readonly string[] }>;
  /** 应用配置集。 */
  applyProfile: (id: string) => Promise<unknown>;
  /** 厂商目录刷新（命中 CATALOG_KEYS 时调用）。 */
  refreshModelCatalog?: (() => void) | undefined;
  /** 提示（错误与成功各一档）。 */
  toast: (msg: string, kind: 'ok' | 'err') => void;
}

/**
 * 设置模型：取数 / 落盘 / 回填 / 提示，全部收敛在这里。
 *
 * 生命周期：`load()` 一次 → 用户改动触发 `save()` → 内部 `reload()` 回填 → `subscribe` 通知视图。
 * 不做 React 依赖，视图侧用 `useSyncExternalStore` 订阅（见 SettingsSurface）。
 */
export class SettingsModel {
  /** 依赖（服务端客户端、通知回调等）。构造后不变。 */
  private readonly deps: SettingsModelDeps;

  /**
   * 当前快照（`useSyncExternalStore` 的取值源）。
   *
   * **引用必须稳定**：每次 `set()` 生成新对象、未变化时沿用旧引用——`useSyncExternalStore`
   * 用 `Object.is` 比较，若每次都造新对象会触发无限重渲染（`EMPTY_SNAPSHOT` 常量即为此保留）。
   */
  private snapshot: SettingsSnapshot = {
    cfg: null,
    baseUrl: '',
    profiles: [],
    activePlugins: '',
    savedHint: '',
    savedField: '',
    saving: false,
    error: '',
    loadError: '',
  };

  /** 订阅者集合（视图侧 useSyncExternalStore）。 */
  private readonly listeners = new Set<() => void>();

  /** 「已保存」提示的消隐定时器。 */
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  /** 是否已 dispose（阻止迟到的异步保存再创建定时器）。 */
  private disposed = false;

  /**
   * @param deps 服务端能力与提示通道
   */
  public constructor(deps: SettingsModelDeps) {
    this.deps = deps;
  }

  /**
   * 当前快照（引用稳定：只有变更时才换新对象，`useSyncExternalStore` 依赖这一点）。
   * @returns 快照
   */
  public getSnapshot(): SettingsSnapshot {
    return this.snapshot;
  }

  /**
   * 订阅变更。
   * @param fn 变更回调
   * @returns 取消订阅
   */
  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * 释放：清掉提示定时器，避免测试进程被挂住（旧实现的手工 clearTimeout 已内聚到这里）。
   * @returns 无
   */
  public dispose(): void {
    this.disposed = true;
    if (this.hintTimer !== null) {
      clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
    this.listeners.clear();
  }

  /**
   * 首次装载：拉配置 + 配置集清单（两者独立容错，任一失败不阻断另一条）。
   * @returns 异步完成
   */
  public async load(): Promise<void> {
    await Promise.all([this.reload(), this.reloadProfiles()]);
  }

  /**
   * 重新拉取运行时配置并回填；失败静默（保留当前值，不打断用户正在输入的内容）。
   * @returns 异步完成
   */
  public async reload(): Promise<void> {
    try {
      this.applyConfig(await this.deps.getConfig());
    } catch (e) {
      // 首次装载失败必须可见（cfg 仍为 null ⇒ 表单全是占位符）；保存后的重拉失败仍静默，
      // 保留用户刚输入的值（见 save() 的失败语义）。
      if (this.snapshot.cfg === null) {
        this.set({
          loadError: t('读取配置失败：{msg}', {
            msg: errorMessageOf(e),
          }),
        });
      }
    }
  }

  /**
   * 拉取配置集清单与当前生效插件；失败静默（profile 服务不可用不该阻断设置渲染）。
   * @returns 异步完成
   */
  public async reloadProfiles(): Promise<void> {
    try {
      const list = await this.deps.listProfiles();
      const active = await this.deps.getActiveProfile();
      this.set({
        profiles: list.map((p) => ({ id: p.id, name: p.name })),
        activePlugins: (active.plugins ?? []).join(t('、')),
      });
    } catch {
      /* 静默：profile 服务不可用时保留上一帧 */
    }
  }

  /**
   * 用服务端配置回填快照（首拉与保存后重拉共用，避免两处取值漂移）。
   * @param c 服务端配置
   * @returns 无
   */
  public applyConfig(c: Config): void {
    this.set({ cfg: c, baseUrl: (c.baseUrl as string) ?? '', loadError: '' });
  }

  /**
   * 落盘一个补丁，成功后重拉配置并闪现「已保存」；命中 CATALOG_KEYS 时刷新厂商目录。
   *
   * 失败语义（判据见 configWiring.test.ts 第 4 条）：**只提示错误，不重拉配置**——
   * 失败后重拉会把表单回填成服务端旧值，用户会以为"改动生效了但又变回去了"（假刷新）。
   * @param patch 配置补丁
   * @param savedField 本次保存对应的字段 id（行级「已保存」徽标用；可缺省）
   * @returns 异步完成
   */
  public async save(patch: Record<string, unknown>, savedField?: string): Promise<void> {
    this.set({ saving: true, error: '' });
    try {
      await this.deps.updateConfig(patch);
      // B3 语言收敛：壳层语言跟随 web 设置（桌面桥可用时；浏览器/旧 preload no-op）。
      if (patch['locale'] === 'zh-CN' || patch['locale'] === 'en-US') {
        desktopBridge()?.setDesktopLocale?.(patch['locale']);
      }
      this.flashSaved(t('已保存'), savedField);
      await this.reload();
      if (Object.keys(patch).some((k) => CATALOG_KEYS.includes(k))) this.deps.refreshModelCatalog?.();
    } catch (e) {
      const msg = t('保存失败：{msg}', { msg: (e as Error).message });
      this.set({ error: msg });
      this.deps.toast(msg, 'err');
    } finally {
      this.set({ saving: false });
    }
  }

  /**
   * 按字段落盘：把"界面里的值"翻成"配置补丁"。
   *
   * 四处语义要注意：
   *   · 声明了 `path` 的字段（结构化段）走 {@link saveSectionField}：提交**完整段**，
   *     留空 = 删除段内叶键（服务端按段替换）；
   *   · `clearWhenEmpty` 的字段（baseUrl）留空 ⇒ 发 `null`（**显式清除**）而不是 `undefined`
   *     （后者是 no-op，空串会被当成真实端点写坏 URL 拼装）；
   *   · 文本字段一律 trim；`model` 清空时发 `undefined`（回落厂商默认）；
   *   · number 字段（2026-11-14 设置页补全）留空 = 显式清除覆盖（发 `null`），非空则
   *     先过 `NUMBER_RANGES` 范围校验——非法值**不发请求**（内核 normalizeConfig 是最终
   *     裁决，前端先挡明显的输错，避免"保存失败"提示往返一次）。
   * @param field 字段定义
   * @param raw 控件给出的原始值（字符串或布尔）
   * @returns 异步完成
   */
  public async saveField(field: SettingsField, raw: string | boolean): Promise<void> {
    if (field.path !== undefined) {
      await this.saveSectionField(field, raw);
      return;
    }
    const id = fieldId(field);
    if (field.kind === 'switch') {
      await this.save({ [field.key]: raw === true }, id);
      return;
    }
    if (field.kind === 'number') {
      const n = this.numberForSave(field, raw);
      if (n === 'invalid') return;
      await this.save({ [field.key]: n === 'empty' ? null : n }, id);
      return;
    }
    const v = String(raw).trim();
    if (field.key === 'baseUrl') {
      this.set({ baseUrl: v });
      await this.save(v ? { baseUrl: v } : { baseUrl: null }, id);
      return;
    }
    if (field.key === 'model') {
      await this.save(v ? { model: v } : { model: undefined }, id);
      return;
    }
    // clearWhenEmpty 通用化（2026-11-14 review P1-1）：声明了该标记的文本字段留空 =
    // 显式清除覆盖（发 null，服务端删除键），而不是把空串原样落盘——内核消费侧
    // （storageDir/keyFile 等）`??` 不回落空串，空串会让运行时往空路径里撞。
    if (field.clearWhenEmpty === true) {
      await this.save(v ? { [field.key]: v } : { [field.key]: null }, id);
      return;
    }
    await this.save({ [field.key]: v }, id);
  }

  /**
   * 结构化段字段落盘：把「段内路径 + 新值」并进**完整段**后提交。
   *
   * 服务端对 `SECTION_REPLACE_KEYS` 按段替换（深合并无法删除嵌套键），故不能只发被改的叶子；
   * 留空 = 删除该嵌套键，删空后整段发 `null`（显式清除段）。
   * @param field 字段定义（`path` 非空）
   * @param raw 控件给出的原始值
   * @returns 异步完成
   */
  private async saveSectionField(field: SettingsField, raw: string | boolean): Promise<void> {
    const path = field.path;
    if (path === undefined) return;
    let value: unknown;
    if (field.kind === 'switch') {
      value = raw === true;
    } else if (field.kind === 'number') {
      const n = this.numberForSave(field, raw);
      if (n === 'invalid') return;
      value = n === 'empty' ? undefined : n;
    } else {
      const v = String(raw).trim();
      value = v === '' ? undefined : v;
    }
    const next = SettingsModel.withPath(this.sectionOf(String(field.key)), path, value);
    await this.save({ [field.key]: Object.keys(next).length === 0 ? null : next }, fieldId(field));
  }

  /**
   * number 输入翻译：数字 / 空（留空）/ invalid（已提示且不得落盘）。
   * @param field 字段定义
   * @param raw 控件原始值
   * @returns 数字、'empty' 或 'invalid'
   */
  private numberForSave(field: SettingsField, raw: string | boolean): number | 'empty' | 'invalid' {
    const v = String(raw).trim();
    if (v === '') return 'empty';
    const n = Number(v);
    const spec = NUMBER_RANGES[fieldId(field)];
    if (spec === undefined) {
      // 未登记范围的 number 字段：只要是个有限数就放行（保守，不发糊涂值）。
      if (!Number.isFinite(n)) {
        this.failInput(field, t('需为数字'));
        return 'invalid';
      }
      return n;
    }
    if (!spec.check(n)) {
      // desc 必须过 t()：en 用户的提示要整句英文（review P1-3）。
      this.failInput(field, t('取值范围：{range}', { range: t(spec.desc) }));
      return 'invalid';
    }
    return n;
  }

  /**
   * 取当前配置里的结构化段（非对象或缺省时给空对象）。
   * @param key 段名
   * @returns 段对象（快照的浅引用，只读消费）
   */
  private sectionOf(key: string): Record<string, unknown> {
    const value = this.snapshot.cfg?.[key];
    return isPlainObject(value) ? value : {};
  }

  /**
   * 在段对象上设置（或删除）一个叶值，并剪掉空父对象。
   * @param base 当前段（不修改）
   * @param path 段内路径
   * @param value 新值；undefined = 删除该叶
   * @returns 新段对象（删空时为 `{}`）
   */
  private static withPath(
    base: Record<string, unknown>,
    path: readonly string[],
    value: unknown,
  ): Record<string, unknown> {
    const root: Record<string, unknown> = { ...base };
    let node = root;
    for (const key of path.slice(0, -1)) {
      const child = node[key];
      const copy: Record<string, unknown> = isPlainObject(child) ? { ...child } : {};
      node[key] = copy;
      node = copy;
    }
    const leaf = path[path.length - 1];
    if (leaf === undefined) return root;
    if (value === undefined) delete node[leaf];
    else node[leaf] = value;
    return SettingsModel.pruneEmpty(root);
  }

  /**
   * 递归删除空对象：`cacheGuard: {}` 这类残留会让「已关闭」在文件里看起来仍配置着。
   * @param node 待清理对象（原地修改）
   * @returns 同一对象
   */
  private static pruneEmpty(node: Record<string, unknown>): Record<string, unknown> {
    for (const [key, value] of Object.entries(node)) {
      if (!isPlainObject(value)) continue;
      const pruned = SettingsModel.pruneEmpty({ ...value });
      if (Object.keys(pruned).length === 0) delete node[key];
      else node[key] = pruned;
    }
    return node;
  }

  /**
   * 沿路径读值（中间不是对象时给 undefined，不抛错）。
   * @param value 起点值
   * @param path 段内路径
   * @returns 叶值或 undefined
   */
  private static readPath(value: unknown, path: readonly string[]): unknown {
    let node = value;
    for (const key of path) {
      if (!isPlainObject(node)) return undefined;
      node = node[key];
    }
    return node;
  }

  /**
   * number 字段的前端校验失败：不落盘，落 error 快照 + toast（与 save 失败同通道）。
   * @param field 字段
   * @param reason 范围说明
   * @returns 无
   */
  private failInput(field: SettingsField, reason: string): void {
    const msg = t('保存失败：{msg}', {
      msg: t('「{name}」{reason}', { name: t(field.label), reason }),
    });
    this.set({ error: msg });
    this.deps.toast(msg, 'err');
  }

  /**
   * 应用配置集（即时生效），成功后刷新生效插件回显。
   * @param id 配置集 id（空串忽略）
   * @returns 异步完成
   */
  public async applyProfile(id: string): Promise<void> {
    if (id === '') return;
    try {
      await this.deps.applyProfile(id);
      this.deps.toast(t('已应用配置集'), 'ok');
      await this.reloadProfiles();
    } catch (e) {
      this.deps.toast(t('应用配置集失败：{msg}', { msg: (e as Error).message }), 'err');
    }
  }

  /**
   * 取某字段在当前配置里的值（视图回填用；未加载时给空串）。
   *
   * 同时接受顶层键（既有调用）与字段定义：结构化段字段按 `path` 取叶值，而不是把
   * 整段对象 `String()` 成 "[object Object]"。
   * @param target 配置键或字段定义
   * @returns 显示值
   */
  public valueOf(target: keyof Config | SettingsField): string {
    const c = this.snapshot.cfg;
    if (c === null) return '';
    if (typeof target !== 'object') {
      if (target === 'baseUrl') return this.snapshot.baseUrl;
      const value = c[target];
      return value === undefined || value === null ? '' : String(value);
    }
    if (target.path === undefined) return this.valueOf(target.key);
    const value = SettingsModel.readPath(c[target.key], target.path);
    return value === undefined || value === null ? '' : String(value);
  }

  /**
   * 取某字段的布尔值（switch 用）。
   * @param target 配置键或字段定义
   * @returns 是否开启
   */
  public boolOf(target: keyof Config | SettingsField): boolean {
    const c = this.snapshot.cfg;
    if (c === null) return false;
    if (typeof target !== 'object') return c[target] === true;
    return SettingsModel.readPath(c[target.key], target.path ?? []) === true;
  }

  /**
   * 闪现「已保存」并在 SAVED_HINT_MS 后自动消隐（重入时重置计时）。
   * @param text 提示文案
   * @param field 本次保存的字段 id（行级徽标；可缺省）
   * @returns 无
   */
  private flashSaved(text: string, field?: string): void {
    if (this.disposed) return;
    this.set({ savedHint: text, savedField: field ?? '' });
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      this.set({ savedHint: '', savedField: '' });
    }, SAVED_HINT_MS);
  }

  /**
   * 合并快照并通知订阅者（引用变化才通知，避免无谓重渲染）。
   * @param patch 快照补丁
   * @returns 无
   */
  private set(patch: Partial<SettingsSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }
}
