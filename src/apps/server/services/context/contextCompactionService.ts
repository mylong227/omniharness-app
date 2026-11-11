import { ContextAssembler, ContextCompactor } from '../../../../host/kernel/context.ts';
import type { SessionEvent, ToolDefinition } from '../../../../host/kernel/contracts.ts';
import { Id } from '../../../../host/kernel/util.ts';
import { CompactionMarkerReader } from '../../../../host/extensions/kernel/context/compactionMarkerReader.ts';

/** 单次手动压缩的结果。 */
export interface ContextCompactionResult {
  readonly ok: true;
  /** 被折叠的消息数（内核游标）。 */
  readonly compactedUpTo: number;
  /** 写入事件流的压缩摘要（人类可读）。 */
  readonly summary: string;
  /** 追加压缩游标后的事件总数。 */
  readonly eventCount: number;
}

/** 手动压缩失败。 */
export interface ContextCompactionFailure {
  readonly ok: false;
  readonly code:
    | 'no_session'
    | 'session_running'
    | 'compaction_noop'
    | 'compaction_failed'
    | 'compaction_persist_failed'
    | 'confirm_required';
  readonly message: string;
}

/** 手动压缩结果联合。 */
export type ContextCompactionOutcome = ContextCompactionResult | ContextCompactionFailure;

/** 手动压缩依赖。 */
export interface ContextCompactionDeps {
  /** 会话事件纯读入口。 */
  readonly events: (threadId: string) => Promise<readonly SessionEvent[]>;
  /** 会话事件全量保存入口（写回压缩游标）。 */
  readonly save: (threadId: string, events: readonly SessionEvent[]) => Promise<void>;
  /** 会话是否正在跑回合（运行中禁止手动压缩，避免写坏事件流）。 */
  readonly isRunning: (threadId: string) => boolean;
  /** 基础常驻系统片段。 */
  readonly fragments: () => readonly string[];
  /** 当前可见工具（固定开销口径与真实请求一致）。 */
  readonly tools: () => readonly ToolDefinition[];
  /** 当前模型窗口 token。 */
  readonly windowTokens: () => number;
  /** 显式压缩预算（配置 compactionMaxTokens；未配置时按窗口自动）。 */
  readonly maxTokens?: number | undefined;
  /** 保留最近消息数（配置 compactionKeepRecent；缺省 6）。 */
  readonly keepRecent?: number | undefined;
  /** 确定性无损收缩（配置 compactionDeterministicShrink；缺省 true）。 */
  readonly deterministicShrink?: boolean | undefined;
  /** 便签端口（压缩摘要自动带上最新一条）。 */
  readonly scratchpad?:
    | {
        readonly name: string;
        recent(k?: number): readonly { id: string; at: string; text: string; tags?: readonly string[] }[];
        latest(): { id: string; at: string; text: string; tags?: readonly string[] } | undefined;
        append(
          text: string,
          tags?: readonly string[],
        ): { id: string; at: string; text: string; tags?: readonly string[] } | undefined;
        clear(): void;
      }
    | undefined;
  /** 存储物理位置（附件水合根；可选）。 */
  readonly storageLocation?: string | undefined;
}

/**
 * 手动压缩服务（`context.compact` RPC 后端）。
 *
 * 只在**空闲会话**上执行：用内核 `ContextAssembler` 把事件投影成消息，调用
 * `ContextCompactor.compact(..., force=true)`（确定性摘要，零模型调用），再把
 * `OMNI_COMPACTION_V1` 游标作为 system 事件写回存档。下一次续跑由 `StepContextBuilder`
 * 恢复游标并复用摘要——因此这不是「只改 UI 的假压缩」。
 *
 * 边界：运行中的回合禁止压缩（会与 write-behind / 内存事件流竞争）；不压缩空会话；
 * 保存失败时不留下半条事件（全量 save 是原子写）。
 */
export class ContextCompactionService {
  /** 依赖。 */
  private readonly deps: ContextCompactionDeps;

  /**
   * @param deps 事件 / 保存 / 工具 / 窗口 / 便签
   */
  public constructor(deps: ContextCompactionDeps) {
    this.deps = deps;
  }

  /**
   * 强制压缩一个空闲会话。
   * @param threadId 会话 id。
   * @returns 压缩结果或判别失败；不抛异常。
   */
  public async compactOf(threadId: string): Promise<ContextCompactionOutcome> {
    if (threadId === '') {
      return ContextCompactionService.fail('no_session', '先选择一个会话，再执行压缩。');
    }
    if (this.deps.isRunning(threadId)) {
      return ContextCompactionService.fail(
        'session_running',
        '会话正在运行，不能手动压缩；等本轮结束后再试。',
      );
    }
    let events: readonly SessionEvent[];
    try {
      events = await this.deps.events(threadId);
    } catch (error) {
      return ContextCompactionService.fail(
        'compaction_failed',
        `事件流不可读：${error instanceof Error ? error.message : String(error)}。`,
      );
    }
    if (events.length === 0) {
      return ContextCompactionService.fail('compaction_noop', '会话没有可压缩的事件。');
    }
    const windowTokens = this.deps.windowTokens();
    const compactor = new ContextCompactor({
      maxTokens: this.deps.maxTokens ?? 8000,
      keepRecent: this.deps.keepRecent ?? 6,
      deterministicShrink: this.deps.deterministicShrink ?? true,
      ...(this.deps.maxTokens === undefined ? { contextWindowTokens: windowTokens } : {}),
      ...(this.deps.scratchpad !== undefined ? { scratchpad: this.deps.scratchpad } : {}),
    });
    const messages = new ContextAssembler(
      this.deps.fragments(),
      this.deps.storageLocation,
      windowTokens,
    ).build(events);
    let result;
    try {
      result = await compactor.compact(
        messages,
        undefined,
        { tools: this.deps.tools() },
        true,
      );
    } catch (error) {
      return ContextCompactionService.fail(
        'compaction_failed',
        `压缩失败：${error instanceof Error ? error.message : String(error)}。`,
      );
    }
    if (result.compacted !== true || result.state === undefined) {
      return ContextCompactionService.fail(
        'compaction_noop',
        result.degraded === true
          ? '压缩摘要降级，未写入游标；请稍后重试。'
          : '内核没有产生可写入的压缩游标（可能没有可折叠历史）。',
      );
    }
    const state = result.state;
    const marker: SessionEvent = {
      id: Id.id('evt'),
      sessionId: threadId,
      type: 'system',
      timestamp: new Date().toISOString(),
      seq: ContextCompactionService.nextSeq(events),
      payload: { content: CompactionMarkerReader.encode(state) },
    };
    try {
      await this.deps.save(threadId, [...events, marker]);
    } catch (error) {
      return ContextCompactionService.fail(
        'compaction_persist_failed',
        `压缩游标写回失败：${error instanceof Error ? error.message : String(error)}。`,
      );
    }
    return {
      ok: true,
      compactedUpTo: state.compactedUpTo,
      summary: state.summary,
      eventCount: events.length + 1,
    };
  }

  /**
   * 下一条事件序号。
   * @param events 现有事件。
   * @returns max(seq)+1；旧事件没有 seq 时用长度 +1。
   */
  private static nextSeq(events: readonly SessionEvent[]): number {
    let max = 0;
    for (const event of events) {
      if (typeof event.seq === 'number' && event.seq > max) max = event.seq;
    }
    return max + 1;
  }

  /**
   * 构造失败。
   * @param code 错误码
   * @param message 可读原因
   * @returns 失败
   */
  private static fail(
    code: ContextCompactionFailure['code'],
    message: string,
  ): ContextCompactionFailure {
    return { ok: false, code, message };
  }
}
