// 应用可调参数（单一来源：`src/config/app.json`）。
//
// 设计口径（docs/HARDCODE-POLICY.md）：
//   · 会随环境/部署/运营调整的**可调参数**放这里，代码只读类型化视图；
//   · 协议/数学常量与安全上限（proof bundle 上限、补丁上限、脱敏阈值等）保留为
//     **命名常量**并在策略里显式豁免——把它们交给配置等于允许削弱安全边界；
//   · 启动即校验：缺键/类型不符/非正数一律 fail-fast，不把坏配置带进运行期。

import raw from '../../config/app.json' with { type: 'json' };

/** Web 端可调参数。 */
export interface WebTunables {
  /** 搜索输入去抖（毫秒）。 */
  readonly searchDebounceMs: number;
  /** 轨迹一次渲染上限（条）。 */
  readonly traceRenderLimit: number;
  /** 回合摘要默认展开的文件数上限。 */
  readonly turnSummaryAutoOpenLimit: number;
  /** 容量面板轮询间隔（毫秒）。 */
  readonly capacityPollMs: number;
  /** 编队轮询间隔（毫秒）。 */
  readonly fleetPollMs: number;
  /** 编队快照缓存窗口（毫秒）。 */
  readonly fleetCacheTtlMs: number;
  /** 编队「已过期」读数刷新间隔（毫秒）。 */
  readonly fleetStaleTickMs: number;
  /** 会话历史首批/分页条数。 */
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

/** 服务端可调参数。 */
export interface ServerTunables {
  /** 审批请求等待上限（毫秒）。 */
  readonly approvalTimeoutMs: number;
  /** 提问请求等待上限（毫秒）。 */
  readonly questionTimeoutMs: number;
  /** 审批/提问入参下行预览上限（字符）。 */
  readonly approvalArgsMaxChars: number;
  /** 会话历史默认分页上限（条）。 */
  readonly defaultPageLimit: number;
  /** trace.read 默认条数。 */
  readonly traceDefaultLimit: number;
  /** trace.read 最大条数。 */
  readonly traceMaxLimit: number;
  /** 工作区搜索最大命中数。 */
  readonly searchMaxHits: number;
  /** 工作区搜索最大遍历深度。 */
  readonly searchMaxDepth: number;
  /** 单次附件附加数量上限。 */
  readonly fsMaxAttachCount: number;
  /** 提问自定义答案字符上限。 */
  readonly questionMaxCustomChars: number;
  /** 决策账本单次返回行数上限。 */
  readonly decisionMaxRows: number;
  readonly probeTimeoutMs: number;
  readonly eventsCacheMaxEntries: number;
  readonly eventsCacheTtlMs: number;
  readonly untrackedMaxBytes: number;
  readonly sseHistoryMax: number;
  readonly httpRequestTimeoutMs: number;
  readonly httpLongRequestTimeoutMs: number;
  readonly probeCacheMax: number;
  readonly threadMaxLimit: number;
  readonly graphMaxRuns: number;
}

/** 配置文件整体形状。 */
export interface AppConfigData {
  readonly web: WebTunables;
  readonly server: ServerTunables;
}

/**
 * 可调参数只读视图。
 *
 * 启动期一次性校验；之后所有消费点只读，不在业务代码里再解析文件。
 */
export class RuntimeConfig {
  private static readonly DATA: AppConfigData = RuntimeConfig.validate(raw);

  private constructor() {}

  /** Web 端参数。 */
  public static get web(): WebTunables {
    return this.DATA.web;
  }

  /** 服务端参数。 */
  public static get server(): ServerTunables {
    return this.DATA.server;
  }

  /**
   * 校验配置形状（缺键 / 非数字 / 非正数一律抛错）。
   * @param value 原始配置
   * @returns 通过校验的配置
   */
  private static validate(value: unknown): AppConfigData {
    const data = value as Partial<AppConfigData> | null;
    if (data === null || typeof data !== 'object' || data.web === undefined || data.server === undefined) {
      throw new Error('src/config/app.json 缺少 web/server 段');
    }
    const check = <T extends Record<string, unknown>>(section: T, name: string): T => {
      for (const [key, raw] of Object.entries(section)) {
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
          throw new Error(`src/config/app.json ${name}.${key} 必须是正数`);
        }
      }
      return section;
    };
    return {
      web: check(data.web as unknown as Record<string, unknown>, 'web') as unknown as WebTunables,
      server: check(data.server as unknown as Record<string, unknown>, 'server') as unknown as ServerTunables,
    };
  }
}
