// 工作流记忆召回（`[WorkflowMemory]`）系统事件的解析（纯逻辑，零 React 依赖）。
//
// 背景（2026-11-16 用户截图反馈）：内核在回合开始召回相似任务时，把「参考步骤」写成一条
// **单行** system 事件：
//   `[WorkflowMemory] 相似任务曾成功走完以下步骤（仅参考，不自动重放）：→ shell … → read_file …`
// 单行意味着「行数阈值」永远不触发，一行上千字的命令串会像一段没有格式的乱码横在对话里。
// 这里把它拆成「引导语 + 步骤数组」，交给折叠卡逐条排版（不再让用户读一串 `→`）。
//
// 编码形态与内核 `WorkflowMemoryRecorder.prime` 对齐：
//   `primeHeader` + 若干个 `primeStep`（`→ {step}`），步骤之间以空格分隔。
// 解析失败一律返回 null（fail-closed）——调用方回落到普通 sysnote / 长文注记渲染，绝不猜。

/** 解析结果：引导语与步骤（步骤已剥掉 `→` 前缀）。 */
export interface WorkflowMemoryParts {
  /** 引导语（`[WorkflowMemory]` 之后的说明句，可能为空串）。 */
  readonly preamble: string;
  /** 参考步骤（保持原顺序，至少一条）。 */
  readonly steps: readonly string[];
}

/** 工作流记忆召回事件的解析器。 */
export class WorkflowMemoryNote {
  /** 标记（内核 `HarnessTexts.workflow('primeHeader')` 的固定前缀）。 */
  private static readonly MARKER = '[WorkflowMemory]';

  /**
   * 判定并解析一条系统事件文本是否为工作流记忆召回。
   * @param content 系统事件 payload.content
   * @returns 解析结果；非召回事件 / 没有任何步骤时为 null
   */
  public static parse(content: string): WorkflowMemoryParts | null {
    if (!content) return null;
    const text = content.trim();
    if (!text.startsWith(this.MARKER)) return null;
    const body = text.slice(this.MARKER.length);
    // 步骤以 `→` 起头、内核以空格连接；按 `→` 切开即得「引导语 + 每步」。命令正文里出现
    // `→` 的概率极低（内核只记录 工具名 + 目标摘要），真出现也只多切一段，不丢内容。
    const chunks = body.split('→').map((chunk) => chunk.trim());
    const steps = chunks.slice(1).filter((chunk) => chunk !== '');
    if (steps.length === 0) return null;
    return { preamble: chunks[0] ?? '', steps };
  }
}
