/**
 * 桌面主进程文案（中英）。
 *
 * 只放**原生壳**会展示的字符串（菜单/托盘/对话框/启动错误）；渲染层 UI 有自己的 i18n，
 * 不要把两套词条混在一起。键是稳定标识，不是中文句子——这样改文案不会改调用点。
 */
import type { DesktopLocale } from './DesktopI18n.ts';

/** 文案键。 */
export type DesktopMessageKey =
  | 'menu.file'
  | 'menu.openWorkspace'
  | 'menu.quickCapture'
  | 'menu.newWindow'
  | 'menu.restartHarness'
  | 'menu.checkUpdates'
  | 'menu.closeToTray'
  | 'menu.openAtLogin'
  | 'menu.openLogs'
  | 'menu.quit'
  | 'menu.edit'
  | 'menu.view'
  | 'menu.help'
  | 'menu.repository'
  | 'tray.show'
  | 'tray.quickCapture'
  | 'tray.newWindow'
  | 'tray.openWorkspace'
  | 'tray.recent'
  | 'tray.noRecent'
  | 'tray.restartHarness'
  | 'tray.openLogs'
  | 'tray.checkUpdates'
  | 'tray.closeToTray'
  | 'tray.openAtLogin'
  | 'tray.quit'
  | 'tray.diagnostics'
  | 'tray.busy'
  | 'dialog.startFailedTitle'
  | 'dialog.startFailedMessage'
  | 'dialog.openLogs'
  | 'dialog.quit'
  | 'dialog.noWorkspace'
  | 'dialog.harnessStartTitle'
  | 'dialog.harnessStartMessage'
  | 'dialog.harnessOutput'
  | 'dialog.crashTitle'
  | 'dialog.crashMessage'
  | 'dialog.uiGoneTitle'
  | 'dialog.uiGoneMessage'
  | 'dialog.restart'
  | 'dialog.diagnosticsTitle'
  | 'dialog.diagnosticsMessage'
  | 'dialog.workspaceOpenFailed'
  | 'dialog.invalidWorkspace'
  | 'dialog.workspaceNotFound'
  | 'dialog.workspaceNotDirectory'
  | 'dialog.pickWorkspace'
  | 'dialog.switchFailedTitle'
  | 'dialog.switchFailedMessage'
  | 'dialog.restartFailedTitle'
  | 'dialog.restartFailedMessage'
  | 'dialog.updateDevTitle'
  | 'dialog.updateDevMessage'
  | 'dialog.updateDevDetail'
  | 'dialog.updateAvailableTitle'
  | 'dialog.updateAvailableMessage'
  | 'dialog.updateAvailableDetail'
  | 'dialog.download'
  | 'dialog.later'
  | 'dialog.updateDownloadedTitle'
  | 'dialog.updateDownloadedMessage'
  | 'dialog.updateDownloadedDetail'
  | 'dialog.installNow'
  | 'dialog.updateFailedTitle'
  | 'dialog.updateFailedMessage'
  | 'dialog.updateLatestTitle'
  | 'dialog.updateLatestMessage'
  | 'window.starting'
  // 配置加载器告警（2026-11-20 遗留 #4 收口：码与 DesktopConfigLoader.CONFIG_WARNING_CODES
  // 一一对应，判据钉齐全；插值参数见各码的 issue.params）。
  | 'config.fileMissing'
  | 'config.notObject'
  | 'config.badJson'
  | 'config.expectObject'
  | 'config.expectNumber'
  | 'config.clamped'
  | 'config.expectBoolean'
  | 'config.badShape'
  | 'config.expectEnum'
  | 'config.loopbackOnly'
  | 'config.expectStringArray'
  | 'config.dropItem'
  | 'config.dropToken'
  | 'config.unknownPermission'
  | 'config.expectObjectFallback';

/** 中文（默认）。 */
const ZH: Record<DesktopMessageKey, string> = {
  'menu.file': '文件',
  'menu.openWorkspace': '打开工作区…',
  'menu.quickCapture': '快速提问',
  'menu.newWindow': '新建窗口',
  'menu.restartHarness': '重启 Harness',
  'menu.checkUpdates': '检查更新',
  'menu.closeToTray': '关闭时最小化到托盘',
  'menu.openAtLogin': '开机启动',
  'menu.openLogs': '打开日志目录',
  'menu.quit': '退出',
  'menu.edit': '编辑',
  'menu.view': '视图',
  'menu.help': '帮助',
  'menu.repository': 'OmniHarness on GitHub',
  'tray.show': '显示 OmniHarness',
  'tray.quickCapture': '快速提问（全局）',
  'tray.newWindow': '新建窗口',
  'tray.openWorkspace': '打开工作区…',
  'tray.recent': '最近工作区',
  'tray.noRecent': '暂无最近工作区',
  'tray.restartHarness': '重启 Harness',
  'tray.openLogs': '打开日志目录',
  'tray.checkUpdates': '检查更新',
  'tray.closeToTray': '关闭时最小化到托盘',
  'tray.openAtLogin': '开机启动',
  'tray.quit': '退出',
  'tray.diagnostics': '诊断信息…',
  'tray.busy': '回合进行中',
  'dialog.startFailedTitle': 'Harness 启动失败',
  'dialog.startFailedMessage': '本地 Harness 未能启动',
  'dialog.openLogs': '打开日志',
  'dialog.quit': '退出',
  'dialog.noWorkspace': '未选择工作区，应用将退出。',
  'dialog.harnessStartTitle': 'Harness 启动失败',
  'dialog.harnessStartMessage': '本地 Harness 未能启动',
  'dialog.harnessOutput': 'Harness 最近输出',
  'dialog.crashTitle': 'Harness 已退出',
  'dialog.crashMessage': '本地 Harness 意外退出',
  'dialog.uiGoneTitle': '界面进程异常',
  'dialog.uiGoneMessage': '工作台界面多次崩溃或加载失败，自动恢复已达上限。',
  'dialog.restart': '重启',
  'dialog.diagnosticsTitle': 'OmniHarness 诊断信息',
  'dialog.diagnosticsMessage': '可复制以下内容用于排障：',
  'dialog.workspaceOpenFailed': '打开工作区失败',
  'dialog.invalidWorkspace': '工作区无效',
  'dialog.workspaceNotFound': '工作区不存在：{path}',
  'dialog.workspaceNotDirectory': '不是目录：{path}',
  'dialog.pickWorkspace': '选择工作区',
  'dialog.switchFailedTitle': '切换工作区失败',
  'dialog.switchFailedMessage': '无法启动新工作区的 Harness',
  'dialog.restartFailedTitle': '重启失败',
  'dialog.restartFailedMessage': 'Harness 未能重新启动',
  'dialog.updateDevTitle': '检查更新',
  'dialog.updateDevMessage': '开发构建不启用自动更新',
  'dialog.updateDevDetail':
    '请使用打包后的安装版本；更新源由 electron-builder 的 publish 配置提供。',
  'dialog.updateAvailableTitle': '发现新版本',
  'dialog.updateAvailableMessage': 'OmniHarness {version} 可用',
  'dialog.updateAvailableDetail': '是否现在下载？下载完成后会在你确认时安装。',
  'dialog.download': '下载',
  'dialog.later': '稍后',
  'dialog.updateDownloadedTitle': '更新已下载',
  'dialog.updateDownloadedMessage': 'OmniHarness {version} 已下载',
  'dialog.updateDownloadedDetail': '安装会先停止本地 Harness，然后重启应用。',
  'dialog.installNow': '立即安装',
  'dialog.updateFailedTitle': '检查更新失败',
  'dialog.updateFailedMessage': '无法检查更新',
  'dialog.updateLatestTitle': '检查更新',
  'dialog.updateLatestMessage': '当前已是最新版本',
  'window.starting': '正在启动本地 Harness…',
  // 配置加载器告警（DesktopConfigLoader 的 issue → 呈现层渲染）
  'config.fileMissing': '{file}: 文件不存在，已忽略',
  'config.notObject': '{file}: 顶层必须是对象，已忽略',
  'config.badJson': '{file}: {message}',
  'config.expectObject': '{path}: 应为对象，已忽略',
  'config.expectNumber': '{path}: 应为数字，实际 {actual}，回落 {fallback}',
  'config.clamped': '{path}: 越界 {actual}，夹取为 {clamped}（允许 {min}–{max}）',
  'config.expectBoolean': '{path}: 应为布尔，实际 {actual}，回落 {fallback}',
  'config.badShape': '{path}: 形状非法，回落 {fallback}',
  'config.expectEnum': '{path}: 应为 {allowed} 之一，实际 {actual}，回落 {fallback}',
  'config.loopbackOnly': '{path}: 只允许 127.0.0.1（serve 固定绑回环；当前不支持 --host）',
  'config.expectStringArray': '{path}: 应为字符串数组，回落默认值',
  'config.dropItem': '{path}: 忽略非字符串项 {item}',
  'config.dropToken': '{path}: 忽略含 ; 或换行的 token {item}',
  'config.unknownPermission': '{path}: 未知权限 {item}，已剔除',
  'config.expectObjectFallback': '{path}: 应为对象，回落默认值',
};

/** 英文。 */
const EN: Record<DesktopMessageKey, string> = {
  'menu.file': 'File',
  'menu.openWorkspace': 'Open Workspace…',
  'menu.quickCapture': 'Quick Capture',
  'menu.newWindow': 'New Window',
  'menu.restartHarness': 'Restart Harness',
  'menu.checkUpdates': 'Check for Updates',
  'menu.closeToTray': 'Minimize to Tray on Close',
  'menu.openAtLogin': 'Launch at Login',
  'menu.openLogs': 'Open Logs Folder',
  'menu.quit': 'Quit',
  'menu.edit': 'Edit',
  'menu.view': 'View',
  'menu.help': 'Help',
  'menu.repository': 'OmniHarness on GitHub',
  'tray.show': 'Show OmniHarness',
  'tray.quickCapture': 'Quick Capture (global)',
  'tray.newWindow': 'New Window',
  'tray.openWorkspace': 'Open Workspace…',
  'tray.recent': 'Recent Workspaces',
  'tray.noRecent': 'No recent workspaces',
  'tray.restartHarness': 'Restart Harness',
  'tray.openLogs': 'Open Logs Folder',
  'tray.checkUpdates': 'Check for Updates',
  'tray.closeToTray': 'Minimize to Tray on Close',
  'tray.openAtLogin': 'Launch at Login',
  'tray.quit': 'Quit',
  'tray.diagnostics': 'Diagnostics…',
  'tray.busy': 'Turn in progress',
  'dialog.startFailedTitle': 'Harness failed to start',
  'dialog.startFailedMessage': 'The local Harness could not start.',
  'dialog.openLogs': 'Open Logs',
  'dialog.quit': 'Quit',
  'dialog.noWorkspace': 'No workspace selected. The app will exit.',
  'dialog.harnessStartTitle': 'Harness failed to start',
  'dialog.harnessStartMessage': 'The local Harness could not start.',
  'dialog.harnessOutput': 'Recent Harness output',
  'dialog.crashTitle': 'Harness exited',
  'dialog.crashMessage': 'The local Harness exited unexpectedly.',
  'dialog.uiGoneTitle': 'Workbench UI crash',
  'dialog.uiGoneMessage':
    'The workbench UI kept crashing or failing to load, and automatic recovery gave up.',
  'dialog.restart': 'Restart',
  'dialog.diagnosticsTitle': 'OmniHarness diagnostics',
  'dialog.diagnosticsMessage': 'Copy the following for troubleshooting:',
  'dialog.workspaceOpenFailed': 'Failed to open workspace',
  'dialog.invalidWorkspace': 'Invalid workspace',
  'dialog.workspaceNotFound': 'Workspace does not exist: {path}',
  'dialog.workspaceNotDirectory': 'Not a directory: {path}',
  'dialog.pickWorkspace': 'Select Workspace',
  'dialog.switchFailedTitle': 'Failed to switch workspace',
  'dialog.switchFailedMessage': 'Could not start the Harness for the new workspace.',
  'dialog.restartFailedTitle': 'Restart failed',
  'dialog.restartFailedMessage': 'The Harness did not restart.',
  'dialog.updateDevTitle': 'Check for Updates',
  'dialog.updateDevMessage': 'Auto-update is disabled in development builds.',
  'dialog.updateDevDetail':
    'Use a packaged build; the update source comes from electron-builder publish config.',
  'dialog.updateAvailableTitle': 'Update available',
  'dialog.updateAvailableMessage': 'OmniHarness {version} is available',
  'dialog.updateAvailableDetail': 'Download now? Installation happens after you confirm.',
  'dialog.download': 'Download',
  'dialog.later': 'Later',
  'dialog.updateDownloadedTitle': 'Update downloaded',
  'dialog.updateDownloadedMessage': 'OmniHarness {version} is downloaded',
  'dialog.updateDownloadedDetail': 'Installing stops the local Harness and restarts the app.',
  'dialog.installNow': 'Install now',
  'dialog.updateFailedTitle': 'Update check failed',
  'dialog.updateFailedMessage': 'Could not check for updates.',
  'dialog.updateLatestTitle': 'Check for Updates',
  'dialog.updateLatestMessage': 'You are on the latest version.',
  'window.starting': 'Starting the local Harness…',
  // Config-loader warnings (issue code → rendered here)
  'config.fileMissing': '{file}: file not found, ignored',
  'config.notObject': '{file}: top level must be an object, ignored',
  'config.badJson': '{file}: {message}',
  'config.expectObject': '{path}: expected an object, ignored',
  'config.expectNumber': '{path}: expected a number, got {actual}, using {fallback}',
  'config.clamped': '{path}: out of range {actual}, clamped to {clamped} (allowed {min}–{max})',
  'config.expectBoolean': '{path}: expected a boolean, got {actual}, using {fallback}',
  'config.badShape': '{path}: invalid shape, using {fallback}',
  'config.expectEnum': '{path}: expected one of {allowed}, got {actual}, using {fallback}',
  'config.loopbackOnly': '{path}: only 127.0.0.1 is allowed (serve binds loopback; --host not supported)',
  'config.expectStringArray': '{path}: expected a string array, using defaults',
  'config.dropItem': '{path}: dropped non-string item {item}',
  'config.dropToken': '{path}: dropped token with ; or newline {item}',
  'config.unknownPermission': '{path}: unknown permission {item}, removed',
  'config.expectObjectFallback': '{path}: expected an object, using defaults',
};

/** 全部语言包。 */
export const DESKTOP_MESSAGES: Record<DesktopLocale, Record<DesktopMessageKey, string>> = {
  'zh-CN': ZH,
  'en-US': EN,
};
