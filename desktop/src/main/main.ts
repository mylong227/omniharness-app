/** OmniHarness 桌面主进程（Electron；按 Codex 官方 App 的 Electron + React/TS 形态）。 */
import { app, BrowserWindow, globalShortcut, Notification, session, shell } from 'electron';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AutoStartService } from './autoStart.ts';
import { DesktopStateStore } from './desktopState.ts';
import { HarnessSupervisor, type HarnessHandle } from './harnessSupervisor.ts';
import { assertDirectory, openLogDirectory, pickDirectory, registerIpc } from './ipc.ts';
import { WorkspaceGuardError } from './ipcGuards.ts';
import { harnessEntry, logDir, modelDir, nodeBinary, runDir, vectorDir } from './lib/paths.ts';
import { parseLaunchArgs } from './lib/args.ts';
import { loadDesktopConfig, type DesktopConfig } from './config.ts';
import { DesktopDialogs } from './app/DesktopDialogs.ts';
import { DeepLinkRouter } from './app/DeepLinkRouter.ts';
import { HarnessRestartPolicy } from './app/HarnessRestartPolicy.ts';
import { HarnessStartFailure } from './app/HarnessStartFailure.ts';
import { SecondaryWindows } from './app/SecondaryWindows.ts';
import { SmokeHarness, type SmokeReport } from './app/SmokeHarness.ts';
import { StartupMarker } from './app/StartupMarker.ts';
import { WindowLifecycle } from './app/WindowLifecycle.ts';
import { DesktopI18n } from './i18n/DesktopI18n.ts';
import type { DesktopMessageKey } from './i18n/messages.ts';
import { DesktopLogger } from './logger.ts';
import { installMenu, refreshMenu } from './menu.ts';
import { NotificationService } from './notifications.ts';
import { attachHarness } from './app/HarnessAttach.ts';
import { installGlobalGuards } from './security.ts';
import { TrayService } from './tray.ts';
import { UpdateService } from './updateService.ts';
import { createMainWindow, loadHarness } from './window.ts';

app.setName('OmniHarness');

/**
 * 加载桌面配置（发布包文件 → 用户文件 → `OMNI_DESKTOP_CONFIG`）。
 *
 * 必须在 `app.setName` 之后（userData 路径取决于应用名）、`whenReady` 之前：
 * `app.getPath('userData')` 在主进程启动早期即可用。
 */
const loadedConfig = loadDesktopConfig({
  builtinFile: app.isPackaged
    ? join(process.resourcesPath, 'desktop.config.json')
    : join(app.getAppPath(), 'desktop.config.json'),
  userFile: join(app.getPath('userData'), 'desktop.config.json'),
  envFile: (process.env['OMNI_DESKTOP_CONFIG'] ?? '').trim(),
});
const config: DesktopConfig = loadedConfig.config;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  run();
}

/** 应用级可变状态（只在主进程）。 */
interface AppContext {
  window: BrowserWindow | null;
  supervisor: HarnessSupervisor | null;
  handle: HarnessHandle | null;
  workspace: string;
  logger: DesktopLogger;
  state: DesktopStateStore;
  notifications: NotificationService;
  updates: UpdateService;
  tray: TrayService | null;
  quitting: boolean;
  /** 原生壳文案（中/英）。 */
  i18n: DesktopI18n;
  /** 原生对话框统一入口。 */
  dialogs: DesktopDialogs;
}

let context: AppContext | null = null;

/** 深链路由（待处理 URL 由类持有，不再用全局变量）。 */
const deepLinks = new DeepLinkRouter({
  protocol: config.app.protocol,
  uiReadyTimeoutMs: config.deepLink.uiReadyTimeoutMs,
  getWindow: () => context?.window ?? null,
  isReady: () => context !== null,
  switchWorkspace: (path) => switchWorkspace(path),
});

/** 主窗口生命周期（显示/关闭到托盘/开机启动/诊断）。 */
const windows = new WindowLifecycle({
  current: () =>
    context === null
      ? null
      : {
          window: context.window,
          handle: context.handle,
          state: context.state,
          tray: context.tray,
        },
  createWindow: () => {
    if (context === null) throw new Error('window lifecycle not ready');
    return createMainWindow({
      preload: join(__dirname, 'preload.cjs'),
      state: context.state,
      config: config.window,
    });
  },
  setWindow: (window) => {
    if (context !== null) context.window = window;
  },
  loadHarness,
  refreshMenu,
  isQuitting: () => context?.quitting === true,
  applyAutoStart: (enabled) => AutoStartService.apply(enabled),
  logger: () => context?.logger ?? null,
  recovery: config.recovery,
  onUiGone: (kind, detail) => onUiGone(kind, detail),
});

/** 额外工作台窗口（多窗口）。 */
const secondary = new SecondaryWindows({
  createWindow: () => windows.createWindow(),
  loadHarness,
  logger: () => context?.logger ?? null,
});

/**
 * 新开一个工作台窗口（复用当前 Harness 句柄）。
 * @returns 无返回值。
 */
function openNewWindow(): void {
  const handle = context?.handle;
  if (handle === null || handle === undefined) return;
  secondary.open(handle);
}

/**
 * 全局「快速提问」：显示并聚焦主窗口，然后通知渲染层把焦点送进输入框。
 *
 * 窗口可能还在加载首屏（从托盘重建 / 冷启动后立刻按下快捷键）：此时等
 * `did-finish-load` 再发事件，否则 UI 的订阅尚未建立，按键看起来「没反应」。
 * @returns 无返回值。
 */
function quickCapture(): void {
  windows.show();
  const target = context?.window ?? null;
  if (target === null || target.isDestroyed()) return;
  const send = (): void => {
    if (!target.isDestroyed()) target.webContents.send('omni:quickCapture');
  };
  if (target.webContents.isLoadingMainFrame()) {
    target.webContents.once('did-finish-load', send);
    return;
  }
  send();
}

/** 启动应用。 */
function run(): void {
  app.setAppUserModelId(config.app.appId);
  if (process.env['OMNI_SMOKE'] === '1') {
    // 冒烟超时闸：默认 90s 内没跑到结论（侧车起不来 / UI 挂了）⇒ 退出码 2，绝不吊死调用方。
    // `OMNI_SMOKE_TIMEOUT_MS` 供 CI / 慢机器放宽：首次冷启动要下载 Electron 运行时，90s 会踩线。
    const smokeTimeoutMs = SmokeHarness.timeoutMs(process.env['OMNI_SMOKE_TIMEOUT_MS']);
    setTimeout(() => {
      // 超时也要给出「卡在哪」：CI 上看不到窗口，没有这行就只能猜（2026-11-10 实测）。
      const win = context?.window ?? null;
      const url =
        win === null || win.isDestroyed() ? '(无窗口)' : DesktopLogger.redact(win.webContents.getURL());
      const sidecar = context?.supervisor?.getState() ?? '(未创建)';
      process.stdout.write(
        `[omni-smoke] TIMEOUT: ${Math.round(smokeTimeoutMs / 1000)}s 内未得出结论` +
          `（sidecar=${sidecar} url=${url}）\n`,
      );
      app.exit(2);
    }, smokeTimeoutMs);
  }
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(config.app.protocol);
  } else if (process.argv[1] !== undefined) {
    app.setAsDefaultProtocolClient(config.app.protocol, process.execPath, [
      resolve(process.argv[1]),
    ]);
  }
  app.enableSandbox();
  installGlobalGuards();

  app.on('second-instance', (_event, argv) => {
    windows.show();
    const launch = parseLaunchArgs(argv, config.app.protocol);
    if (launch.workspace !== null) {
      void switchWorkspace(launch.workspace);
    } else if (launch.deepLink !== null) {
      void deepLinks.handle(launch.deepLink);
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    void deepLinks.handle(url);
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (context === null) return;
    if (context.window === null && context.handle !== null) {
      context.window = createMainWindow({
        preload: join(__dirname, 'preload.cjs'),
        state: context.state,
        config: config.window,
      });
      windows.attach(context.window);
      loadHarness(context.window, context.handle);
    }
  });

  // 2026-11-06 审计 P3：原 `will-quit` 钩子不可达——所有退出路径都走 before-quit →
  // shutdownAndExit → app.exit(0)（跳过 will-quit）。全局快捷键与二级窗口的收尾并入 before-quit。
  app.on('before-quit', (event) => {
    globalShortcut.unregisterAll();
    secondary.closeAll();
    if (context === null || context.quitting) return;
    event.preventDefault();
    context.quitting = true;
    void shutdownAndExit(context);
  });

  void app
    .whenReady()
    .then(bootstrap)
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      context?.logger.write('main', `bootstrap failed: ${message}`);
      const i18n = new DesktopI18n(DesktopI18n.resolve(config.app.language, app.getLocale()));
      await new DesktopDialogs(i18n).startFailed(message);
      app.exit(1);
    });
}

/** 初始化：日志 → 偏好 → 工作区 → 窗口 → Harness → 载入 UI。 */
async function bootstrap(): Promise<void> {
  const logger = new DesktopLogger(logDir(app.getPath('userData'), config.logging.dirName), {
    ringLines: config.logging.ringLines,
  });
  const i18n = new DesktopI18n(DesktopI18n.resolve(config.app.language, app.getLocale()));
  // 结构化告警经 i18n 渲染（2026-11-20 遗留 #4 收口）：码与 messages.ts 的 config.* 键
  // 一一对应（判据钉齐全，见 test.mjs「配置告警 code 与文案键一一对应」）；码拼接在此是
  // 安全的——ConfigWarningCode 联合就是该键表的后缀面。
  for (const issue of loadedConfig.issues) {
    const key = `config.${issue.code}` as DesktopMessageKey;
    logger.write('main', `config: ${i18n.t(key, { path: issue.path, ...issue.params })}`);
  }
  const startup = new StartupMarker(logger);
  startup.mark('config.loaded');
  const dialogs = new DesktopDialogs(i18n);
  logger.write('main', `desktop language=${i18n.locale} (setting=${config.app.language})`);
  const state = new DesktopStateStore(app.getPath('userData'), {
    maxRecent: config.state.maxRecentWorkspaces,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    closeToTray: config.state.defaultCloseToTray,
    openAtLogin: config.state.defaultOpenAtLogin,
  });
  // B3 语言收敛：web 设置跟随记录（desktopState.locale）优先于 system 解析——
  // 用户在 web 改过语言后，重启的壳层也跟随；config.app.language 显式值仍最高。
  const savedLocale = state.get().locale;
  if (savedLocale !== undefined && config.app.language === 'system') {
    i18n.setLocale(savedLocale);
  }
  const launch = parseLaunchArgs(process.argv, config.app.protocol);
  const linkedWorkspace =
    launch.deepLink !== null
      ? DeepLinkRouter.workspaceOf(launch.deepLink, config.app.protocol)
      : null;
  const initial = await resolveWorkspace(launch.workspace ?? linkedWorkspace, state, i18n);
  if (initial === null) {
    logger.write('main', 'no workspace selected; quit');
    app.quit();
    return;
  }
  startup.mark('workspace.resolved');
  const window = createMainWindow({
    preload: join(__dirname, 'preload.cjs'),
    state,
    config: config.window,
    autoShow: !launch.hidden,
    loadingHint: i18n.t('window.starting'),
    loadingLang: i18n.locale,
  });
  startup.mark('window.created');
  const supervisor = createSupervisor(initial, logger);
  const notifications = new NotificationService(
    () => context?.window ?? null,
    (sessionId) => {
      const target = context?.window;
      if (target !== null && target !== undefined && !target.isDestroyed()) {
        target.webContents.send('omni:notificationClick', sessionId);
      }
    },
    config.notification,
  );
  const updates = new UpdateService(
    () => context?.window ?? null,
    async () => {
      if (context === null) return;
      context.quitting = true;
      await context.supervisor?.stop().catch(() => undefined);
    },
    config.update,
  );
  context = {
    window,
    supervisor,
    handle: null,
    workspace: initial,
    logger,
    state,
    notifications,
    updates,
    tray: null,
    quitting: false,
    i18n,
    dialogs,
  };
  windows.attach(window);
  // 共享动作单源（2026-11-20 抽取）：Tray/Menu/IPC 三方各取子集——新增动作只改这里，
  // 消除「托盘有菜单没有」的三处同步漂移面。
  const appActions = {
    openWorkspace: () => {
      void chooseWorkspace();
    },
    newWindow: openNewWindow,
    quickCapture,
    openLogs: () => {
      void openLogs();
    },
    restartHarness: () => {
      void restartHarness();
    },
    checkForUpdates: () => {
      void checkForUpdates();
    },
    diagnostics: () => {
      void showDiagnostics();
    },
    closeToTray: () => context?.state.get().closeToTray === true,
    setCloseToTray: (enabled: boolean) => windows.setCloseToTray(enabled),
    openAtLogin: () => context?.state.get().openAtLogin === true,
    setOpenAtLogin: (enabled: boolean) => windows.setOpenAtLogin(enabled),
    quit: () => app.quit(),
    // B3 语言收敛（2026-11-21）：web 设置改语言 → IPC → 持久化 + i18n 运行时切换 +
    // 菜单重建 + 托盘重建（标签随新语言再生）。desktopState.locale 让下次启动也跟随。
    setLocale: (locale: 'zh-CN' | 'en-US') => {
      if (context === null) return;
      state.setLocale(locale);
      i18n.setLocale(locale);
      refreshMenu();
      trayService.destroy();
      context.tray = trayService.create() ? trayService : null;
    },
  };
  const trayService = new TrayService(
    join(__dirname, 'icon.png'),
    {
      ...appActions,
      // 托盘的键名是 checkUpdates（menu/IPC 是 checkForUpdates）——同一动作两个键名。
      checkUpdates: () => {
        void checkForUpdates();
      },
      show: () => windows.show(),
      recentWorkspaces: () => (context?.state.get().recentWorkspaces ?? []).slice(0, 5),
      openRecent: (path) => {
        void switchWorkspace(path);
      },
    },
    config.tray,
    i18n,
  );
  context.tray = trayService.create() ? trayService : null;
  if (config.window.showShortcut !== '') {
    try {
      const ok = globalShortcut.register(config.window.showShortcut, () => windows.show());
      logger.write(
        'main',
        ok
          ? `global shortcut registered: ${config.window.showShortcut}`
          : `global shortcut unavailable: ${config.window.showShortcut}`,
      );
    } catch (error) {
      logger.write(
        'main',
        `global shortcut failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  // 快速提问是独立快捷键：注册失败只记日志，用户仍可从托盘/菜单进入。
  try {
    // 全局「快速提问」（2026-11-10 桌面体验）：任何应用里按下都唤起工作台并聚焦输入框。
    // 快捷键走 desktop.config 的 app.quickCaptureShortcut（2026-11-20 配置化集中）——
    // 与 `showShortcut`（只显示窗口）分工明确：前者是「随手记一句」，后者是「回到应用」。
    const ok = globalShortcut.register(config.app.quickCaptureShortcut, () => quickCapture());
    logger.write(
      'main',
      ok
        ? `quick capture registered: ${config.app.quickCaptureShortcut}`
        : `quick capture unavailable: ${config.app.quickCaptureShortcut}`,
    );
  } catch (error) {
    logger.write(
      'main',
      `quick capture failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (launch.hidden && context.tray === null) window.show();
  AutoStartService.apply(state.get().openAtLogin === true);
  updates.initialize();
  bindCrashHandler(supervisor);
  installMenu({
    ...appActions,
    isPackaged: app.isPackaged,
    repositoryUrl: config.app.repositoryUrl,
    quickCaptureAccelerator: config.app.quickCaptureShortcut,
    i18n,
  });
  registerIpc({
    limits: config.ipc,
    setTrayBusy: (busy) => context?.tray?.setBusy(busy),
    mainContents: () => context?.window?.webContents,
    isTrustedContents: (contents) => secondary.owns(contents),
    workspace: () => context?.workspace ?? initial,
    language: () => context?.i18n.locale ?? i18n.locale,
    ...appActions,
    // IPC 侧三个动作要 Promise 形态（直接引用异步原函数，覆盖 spread 进来的 void 包装）。
    openLogs,
    restartHarness,
    checkForUpdates,
    showDiagnostics: () => {
      void showDiagnostics();
    },
    revealPath,
    notify: (input) => context?.notifications.show(input) === true,
    downloadUpdate: () => context?.updates.download() ?? Promise.resolve(),
    installUpdate: () => context?.updates.install() ?? Promise.resolve(),
    updateStatus: () => context?.updates.current() ?? { state: 'idle' },
  });
  if (app.isPackaged && config.update.autoCheckDelayMs > 0) {
    setTimeout(() => {
      void context?.updates.check();
    }, config.update.autoCheckDelayMs);
  }

  startup.mark('harness.start');
  try {
    const handle = await supervisor.start();
    context.handle = handle;
    startup.mark('harness.ready');
    attachHarness({ session: session.defaultSession, security: config.security, handle, window, secondary });
    state.rememberWorkspace(initial);
    startup.mark('ui.loading');
    logger.write('main', `UI loaded for workspace ${initial}`);
    if (launch.deepLink !== null) deepLinks.setPending(launch.deepLink);
    window.webContents.once('did-finish-load', () => {
      startup.mark('ui.ready');
      deepLinks.flush();
      if (process.env['OMNI_SMOKE'] === '1') void runSmoke(launch.hidden);
    });
  } catch (error) {
    // 详情里带上侧车最近输出：只报「超时/退出码」等于让用户去猜（2026-11-14 用户报障）。
    // 复用日志脱敏（Token / Bearer / sk- 前缀），对话框内容可能被用户贴进 issue。
    const detail = DesktopLogger.redact(
      HarnessStartFailure.describe(error, i18n.t('dialog.harnessOutput')),
    );
    logger.write('main', `harness start failed: ${HarnessStartFailure.reasonOf(error)}`);
    await dialogs.harnessStartFailed(window, detail, logger.directory());
    app.quit();
  }
}

/**
 * 解析初始工作区：显式参数 > 上次工作区 > 原生选择框。
 * @param explicit 命令行 `--workspace`。
 * @param state 偏好。
 * @param i18n 桌面文案（目录选择框标题等用户可见面）。
 * @returns 工作区绝对路径；取消为 null。
 */
async function resolveWorkspace(
  explicit: string | null,
  state: DesktopStateStore,
  i18n: DesktopI18n,
): Promise<string | null> {
  if (explicit !== null) {
    if (!existsSync(explicit) || !statSync(explicit).isDirectory()) {
      throw new Error(`--workspace 不是有效目录：${explicit}`);
    }
    return explicit;
  }
  const remembered = state.get().workspace ?? state.get().recentWorkspaces[0];
  if (remembered !== undefined && existsSync(remembered) && statSync(remembered).isDirectory()) {
    return remembered;
  }
  if (process.env['OMNI_SMOKE'] === '1') {
    // 无人值守冒烟：原生目录选择框没人点，会一直挂到超时闸才退出（2026-11-10 CI 实测）。
    // 与其挂 300s 再报「TIMEOUT」，不如当场说清楚缺什么。
    process.stderr.write(
      '[omni-smoke] 缺少 --workspace：无人值守冒烟不弹目录选择框，请显式传工作区目录\n',
    );
    app.exit(2);
    return null;
  }
  return pickWorkspace(i18n);
}

/**
 * 弹出目录选择框（标题走 `dialog.pickWorkspace` 消息键、跟随桌面语言——此前 ipc.ts
 * 里硬编码中文标题，en 用户看到中文框题，2026-11-18 硬编码清理批次收口）。
 * @param i18n 桌面文案。
 * @returns 选中路径或 null。
 */
async function pickWorkspace(i18n: DesktopI18n): Promise<string | null> {
  return pickDirectory(app.getPath('documents'), i18n.t('dialog.pickWorkspace'));
}

/**
 * 按桌面配置构造 Harness 侧车（启动/切换工作区共用同一套路径与超时）。
 * @param workspace 工作区绝对路径。
 * @param logger 日志器。
 * @returns 侧车实例。
 */
function createSupervisor(workspace: string, logger: DesktopLogger): HarnessSupervisor {
  const userData = app.getPath('userData');
  return new HarnessSupervisor({
    workspace,
    entry: harnessEntry(),
    node: nodeBinary(),
    runDir: runDir(userData, config.harness.runDirName),
    modelDir: modelDir(userData, config.harness.modelDirName),
    vectorDir: vectorDir(userData, config.harness.vectorDirName),
    logger,
    config: config.harness,
  });
}

/** 菜单/IPC：选择并切换工作区。 */
async function chooseWorkspace(): Promise<void> {
  const ctx = context;
  try {
    // context 未就绪时（理论不可达，防御性兜底）用缺省中文——正常路径 i18n 恒在位。
    const picked = await pickWorkspace(ctx?.i18n ?? new DesktopI18n('zh-CN'));
    if (picked !== null) await switchWorkspace(picked);
  } catch (error) {
    ctx?.logger.write('main', `choose workspace failed: ${String(error)}`);
    if (ctx !== null) {
      await ctx.dialogs.workspaceOpenFailed(error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * 切换工作区：停旧 Harness → 起新 Harness → 重新载入 UI。
 * @param path 新工作区。
 * @returns 无返回值。
 */
async function switchWorkspace(path: string): Promise<void> {
  const ctx = context;
  if (ctx === null) return;
  let absolute: string;
  try {
    absolute = assertDirectory(path);
  } catch (error) {
    // 守卫错误（not-exists / not-directory）按稳定码走本地化模板——en 用户不再看到中文句子；
    // 其余错误（理论不可达）保留原样呈现。
    if (error instanceof WorkspaceGuardError) {
      await ctx.dialogs.invalidWorkspaceGuarded(error.code, error.path);
    } else {
      await ctx.dialogs.invalidWorkspace(error instanceof Error ? error.message : String(error));
    }
    return;
  }
  if (absolute === ctx.workspace) return;
  ctx.logger.write('main', `switch workspace -> ${absolute}`);
  await ctx.supervisor?.stop();
  const next = createSupervisor(absolute, ctx.logger);
  bindCrashHandler(next);
  ctx.supervisor = next;
  try {
    const handle = await next.start();
    ctx.handle = handle;
    ctx.workspace = absolute;
    attachHarness({ session: session.defaultSession, security: config.security, handle, window: ctx.window, secondary });
    ctx.state.rememberWorkspace(absolute);
  } catch (error) {
    // 旧 supervisor 已在上文 stop ⇒ ctx.handle 此刻指向一个**已死**的端口/令牌；
    // 不清空的话，托盘/菜单/新窗口路径仍会拿它去 loadHarness（连接拒答/401，2026-11-06 审计 P2）。
    ctx.handle = null;
    const message = HarnessStartFailure.reasonOf(error);
    ctx.logger.write('main', `switch workspace failed: ${message}`);
    await ctx.dialogs.switchFailed(
      DesktopLogger.redact(
        HarnessStartFailure.describe(error, ctx.i18n.t('dialog.harnessOutput')),
      ),
    );
  }
}

/**
 * 重启当前 Harness。
 * @returns 无返回值。
 */
async function restartHarness(): Promise<void> {
  const ctx = context;
  if (ctx === null) return;
  ctx.logger.write('main', 'restart harness requested');
  await ctx.supervisor?.stop();
  try {
    const handle = await ctx.supervisor?.start();
    if (handle === undefined) throw new Error('supervisor unavailable');
    ctx.handle = handle;
    attachHarness({ session: session.defaultSession, security: config.security, handle, window: ctx.window, secondary });
  } catch (error) {
    // 同 switchWorkspace：旧实例已停，悬挂的 handle 必须清空（2026-11-06 审计 P2）。
    ctx.handle = null;
    const message = HarnessStartFailure.reasonOf(error);
    ctx.logger.write('main', `restart failed: ${message}`);
    await ctx.dialogs.restartFailed(
      DesktopLogger.redact(
        HarnessStartFailure.describe(error, ctx.i18n.t('dialog.harnessOutput')),
      ),
    );
  }
}

/** 打开日志目录。 */
async function openLogs(): Promise<void> {
  const ctx = context;
  if (ctx === null) return;
  await openLogDirectory(ctx.logger.directory());
}

/**
 * 渲染层自愈耗尽的人机出口：弹「重试/退出」对话框（重试由 WindowLifecycle 清零计数并重载 UI）。
 * @param kind 故障种类。
 * @param detail 故障细节。
 * @returns 对话框按钮序号（1 = 重试）。
 */
async function onUiGone(kind: 'load-failed' | 'renderer-gone', detail: string): Promise<number> {
  const ctx = context;
  if (ctx === null) return 0;
  ctx.logger.write('main', `ui recovery exhausted: ${kind} ${detail}`);
  const response = await ctx.dialogs.uiGone(kind, detail, ctx.logger.directory());
  // 「退出」按钮（2026-11-06 审计发现的真实缺陷）：此前 response 0 什么都不做——
  // 对话框关掉后留在无 UI 态。退出走 before-quit → shutdownAndExit 优雅收尾（停侧车再退）。
  if (response === 0) {
    ctx.logger.write('main', 'ui gone: quit requested by user');
    app.quit();
  }
  return response;
}

/** 托盘「诊断信息」：把版本/工作区/侧车/日志/配置来源汇总到可复制对话框。 */
async function showDiagnostics(): Promise<void> {
  const ctx = context;
  if (ctx === null) return;
  const handle = ctx.handle;
  const detail = [
    `version: ${app.getVersion()}`,
    `workspace: ${ctx.workspace}`,
    `language: ${ctx.i18n.locale}`,
    `harness: ${ctx.supervisor?.getState() ?? 'none'}${
      handle !== null ? ` (${handle.host}:${String(handle.port)})` : ''
    }`,
    `logs: ${ctx.logger.directory()}`,
    `config: ${loadedConfig.sources.length > 0 ? loadedConfig.sources.join(' -> ') : 'builtin defaults'}`,
    `config issues: ${loadedConfig.issues.length}`,
  ].join('\n');
  await ctx.dialogs.diagnostics(detail);
}

/**
 * 在系统文件管理器中打开目录。
 * @param path 目录路径（渲染层传入，必须再次校验）。
 * @returns 无返回值。
 */
async function revealPath(path: string): Promise<void> {
  const absolute = assertDirectory(path);
  const error = await shell.openPath(absolute);
  if (error !== '') throw new Error(error);
}

/** 检查更新（手动入口；开发态提示，不静默）。 */
async function checkForUpdates(): Promise<void> {
  const ctx = context;
  if (ctx === null) return;
  if (!app.isPackaged) {
    await ctx.dialogs.updateDev();
    return;
  }
  await ctx.updates.check();
  const status = ctx.updates.current();
  if (status.state === 'available') {
    const response = await ctx.dialogs.updateAvailable(status.version);
    if (response === 0) await ctx.updates.download();
    return;
  }
  if (status.state === 'downloaded') {
    const response = await ctx.dialogs.updateDownloaded(status.version);
    if (response === 0) await ctx.updates.install();
    return;
  }
  if (status.state === 'error') {
    await ctx.dialogs.updateFailed(status.message);
    return;
  }
  if (status.state === 'idle') {
    await ctx.dialogs.updateLatest();
  }
}

/**
 * 绑定崩溃处理：配置允许时按策略自动重启，超出上限才弹对话框。
 * @param supervisor 侧车。
 * @returns 无返回值。
 */
function bindCrashHandler(supervisor: HarnessSupervisor): void {
  const policy = new HarnessRestartPolicy(
    config.harness.restartMax,
    config.harness.restartWindowMs,
  );
  supervisor.on('crashed', (error: unknown) => {
    const ctx = context;
    if (ctx === null || ctx.quitting) return;
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger.write('main', `harness crashed: ${message}`);
    if (config.harness.autoRestart && policy.allow(Date.now())) {
      ctx.logger.write(
        'main',
        `auto restart in ${String(config.harness.restartDelayMs)}ms (policy ${String(config.harness.restartMax)}/${String(config.harness.restartWindowMs)}ms)`,
      );
      setTimeout(() => {
        void restartHarness();
      }, config.harness.restartDelayMs);
      return;
    }
    void ctx.dialogs.crash(message, ctx.logger.directory()).then((response) => {
      if (response === 1) void restartHarness();
      else app.quit();
    });
  });
}

/**
 * `OMNI_SMOKE=1` 冒烟入口：采集运行事实 → `SmokeHarness` 判定 → 落盘 JSON → 按结论退出
 * （0 = 全过 / 1 = 有致命断言失败；90s 超时闸在 `run()` 里，退出码 2）。
 * @param hiddenLaunch 是否带 `--hidden` 启动（可见性按「预期隐藏」判定）。
 * @returns 无返回值。
 */
async function runSmoke(hiddenLaunch: boolean): Promise<void> {
  const ctx = context;
  const handle = ctx?.handle ?? null;
  const window = ctx?.window ?? null;
  const alive = window !== null && !window.isDestroyed();
  let dom: { root: boolean; bridgeVersion: number } | null = null;
  try {
    if (alive) {
      dom = (await window.webContents.executeJavaScript(SmokeHarness.DOM_PROBE, true)) as {
        root: boolean;
        bridgeVersion: number;
      };
    }
  } catch (error) {
    ctx?.logger.write(
      'main',
      `smoke dom probe failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const report: SmokeReport = SmokeHarness.judge({
    windowAlive: alive,
    windowVisible: alive && window.isVisible(),
    hiddenLaunch,
    harnessState: ctx?.supervisor?.getState() ?? null,
    harnessEndpoint: handle !== null ? `${handle.host}:${String(handle.port)}` : null,
    // 令牌打码（2026-11-06 审计 P1）：loadedUrl 是带 `?token=` 的地址，报告 JSON 号称
    // 「可贴回 issue」——不脱敏等于鼓励把访问令牌贴进公共 issue。2026-11-20 统一走
    // DesktopLogger.redact 单一真源（此前本文件自持一份弱变体正则，口径可漂移）。
    loadedUrl: alive ? DesktopLogger.redact(window.webContents.getURL()) : null,
    dom,
    trayCreated: ctx?.tray !== null,
    notificationsSupported: Notification.isSupported(),
    protocolRegistered: app.isDefaultProtocolClient(config.app.protocol),
  });
  const out =
    (process.env['OMNI_SMOKE_OUT'] ?? '').trim() ||
    join(app.getPath('userData'), 'smoke-result.json');
  try {
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } catch (error) {
    // 落盘失败不改变结论，只进日志（结论仍走 stdout/退出码）。
    ctx?.logger.write('main', `smoke result write failed: ${String(error)}`);
  }
  const line = `smoke ${report.pass ? 'PASS' : 'FAIL'} (${String(report.checks.length)} checks) -> ${out}`;
  process.stdout.write(`[omni-smoke] ${line}\n`);
  for (const check of report.checks) {
    if (!check.ok) process.stdout.write(`[omni-smoke]   ✗ ${check.name}: ${check.detail}\n`);
  }
  ctx?.logger.write('main', line);
  setTimeout(() => app.exit(report.pass ? 0 : 1), 300);
}

/** 停止 Harness 并退出。 */
async function shutdownAndExit(ctx: AppContext): Promise<void> {
  ctx.logger.write('main', 'shutting down');
  await ctx.supervisor?.stop().catch(() => undefined);
  ctx.logger.close();
  app.exit(0);
}
