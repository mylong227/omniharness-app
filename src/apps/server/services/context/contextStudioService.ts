import type { SessionEvent } from '../../../../host/kernel/contracts.ts';
import { COMPACTION_MARKER } from '../../../../host/kernel/context.ts';
import { CompactionMarkerReader } from '../../../../host/extensions/kernel/context/compactionMarkerReader.ts';
import type { ContextUsageService, ContextUsageReport } from '../contextUsageService.ts';
import type { CompactionMark, ContextStudioSnapshot, HandoffNote } from './contextStudioSnapshot.ts';

/** 便签端口的最小结构（避免把内核端口类型扩散到应用层）。 */
export interface ScratchpadLike {
  append(text: string, tags?: readonly string[]): { id: string; at: string; text: string; tags?: readonly string[] } | undefined;
  recent(k?: number): readonly { id: string; at: string; text: string; tags?: readonly string[] }[];
  clear(): void;
}

/** 上下文工作室依赖。 */
export interface ContextStudioDeps {
  /** 六类构成报告（与 `context.usage` RPC 同源，复用同一服务实例）。 */
  readonly usage: (threadId: string) => Promise<ContextUsageReport>;
  /** 会话事件流纯读入口（`Agent.eventsOf`）。 */
  readonly events: (threadId: string) => Promise<readonly SessionEvent[]>;
  /** 跨重置便签端口（缺省 = 未接线，快照如实标记）。 */
  readonly scratchpad?: ScratchpadLike | undefined;
}

/**
 * 上下文工作室服务（`context.studio` RPC 后端）：压缩记录 + 六类构成 + 便签，一份只读快照。
 *
 * ## 取数口径
 *
 *  - 六类构成**直接复用** {@link ContextUsageService}（同源，不重投影两次——设计 §7.3）；
 *  - 压缩记录：事件流里 content 以 `OMNI_COMPACTION_V1` 开头的 **system 事件**，用应用侧
 *    `CompactionMarkerReader` 解码游标（与内核 encode 逐字节对齐；内核 codec 深路径不在
 *    alpha.16 的 exports 承诺面）；
 *  - `turnIndex`：压缩事件之前的 user 事件数（第几轮之后发生的压缩，与凭证回合切分同口径）；
 *  - 交接便签：serve 路径未注入 `ScratchpadPort` ⇒ 快照恒为空态 + `handoffAvailable:false`，
 *    绝不伪造便签（设计 §1.6 诚实边界）。
 *
 * 纯读：不写事件、不触发压缩，任何解析失败只丢该条记录。
 */
export class ContextStudioService {
  /** 依赖（usage 与事件流取值器）。 */
  private readonly deps: ContextStudioDeps;

  /**
   * @param deps usage 与事件流取值器
   */
  public constructor(deps: ContextStudioDeps) {
    this.deps = deps;
  }

  /**
   * 采集某会话的上下文工作室快照。
   * @param threadId 会话 id（空串返回空快照，不触发回放）。
   * @returns 快照（事件流不可读时 compactions 为空数组 + usage 空报告，不抛错）。
   */
  public async snapshotOf(threadId: string): Promise<ContextStudioSnapshot> {
    const report = await this.deps.usage(threadId);
    if (threadId === '') {
      return ContextStudioService.empty(threadId, report);
    }
    let events: readonly SessionEvent[];
    try {
      events = await this.deps.events(threadId);
    } catch (error) {
      return ContextStudioService.empty(
        threadId,
        report,
        `事件流不可读：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return {
      threadId,
      report,
      compactions: ContextStudioService.compactionsOf(events),
      handoff: this.handoffOf(),
      handoffAvailable: this.deps.scratchpad !== undefined,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * 追加一条交接便签（工作区级；压缩摘要会自动并入最新一条）。
   * @param text 正文（空白拒收）。
   * @param tags 可选标签。
   * @returns 落盘成功的便签；未接线/空白/写盘失败返回 undefined。
   */
  public appendHandoff(
    text: string,
    tags?: readonly string[],
  ): HandoffNote | undefined {
    const note = this.deps.scratchpad?.append(text, tags);
    if (note === undefined) return undefined;
    return {
      id: note.id,
      text: note.text,
      tags: note.tags ?? [],
      createdAt: note.at,
      source: 'user',
    };
  }

  /**
   * 清空便签（破坏性；仅用于用户显式清理）。
   * @returns 是否已接线并执行。
   */
  public clearHandoff(): boolean {
    if (this.deps.scratchpad === undefined) return false;
    this.deps.scratchpad.clear();
    return true;
  }

  /**
   * 读取最近便签（新在前）。
   * @returns 便签列表；未接线为空数组。
   */
  private handoffOf(): readonly HandoffNote[] {
    const notes = this.deps.scratchpad?.recent(20) ?? [];
    return notes.map((note) => ({
      id: note.id,
      text: note.text,
      tags: note.tags ?? [],
      createdAt: note.at,
      source: 'user',
    }));
  }

  /**
   * 从事件流解析全部压缩游标记录。
   * @param events 会话事件流（升序）。
   * @returns 压缩记录（按时间升序；解码失败的旧记录跳过——坏记录 ≠ 没压缩，UI 单独提示）。
   */
  private static compactionsOf(events: readonly SessionEvent[]): readonly CompactionMark[] {
    const marks: CompactionMark[] = [];
    let userCount = 0;
    for (const event of events) {
      if (event.type === 'user') {
        userCount += 1;
        continue;
      }
      if (event.type !== 'system') continue;
      const content = ContextStudioService.systemContentOf(event);
      if (content === undefined || !content.startsWith(COMPACTION_MARKER)) continue;
      const state = ContextStudioService.decodeOf(content);
      if (state === undefined) continue;
      marks.push({
        at: event.timestamp,
        turnIndex: Math.max(userCount - 1, 0),
        compactedUpTo: state.compactedUpTo,
        headHash: state.headHash,
        summary: state.summary,
        // alpha.16 的 stateAudit / signals 是压缩时的 shadow 返回值，不落事件流；
        // 有 sidecar 持久化后这里才可能出现 true（设计 §1.6）。
        auditRecorded: false,
      });
    }
    return marks;
  }

  /**
   * 解码压缩游标文本（fail-closed：格式不符返回 undefined，由调用方跳过）。
   *
   * 为什么不直接用内核 `CompactionStateCodec`：alpha.16 的 package exports 只承诺
   * `contextCompactor.js`，codec 的深路径不在 exports 清单里。解析实现收在应用侧自有件
   * {@link CompactionMarkerReader}（extensions 登记，口径与内核 encode 逐字节对齐）。
   * @param content system 事件文本。
   * @returns 压缩游标；不可解析时 undefined。
   */
  private static decodeOf(content: string): ReturnType<typeof CompactionMarkerReader.decode> {
    return CompactionMarkerReader.decode(content);
  }

  /**
   * 取 system 事件的文本内容（payload 形态防御式读取）。
   * @param event system 事件。
   * @returns 文本内容；形态不符时 undefined。
   */
  private static systemContentOf(event: SessionEvent): string | undefined {
    const payload = event.payload as { content?: unknown } | undefined;
    return typeof payload?.content === 'string' ? payload.content : undefined;
  }

  /**
   * 空快照（未选会话 / 事件流不可读）。
   * @param threadId 会话 id。
   * @param report 已算好的 usage 报告（含 empty 报告）。
   * @param error 快照级错误（可选）。
   * @returns 零记录快照。
   */
  private static empty(threadId: string, report: ContextUsageReport, error?: string): ContextStudioSnapshot {
    return {
      threadId,
      report,
      compactions: [],
      handoff: [],
      handoffAvailable: false,
      ...(error !== undefined ? { error } : {}),
      collectedAt: new Date().toISOString(),
    };
  }
}
