// 当前会话的「一屏摘要」：只从已在内存里的事件流派生，不发请求、不碰后端状态。
//
// 为什么放在模型层：右栏工作台首页、输入区空态、命令面板都可能要同一组数字；
// 若各写一份「数 user / 数 tool_call / 累 token」的实现，第一次改口径就会漂。
//
// 口径：
//   · 回合数 = `type === 'user'` 的事件数（与内核 SessionSummaryBuilder 同口径）；
//   · 工具调用 / 失败 = `tool_call` 事件数 / 对应 `tool_result` 中 `ok === false` 的条数；
//   · 文件数 / 增删 = 所有 `turn_diff` 解析出的 per-file 行去重后累加（同一文件多轮只算一次）；
//   · token = `model` 事件 payload.usage 的 prompt + completion 之和（端点未上报时贡献 0）；
//   · 时长 = 首末事件时间戳之差（不剔除挂机；列表里的 activeMs 才剔除）。

import type { ThreadEvent } from '../../types/models.ts';
import { ArtifactResolver } from './ArtifactResolver.ts';
import { EventFields } from './EventFields.ts';
import { parseTurnDiffFiles } from './TurnDiffFiles.ts';

/** 最近一次模型调用上报的上下文快照（内核 `model` 事件 payload.context）。 */
export interface SessionContextStat {
  /** 上次请求实际使用的 token 数。 */
  readonly usedTokens: number;
  /** 上下文窗口 token 数。 */
  readonly windowTokens: number;
  /** 已用占窗口百分比（0–100 一位小数）。 */
  readonly percent: number;
  /** 该次调用的缓存命中率（0–100 一位小数）；端点未上报时为 undefined。 */
  readonly cacheHitRate?: number;
}

/** 会话摘要数字（全部为 0 表示还没有可展示的内容）。 */
export interface SessionBriefStats {
  /** 用户回合数。 */
  readonly turns: number;
  /** 工具调用次数。 */
  readonly toolCalls: number;
  /** 工具失败次数（只统计有显式 ok:false 的结果）。 */
  readonly toolFailures: number;
  /** 本会话涉及的文件数（按路径去重）。 */
  readonly files: number;
  /** 累计新增行数。 */
  readonly added: number;
  /** 累计删除行数。 */
  readonly deleted: number;
  /** 累计 token（prompt + completion；未上报的调用不贡献）。 */
  readonly tokens: number;
  /** 首末事件时间差（ms；不足两条时间戳时为 0）。 */
  readonly durationMs: number;
  /** 出现过的模型名（顺序 = 首次出现顺序，去重）。 */
  readonly models: readonly string[];
  /** 最近一次上下文快照（没有 `model` 事件或旧端点未上报时为 undefined）。 */
  readonly context?: SessionContextStat | undefined;
}

/** 空摘要（无会话 / 空事件时的稳定返回）。 */
const EMPTY_STATS: SessionBriefStats = {
  turns: 0,
  toolCalls: 0,
  toolFailures: 0,
  files: 0,
  added: 0,
  deleted: 0,
  tokens: 0,
  durationMs: 0,
  models: [],
};

/** 会产出文件的工具（补 diff 覆盖不到的产物；与 TurnSummary 同口径）。 */
const WRITE_TOOLS: ReadonlySet<string> = new Set(['write_file', 'apply_patch', 'sketch_write']);

/** 从事件流提取会话摘要。 */
export class SessionBrief {
  /**
   * 汇总当前会话。
   * @param events 当前会话事件（已加载的部分；更早历史未加载时只统计可见范围）
   * @returns 摘要数字
   */
  public static from(events: readonly ThreadEvent[]): SessionBriefStats {
    if (events.length === 0) return EMPTY_STATS;
    let turns = 0;
    let toolCalls = 0;
    let toolFailures = 0;
    let tokens = 0;
    let firstAt = 0;
    let lastAt = 0;
    let context: SessionContextStat | undefined;
    const models: string[] = [];
    const seenModels = new Set<string>();
    const files = new Map<string, { added: number; deleted: number }>();
    const results = new Map<string, { ok: boolean; text: string }>();

    for (const ev of events) {
      if (ev.type !== 'tool_result') continue;
      const callId = EventFields.rawCallId(ev);
      if (callId === '') continue;
      const payload = ev.payload ?? {};
      const text =
        payload['error'] != null
          ? String(payload['error'])
          : payload['output'] != null
            ? String(payload['output'])
            : '';
      results.set(callId, { ok: payload['ok'] === true, text });
    }

    for (const ev of events) {
      if (ev.type === 'user') turns += 1;
      if (ev.type === 'tool_call') {
        toolCalls += 1;
        const name = EventFields.toolName(ev);
        if (WRITE_TOOLS.has(name)) {
          const result = results.get(EventFields.callId(ev));
          const artifact = result?.ok === true
            ? ArtifactResolver.fromTool(name, ev.payload?.['args'], result.text)
            : null;
          if (artifact !== null && !files.has(artifact.relPath)) {
            files.set(artifact.relPath, { added: 0, deleted: 0 });
          }
        }
      }
      if (ev.type === 'tool_result' && ev.payload?.['ok'] === false) toolFailures += 1;
      if (ev.type === 'turn_diff') {
        const diff = typeof ev.payload?.['diff'] === 'string' ? ev.payload.diff : '';
        for (const file of parseTurnDiffFiles(diff)) {
          const prev = files.get(file.path);
          if (prev === undefined) {
            files.set(file.path, { added: file.added, deleted: file.deleted });
          } else {
            files.set(file.path, {
              added: prev.added + file.added,
              deleted: prev.deleted + file.deleted,
            });
          }
        }
      }
      if (ev.type === 'model') {
        const usage = ev.payload?.['usage'];
        let cacheHitRate: number | undefined;
        if (usage !== null && typeof usage === 'object') {
          const record = usage as Record<string, unknown>;
          const prompt = SessionBrief.numberOf(record['promptTokens']);
          const cached = SessionBrief.numberOf(record['cachedPromptTokens']);
          tokens += prompt + SessionBrief.numberOf(record['completionTokens']);
          if (prompt > 0 && record['cachedPromptTokens'] !== undefined) {
            cacheHitRate = Math.round((Math.min(cached, prompt) / prompt) * 1000) / 10;
          }
        }
        const snapshot = ev.payload?.['context'];
        if (snapshot !== null && typeof snapshot === 'object') {
          const record = snapshot as Record<string, unknown>;
          const used = SessionBrief.numberOf(record['usedTokens']);
          const windowTokens = SessionBrief.numberOf(record['windowTokens']);
          if (windowTokens > 0) {
            context = {
              usedTokens: used,
              windowTokens,
              percent: Math.round((Math.min(used, windowTokens) / windowTokens) * 1000) / 10,
              ...(cacheHitRate !== undefined ? { cacheHitRate } : {}),
            };
          }
        }
        const model = ev.payload?.['model'];
        if (typeof model === 'string' && model !== '' && !seenModels.has(model)) {
          seenModels.add(model);
          models.push(model);
        }
      }
      const at = EventFields.timestamp(ev);
      if (at > 0) {
        if (firstAt === 0 || at < firstAt) firstAt = at;
        if (at > lastAt) lastAt = at;
      }
    }

    let added = 0;
    let deleted = 0;
    for (const stat of files.values()) {
      added += stat.added;
      deleted += stat.deleted;
    }

    return {
      turns,
      toolCalls,
      toolFailures,
      files: files.size,
      added,
      deleted,
      tokens,
      durationMs: firstAt > 0 && lastAt > firstAt ? lastAt - firstAt : 0,
      models,
      ...(context !== undefined ? { context } : {}),
    };
  }

  /**
   * 是否没有任何可展示内容。
   * @param stats 摘要
   * @returns 全零返回 true
   */
  public static isEmpty(stats: SessionBriefStats): boolean {
    return (
      stats.turns === 0 &&
      stats.toolCalls === 0 &&
      stats.files === 0 &&
      stats.tokens === 0
    );
  }

  /**
   * 安全读取非负数字（脏数据按 0）。
   * @param value 未知值
   * @returns 非负有限数
   */
  private static numberOf(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.round(value)
      : 0;
  }
}
