/** 系统托盘：显示窗口/打开工作区/日志/更新/退出。 */
import {
  Menu,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { DesktopI18n } from './i18n/DesktopI18n.ts';
import type { DesktopTrayConfig } from './config.ts';

/** 托盘依赖的动作。 */
export interface TrayActions {
  show(): void;
  /** 新开工作台窗口。 */
  newWindow(): void;
  openWorkspace(): void;
  /** 最近工作区（最多 5 条，按最近使用排序）。 */
  recentWorkspaces(): readonly string[];
  /** 打开最近工作区。 */
  openRecent(path: string): void;
  /** 重启本地 Harness 侧车（主进程统一入口；失败有对话框）。 */
  restartHarness(): void;
  openLogs(): void;
  checkUpdates(): void;
  diagnostics(): void;
  setCloseToTray(enabled: boolean): void;
  setOpenAtLogin(enabled: boolean): void;
  quit(): void;
  closeToTray(): boolean;
  openAtLogin(): boolean;
}

/** 托盘服务。 */
export class TrayService {
  private tray: Tray | null = null;

  /** busy 态图标路径（与常规图标同目录；缺失时回退常规图标）。 */
  private readonly busyPath: string;
  /** 当前是否处于 busy 态（重复 setBusy 去重，避免无谓的重绘）。 */
  private busy = false;

  /**
   * @param iconPath 托盘图标路径（dist/icon.png）。
   * @param actions 动作。
   * @param config 图标尺寸与提示文案。
   * @param i18n 托盘菜单文案。
   */
  public constructor(
    private readonly iconPath: string,
    private readonly actions: TrayActions,
    private readonly config: DesktopTrayConfig,
    private readonly i18n: DesktopI18n,
  ) {
    // busy 变体与常规图标同目录（dist/icon-busy.png；build 从 static/ 拷贝）。
    this.busyPath = join(dirname(iconPath), 'icon-busy.png');
  }

  /**
   * 创建托盘（图标缺失时静默跳过，不阻塞主流程）。
   *
   * 若创建时已处于 busy 态（慢启动期间回合已开始），直接以 busy 变体起盘——否则要等下一次
   * `setProgress` 才会切图，托盘会在最该显示"在跑"的前几秒保持常态。
   * @returns 是否创建成功。
   */
  public create(): boolean {
    if (this.tray !== null) return true;
    const image = this.imageFor(this.busy);
    if (image === null) return false;
    try {
      const tray = new Tray(
        image.resize({ width: this.config.iconSize, height: this.config.iconSize }),
      );
      tray.setToolTip(this.tooltipText(this.busy));
      tray.setContextMenu(this.menu());
      tray.on('click', () => this.actions.show());
      tray.on('double-click', () => this.actions.show());
      this.tray = tray;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 设置 busy 态（2026-11-06 实用性打磨）：切换托盘图标为带状态点的变体。
   *
   * 信号源复用**既有通道**：Web 在回合开始/结束时经 `omni:setProgress`（value 2 / -1）
   * 驱动任务栏进度——同一事件顺带切换托盘图标，无需新增 IPC 面。重复设置去重；
   * busy 变体缺失（旧包/开发态没生成）回退常规图标，绝不因装饰品抛错。
   * @param busy true = 有回合在跑（绿点变体）；false = 恢复常规图标。
   * @returns 无返回值。
   */
  public setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
    if (this.tray === null || this.tray.isDestroyed()) return;
    // 悬停提示同步反映状态：图标只给颜色，提示补一句「回合进行中」，托盘里也能确认在跑。
    this.tray.setToolTip(this.tooltipText(busy));
    const image = this.imageFor(busy);
    if (image === null) return;
    this.tray.setImage(image.resize({ width: this.config.iconSize, height: this.config.iconSize }));
  }

  /**
   * 托盘悬停提示：常态 = 配置文案；busy = 文案 + 「回合进行中」。
   * @param busy 是否 busy
   * @returns 提示文案
   */
  private tooltipText(busy: boolean): string {
    return busy ? `${this.config.tooltip} · ${this.i18n.t('tray.busy')}` : this.config.tooltip;
  }

  /**
   * 取某个状态对应的托盘图标（按需读盘；缺失/损坏时回退常规图标，二者都不可用返回 null）。
   * @param busy true = busy 变体
   * @returns 可用图标；不可用返回 null
   */
  private imageFor(busy: boolean): NativeImage | null {
    const candidates = busy ? [this.busyPath, this.iconPath] : [this.iconPath];
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      try {
        const image = nativeImage.createFromPath(path);
        if (!image.isEmpty()) return image;
      } catch {
        // 换下一个候选：装饰失败不影响任何功能。
      }
    }
    return null;
  }

  /**
   * 销毁托盘（同时复位 busy 态：窗口重建/托盘重建时不会带着上一轮的绿点）。
   * @returns 无返回值。
   */
  public destroy(): void {
    this.tray?.destroy();
    this.tray = null;
    this.busy = false;
  }

  /**
   * 刷新菜单（设置变化后调用）。
   * @returns 无返回值。
   */
  public refresh(): void {
    this.tray?.setContextMenu(this.menu());
  }

  /**
   * 构建原生菜单。
   * @returns 菜单。
   */
  private menu(): Menu {
    const template: MenuItemConstructorOptions[] = [
      { label: this.i18n.t('tray.show'), click: () => this.actions.show() },
      { label: this.i18n.t('tray.newWindow'), click: () => this.actions.newWindow() },
      { type: 'separator' },
      { label: this.i18n.t('tray.openWorkspace'), click: () => this.actions.openWorkspace() },
      {
        label: this.i18n.t('tray.recent'),
        submenu:
          this.actions.recentWorkspaces().length > 0
            ? this.actions.recentWorkspaces().map((path) => ({
                label: path,
                click: () => this.actions.openRecent(path),
              }))
            : [{ label: this.i18n.t('tray.noRecent'), enabled: false }],
      },
      { label: this.i18n.t('tray.restartHarness'), click: () => this.actions.restartHarness() },
      { label: this.i18n.t('tray.openLogs'), click: () => this.actions.openLogs() },
      { label: this.i18n.t('tray.checkUpdates'), click: () => this.actions.checkUpdates() },
      { label: this.i18n.t('tray.diagnostics'), click: () => this.actions.diagnostics() },
      { type: 'separator' },
      {
        label: this.i18n.t('tray.closeToTray'),
        type: 'checkbox',
        checked: this.actions.closeToTray(),
        click: (item) => {
          this.actions.setCloseToTray(item.checked);
          this.refresh();
        },
      },
      {
        label: this.i18n.t('tray.openAtLogin'),
        type: 'checkbox',
        checked: this.actions.openAtLogin(),
        click: (item) => {
          this.actions.setOpenAtLogin(item.checked);
          this.refresh();
        },
      },
      { type: 'separator' },
      { label: this.i18n.t('tray.quit'), click: () => this.actions.quit() },
    ];
    return Menu.buildFromTemplate(template);
  }
}
