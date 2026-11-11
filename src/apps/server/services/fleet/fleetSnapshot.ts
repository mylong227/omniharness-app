/**
 * 编队快照类型（`fleet.list` RPC 的返回体）。
 *
 * 数据来源与诚实边界（设计 §4.2 / §4.6，全部**只读**）：
 *  - 车道从**父会话事件流**解析：`tool_call(name='subagent')` 是派生事实，
 *    对应 `tool_result` 是回传事实——不依赖内核内部编排器实例（alpha.16 不暴露它）。
 *  - 运行中车道（有 tool_call 无 tool_result）的步数 / token / 改动**未知**：
 *    子代理事件只进内存桥，结束后才落盘，运行态对这些字段一律 `undefined`，绝不填 0 冒充。
 *  - `truncated` / `aborted` / `writesUnrecoverable` 原样透传，**不得渲染成成功**。
 */

/** 单条编队车道状态（显式枚举，前端按值选文案与色点）。 */
export type FleetStatus = 'queued' | 'running' | 'ok' | 'failed' | 'aborted' | 'truncated';

/** 一条子代理车道（父会话事件流里的一次 subagent 派生）。 */
export interface FleetNode {
  /** 子会话 id（tool_result 回传后才有；运行中为 undefined）。 */
  readonly childSessionId?: string;
  /** 工具调用 id（运行中即可用于 `fleet.cancel`；结果回传后仍保留）。 */
  readonly callId?: string;
  /** 父会话 id（即请求的 threadId）。 */
  readonly parentSessionId: string;
  /** 一句话任务原文（tool_call 的 args.task）。 */
  readonly task: string;
  /** 状态（truncated / aborted 优先于 ok，见设计 §4.6）。 */
  readonly status: FleetStatus;
  /** 开始时刻（tool_call 事件时间戳，ISO 8601）。 */
  readonly startedAt: string;
  /** 结束时刻（tool_result 事件时间戳；运行中 undefined）。 */
  readonly endedAt?: string;
  /** 步数（结果回传文本；运行中 / 未回传 undefined = 未上报，不填 0）。 */
  readonly steps?: number;
  /** 耗时毫秒（结果回传文本；运行中 undefined）。 */
  readonly durationMs?: number;
  /** 模型 token 用量（内核未在结果文本中上报 ⇒ 恒 undefined；保留字段供后续内核版本回传）。 */
  readonly tokens?: number;
  /** 改动文件（结果文本的改动清单；运行中 / 无改动 undefined）。 */
  readonly changedFiles?: readonly string[];
  /** patch 工件的工作区相对路径（`.omniharness/subagent-patches/<id>.patch`）。 */
  readonly patchPath?: string;
  /** patch 字节数（来自磁盘 stat；patch 文件不在时 undefined）。 */
  readonly patchBytes?: number;
  /** patch 是否被截断（清单仍完整）。 */
  readonly patchTruncated?: boolean;
  /** 改动采集失败：改动确实存在但取不回（fail-closed 标记，绝不静默）。 */
  readonly writesUnrecoverable?: boolean;
  /** copy 降级档禁写：写类工具被禁用，改动不可能存在。 */
  readonly writesForbidden?: boolean;
  /** 隔离方式：worktree（git 分支隔离）或 copy（整目录拷贝降级）。 */
  readonly isolation: 'worktree' | 'copy';
  /** 验证状态（内核口径：`unverified` 不得读成通过）。 */
  readonly verificationState?: 'not-run' | 'failed' | 'unverified' | 'passed';
  /** 失败 / 取消原因（status=failed/aborted 时的可读文案）。 */
  readonly error?: string;
  /** 该子会话是否已有持久化轨迹存档（详情「查看轨迹」可用性）。 */
  readonly traceAvailable?: boolean;
}

/** 编队快照（`fleet.list` 返回体）。 */
export interface FleetSnapshot {
  /** 父会话 id。 */
  readonly parentSessionId: string;
  /** 车道列表（按开始时间升序）。 */
  readonly nodes: readonly FleetNode[];
  /** 是否仍有子代理在跑（running / queued 行数 > 0）。 */
  readonly runningCount: number;
  /** 快照采集时刻（ISO 8601）。 */
  readonly collectedAt: string;
  /** 事件流不可读等快照级错误；有值时 `nodes` 为空，UI 必须显示错误而不是「没有子代理」。 */
  readonly error?: string;
}
