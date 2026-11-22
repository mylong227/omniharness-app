/**
 * 桌面配置加载器（单类；逐字段校验/夹取，绝不静默采纳非法值）。
 *
 * 合并顺序：`DEFAULT_DESKTOP_CONFIG` → 内置/发布包 → 用户 → `OMNI_DESKTOP_CONFIG`。
 * 本文件不 import electron，可在 `node --test` 里直接跑。
 */

import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_DESKTOP_CONFIG } from './defaults.ts';
import type {
  ConfigIssue,
  ConfigWarningCode,
  DesktopConfig,
  LoadDesktopConfigOptions,
  LoadedDesktopConfig,
} from './types.ts';
import { isRecord, type Validator } from './fieldHelpers.ts';
import {
  mergeApp,
  mergeDeepLink,
  mergeHarness,
  mergeIpc,
  mergeLogging,
  mergeNotification,
  mergeRecovery,
  mergeSecurity,
  mergeState,
  mergeTray,
  mergeUpdate,
  mergeWindow,
} from './mergeDomains.ts';

export const CONFIG_WARNING_CODES: readonly ConfigWarningCode[] = [
  'fileMissing',
  'notObject',
  'badJson',
  'expectObject',
  'expectNumber',
  'clamped',
  'expectBoolean',
  'badShape',
  'expectEnum',
  'loopbackOnly',
  'expectStringArray',
  'dropItem',
  'dropToken',
  'unknownPermission',
  'expectObjectFallback',
];

export class DesktopConfigLoader {
  public static load(options: LoadDesktopConfigOptions = {}): LoadedDesktopConfig {
    const issues: ConfigIssue[] = [];
    const sources: string[] = [];
    const v: Validator = {
      warn: (path, code, params) => issues.push({ path, code, params: params ?? {} }),
    };
    let config: DesktopConfig = structuredClone(DEFAULT_DESKTOP_CONFIG);

    const builtin = DesktopConfigLoader.readConfigFile(
      options.builtinFile,
      false,
      issues,
      sources,
    );
    if (builtin !== undefined) config = DesktopConfigLoader.applyDocument(config, builtin, v);

    const user = DesktopConfigLoader.readConfigFile(options.userFile, false, issues, sources);
    if (user !== undefined) config = DesktopConfigLoader.applyDocument(config, user, v);

    const env = DesktopConfigLoader.readConfigFile(options.envFile, true, issues, sources);
    if (env !== undefined) config = DesktopConfigLoader.applyDocument(config, env, v);

    return { config, issues, sources };
  }

  /** 读一份 JSON（容忍 BOM；坏文件只告警）。 */
  private static readConfigFile(
    file: string | undefined,
    required: boolean,
    issues: ConfigIssue[],
    sources: string[],
  ): Record<string, unknown> | undefined {
    if (file === undefined || file === '') return undefined;
    if (!existsSync(file)) {
      if (required) issues.push({ path: file, code: 'fileMissing', params: { file } });
      return undefined;
    }
    try {
      const text = readFileSync(file, 'utf8').replace(/^\uFEFF/u, '');
      const parsed = JSON.parse(text) as unknown;
      if (!isRecord(parsed)) {
        issues.push({ path: file, code: 'notObject', params: { file } });
        return undefined;
      }
      sources.push(file);
      return parsed;
    } catch (error) {
      issues.push({
        path: file,
        code: 'badJson',
        params: { file, message: error instanceof Error ? error.message : String(error) },
      });
      return undefined;
    }
  }

  /** 取一个配置分区；非对象 -> 空对象 + 告警。 */
  private static section(
    doc: Record<string, unknown>,
    name: string,
    v: Validator,
  ): Record<string, unknown> {
    const value = doc[name];
    if (value === undefined) return {};
    if (!isRecord(value)) {
      v.warn(name, 'expectObject');
      return {};
    }
    return value;
  }

  /** 合并全部分区（未知字段忽略）。 */
  private static applyDocument(
    base: DesktopConfig,
    doc: Record<string, unknown>,
    v: Validator,
  ): DesktopConfig {
    return {
      app: mergeApp(DesktopConfigLoader.section(doc, 'app', v), base.app, v),
      window: mergeWindow(
        DesktopConfigLoader.section(doc, 'window', v),
        base.window,
        v,
      ),
      harness: mergeHarness(
        DesktopConfigLoader.section(doc, 'harness', v),
        base.harness,
        v,
      ),
      update: mergeUpdate(
        DesktopConfigLoader.section(doc, 'update', v),
        base.update,
        v,
      ),
      logging: mergeLogging(
        DesktopConfigLoader.section(doc, 'logging', v),
        base.logging,
        v,
      ),
      state: mergeState(
        DesktopConfigLoader.section(doc, 'state', v),
        base.state,
        v,
      ),
      notification: mergeNotification(
        DesktopConfigLoader.section(doc, 'notification', v),
        base.notification,
        v,
      ),
      ipc: mergeIpc(DesktopConfigLoader.section(doc, 'ipc', v), base.ipc, v),
      deepLink: mergeDeepLink(
        DesktopConfigLoader.section(doc, 'deepLink', v),
        base.deepLink,
        v,
      ),
      recovery: mergeRecovery(
        DesktopConfigLoader.section(doc, 'recovery', v),
        base.recovery,
        v,
      ),
      security: mergeSecurity(
        DesktopConfigLoader.section(doc, 'security', v),
        base.security,
        v,
      ),
      tray: mergeTray(
        DesktopConfigLoader.section(doc, 'tray', v),
        base.tray,
        v,
      ),
    };
  }
}