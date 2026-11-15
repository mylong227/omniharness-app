/**
 * Harness 启动失败的可展示细节（原因 + 最近输出）。
 *
 * ## 为什么需要（2026-11-14 用户报障）
 *
 * 安装版启动失败时，对话框只有一句「本地 Harness 未能启动 / 等待就绪超时（30000ms）」，
 * 真正的原因（例如侧车打不开用户配置里的 DPAPI 凭据、退出码 1）只写在
 * `harness-YYYY-MM-DD.log` 里。用户看到的「启动报错」因此无法自查，排障只能靠翻日志。
 *
 * 侧车 stdout/stderr 本来就会逐行进日志；这里把**最近若干行**随启动失败的异常一起带出来，
 * 由主进程拼进对话框详情。纯值对象：不读文件、不依赖 Electron，可在 node 测试里直接覆盖。
 */

/** Harness 启动失败（携带可展示的最近输出）。 */
export class HarnessStartFailure extends Error {
  /** 对话框里最多展示的输出行数。 */
  private static readonly OUTPUT_LINES = 20;
  /** 单行最长字符数（侧车可能打印整段 PowerShell 堆栈）。 */
  private static readonly LINE_CHARS = 400;

  /** 失败原因（不含输出块）。 */
  public readonly reason: string;
  /** 侧车最近输出的截断副本（已按行去空）。 */
  private readonly output: readonly string[];

  /**
   * @param reason 失败原因。
   * @param output 侧车最近输出（按发生顺序）。
   */
  public constructor(reason: string, output: readonly string[]) {
    super(reason);
    this.name = 'HarnessStartFailure';
    this.reason = reason;
    this.output = HarnessStartFailure.clip(output);
  }

  /**
   * 生成对话框/日志用的详情文本。
   *
   * 非 `HarnessStartFailure` 的异常只返回错误消息，保持旧行为。
   * @param error 捕获到的异常。
   * @param outputLabel 输出块标题（跟随界面语言）。
   * @returns 可直接放进 dialog detail 的文本。
   */
  public static describe(error: unknown, outputLabel: string): string {
    const message = HarnessStartFailure.messageOf(error);
    if (!(error instanceof HarnessStartFailure) || error.output.length === 0) return message;
    return `${error.reason}\n\n${outputLabel}：\n${error.output.join('\n')}`;
  }

  /**
   * 只取失败原因（写单行日志用）。
   * @param error 捕获到的异常。
   * @returns 失败原因文本。
   */
  public static reasonOf(error: unknown): string {
    return error instanceof HarnessStartFailure
      ? error.reason
      : HarnessStartFailure.messageOf(error);
  }

  /**
   * 解析异常消息。
   * @param error 捕获到的异常。
   * @returns 消息文本。
   */
  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * 截断输出：只留最后 N 行、逐行裁长度。
   * @param output 原始输出行。
   * @returns 截断后的只读副本。
   */
  private static clip(output: readonly string[]): readonly string[] {
    return output
      .slice(-HarnessStartFailure.OUTPUT_LINES)
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) =>
        line.length <= HarnessStartFailure.LINE_CHARS
          ? line
          : `${line.slice(0, HarnessStartFailure.LINE_CHARS)}…`,
      );
  }
}
