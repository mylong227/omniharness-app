import type { SessionEvent, ToolDefinition } from '../../../../host/kernel/contracts.ts';
import { AuditBundles, EventMerkle, ExecutionCertificates, Jcs } from '../../../../host/kernel/util.ts';
import type { ExecutionCertificate } from '../../../../host/kernel/util.ts';
import type { AuditSink } from '../auditSink.ts';
import { ProofTurnSlicer } from './proofTurnSlicer.ts';
import type { TurnSlice } from './proofTurnSlicer.ts';
import type { ProofBundleView, ProofCheck, ProofExportResult, ProofFailure, ProofTurnSummary } from './proofTypes.ts';

/** 凭证服务依赖。 */
export interface ProofServiceDeps {
  /** 会话事件流纯读入口（`Agent.eventsOf`）。 */
  readonly events: (threadId: string) => Promise<readonly SessionEvent[]>;
  /** 本轮可能进入模型视野的工具（直载优先；工具面摘要的口径与证书一致）。 */
  readonly tools: () => readonly ToolDefinition[];
  /** 本地审计链（app 自己的 HMAC 事件链；未接线 undefined——**不是**内核回执链）。 */
  readonly audit: () => AuditSink | undefined;
}

/** 导出包大小上限（2 MB；超过报 `export_too_large`，见设计 §7.1 导出边界）。 */
const EXPORT_MAX_BYTES = 2 * 1024 * 1024;

/** unified diff 的文件头行模式（统计回合变更文件数用，去重保序）。 */
const DIFF_FILE_PATTERN = /^diff --git a\/(.+?) b\/(.+)$/gm;

/**
 * 凭证服务（`proof.*` RPC 后端）：把某一回合做成**离线可复核**的证据。
 *
 * ## 内核能力接线（alpha.16）
 *
 *  - 证书：`ExecutionCertificates.build({ events, tools })`（未签名；签名是 v3 + trust store）；
 *  - 根：`EventMerkle.build(events).root`（复核时重算比对）；
 *  - 导出包：`AuditBundles.build({ runs: [{ events, certificate }] })`，内存 JSON 不落临时文件。
 *
 * ## 诚实边界（设计 §6.6）
 *
 *  - 未配置 signer ⇒ 状态恒 `structural`（结构自洽，未签名），SIGNATURE 检查是 warn 不是 pass；
 *  - AUDIT_CHAIN 只对**本地审计链**（app 事件链）负责，不冒充内核回执链；
 *  - 证明的是完整性/顺序，不是事件内容为真——文案由前端按此口径渲染。
 */
export class ProofService {
  /** 依赖（事件流 / 工具面 / 本地审计链）。 */
  private readonly deps: ProofServiceDeps;

  /**
   * @param deps 事件流、工具面与本地审计链取值器
   */
  public constructor(deps: ProofServiceDeps) {
    this.deps = deps;
  }

  /**
   * 回合列表（`proof.turns`）：按 user 事件切分并统计每回合规模。
   * @param threadId 会话 id（空串 → no_session）。
   * @returns 回合摘要列表；会话不可读时判别失败（不能伪装成「没有回合」）。
   */
  public async turnsOf(threadId: string): Promise<readonly ProofTurnSummary[] | ProofFailure> {
    if (threadId === '') {
      return ProofService.failure('no_session', '先选择一个会话，再打开凭证。');
    }
    let events: readonly SessionEvent[];
    try {
      events = await this.deps.events(threadId);
    } catch (error) {
      return ProofService.failure('proof_invalid', `事件流不可读：${ProofService.messageOf(error)}`);
    }
    return ProofTurnSlicer.slice(events).map((slice) => ProofService.summaryOf(threadId, events, slice));
  }

  /**
   * 构造一回合的执行证书并复核（`proof.build`）：证书 + 六项检查一次返回。
   * @param threadId 会话 id。
   * @param turnIndex 回合下标。
   * @returns 凭证视图；回合不存在 / 无事件时判别失败。
   */
  public async buildOf(threadId: string, turnIndex: number): Promise<ProofBundleView | ProofFailure> {
    const loaded = await this.loadTurn(threadId, turnIndex);
    if ('ok' in loaded) return loaded;
    const { events, slice } = loaded;
    const turnEvents = ProofTurnSlicer.eventsOf(events, slice);
    let certificate: ExecutionCertificate;
    try {
      certificate = ExecutionCertificates.build({
        events: turnEvents,
        ...(this.hasToolSurface() ? { tools: this.safeTools() } : {}),
      });
    } catch (error) {
      return ProofService.failure('proof_invalid', `证书构造失败：${ProofService.messageOf(error)}`);
    }
    const checks = this.checksOf(threadId, turnEvents, certificate);
    const failed = checks.some((check) => check.status === 'fail');
    return {
      sessionId: threadId,
      turnIndex,
      displayIndex: slice.displayIndex,
      certificate,
      checks,
      state: failed ? 'failed' : 'structural',
      eventCount: turnEvents.length,
      auditRecords: this.auditRecordsOf(threadId),
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * 导出一回合证据包（`proof.export`）：审计包 JSON 文本，由前端下载。
   * @param threadId 会话 id。
   * @param turnIndex 回合下标。
   * @returns 导出结果；超过 2 MB 时判别失败（设计 §7.1 导出边界）。
   */
  public async exportOf(threadId: string, turnIndex: number): Promise<ProofExportResult | ProofFailure> {
    const built = await this.buildOf(threadId, turnIndex);
    if ('ok' in built) return built;
    const loaded = await this.loadTurn(threadId, turnIndex);
    if ('ok' in loaded) return loaded;
    const bundle = AuditBundles.build({
      runs: [
        {
          events: ProofTurnSlicer.eventsOf(loaded.events, loaded.slice),
          ...(built.certificate !== undefined ? { certificate: built.certificate } : {}),
        },
      ],
      exportedAt: new Date().toISOString(),
    });
    const content = Jcs.serialize(bundle);
    const size = Buffer.byteLength(content, 'utf8');
    if (size > EXPORT_MAX_BYTES) {
      return ProofService.failure(
        'export_too_large',
        `证据包超过 ${Math.round(EXPORT_MAX_BYTES / 1024)} KB（实测 ${size} 字节），请改用下载端点或分片导出。`,
      );
    }
    return {
      filename: `proof-${threadId}-turn${turnIndex}-${new Date().toISOString().slice(0, 19).replaceAll(':', '')}.json`,
      content,
      size,
    };
  }

  /**
   * 加载并校验回合区间（空回合 → proof_empty；下标越界 → proof_invalid）。
   * @param threadId 会话 id。
   * @param turnIndex 回合下标。
   * @returns 事件流与区间，或判别失败。
   */
  private async loadTurn(
    threadId: string,
    turnIndex: number,
  ): Promise<
    | { readonly events: readonly SessionEvent[]; readonly slice: TurnSlice }
    | ProofFailure
  > {
    if (threadId === '') {
      return ProofService.failure('no_session', '先选择一个会话，再打开凭证。');
    }
    if (!Number.isInteger(turnIndex) || turnIndex < 0) {
      return ProofService.failure('proof_invalid', `回合下标非法：${String(turnIndex)}。`);
    }
    let events: readonly SessionEvent[];
    try {
      events = await this.deps.events(threadId);
    } catch (error) {
      return ProofService.failure('proof_invalid', `事件流不可读：${ProofService.messageOf(error)}`);
    }
    const slices = ProofTurnSlicer.slice(events);
    const slice = slices[turnIndex];
    if (slice === undefined) {
      return ProofService.failure(
        'proof_invalid',
        `回合 ${String(turnIndex)} 不存在（本会话共 ${String(slices.length)} 个回合）。`,
      );
    }
    if (ProofTurnSlicer.eventsOf(events, slice).length === 0) {
      return ProofService.failure('proof_empty', '这个回合没有可复核的事件。');
    }
    return { events, slice };
  }

  /**
   * 六项复核矩阵（设计 PR-03）：事件条数 / 根 / 会话 / 工具面 / 本地审计链 / 签名。
   * @param threadId 会话 id。
   * @param turnEvents 回合事件切片。
   * @param certificate 已构造证书。
   * @returns 六项结论（顺序固定）。
   */
  private checksOf(
    threadId: string,
    turnEvents: readonly SessionEvent[],
    certificate: ExecutionCertificate,
  ): readonly ProofCheck[] {
    const root = EventMerkle.build(turnEvents).root;
    const toolSurface = this.toolSurfaceCheck(certificate);
    const audit = this.auditCheck(threadId);
    return [
      ProofService.checkOf(
        'EVENT_COUNT',
        certificate.eventCount === turnEvents.length ? 'pass' : 'fail',
        `证书绑定 ${String(certificate.eventCount)} 条，当前事件流 ${String(turnEvents.length)} 条。`,
        certificate.eventCount === turnEvents.length ? undefined : 'EVENT_COUNT_MISMATCH',
      ),
      ProofService.checkOf(
        'EVENT_ROOT',
        root === certificate.eventRoot ? 'pass' : 'fail',
        root === certificate.eventRoot
          ? `Merkle 根一致（${root.slice(0, 12)}…）。`
          : 'Merkle 根不一致：事件流可能被增删或改序。',
        root === certificate.eventRoot ? undefined : 'EVENT_ROOT_MISMATCH',
      ),
      ProofService.checkOf(
        'SESSION',
        certificate.sessionId === threadId ? 'pass' : 'fail',
        `证书会话 ${certificate.sessionId}，请求会话 ${threadId}。`,
        certificate.sessionId === threadId ? undefined : 'SESSION_MISMATCH',
      ),
      toolSurface,
      audit,
      // v1 无 signer：SIGNATURE 是 warn（如实标注未证明），不是 pass——设计 PR-04。
      ProofService.checkOf(
        'SIGNATURE',
        'warn',
        '证书未签名：结构自洽（未签名），复核方无法确认签发方身份。',
      ),
    ];
  }

  /**
   * 工具面检查：有工具面时重算摘要比对；未绑定则 warn（不冒充通过）。
   * @param certificate 已构造证书。
   * @returns 检查结论。
   */
  private toolSurfaceCheck(certificate: ExecutionCertificate): ProofCheck {
    if (certificate.toolSurfaceDigest === undefined) {
      return ProofService.checkOf('TOOL_SURFACE', 'warn', '证书未绑定工具面摘要。');
    }
    const digest = ExecutionCertificates.digestOf(this.safeTools());
    return ProofService.checkOf(
      'TOOL_SURFACE',
      digest === certificate.toolSurfaceDigest ? 'pass' : 'fail',
      `工具面摘要 ${digest === certificate.toolSurfaceDigest ? '一致' : '不一致'}（${digest.slice(0, 12)}…）。`,
      digest === certificate.toolSurfaceDigest ? undefined : 'TOOL_SURFACE_MISMATCH',
    );
  }

  /**
   * 本地审计链检查：只对 app 自己的 HMAC 事件链负责（设计 PR-05）。
   * @param threadId 会话 id。
   * @returns 检查结论（未接线 / 无记录 → warn；有记录 → pass 附条数）。
   */
  private auditCheck(threadId: string): ProofCheck {
    const sink = this.deps.audit();
    if (sink === undefined) {
      return ProofService.checkOf('AUDIT_CHAIN', 'warn', '本地审计链未启用（serve 组合根未注入 audit sink）。');
    }
    let all: ReturnType<AuditSink['read']>;
    try {
      all = sink.read();
    } catch (error) {
      return ProofService.checkOf(
        'AUDIT_CHAIN',
        'warn',
        `本地审计链不可读：${ProofService.messageOf(error)}。`,
      );
    }
    const records = all.filter((event) => event.sessionId === threadId);
    if (records.length === 0) {
      return ProofService.checkOf('AUDIT_CHAIN', 'warn', '本地审计链没有该会话的记录。');
    }
    const seqs = records.map((event) => event.seq).filter((seq): seq is number => typeof seq === 'number');
    const first = seqs.length > 0 ? String(Math.min(...seqs)) : '—';
    const last = seqs.length > 0 ? String(Math.max(...seqs)) : '—';
    return ProofService.checkOf(
      'AUDIT_CHAIN',
      'pass',
      `本地审计链已记录该会话 ${String(records.length)} 条（seq ${first}–${last}）；这不等于内核回执链。`,
    );
  }

  /**
   * 本地审计链覆盖该会话的记录条数（proof.build 摘要展示用）。
   * @param threadId 会话 id。
   * @returns 记录条数（未接线 / 无记录为 0）。
   */
  private auditRecordsOf(threadId: string): number {
    const sink = this.deps.audit();
    if (sink === undefined) return 0;
    try {
      return sink.read().filter((event) => event.sessionId === threadId).length;
    } catch {
      return 0;
    }
  }

  /**
   * 组装回合摘要（`proof.turns` 的元素）。
   * @param threadId 会话 id。
   * @param events 全量事件流。
   * @param slice 回合区间。
   * @returns 摘要。
   */
  private static summaryOf(threadId: string, events: readonly SessionEvent[], slice: TurnSlice): ProofTurnSummary {
    const turnEvents = ProofTurnSlicer.eventsOf(events, slice);
    const toolCalls = turnEvents.filter((event) => event.type === 'tool_call').length;
    const changedFiles = ProofService.changedFilesOf(turnEvents);
    const first = turnEvents[0];
    const last = turnEvents[turnEvents.length - 1];
    return {
      sessionId: threadId,
      turnIndex: slice.turnIndex,
      displayIndex: slice.displayIndex,
      startedAt: first?.timestamp ?? '',
      endedAt: last?.timestamp ?? first?.timestamp ?? '',
      eventCount: turnEvents.length,
      toolCalls,
      changedFiles,
      systemTurn: slice.systemTurn,
    };
  }

  /**
   * 统计回合变更文件数：回合内 turn_diff 的 unified diff 文件头去重计数。
   * @param turnEvents 回合事件切片。
   * @returns 变更文件数（无 turn_diff 为 0）。
   */
  private static changedFilesOf(turnEvents: readonly SessionEvent[]): number {
    const files = new Set<string>();
    for (const event of turnEvents) {
      if (event.type !== 'turn_diff') continue;
      const payload = event.payload as { diff?: unknown } | undefined;
      if (typeof payload?.diff !== 'string') continue;
      const pattern = new RegExp(DIFF_FILE_PATTERN.source, 'gm');
      for (const match of payload.diff.matchAll(pattern)) {
        files.add(match[2] ?? match[1] ?? '');
      }
    }
    files.delete('');
    return files.size;
  }

  /**
   * 是否应把工具面绑进证书（工具清单为空时不绑，与内核 build 行为一致）。
   * @returns 有可见工具时 true。
   */
  private hasToolSurface(): boolean {
    return this.safeTools().length > 0;
  }

  /**
   * 取工具清单：任何异常都退化为空表（凭证不该因工具注册表抖动而整体失败）。
   * @returns 当前可见工具定义。
   */
  private safeTools(): readonly ToolDefinition[] {
    try {
      return this.deps.tools();
    } catch {
      return [];
    }
  }

  /**
   * 组装单项检查结论（undefined 问题码不写入，保证 JSON 往返一致）。
   * @param code 检查项代码。
   * @param status 结论。
   * @param detail 说明。
   * @param kernelCode 内核问题码。
   * @returns 检查结论。
   */
  private static checkOf(
    code: ProofCheck['code'],
    status: ProofCheck['status'],
    detail: string,
    kernelCode?: string,
  ): ProofCheck {
    return { code, status, detail, ...(kernelCode !== undefined ? { kernelCode } : {}) };
  }

  /**
   * 组装判别失败（`{ok:false, code, message}`）。
   * @param code 错误码。
   * @param message 可读原因。
   * @returns 判别失败。
   */
  private static failure(code: ProofFailure['code'], message: string): ProofFailure {
    return { ok: false, code, message };
  }

  /**
   * 提取错误消息。
   * @param error 任意抛出值。
   * @returns Error 取 message，其余 String() 化。
   */
  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
