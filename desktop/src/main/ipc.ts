/** 主进程 IPC：只暴露语义化能力，不提供任意命令/任意路径。 */
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';
import type { NotifyInput } from './notifications.ts';
import type { DesktopIpcConfig } from './config.ts';
import { currentHarnessOrigin } from './security.ts';
import type { UpdateStatus } from './updateService.ts';
import {
  assertNotifyInput as assertNotifyInputPure,
  assertRevealPathInside,
  trustRejection,
} from './ipcGuards.ts';

// assertDirectory 的实现移入纯逻辑模块 ipcGuards.ts（可被桌面判据直接打包测试）；此处
// 再导出保持 main.ts 的既有导入路径不变。
export { assertDirectory } from './ipcGuards.ts';

/** IPC 依赖。 */
export interface IpcDeps {
  /** 入参上限（来自桌面配置）。 */
  readonly limits: DesktopIpcConfig;
  /** 当前主窗口 webContents（sender 校验）。 */
  mainContents(): WebContents | undefined;
  /** 额外窗口 sender 校验（多窗口；缺省只看主窗口）。 */
  isTrustedContents?(contents: WebContents): boolean;
  /** 当前工作区。 */
  workspace(): string;
  /** 托盘 busy 态切换（回合开始/结束；缺省则托盘无 busy 面）。 */
  setTrayBusy?(busy: boolean): void;
  /** 当前桌面语言（`zh-CN`/`en-US`）。 */
  language(): string;
  /** 打开诊断信息对话框。 */
  showDiagnostics(): void;
  /** 关闭到托盘状态。 */
  closeToTray(): boolean;
  /** 设置关闭到托盘。 */
  setCloseToTray(enabled: boolean): void;
  /** 开机启动状态。 */
  openAtLogin(): boolean;
  /** 设置开机启动。 */
  setOpenAtLogin(enabled: boolean): void;
  /** 打开日志目录。 */
  openLogs(): Promise<void>;
  /** 重启 Harness。 */
  restartHarness(): Promise<void>;
  /** 在系统文件管理器中打开目录（桌面版专用）。 */
  revealPath(path: string): Promise<void>;
  /** 原生通知。 */
  notify(input: NotifyInput): boolean;
  /** 检查更新。 */
  checkForUpdates(): Promise<void>;
  /** 下载更新。 */
  downloadUpdate(): Promise<void>;
  /** 安装更新。 */
  installUpdate(): Promise<void>;
  /** 当前更新状态。 */
  updateStatus(): UpdateStatus;
  // 2026-11-06 审计 P2：删除 pickWorkspace / openWorkspace / openExternal / quit 四个零 UI
  // 消费的桥面（见 preload.ts 同日注）。选目录/切工作区仍是主进程托盘与菜单的一等动作，
  // 但不再暴露给渲染进程——那会把「把侧车指到任意目录」的权限送给一次 XSS。
}

/**
 * 注册 IPC。
 * @param deps 依赖。
 * @returns 无返回值。
 */
export function registerIpc(deps: IpcDeps): void {
  ipcMain.handle('omni:getInfo', (event) => {
    assertTrusted(event, deps);
    return {
      appVersion: app.getVersion(),
      platform: process.platform,
      workspace: deps.workspace(),
      language: deps.language(),
      closeToTray: deps.closeToTray(),
      openAtLogin: deps.openAtLogin(),
    };
  });
  ipcMain.handle('omni:showDiagnostics', (event) => {
    assertTrusted(event, deps);
    deps.showDiagnostics();
    return true;
  });
  ipcMain.handle('omni:setProgress', (event, value: unknown) => {
    assertTrusted(event, deps);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('invalid progress');
    }
    const progress = Math.min(2, Math.max(-1, value));
    BrowserWindow.fromWebContents(event.sender)?.setProgressBar(progress);
    // 复用既有信号切托盘 busy 态（2026-11-06 实用性打磨）：value 2 = 回合开始（不确定进度）
    // ⇒ 绿点变体；-1 = 回合收尾 ⇒ 常规图标。无需新增 IPC 面。
    deps.setTrayBusy?.(progress === 2);
    return true;
  });
  ipcMain.handle('omni:setCloseToTray', (event, enabled: unknown) => {
    assertTrusted(event, deps);
    if (typeof enabled !== 'boolean') throw new Error('invalid closeToTray');
    deps.setCloseToTray(enabled);
    return deps.closeToTray();
  });
  ipcMain.handle('omni:setOpenAtLogin', (event, enabled: unknown) => {
    assertTrusted(event, deps);
    if (typeof enabled !== 'boolean') throw new Error('invalid openAtLogin');
    deps.setOpenAtLogin(enabled);
    return deps.openAtLogin();
  });
  ipcMain.handle('omni:openLogs', async (event) => {
    assertTrusted(event, deps);
    await deps.openLogs();
  });
  ipcMain.handle('omni:restartHarness', async (event) => {
    assertTrusted(event, deps);
    await deps.restartHarness();
  });
  ipcMain.handle('omni:revealPath', async (event, path: unknown) => {
    assertTrusted(event, deps);
    if (typeof path !== 'string') throw new Error('invalid path');
    // 白名单（2026-11-08 审计中危）：渲染层不可信——路径必须落在当前工作区子树内才允许
    // 唤起系统文件管理器（日志目录走语义化的 omni:openLogs，不经本通道）。
    await deps.revealPath(assertRevealPathInside(path, [deps.workspace()]));
  });
  ipcMain.handle('omni:notify', (event, input: unknown) => {
    assertTrusted(event, deps);
    return deps.notify(assertNotifyInput(input, deps.limits));
  });
  ipcMain.handle('omni:checkForUpdates', async (event) => {
    assertTrusted(event, deps);
    await deps.checkForUpdates();
  });
  ipcMain.handle('omni:downloadUpdate', async (event) => {
    assertTrusted(event, deps);
    await deps.downloadUpdate();
  });
  ipcMain.handle('omni:installUpdate', async (event) => {
    assertTrusted(event, deps);
    await deps.installUpdate();
  });
  ipcMain.handle('omni:getUpdateStatus', (event) => {
    assertTrusted(event, deps);
    return deps.updateStatus();
  });
  // 窗口控制（win32 隐藏系统标题栏后，UI 自绘标题条的三个动作；其它平台 harmless）：
  // 目标窗口一律从 sender 反查——不可能借道操控别的窗口；close 走正常 close 事件链，
  // 与「关闭到托盘」和 bounds 记忆行为保持一致。
  ipcMain.handle('omni:win:minimize', (event) => {
    assertTrusted(event, deps);
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle('omni:win:toggleMaximize', (event) => {
    assertTrusted(event, deps);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win === null || win.isDestroyed()) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('omni:win:close', (event) => {
    assertTrusted(event, deps);
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

/**
 * 校验通知参数（渲染层不可信）。
 * @param value 原始参数。
 * @param limits 长度上限（桌面配置）。
 * @returns 合法输入。
 */
function assertNotifyInput(value: unknown, limits: DesktopIpcConfig): NotifyInput {
  return assertNotifyInputPure(value, limits) as NotifyInput;
}

/**
 * 校验 IPC 来源：主窗口主 frame + 当前 harness origin。
 * @param event IPC 事件。
 * @param deps 依赖。
 * @returns 无返回值；不可信时抛错。
 */
function assertTrusted(event: IpcMainInvokeEvent, deps: IpcDeps): void {
  const rejection = trustRejection(event, deps, currentHarnessOrigin());
  if (rejection === 'sender') throw new Error('ipc denied: sender');
  if (rejection === 'frame') throw new Error('ipc denied: frame');
  if (rejection === 'origin') throw new Error('ipc denied: origin');
}

/**
 * 弹出原生目录选择。
 * @param defaultPath 默认路径。
 * @returns 选中路径或 null。
 */
export async function pickDirectory(defaultPath: string): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: '选择工作区',
    defaultPath,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0] ?? null;
}

/**
 * 打开日志目录（失败时用系统文件管理器打开父目录）。
 * @param dir 目录。
 * @returns 无返回值。
 */
export async function openLogDirectory(dir: string): Promise<void> {
  const error = await shell.openPath(dir);
  if (error !== '') await shell.openPath(app.getPath('userData'));
}
