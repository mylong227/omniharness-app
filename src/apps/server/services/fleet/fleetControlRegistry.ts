import type { ToolCall, ToolContext, ToolDefinition, ToolPort, ToolResult } from '../../../../host/kernel/contracts.ts';

/** 一条正在执行的子代理工具调用（取消句柄 + 观测信息）。 */
export interface FleetActiveCall {
  /** 工具调用 id（与事件流 `tool_call.callId` 同值）。 */
  readonly callId: string;
  /** 父会话 id。 */
  readonly parentSessionId: string;
  /** 任务原文（取不到为空串）。 */
  readonly task: string;
  /** 开始时刻（ISO 8601）。 */
  readonly startedAt: string;
}

/** 取消结果。 */
export type FleetCancelResult =
  | { readonly ok: true; readonly callId: string }
  | { readonly ok: false; readonly code: 'call_not_found'; readonly message: string };

/** 运行中的子代理取消令牌表。 */
export class FleetControlRegistry {
  /** callId → 控制器与父信号解绑函数。 */
  private readonly active = new Map<
    string,
    { readonly controller: AbortController; readonly detach: () => void; readonly info: FleetActiveCall }
  >();

  /**
   * 登记一次 subagent 调用，返回与父取消信号联动的子信号。
   * @param call 工具调用（只读 callId / task）。
   * @param context 工具上下文（父取消信号）。
   * @returns 子调用信号（父取消或 {@link cancel} 时 abort）。
   */
  public begin(call: ToolCall, context: ToolContext): AbortSignal {
    const controller = new AbortController();
    const parent = context.signal;
    const onAbort = (): void => controller.abort();
    if (parent?.aborted === true) controller.abort();
    else parent?.addEventListener('abort', onAbort, { once: true });
    const task = FleetControlRegistry.taskOf(call);
    this.active.set(call.id, {
      controller,
      detach: () => parent?.removeEventListener('abort', onAbort),
      info: {
        callId: call.id,
        parentSessionId: context.sessionId,
        task,
        startedAt: new Date().toISOString(),
      },
    });
    return controller.signal;
  }

  /**
   * 注销一次调用（成功/失败/取消后都必须调用，防表泄漏）。
   * @param callId 工具调用 id。
   * @returns 无
   */
  public finish(callId: string): void {
    const entry = this.active.get(callId);
    if (entry === undefined) return;
    entry.detach();
    this.active.delete(callId);
  }

  /**
   * 取消一条正在跑的子代理。
   * @param callId 工具调用 id（来自 `fleet.list` 车道的 callId）。
   * @returns 取消结果；已结束/未知返回 `call_not_found`。
   */
  public cancel(callId: string): FleetCancelResult {
    const entry = this.active.get(callId);
    if (entry === undefined) {
      return {
        ok: false,
        code: 'call_not_found',
        message: '这个子代理已不在运行列表里；可能已经结束。',
      };
    }
    entry.controller.abort();
    return { ok: true, callId };
  }

  /**
   * 当前登记中的调用快照（观测/测试用）。
   * @returns 活跃调用列表（按登记顺序）。
   */
  public list(): readonly FleetActiveCall[] {
    return [...this.active.values()].map((entry) => entry.info);
  }

  /**
   * 提取任务原文。
   * @param call 工具调用。
   * @returns 任务文本；缺失为空串。
   */
  private static taskOf(call: ToolCall): string {
    const args = call.arguments as { task?: unknown } | undefined;
    return typeof args?.task === 'string' ? args.task : '';
  }
}

/**
 * Fleet 感知的工具端口包装：只在 `subagent` 调用上注入可单独取消的 AbortSignal，其余原样委托。
 *
 * 为什么要包在工具端口层：内核 `SubagentTool` 只接收 `ToolContext.signal`，而 app 拿不到内部
 * `SubagentOrchestrator`；包装 `execute` 是唯一能在不修改内核的前提下，为每次调用建立独立取消令牌的
 * 应用层接缝。父取消信号仍会联动（不会因为单独取消能力而丢掉原有传播）。
 */
export class FleetToolPort implements ToolPort {
  /** 端口名（沿用被包装端口，避免下游按 name 分流时改变行为）。 */
  public readonly name: string;

  /** 被包装的工具端口。 */
  private readonly inner: ToolPort;

  /** 取消令牌表。 */
  private readonly control: FleetControlRegistry;

  /**
   * @param inner 原工具端口
   * @param control 子代理取消令牌表
   */
  public constructor(inner: ToolPort, control: FleetControlRegistry) {
    this.inner = inner;
    this.control = control;
    this.name = inner.name;
  }

  /** @inheritdoc */
  public list(): readonly ToolDefinition[] {
    return this.inner.list();
  }

  /** @inheritdoc */
  public listDirect(): readonly ToolDefinition[] {
    return this.inner.listDirect?.() ?? this.inner.list();
  }

  /** @inheritdoc */
  public unregister(name: string): boolean {
    return this.inner.unregister?.(name) ?? false;
  }

  /** @inheritdoc */
  public lastFailure(sessionId: string): string | undefined {
    return this.inner.lastFailure?.(sessionId);
  }

  /**
   * 执行工具；subagent 调用获取独立取消信号，结束后注销。
   * @param call 工具调用
   * @param context 工具上下文
   * @returns 工具结果
   */
  public async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    if (call.name !== 'subagent') return this.inner.execute(call, context);
    const signal = this.control.begin(call, context);
    try {
      return await this.inner.execute(call, { ...context, signal });
    } finally {
      this.control.finish(call.id);
    }
  }
}
