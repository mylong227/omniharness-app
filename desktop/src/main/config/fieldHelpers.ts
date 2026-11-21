// 配置校验辅助 + Validator 接口（2026-11-21 P4 从 DesktopConfigLoader.ts 按职责拆出）：
// 逐字段「类型错回落 / 越界夹取」的单一实现集；告警经 Validator 收集（不抛错），
// 告警码即 messages.ts 的 `config.<code>` 键尾段（test.mjs parity 判据钉齐全）。

import type { ConfigWarningCode } from './types.ts';

/** 校验上下文：收集结构化告警（不抛错；code 对应 messages.ts 的 `config.<code>` 键）。 */
export interface Validator {
  warn(path: string, code: ConfigWarningCode, params?: Readonly<Record<string, string>>): void;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  export function numberField(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
    path: string,
    v: Validator,
  ): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      v.warn(path, 'expectNumber', { actual: JSON.stringify(value), fallback: String(fallback) });
      return fallback;
    }
    if (value < min || value > max) {
      const clamped = Math.min(max, Math.max(min, value));
      v.warn(path, 'clamped', {
        actual: String(value),
        clamped: String(clamped),
        min: String(min),
        max: String(max),
      });
      return clamped;
    }
    return value;
  }

  /** 整数：在 numberField 上取整。 */
  export function integerField(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
    path: string,
    v: Validator,
  ): number {
    const numeric = numberField(value, fallback, min, max, path, v);
    return Math.round(numeric);
  }

  /** 布尔：类型错回落。 */
  export function booleanField(
    value: unknown,
    fallback: boolean,
    path: string,
    v: Validator,
  ): boolean {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') {
      v.warn(path, 'expectBoolean', { actual: JSON.stringify(value), fallback: String(fallback) });
      return fallback;
    }
    return value;
  }

  /** 字符串：正则不匹配回落。 */
  export function stringField(
    value: unknown,
    fallback: string,
    pattern: RegExp,
    path: string,
    v: Validator,
  ): string {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !pattern.test(value)) {
      v.warn(path, 'badShape', { fallback: JSON.stringify(fallback) });
      return fallback;
    }
    return value;
  }

  /** 枚举：白名单之外回落。 */
  export function enumField<T extends string>(
    value: unknown,
    fallback: T,
    allowed: readonly T[],
    path: string,
    v: Validator,
  ): T {
    if (value === undefined) return fallback;
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
      return value as T;
    }
    v.warn(path, 'expectEnum', {
      allowed: allowed.join(' / '),
      actual: JSON.stringify(value),
      fallback: String(fallback),
    });
    return fallback;
  }

  /** 回环主机：serve 固定绑 127.0.0.1。 */
  export function loopbackField(
    value: unknown,
    fallback: string,
    path: string,
    v: Validator,
  ): string {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || value !== '127.0.0.1') {
      v.warn(path, 'loopbackOnly');
      return fallback;
    }
    return value;
  }

  /** CSP token 列表：过滤控制字符/分号，非法项告警。 */
  export function cspTokens(
    value: unknown,
    path: string,
    v: Validator,
  ): readonly string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      v.warn(path, 'expectStringArray');
      return undefined;
    }
    const tokens: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string' || item === '') {
        v.warn(path, 'dropItem', { item: JSON.stringify(item) });
        continue;
      }
      if (item.includes(';') || /[\r\n]/u.test(item)) {
        v.warn(path, 'dropToken', { item: JSON.stringify(item) });
        continue;
      }
      tokens.push(item);
    }
    return tokens;
  }
