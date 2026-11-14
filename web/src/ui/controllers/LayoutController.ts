// 视图布局 / 主题偏好控制器（从 AppController 抽离，避免越过 25 方法的上帝类红线）。
// 单一职责：主题切换、左右面板开合、面板宽度持久化、首屏偏好恢复。全部经 AppHost.patch 驱动状态。

import type { AppHost } from './AppController.ts';
import { MethodBinder } from './methodBinder.ts';
import { setLocale as applyLocale, t, type Locale } from '../i18n/i18n.ts';
import {
  applyScheme,
  applyTheme,
  readSchemePreference,
  readThemePreference,
  resolveTheme,
  watchSystemTheme,
  type ThemePreference,
} from '../models/ThemePreference.ts';
import { RightPanePreference, RIGHT_COLLAPSED_STORAGE_KEY } from '../models/RightPanePreference.ts';
import type { ThemeScheme } from '../theme/palette.ts';

/** 布局 / 主题偏好控制器。 */
export class LayoutController {
  /** 状态宿主（App 组件）。 */
  private readonly host: AppHost;

  /** 系统主题订阅的取消函数（偏好不是 `system` 时为 null）。 */
  private unwatchSystem: (() => void) | null = null;

  /** 进入专注模式前的布局快照（退出时原样恢复；未进入为 null）。 */
  private focusRestore: { leftOpen: boolean; rightOpen: boolean; rightCollapsed: boolean } | null =
    null;

  /**
   * 构造。
   * @param host 状态宿主
   */
  public constructor(host: AppHost) {
    this.host = host;
    // 本类的方法**全部**以裸引用传给子组件（onToggleTheme / onToggleLeft / onToggleRight /
    // onLeftWidthChange / onRightWidthChange）⇒ 必须绑定，否则每次点击都在事件处理器里抛
    // `this.host` 读取失败（表现为「按钮点了没反应」）。见 MethodBinder。
    MethodBinder.bindAll(this);
  }

  /**
   * 从 localStorage 恢复主题偏好 / 模型清单 / 面板宽度（挂载时调用一次）。
   *
   * 主题默认**跟随系统**（2026-10-18）：从未选择过的用户按 `prefers-color-scheme` 取首屏，
   * 且不把"猜出来的结果"当成用户选择写回。首帧前的取值由 `index.html` 的内联脚本完成，
   * 这里负责把同一结果同步进 React 状态、并挂上系统主题的订阅。
   * @returns 无
   */
  public initTheme(): void {
    const pref = readThemePreference();
    const theme = applyTheme(pref);
    if (pref === 'system') this.watchSystem();
    // 主题色方案：读盘 → 应用（写 data-scheme）→ 同步进 React 状态。
    // 首帧前的属性由 index.html 内联脚本设好，这里只对齐状态。
    const scheme = readSchemePreference();
    applyScheme(scheme);
    this.host.patch({ theme, themePref: pref, scheme });
    try {
      const cachedOptions = localStorage.getItem('omni-model-options');
      const cachedLabel = localStorage.getItem('omni-provider-label');
      if (cachedOptions) {
        const parsed = JSON.parse(cachedOptions) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) this.host.patch({ modelOptions: parsed });
      }
      if (cachedLabel) this.host.patch({ providerLabel: cachedLabel });
      // 每模型档位表与模型清单同缓存口径（adaptive-reasoning）：刷新后首屏（catalog RPC
      // 返回前）没有它，deepseek-chat/gpt-4o 这类"确证不支持"的模型会先按厂商档画出假
      // 进度条。只接受纯对象（形状不符就丢弃——缓存值可能被旧版本写成别的）。
      const cachedEfforts = localStorage.getItem('omni-efforts-by-model');
      if (cachedEfforts) {
        const parsedEfforts = JSON.parse(cachedEfforts) as unknown;
        const plain =
          typeof parsedEfforts === 'object' &&
          parsedEfforts !== null &&
          !Array.isArray(parsedEfforts);
        if (plain) this.host.patch({ effortsByModel: parsedEfforts as Record<string, string[]> });
      }
      const cachedLeft = Number(localStorage.getItem('omni-left-width'));
      const cachedRight = Number(localStorage.getItem('omni-right-width'));
      if (cachedLeft >= 180 && cachedLeft <= 600) this.host.patch({ leftWidth: cachedLeft });
      if (cachedRight >= 180 && cachedRight <= 760) this.host.patch({ rightWidth: cachedRight });
      // 右栏收起态也是本机偏好：上次收着，这次就别再撑开（2026-10-07 用户反馈「右栏也要可收起」）。
      // 2026-11-10：没有显式偏好时按视口自动收起——900–1100px 的三栏会把中栏挤到不可读。
      const storedRight = localStorage.getItem(RIGHT_COLLAPSED_STORAGE_KEY);
      const viewportWidth = typeof window === 'undefined' ? 1600 : window.innerWidth;
      this.host.patch({ rightCollapsed: RightPanePreference.resolve(storedRight, viewportWidth) });
    } catch {
      /* 忽略 */
    }
  }

  /**
   * 设置主题偏好（系统 / 深色 / 浅色三态，持久化并立即生效）。
   *
   * 偏好为 `system` 时挂上系统主题订阅：系统在日落切换到暗色时界面跟着走；
   * 一旦用户显式选了明/暗，就取消订阅（锁定选择，不再被系统覆盖）。
   * @param pref 目标偏好
   * @returns 无
   */
  public setThemePref(pref: ThemePreference): void {
    const theme = applyTheme(pref);
    if (pref === 'system') {
      this.watchSystem();
    } else if (this.unwatchSystem !== null) {
      this.unwatchSystem();
      this.unwatchSystem = null;
    }
    this.host.patch({ theme, themePref: pref });
  }

  /**
   * 页脚/中栏按钮的「明暗互换」：始终写成显式偏好（这本身就是一次用户选择）。
   * @returns 无
   */
  public toggleTheme(): void {
    this.setThemePref(this.host.getState().theme === 'light' ? 'dark' : 'light');
  }

  /**
   * 设置主题色方案（靛墨 / 苔青 / 绛紫 / 琥珀 / 玫红）：写 `<html data-scheme>` +
   * 持久化 + 同步 React 状态。方案与明暗正交——任意方案 × 任意明暗都成立
   * （palette.ts SCHEMES 每套方案都带 dark / light 两份签名色）。
   * @param scheme 目标方案
   * @returns 无
   */
  public setSchemePref(scheme: ThemeScheme): void {
    applyScheme(scheme);
    this.host.patch({ scheme });
  }

  /**
   * 挂上系统主题订阅（幂等：已在订阅中则什么都不做）。
   * @returns 无
   */
  private watchSystem(): void {
    if (this.unwatchSystem !== null) return;
    this.unwatchSystem = watchSystemTheme(() => {
      if (this.host.getState().themePref !== 'system') return;
      const theme = resolveTheme('system');
      document.documentElement.setAttribute('data-theme', theme);
      this.host.patch({ theme });
    });
  }

  /**
   * 切换界面语言（中文 / English）：i18n 模块态 + localStorage（模块内）+ App 状态（触发全树
   * 重渲染）三处同步；t() 在渲染期读模块态，故重渲染后文案即刻换语言。
   *
   * 只负责"即时生效"；把 locale **持久化到服务端配置**是 SettingsController.setLocale 的
   * 职责（那是配置写盘，不是布局状态）。
   * @param l 目标语言
   * @returns 无
   */
  public setLocale(l: Locale): void {
    applyLocale(l);
    // 标签页标题同步换语言（挂载首设见 AppController.mount → settings.applyConfigLocale）。
    document.title = t('OmniHarness 工作台');
    this.host.patch({ locale: l });
  }

  /** 切换左侧会话面板（互斥关闭右侧）。 @returns 无 */
  public toggleLeft(): void {
    // 手动开合面板即视为退出专注：否则「专注中又开了侧栏」会变成自相矛盾的布局态。
    this.focusRestore = null;
    this.host.patch((s) => ({ focusMode: false, leftOpen: !s.leftOpen, rightOpen: false }));
  }

  /**
   * 切换专注模式：记住当前左右栏状态 → 隐藏两栏；再执行一次恢复。
   *
   * 为什么单独记状态而不是简单「都关掉」：用户可能在右栏本来收起、左栏打开的布局里按专注，
   * 退出时应该回到那个真实布局，而不是把两栏都强行撑开。与 `toggleLeft` / `toggleRight`
   * 共用状态机——手动开合任一面板即退出专注。
   * @returns 无
   */
  public toggleFocus(): void {
    const s = this.host.getState();
    if (!s.focusMode) {
      this.focusRestore = {
        leftOpen: s.leftOpen,
        rightOpen: s.rightOpen,
        rightCollapsed: s.rightCollapsed,
      };
      this.host.patch({ focusMode: true, leftOpen: false, rightOpen: false, rightCollapsed: true });
      return;
    }
    const restore = this.focusRestore ?? { leftOpen: false, rightOpen: false, rightCollapsed: false };
    this.focusRestore = null;
    this.host.patch({ focusMode: false, ...restore });
  }

  /** 关闭功能面板模态。 @returns 无 */
  public closePanels(): void {
    this.host.patch({ panelModalOpen: false });
  }

  /**
   * 切换右侧面板：桌面端 = 收起 / 展开整栏（持久化本机偏好）；窄屏（≤880px）= 抽屉（互斥关闭左栏）。
   * 2026-10-07 用户反馈「右侧栏也要可以收起来」前的行为只有抽屉一态，桌面端 12 面板常驻占宽。
   * @returns 无
   */
  public toggleRight(): void {
    // 与 toggleLeft 同口径：手动开合任一面板即退出专注。
    this.focusRestore = null;
    if (window.innerWidth <= 880) {
      this.host.patch((s) => ({ focusMode: false, rightOpen: !s.rightOpen, leftOpen: false }));
      return;
    }
    const next = !this.host.getState().rightCollapsed;
    try {
      localStorage.setItem(RIGHT_COLLAPSED_STORAGE_KEY, next ? '1' : '');
    } catch {
      /* 忽略 */
    }
    this.host.patch({ focusMode: false, rightCollapsed: next });
  }

  /**
   * 左/右侧面板拖拽宽度变更（持久化到 localStorage）。
   * @param w 宽度
   * @returns 无
   */
  public onLeftWidthChange(w: number): void {
    this.host.patch({ leftWidth: w });
    try {
      localStorage.setItem('omni-left-width', String(w));
    } catch {
      /* 忽略 */
    }
  }

  /**
   * 右/左侧面板拖拽宽度变更（持久化到 localStorage）。
   * @param w 宽度
   * @returns 无
   */
  public onRightWidthChange(w: number): void {
    this.host.patch({ rightWidth: w });
    try {
      localStorage.setItem('omni-right-width', String(w));
    } catch {
      /* 忽略 */
    }
  }
}
