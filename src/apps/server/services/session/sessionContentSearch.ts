// 会话内容搜索服务（`search.all` 的「对话内容」组后端；需求设计见 docs/design/session-search/）。
//
// 为什么不用 .jsonl 裸扫：事件读取统一走 `Agent.eventsOf`（在跑会话取内存事实源、其余取存档、
// 纯读不广播——内核契约见 Agent.eventsOf 说明），与 trace 面板同一条只读通路。
//
// 匹配口径（v1，见设计文档「非目标」）：大小写不敏感的子串匹配，零依赖、可预期。
// 扫描上限见 CONTENT_SEARCH_LIMITS：超限 `truncated: true`，新会话（清单序）优先覆盖。

import type { SessionEvent } from '../../../../host/kernel/contracts.ts';

/** 会话内容命中（单会话）。 */
export interface SessionContentHit {
  /** 会话 id（点击打开该会话）。 */
  readonly sessionId: string;
  /** 会话标题（侧车清单；无标题回退 id）。 */
  readonly label: string;
  /** 更新时间（原样透传清单值；排序次序键）。 */
  readonly updatedAt: string;
  /** 命中行数（封顶计数，供 UI 展示「N 处命中」）。 */
  readonly matchCount: number;
  /** 首条命中片段（±30 字符，含省略号；UI 第二行高亮渲染）。 */
  readonly snippet: string;
  /** 前 3 条命中的事件明细。 */
  readonly matches: readonly {
    readonly eventId: string;
    readonly type: string;
    readonly excerpt: string;
  }[];
}

/** 内容搜索结果（`truncated` = 触达任一上限，结果可能不完整）。 */
export interface SessionContentSearchResult {
  readonly hits: readonly SessionContentHit[];
  readonly truncated: boolean;
}

/** 扫描上限（导出供判据对齐；改值需同步 docs/design/session-search/README.md §3 表格）。 */
export const CONTENT_SEARCH_LIMITS = {
  /** 查询词最小长度（短于 2 个字符的子串命中面太广，直接拒绝）。 */
  queryMin: 2,
  /** 查询词最大长度。 */
  queryMax: 64,
  /** 扫描会话数上限（清单序 = 最近更新优先）。 */
  scanSessions: 200,
  /** 每会话命中行计数上限（超过即停扫该会话）。 */
  matchCountCapPerSession: 50,
  /** 每会话保留片段条数。 */
  matchesKeptPerSession: 3,
  /** 片段单侧保留字符数（命中词居中，两侧各 30）。 */
  excerptRadius: 30,
} as const;

/** 内容搜索依赖。 */
export interface SessionContentSearchDeps {
  /** 会话清单（`sessionList`：全量跨项目，含 label/updatedAt）。 */
  readonly sessions: () => Promise<
    readonly { readonly sessionId: string; readonly label: string; readonly updatedAt: string }[]
  >;
  /** 事件读取（`Agent.eventsOf`：在跑会话取内存、其余取存档、纯读不广播）。 */
  readonly eventsOf: (sessionId: string) => Promise<readonly SessionEvent[]>;
}

/**
 * 会话内容搜索：在会话事件流里做大小写不敏感的子串匹配。
 *
 * 只读、仅本机磁盘/内存，无任何上行。扫描上限见 {@link CONTENT_SEARCH_LIMITS}。
 */
export class SessionContentSearch {
  private readonly eventsOf: (sessionId: string) => Promise<readonly SessionEvent[]>;
  private readonly sessions: () => Promise<
    readonly { readonly sessionId: string; readonly label: string; readonly updatedAt: string }[]
  >;

  /**
   * @param deps 会话清单与事件读取两个取数器
   */
  public constructor(deps: SessionContentSearchDeps) {
    this.sessions = deps.sessions;
    this.eventsOf = deps.eventsOf;
  }

  /**
   * 执行内容搜索。
   * @param query 查询词（trim 后 2–64 字符；越界返回空结果——UI 侧短查询只做本地标题过滤）
   * @param limit 返回结果条数上限（缺省 8，钳到 1–20）
   * @returns 命中列表（命中行数多者优先 → 更新时间新者优先）与截断标记；不抛异常
   */
  public async searchOf(query: string, limit = 8): Promise<SessionContentSearchResult> {
    const needle = query.trim().toLowerCase();
    if (needle.length < CONTENT_SEARCH_LIMITS.queryMin || needle.length > CONTENT_SEARCH_LIMITS.queryMax) {
      return { hits: [], truncated: false };
    }
    const capped = Math.max(1, Math.min(limit, 20));
    let roster: readonly { sessionId: string; label: string; updatedAt: string }[] = [];
    try {
      roster = await this.sessions();
    } catch {
      roster = [];
    }
    // 清单序（最近更新优先）即扫描序：截断发生时新会话优先覆盖。
    const scanList = roster.slice(0, CONTENT_SEARCH_LIMITS.scanSessions);
    const truncatedByScan = roster.length > scanList.length;
    const hits: SessionContentHit[] = [];
    let truncated = truncatedByScan;
    for (const session of scanList) {
      if (hits.length >= capped) {
        truncated = true;
        break;
      }
      let events: readonly SessionEvent[] = [];
      try {
        events = await this.eventsOf(session.sessionId);
      } catch {
        continue; // 单会话读取失败（存储瞬断/并发删除）不拖垮整次搜索。
      }
      const scanned = SessionContentSearch.scanEvents(session, events, needle);
      if (scanned === undefined) continue;
      hits.push(scanned.hit);
      if (scanned.truncatedInSession) truncated = true;
    }
    hits.sort((a, b) => b.matchCount - a.matchCount || (a.updatedAt < b.updatedAt ? 1 : -1));
    return { hits: hits.slice(0, capped), truncated };
  }

  /**
   * 扫单个会话的事件流。
   * @param session 清单条目（id/标题/更新时间）
   * @param events 事件数组（只读）
   * @param needle 已小写化的查询词
   * @returns 命中条目；无命中为 undefined
   */
  private static scanEvents(
    session: { sessionId: string; label: string; updatedAt: string },
    events: readonly SessionEvent[],
    needle: string,
  ): { readonly hit: SessionContentHit; readonly truncatedInSession: boolean } | undefined {
    let matchCount = 0;
    let truncatedInSession = false;
    const matches: { eventId: string; type: string; excerpt: string }[] = [];
    for (const event of events) {
      if (matchCount >= CONTENT_SEARCH_LIMITS.matchCountCapPerSession) {
        truncatedInSession = true;
        break;
      }
      const readable = SessionContentSearch.readableTextOf(event);
      const at = readable.toLowerCase().indexOf(needle);
      if (at < 0) continue;
      matchCount += 1;
      if (matches.length < CONTENT_SEARCH_LIMITS.matchesKeptPerSession) {
        matches.push({
          eventId: event.id,
          type: event.type,
          excerpt: SessionContentSearch.excerptOf(readable, at, needle.length),
        });
      }
    }
    if (matchCount === 0) return undefined;
    const first = matches[0];
    return {
      truncatedInSession,
      hit: {
        sessionId: session.sessionId,
        label: session.label,
        updatedAt: session.updatedAt,
        matchCount,
        snippet: first !== undefined ? first.excerpt : '',
        matches,
      },
    };
  }

  /**
   * 按事件类型提取可读文本（命中即在此文本上定位；元数据命中不计入）。
   * @param event 会话事件
   * @returns 可读文本（无则为空串）
   */
  private static readableTextOf(event: SessionEvent): string {
    const payload = (event as { payload?: Record<string, unknown> }).payload;
    if (payload === undefined || payload === null) return '';
    if (typeof payload['content'] === 'string') return payload['content'];
    if (typeof payload['text'] === 'string') return payload['text'];
    if (typeof payload['name'] === 'string') return payload['name'];
    const dumped = JSON.stringify(payload);
    return dumped === undefined ? '' : dumped.slice(0, 200);
  }

  /**
   * 命中词居中的片段截断（两侧各 30 字符，越界补省略号）。
   * @param text 可读文本
   * @param at 命中起始下标（小写化口径）
   * @param needleLength 查询词长度
   * @returns 片段
   */
  private static excerptOf(text: string, at: number, needleLength: number): string {
    const half = CONTENT_SEARCH_LIMITS.excerptRadius;
    const start = Math.max(0, Math.min(at - half, at));
    const end = Math.min(text.length, Math.max(start + half * 2 + needleLength, at + needleLength));
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }
}
