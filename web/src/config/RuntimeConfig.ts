// Web 端可调参数视图（单一来源：`src/config/app.json`）。
//
// 不 import 服务端 loader（分层：web 不依赖 src/apps）；只读同一份 JSON 的 `web` 段，
// 启动即校验正数，消费点只读。

import raw from '../../../src/config/app.json' with { type: 'json' };

/** Web 可调参数（与服务端 loader 的 WebTunables 同形）。 */
export interface UiTunables {
  readonly searchDebounceMs: number;
  readonly traceRenderLimit: number;
  readonly turnSummaryAutoOpenLimit: number;
  readonly capacityPollMs: number;
  readonly fleetPollMs: number;
  readonly fleetCacheTtlMs: number;
  readonly fleetStaleTickMs: number;
  readonly historyPageSize: number;
  readonly tickMs: number;
  readonly metricsPollMs: number;
  readonly pluginsDebounceMs: number;
  readonly clusterFreshMs: number;
  readonly markdownCacheEntries: number;
  readonly markdownCacheChars: number;
  readonly highlightCacheEntries: number;
  readonly draftMaxEntries: number;
  readonly hoverDelayMs: number;
  readonly quoteMaxChars: number;
  readonly streamIntervalMs: number;
  readonly textRevealStepMs: number;
}

/** 校验并冻结 web 段。 */
function validate(value: unknown): UiTunables {
  const data = value as Record<string, unknown> | null;
  if (data === null || typeof data !== 'object') throw new Error('app.json is missing the web section');
  for (const [key, item] of Object.entries(data)) {
    if (typeof item !== 'number' || !Number.isFinite(item) || item <= 0) {
      throw new Error(`app.json web.${key} must be a positive number`);
    }
  }
  return data as unknown as UiTunables;
}

/** Web 可调参数（模块加载时校验一次）。 */
export const UI_TUNABLES: UiTunables = validate(raw.web);
