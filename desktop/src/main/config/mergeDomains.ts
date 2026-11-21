// 十三个域的逐字段 merge（2026-11-21 P4 从 DesktopConfigLoader.ts 按职责拆出）：
// 每个函数形状 = (raw, base, v) → DesktopXxxConfig；类型错回落 / 越界夹取经 fieldHelpers。

import type {
  DesktopAppConfig,
  DesktopCspConfig,
  DesktopDeepLinkConfig,
  DesktopHarnessConfig,
  DesktopIpcConfig,
  DesktopLoggingConfig,
  DesktopNotificationConfig,
  DesktopRecoveryConfig,
  DesktopSecurityConfig,
  DesktopStateConfig,
  DesktopTrayConfig,
  DesktopUpdateConfig,
  DesktopWindowConfig,
} from './types.ts';
import {
  booleanField,
  cspTokens,
  enumField,
  integerField,
  isRecord,
  loopbackField,
  stringField,
  type Validator,
} from './fieldHelpers.ts';

const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set([
  'notifications',
  'clipboard-sanitized-write',
]);

  export function mergeApp(
    raw: Record<string, unknown>,
    base: DesktopAppConfig,
    v: Validator,
  ): DesktopAppConfig {
    return {
      appId: stringField(
        raw['appId'],
        base.appId,
        /^[A-Za-z0-9._-]{1,128}$/u,
        'app.appId',
        v,
      ),
      protocol: stringField(
        raw['protocol'],
        base.protocol,
        /^[a-z][a-z0-9+.-]{1,31}$/u,
        'app.protocol',
        v,
      ),
      repositoryUrl: stringField(
        raw['repositoryUrl'],
        base.repositoryUrl,
        /^https?:\/\/[^\s]+$/u,
        'app.repositoryUrl',
        v,
      ),
      // 全局快速提问快捷键（2026-11-20 配置化集中：原 main.ts 模块常量 + menu.ts 内联
      // accelerator 两处硬编码收进配置，单一真源）。accelerator 形态：至少一个修饰键 + 主键。
      quickCaptureShortcut: stringField(
        raw['quickCaptureShortcut'],
        base.quickCaptureShortcut,
        /^[A-Za-z0-9]+(\+[A-Za-z0-9]+)+$/u,
        'app.quickCaptureShortcut',
        v,
      ),
      language: enumField(
        raw['language'],
        base.language,
        ['system', 'zh-CN', 'en-US'] as const,
        'app.language',
        v,
      ),
    };
  }

  /** window 分区。 */
  export function mergeWindow(
    raw: Record<string, unknown>,
    base: DesktopWindowConfig,
    v: Validator,
  ): DesktopWindowConfig {
    return {
      width: integerField(
        raw['width'],
        base.width,
        640,
        4096,
        'window.width',
        v,
      ),
      height: integerField(
        raw['height'],
        base.height,
        480,
        2160,
        'window.height',
        v,
      ),
      minWidth: integerField(
        raw['minWidth'],
        base.minWidth,
        640,
        4096,
        'window.minWidth',
        v,
      ),
      minHeight: integerField(
        raw['minHeight'],
        base.minHeight,
        480,
        2160,
        'window.minHeight',
        v,
      ),
      backgroundColor: stringField(
        raw['backgroundColor'],
        base.backgroundColor,
        /^#[0-9a-fA-F]{6}$/u,
        'window.backgroundColor',
        v,
      ),
      autoHideMenuBar: booleanField(
        raw['autoHideMenuBar'],
        base.autoHideMenuBar,
        'window.autoHideMenuBar',
        v,
      ),
      backgroundThrottling: booleanField(
        raw['backgroundThrottling'],
        base.backgroundThrottling,
        'window.backgroundThrottling',
        v,
      ),
      showShortcut: stringField(
        raw['showShortcut'],
        base.showShortcut,
        /^(?:[A-Za-z0-9+]|CommandOrControl|Command|Control|Ctrl|Alt|Shift|Super|Meta|Space|F(?:[1-9]|1[0-2])){0,64}$/u,
        'window.showShortcut',
        v,
      ),
    };
  }

  /** harness 分区。 */
  export function mergeHarness(
    raw: Record<string, unknown>,
    base: DesktopHarnessConfig,
    v: Validator,
  ): DesktopHarnessConfig {
    return {
      host: loopbackField(raw['host'], base.host, 'harness.host', v),
      readyTimeoutMs: integerField(
        raw['readyTimeoutMs'],
        base.readyTimeoutMs,
        1_000,
        120_000,
        'harness.readyTimeoutMs',
        v,
      ),
      readyPollIntervalMs: integerField(
        raw['readyPollIntervalMs'],
        base.readyPollIntervalMs,
        10,
        5_000,
        'harness.readyPollIntervalMs',
        v,
      ),
      readyzTimeoutMs: integerField(
        raw['readyzTimeoutMs'],
        base.readyzTimeoutMs,
        1_000,
        60_000,
        'harness.readyzTimeoutMs',
        v,
      ),
      readyzProbeTimeoutMs: integerField(
        raw['readyzProbeTimeoutMs'],
        base.readyzProbeTimeoutMs,
        100,
        30_000,
        'harness.readyzProbeTimeoutMs',
        v,
      ),
      readyzRetryIntervalMs: integerField(
        raw['readyzRetryIntervalMs'],
        base.readyzRetryIntervalMs,
        10,
        5_000,
        'harness.readyzRetryIntervalMs',
        v,
      ),
      stopGraceMs: integerField(
        raw['stopGraceMs'],
        base.stopGraceMs,
        1_000,
        60_000,
        'harness.stopGraceMs',
        v,
      ),
      killGraceMs: integerField(
        raw['killGraceMs'],
        base.killGraceMs,
        500,
        30_000,
        'harness.killGraceMs',
        v,
      ),
      autoRestart: booleanField(
        raw['autoRestart'],
        base.autoRestart,
        'harness.autoRestart',
        v,
      ),
      restartDelayMs: integerField(
        raw['restartDelayMs'],
        base.restartDelayMs,
        0,
        30_000,
        'harness.restartDelayMs',
        v,
      ),
      restartMax: integerField(
        raw['restartMax'],
        base.restartMax,
        1,
        10,
        'harness.restartMax',
        v,
      ),
      restartWindowMs: integerField(
        raw['restartWindowMs'],
        base.restartWindowMs,
        10_000,
        3_600_000,
        'harness.restartWindowMs',
        v,
      ),
      tokenBytes: integerField(
        raw['tokenBytes'],
        base.tokenBytes,
        16,
        64,
        'harness.tokenBytes',
        v,
      ),
      readyFilePrefix: stringField(
        raw['readyFilePrefix'],
        base.readyFilePrefix,
        /^[A-Za-z0-9_-]{1,32}$/u,
        'harness.readyFilePrefix',
        v,
      ),
      runDirName: stringField(
        raw['runDirName'],
        base.runDirName,
        /^[A-Za-z0-9._-]{1,64}$/u,
        'harness.runDirName',
        v,
      ),
      modelDirName: stringField(
        raw['modelDirName'],
        base.modelDirName,
        /^[A-Za-z0-9._-]{1,64}$/u,
        'harness.modelDirName',
        v,
      ),
      vectorDirName: stringField(
        raw['vectorDirName'],
        base.vectorDirName,
        /^[A-Za-z0-9._-]{1,64}$/u,
        'harness.vectorDirName',
        v,
      ),
    };
  }

  /** update 分区。 */
  export function mergeUpdate(
    raw: Record<string, unknown>,
    base: DesktopUpdateConfig,
    v: Validator,
  ): DesktopUpdateConfig {
    return {
      autoCheckDelayMs: integerField(
        raw['autoCheckDelayMs'],
        base.autoCheckDelayMs,
        0,
        3_600_000,
        'update.autoCheckDelayMs',
        v,
      ),
      autoDownload: booleanField(
        raw['autoDownload'],
        base.autoDownload,
        'update.autoDownload',
        v,
      ),
      autoInstallOnAppQuit: booleanField(
        raw['autoInstallOnAppQuit'],
        base.autoInstallOnAppQuit,
        'update.autoInstallOnAppQuit',
        v,
      ),
      allowPrerelease: booleanField(
        raw['allowPrerelease'],
        base.allowPrerelease,
        'update.allowPrerelease',
        v,
      ),
      channel: enumField(
        raw['channel'],
        base.channel,
        ['latest', 'beta', 'alpha'] as const,
        'update.channel',
        v,
      ),
      allowDowngrade: booleanField(
        raw['allowDowngrade'],
        base.allowDowngrade,
        'update.allowDowngrade',
        v,
      ),
    };
  }

  /** logging 分区。 */
  export function mergeLogging(
    raw: Record<string, unknown>,
    base: DesktopLoggingConfig,
    v: Validator,
  ): DesktopLoggingConfig {
    return {
      dirName: stringField(
        raw['dirName'],
        base.dirName,
        /^[A-Za-z0-9._-]{1,64}$/u,
        'logging.dirName',
        v,
      ),
      ringLines: integerField(
        raw['ringLines'],
        base.ringLines,
        20,
        10_000,
        'logging.ringLines',
        v,
      ),
    };
  }

  /** state 分区。 */
  export function mergeState(
    raw: Record<string, unknown>,
    base: DesktopStateConfig,
    v: Validator,
  ): DesktopStateConfig {
    return {
      maxRecentWorkspaces: integerField(
        raw['maxRecentWorkspaces'],
        base.maxRecentWorkspaces,
        1,
        50,
        'state.maxRecentWorkspaces',
        v,
      ),
      defaultCloseToTray: booleanField(
        raw['defaultCloseToTray'],
        base.defaultCloseToTray,
        'state.defaultCloseToTray',
        v,
      ),
      defaultOpenAtLogin: booleanField(
        raw['defaultOpenAtLogin'],
        base.defaultOpenAtLogin,
        'state.defaultOpenAtLogin',
        v,
      ),
    };
  }

  /** notification 分区。 */
  export function mergeNotification(
    raw: Record<string, unknown>,
    base: DesktopNotificationConfig,
    v: Validator,
  ): DesktopNotificationConfig {
    return {
      titleMax: integerField(
        raw['titleMax'],
        base.titleMax,
        16,
        1_000,
        'notification.titleMax',
        v,
      ),
      bodyMax: integerField(
        raw['bodyMax'],
        base.bodyMax,
        16,
        1_000,
        'notification.bodyMax',
        v,
      ),
    };
  }

  /** ipc 分区。 */
  export function mergeIpc(
    raw: Record<string, unknown>,
    base: DesktopIpcConfig,
    v: Validator,
  ): DesktopIpcConfig {
    return {
      notifyTitleMax: integerField(
        raw['notifyTitleMax'],
        base.notifyTitleMax,
        16,
        2_000,
        'ipc.notifyTitleMax',
        v,
      ),
      notifyBodyMax: integerField(
        raw['notifyBodyMax'],
        base.notifyBodyMax,
        16,
        8_000,
        'ipc.notifyBodyMax',
        v,
      ),
      notifySessionIdMax: integerField(
        raw['notifySessionIdMax'],
        base.notifySessionIdMax,
        16,
        1_000,
        'ipc.notifySessionIdMax',
        v,
      ),
    };
  }

  /** deepLink 分区。 */
  export function mergeDeepLink(
    raw: Record<string, unknown>,
    base: DesktopDeepLinkConfig,
    v: Validator,
  ): DesktopDeepLinkConfig {
    return {
      uiReadyTimeoutMs: integerField(
        raw['uiReadyTimeoutMs'],
        base.uiReadyTimeoutMs,
        0,
        60_000,
        'deepLink.uiReadyTimeoutMs',
        v,
      ),
    };
  }

  /** recovery 分区（渲染层自愈）。 */
  export function mergeRecovery(
    raw: Record<string, unknown>,
    base: DesktopRecoveryConfig,
    v: Validator,
  ): DesktopRecoveryConfig {
    return {
      maxAttempts: integerField(
        raw['maxAttempts'],
        base.maxAttempts,
        0,
        20,
        'recovery.maxAttempts',
        v,
      ),
      windowMs: integerField(
        raw['windowMs'],
        base.windowMs,
        1_000,
        3_600_000,
        'recovery.windowMs',
        v,
      ),
      delayMs: integerField(
        raw['delayMs'],
        base.delayMs,
        0,
        30_000,
        'recovery.delayMs',
        v,
      ),
    };
  }

  /** security 分区（权限白名单 + CSP token 校验）。 */
  export function mergeSecurity(
    raw: Record<string, unknown>,
    base: DesktopSecurityConfig,
    v: Validator,
  ): DesktopSecurityConfig {
    let permissions: readonly string[] = base.permissions;
    if (raw['permissions'] !== undefined) {
      if (!Array.isArray(raw['permissions'])) {
        v.warn('security.permissions', 'expectStringArray');
      } else {
        const kept = raw['permissions'].filter((item): item is string => {
          if (typeof item !== 'string') return false;
          if (ALLOWED_PERMISSIONS.has(item)) return true;
          v.warn('security.permissions', 'unknownPermission', { item: JSON.stringify(item) });
          return false;
        });
        permissions = kept;
      }
    }
    const cspRaw = raw['csp'];
    const cspDoc = isRecord(cspRaw)
      ? cspRaw
      : cspRaw === undefined
        ? {}
        : (v.warn('security.csp', 'expectObjectFallback'), {});
    return { permissions, csp: mergeCsp(cspDoc, base.csp, v) };
  }

  /** CSP 分区（逐指令过滤 token）。 */
  export function mergeCsp(
    raw: Record<string, unknown>,
    base: DesktopCspConfig,
    v: Validator,
  ): DesktopCspConfig {
    const directive = (key: keyof DesktopCspConfig): readonly string[] =>
      cspTokens(raw[key], `security.csp.${key}`, v) ?? base[key];
    return {
      defaultSrc: directive('defaultSrc'),
      scriptSrc: directive('scriptSrc'),
      styleSrc: directive('styleSrc'),
      imgSrc: directive('imgSrc'),
      fontSrc: directive('fontSrc'),
      connectSrc: directive('connectSrc'),
      frameSrc: directive('frameSrc'),
      mediaSrc: directive('mediaSrc'),
      baseUri: directive('baseUri'),
      formAction: directive('formAction'),
      objectSrc: directive('objectSrc'),
      frameAncestors: directive('frameAncestors'),
    };
  }

  /** tray 分区。 */
  export function mergeTray(
    raw: Record<string, unknown>,
    base: DesktopTrayConfig,
    v: Validator,
  ): DesktopTrayConfig {
    return {
      iconSize: integerField(
        raw['iconSize'],
        base.iconSize,
        8,
        64,
        'tray.iconSize',
        v,
      ),
      tooltip: stringField(
        raw['tooltip'],
        base.tooltip,
        /^.{1,100}$/u,
        'tray.tooltip',
        v,
      ),
    };
  }
