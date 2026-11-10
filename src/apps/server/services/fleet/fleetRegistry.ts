import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { SessionEvent } from '../../../../host/kernel/contracts.ts';
import { FleetLaneParser } from './fleetLaneParser.ts';
import type { FleetNode, FleetSnapshot } from './fleetSnapshot.ts';

/** 编队台账依赖（全部实时取值器：工作区可切换、事件流随会话增长）。 */
export interface FleetRegistryDeps {
  /** 父会话事件流纯读入口（`Agent.eventsOf`）。 */
  readonly events: (threadId: string) => Promise<readonly SessionEvent[]>;
  /** 当前生效工作区根（patch 工件目录在其下）。 */
  readonly workspaceRoot: () => string;
}

/**
 * 编队台账（`fleet.list` RPC 后端）：把「当前父会话派生了哪些子代理」聚合为一份只读快照。
 *
 * ## 数据源（零内核改动）
 *
 * 1. **父事件流**：`FleetLaneParser` 解析 tool_call / tool_result 得到车道与诚实标记；
 * 2. **patch 工件目录**：`<workspaceRoot>/.omniharness/subagent-patches/<childId>.patch`，
 *    `statSync` 取真实字节数——文本里说的 patchPath 必须落到磁盘才算「可取回」；
 * 3. **子会话存档**：由调用方（模块层）经 `sessionTraceExists` 补充 `traceAvailable`，
 *    本类不重复实现存在性判定。
 *
 * 只读保证：不写事件、不改工作区、任何解析失败都降级为字段缺省。
 */
export class FleetRegistry {
  /** 静态解析器（无状态）。 */
  private static readonly PARSER = FleetLaneParser;

  /** 依赖（事件流与工作区根）。 */
  private readonly deps: FleetRegistryDeps;

  /**
   * @param deps 事件流与工作区根取值器
   */
  public constructor(deps: FleetRegistryDeps) {
    this.deps = deps;
  }

  /**
   * 采集某父会话的编队快照。
   * @param threadId 父会话 id（空串返回空快照，与 `context.usage` 口径一致）。
   * @param traceExists 子会话轨迹存在性判定（模块层注入；缺省不给轨迹信息）。
   * @returns 编队快照（事件流不可读时为空快照，不抛错）。
   */
  public async snapshotOf(
    threadId: string,
    traceExists?: (sessionId: string) => Promise<boolean>,
  ): Promise<FleetSnapshot> {
    if (threadId === '') {
      return FleetRegistry.empty(threadId);
    }
    let events: readonly SessionEvent[];
    try {
      events = await this.deps.events(threadId);
    } catch (error) {
      return FleetRegistry.empty(threadId, `事件流不可读：${FleetRegistry.messageOf(error)}`);
    }
    const parsed = FleetRegistry.PARSER.parse(events, threadId);
    const nodes: FleetNode[] = [];
    for (const node of parsed) {
      const withPatch = this.attachPatchBytes(node);
      nodes.push(
        traceExists === undefined || withPatch.childSessionId === undefined
          ? withPatch
          : {
              ...withPatch,
              traceAvailable: await traceExists(withPatch.childSessionId),
            },
      );
    }
    const runningCount = nodes.filter((node) => node.status === 'running' || node.status === 'queued')
      .length;
    return {
      parentSessionId: threadId,
      nodes,
      runningCount,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * 给车道补 patch 字节数（磁盘 stat；文件不在 = patch 不可取回，路径不删——诚实展示）。
   * @param node 待补车道。
   * @returns 带 patchBytes 的车道（无 patchPath 或 stat 失败时原样返回）。
   */
  private attachPatchBytes(node: FleetNode): FleetNode {
    if (node.patchPath === undefined) return node;
    // 结果文本来自模型可见的工具输出：只允许读内核约定的 patch 目录，拒绝绝对路径 /
    // `..` 穿越；否则一次伪造的 tool_result 就能让服务端 stat 工作区外的文件。
    const normalized = node.patchPath.replaceAll('\\', '/');
    if (!normalized.startsWith('.omniharness/subagent-patches/') || normalized.split('/').includes('..')) {
      return node;
    }
    const root = this.deps.workspaceRoot();
    if (root === '') return node;
    try {
      const stat = statSync(join(root, normalized), { throwIfNoEntry: false });
      if (stat === undefined || !stat.isFile()) return node;
      return { ...node, patchBytes: stat.size };
    } catch {
      return node;
    }
  }

  /**
   * 空快照（会话不存在 / 事件流不可读 / 未选会话）。
   * @param threadId 会话 id。
   * @param error 快照级错误（可选；有值时 UI 必须显示错误）。
   * @returns 零车道快照。
   */
  private static empty(threadId: string, error?: string): FleetSnapshot {
    return {
      parentSessionId: threadId,
      nodes: [],
      runningCount: 0,
      collectedAt: new Date().toISOString(),
      ...(error !== undefined ? { error } : {}),
    };
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
