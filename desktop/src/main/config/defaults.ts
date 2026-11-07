/** 内置默认值（发布包 JSON 必须与它逐字段相等，测试会核对）。 */
import type { DesktopConfig } from './types.ts';

export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  app: {
    appId: 'com.mylong227.omniharness',
    protocol: 'omniharness',
    repositoryUrl: 'https://github.com/mylong227/OmniHarness',
    language: 'system',
  },
  window: {
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#16181d',
    // 2026-11-06 实用性打磨：true——win32 无边框窗口由 UI 自绘标题条（TitlebarStrip），
    // Electron 菜单栏再横一条就是「双标题栏」；true = 平时隐藏（Alt 呼出），
    // 菜单 roles 的快捷键（Ctrl+滚轮外的 Ctrl+=/-、Ctrl+Shift+N…）不受可见性影响。
    autoHideMenuBar: true,
    backgroundThrottling: false,
    showShortcut: 'CommandOrControl+Shift+O',
  },
  harness: {
    host: '127.0.0.1',
    readyTimeoutMs: 30_000,
    readyPollIntervalMs: 50,
    readyzTimeoutMs: 8_000,
    readyzProbeTimeoutMs: 1_500,
    readyzRetryIntervalMs: 100,
    stopGraceMs: 10_000,
    killGraceMs: 2_000,
    autoRestart: true,
    restartDelayMs: 1_500,
    restartMax: 3,
    restartWindowMs: 10 * 60 * 1000,
    tokenBytes: 32,
    readyFilePrefix: 'harness',
    runDirName: 'run',
    modelDirName: 'models',
    vectorDirName: 'vec-cache',
  },
  update: {
    autoCheckDelayMs: 10_000,
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    channel: 'latest',
    allowDowngrade: false,
  },
  logging: { dirName: 'logs', ringLines: 200 },
  state: { maxRecentWorkspaces: 8, defaultCloseToTray: true, defaultOpenAtLogin: false },
  notification: { titleMax: 120, bodyMax: 500 },
  ipc: { notifyTitleMax: 160, notifyBodyMax: 800, notifySessionIdMax: 200 },
  deepLink: { uiReadyTimeoutMs: 5_000 },
  recovery: { maxAttempts: 3, windowMs: 10 * 60 * 1000, delayMs: 1_200 },
  security: {
    permissions: ['notifications', 'clipboard-sanitized-write'],
    csp: {
      defaultSrc: ["'none'"],
      // script-src 用**哈希白名单**放行 index.html 里的主题防闪烁内联脚本（SHA-256 of
      // 脚本内容，2026-11-08 审计高危摘除 'unsafe-inline'）：渲染层渲染模型/工具输出的富文本，
      // unsafe-inline 让 CSP 对注入脚本不设防——同源 localStorage/sessionStorage 里的服务端
      // 令牌可被一锅端。哈希与产物由 `desktop/scripts/test.mjs` 的 CSP 门禁判据钉死：
      // web/index.html（及 web/dist 产物）的内联脚本哈希变化 ⇒ desktop:test 直接红。
      scriptSrc: ["'self'", "'sha256-xGZ5bcutV1RqO2FYMshTMrQD4Z2lz4NdTg/vVe2WXv8='"],
      // style-src 保留 unsafe-inline：antd v6 的 cssinjs 运行时注入 <style> 标签，哈希白名单
      // 不可行（样式块内容随机）；样式注入的攻击面远小于脚本，接受并在此登记。
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'http://127.0.0.1:*', 'ws://127.0.0.1:*'],
      // frame-src 必须同时放行 `localhost`：web 侧 PreviewUrl 为隔离 cookie **故意**把
      // 127.0.0.1 预览源显示为 `http://localhost:<port>`——desktop CSP 只放行 127.0.0.1 时，
      // 工作区文件预览在壳内全白屏（浏览器里却正常，2026-11-06 审计 P1）。
      // `http(s)://*:*` 是 BrowserController 远程浏览面板（任意站点 iframe）所需。
      frameSrc: ['http://127.0.0.1:*', 'http://localhost:*', 'http://*:*', 'https://*:*'],
      mediaSrc: ["'self'", 'blob:'],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  tray: { iconSize: 16, tooltip: 'OmniHarness' },
};
