// SSE 事件路由（2026-11-20 批次六从 AppController 抽出）：method → 处理器的**纯分发表**。
//
// 为什么抽出来：AppController 组合根六职加一（SSE 分流），分流本体与「怎么处理」无关
// ——它只认识 method 名与处理器。抽出后分流逻辑在 node 里可直测（构造 handlers 桩即可
// 断言每个 method 路由到正确处理器），处理器的业务（单槽纪律 / 去抖 / toast）留在控制器。
//
// 归属注记：`memory.changed` 的 300ms 去抖在 handler 内实现（AppController.memoryChanged）。

import type { SseEnvelope, ThreadEvent } from '../../types/models.ts';

/** SSE 事件路由的处理器集合（AppController 提供实现）。 */
export interface StreamEventHandlers {
  /** thread.event：会话事件增量。 */
  threadEvent(event: ThreadEvent): void;
  /** approval.request：审批卡（单槽纪律在实现内）。 */
  approvalRequest(params: Record<string, unknown>): void;
  /** question.request：提问卡（单槽纪律在实现内）。 */
  questionRequest(params: Record<string, unknown>): void;
  /** memory.changed：记忆重载信号（去抖在实现内）。 */
  memoryChanged(): void;
  /** profile.event：插件集变更（重载信号）。 */
  profilesReload(): void;
  /** profile.applied：插件集应用完成（重载 + toast）。 */
  profileApplied(params: Record<string, unknown>): void;
  /** profile.error / plugin.loaded / plugin.loadError：提示族（method 原样传给实现）。 */
  profilePluginToast(method: string, params: Record<string, unknown>): void;
  /** thread.tool_input：工具输入增量。 */
  toolInput(params: Record<string, unknown>): void;
  /** thread.text_delta：文本增量。 */
  textDelta(params: Record<string, unknown>): void;
  /** graph.progress / graph.done：图运行进度（实现侧自行收窄为 GraphProgress/GraphDone）。 */
  graphProgress(params: unknown): void;
  graphDone(params: unknown): void;
}

/**
 * SSE 消息分流（纯函数）：按 method 调用对应处理器；未登记的 method 静默忽略
 * （服务端新增通知时旧前端不崩）。
 * @param msg SSE 信封
 * @param h 处理器集合
 * @returns 无返回值
 */
export function routeStreamMessage(msg: SseEnvelope, h: StreamEventHandlers): void {
  const params = msg.params as Record<string, unknown>;
  switch (msg.method) {
    case 'thread.event':
      h.threadEvent(params.event as ThreadEvent);
      break;
    case 'approval.request':
      h.approvalRequest(params);
      break;
    case 'question.request':
      h.questionRequest(params);
      break;
    case 'memory.changed':
      h.memoryChanged();
      break;
    case 'profile.event':
      h.profilesReload();
      break;
    case 'profile.applied':
      h.profileApplied(params);
      break;
    case 'profile.error':
    case 'plugin.loaded':
    case 'plugin.loadError':
      h.profilePluginToast(msg.method, params);
      break;
    case 'thread.tool_input':
      h.toolInput(params);
      break;
    case 'thread.text_delta':
      h.textDelta(params);
      break;
    case 'graph.progress':
      h.graphProgress(params);
      break;
    case 'graph.done':
      h.graphDone(params);
      break;
  }
}
