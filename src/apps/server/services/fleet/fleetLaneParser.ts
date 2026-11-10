import type { SessionEvent } from '../../../../host/kernel/contracts.ts';
import type { FleetNode, FleetStatus } from './fleetSnapshot.ts';

/**
 * 编队车道解析器（纯静态）：从**父会话事件流**解析 subagent 派生事实。
 *
 * ## 为什么解析事件流而不是调内核编排器
 *
 * alpha.16 的 serve 路径里 `SubagentOrchestrator` 在内核 `configToolRegistry` 内部装配，
 * 应用层拿不到实例（无 childrenOf / fleet 查询口）。但派生的**可观测事实全部落回父事件流**：
 *  - `tool_call(name='subagent')`：派生发生（含任务原文）——此时子代理可能仍在跑；
 *  - `tool_result`：结果回传，output 首行是内核 `subagentTool.head.text.1` 渲染的
 *    `[子智能体 <id>] <步数> 步 / <毫秒>ms<状态后缀>`，writes 块带 patch 去向与诚实标记。
 *
 * 解析口径与内核文案（`kernel-texts.json`）耦合，因此**逐字段 fail-soft**：单行解析不出
 * 只丢该字段，绝不抛错打断整个快照——文案随内核升级变化时，本解析器只降级为「字段未上报」。
 */
export class FleetLaneParser {
  private constructor() {}

  /** subagent 工具名（与内核 `SUBAGENT_TOOL_NAME` 同值；内核常量未再导出，此处显式声明）。 */
  private static readonly TOOL_NAME = 'subagent';

  /** 结果首行的会话 id / 步数 / 耗时模板（`[子智能体 sess_x] 3 步 / 1200ms…`）。 */
  private static readonly HEAD_PATTERN = /^\[子智能体 (sess_[^\]]+)\]\s+(\d+)\s*步\s*\/\s*(\d+)ms/;

  /** patch 落盘路径模板（`patch 在 \`<路径>\``）。 */
  private static readonly PATCH_PATTERN = /patch 在 `([^`]+)`/;

  /** 改动不可取回标记（采集失败的 fail-closed 提示首句）。 */
  private static readonly WRITES_UNRECOVERABLE_MARK = '改动不可取回';

  /** copy 降级禁写标记。 */
  private static readonly WRITES_FORBIDDEN_MARK = '写类工具已被禁用';

  /** patch 截断标记（清单仍完整）。 */
  private static readonly PATCH_TRUNCATED_MARK = 'patch 已截断';

  /** 未验证收尾标记（`unverified` 不得读成通过）。 */
  private static readonly UNVERIFIED_MARK = '以**未验证**状态收尾';

  /** 步数截断状态后缀。 */
  private static readonly TRUNCATED_MARK = '未完成：达步数上限';

  /** 失控熔断 / 取消状态后缀。 */
  private static readonly ABORTED_MARK = '未完成：被失控熔断';

  /**
   * 从父会话事件流解析全部编队车道。
   * @param events 父会话事件流（升序）。
   * @param parentSessionId 父会话 id（快照回填）。
   * @returns 车道列表（按开始时间升序；无派生为空数组）。
   */
  public static parse(events: readonly SessionEvent[], parentSessionId: string): readonly FleetNode[] {
    const lanes: FleetNode[] = [];
    /** callId → 车道下标（tool_result 回填用）。 */
    const openByCallId = new Map<string, number>();
    for (const event of events) {
      if (event.type === 'tool_call') {
        const index = FleetLaneParser.openLaneOf(event, parentSessionId);
        if (index !== undefined) {
          openByCallId.set(index.callId, lanes.length);
          lanes.push(index.node);
        }
        continue;
      }
      if (event.type === 'tool_result') {
        const laneIndex = FleetLaneParser.resultLaneIndex(event, openByCallId);
        if (laneIndex !== undefined) {
          lanes[laneIndex] = FleetLaneParser.closeLane(lanes[laneIndex]!, event);
        }
      }
    }
    return lanes;
  }

  /**
   * tool_call 是否为一次 subagent 派生；是则产出初始车道（running）。
   * @param event tool_call 事件。
   * @param parentSessionId 父会话 id。
   * @returns callId 与初始车道；非 subagent / 无 callId / 无任务时 undefined。
   */
  private static openLaneOf(
    event: SessionEvent,
    parentSessionId: string,
  ): { readonly callId: string; readonly node: FleetNode } | undefined {
    const payload = event.payload as { callId?: unknown; name?: unknown; args?: unknown } | undefined;
    if (payload?.name !== FleetLaneParser.TOOL_NAME || typeof payload.callId !== 'string') {
      return undefined;
    }
    const args = payload.args as { task?: unknown } | undefined;
    const task = typeof args?.task === 'string' ? args.task : '';
    if (task === '') return undefined;
    return {
      callId: payload.callId,
      node: {
        parentSessionId,
        task,
        status: 'running',
        startedAt: event.timestamp,
        isolation: 'worktree',
      },
    };
  }

  /**
   * tool_result 对应的已开车道下标（配对键 callId）。
   * @param event tool_result 事件。
   * @param openByCallId callId → 下标表。
   * @returns 下标；未配对（结果先于调用到达 / 非本域调用）时 undefined。
   */
  private static resultLaneIndex(
    event: SessionEvent,
    openByCallId: ReadonlyMap<string, number>,
  ): number | undefined {
    const payload = event.payload as { callId?: unknown } | undefined;
    if (typeof payload?.callId !== 'string') return undefined;
    return openByCallId.get(payload.callId);
  }

  /**
   * 用 tool_result 关闭车道：解析结果文本与诚实标记，映射终态。
   * @param lane 待关闭车道（running 态）。
   * @param event tool_result 事件。
   * @returns 关闭后的车道（字段解析不出时保持 undefined，不编造）。
   */
  private static closeLane(lane: FleetNode, event: SessionEvent): FleetNode {
    const payload = event.payload as { ok?: unknown; output?: unknown; error?: unknown } | undefined;
    const output = typeof payload?.output === 'string' ? payload.output : '';
    const head = FleetLaneParser.headOf(output);
    const status = FleetLaneParser.statusOf(payload, output);
    const writes = FleetLaneParser.writesOf(output);
    const verification = output.includes(FleetLaneParser.UNVERIFIED_MARK)
      ? ('unverified' as const)
      : undefined;
    const patchPath = head !== undefined ? FleetLaneParser.patchPathOf(output, head.id) : undefined;
    return {
      ...lane,
      ...(head !== undefined ? { childSessionId: head.id, steps: head.steps, durationMs: head.ms } : {}),
      ...(patchPath !== undefined ? { patchPath } : {}),
      status,
      endedAt: event.timestamp,
      ...(writes.changedFiles !== undefined ? { changedFiles: writes.changedFiles } : {}),
      ...(writes.patchTruncated !== undefined ? { patchTruncated: writes.patchTruncated } : {}),
      ...(writes.writesUnrecoverable !== undefined
        ? { writesUnrecoverable: writes.writesUnrecoverable }
        : {}),
      ...(writes.writesForbidden !== undefined ? { writesForbidden: writes.writesForbidden } : {}),
      ...(writes.isolation !== undefined ? { isolation: writes.isolation } : {}),
      ...(verification !== undefined ? { verificationState: verification } : {}),
      ...(typeof payload?.error === 'string' && payload.error !== '' ? { error: payload.error } : {}),
    };
  }

  /**
   * 终态映射（设计 §4.2 statusOf）：truncated / aborted 优先于 ok，失败兜底 failed。
   * @param payload tool_result 载荷（ok / error）。
   * @param output 结果文本（状态后缀来源）。
   * @returns 车道终态。
   */
  private static statusOf(
    payload: { ok?: unknown; error?: unknown } | undefined,
    output: string,
  ): FleetStatus {
    if (output.includes(FleetLaneParser.TRUNCATED_MARK)) return 'truncated';
    if (output.includes(FleetLaneParser.ABORTED_MARK)) return 'aborted';
    if (payload?.ok !== true) return 'failed';
    return 'ok';
  }

  /**
   * 解析结果首行头（会话 id / 步数 / 毫秒）。
   * @param output 结果文本。
   * @returns `{id, steps, ms}`；首行不符合内核模板时 undefined（fail-soft 降级为字段未上报）。
   */
  private static headOf(output: string): { readonly id: string; readonly steps: number; readonly ms: number } | undefined {
    const firstLine = output.split('\n', 1)[0] ?? '';
    const match = FleetLaneParser.HEAD_PATTERN.exec(firstLine);
    if (match === null) return undefined;
    const steps = Number(match[2]);
    const ms = Number(match[3]);
    return { id: match[1]!, steps, ms };
  }

  /**
   * patch 落盘路径：优先取文本里内核回传的相对路径；取不到时按补丁目录约定回填
   * （文件是否真实存在由 FleetRegistry 的磁盘 stat 负责，本函数只给路径）。
   * @param output 结果文本。
   * @param childSessionId 子会话 id。
   * @returns 工作区相对路径；两者都取不到时 undefined。
   */
  private static patchPathOf(output: string, childSessionId: string): string | undefined {
    const fromText = FleetLaneParser.PATCH_PATTERN.exec(output)?.[1];
    return fromText ?? `.omniharness/subagent-patches/${childSessionId}.patch`;
  }

  /**
   * 解析 writes 块的诚实标记（禁写 / 不可取回 / 截断 / 隔离方式 / 文件清单）。
   * @param output 结果文本。
   * @returns 各标记（解析不出为 undefined，不编造）。
   */
  private static writesOf(output: string): {
    readonly changedFiles?: readonly string[];
    readonly patchTruncated?: boolean;
    readonly writesUnrecoverable?: boolean;
    readonly writesForbidden?: boolean;
    readonly isolation?: 'worktree' | 'copy';
  } {
    const forbidden = output.includes(FleetLaneParser.WRITES_FORBIDDEN_MARK);
    const unrecoverable = output.includes(FleetLaneParser.WRITES_UNRECOVERABLE_MARK);
    const truncated = output.includes(FleetLaneParser.PATCH_TRUNCATED_MARK);
    const changedFiles = forbidden === true ? undefined : FleetLaneParser.changedFilesOf(output);
    return {
      ...(changedFiles !== undefined && changedFiles.length > 0 ? { changedFiles } : {}),
      ...(truncated ? { patchTruncated: true } : {}),
      ...(unrecoverable ? { writesUnrecoverable: true } : {}),
      ...(forbidden ? { writesForbidden: true } : {}),
      ...(forbidden ? { isolation: 'copy' as const } : {}),
    };
  }

  /**
   * 从「改动文件：a.ts、b.ts …（共 N 个）」行解析文件清单（内核把多文件用「、」连接）。
   * @param output 结果文本。
   * @returns 文件相对路径列表；解析不出为 undefined。
   */
  private static changedFilesOf(output: string): readonly string[] | undefined {
    const line = output
      .split('\n')
      .find((candidate) => candidate.startsWith('改动文件：'));
    if (line === undefined) return undefined;
    const body = line.slice('改动文件：'.length);
    const truncated = body.split('…（共')[0] ?? body;
    const files = truncated
      .split('、')
      .map((name) => name.trim())
      .filter((name) => name !== '');
    return files;
  }
}
