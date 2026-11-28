// 错误文案单源（2026-11-28 评审收编）：`e instanceof Error ? e.message : String(e)` 此前
// 全仓 31 处 / 18 文件各写一份——兜底口径一旦要改（比如加错误码前缀）就得改 31 处。
// 放 core 层：core/ApiClient 与 ui/* 都可依赖（不构成 core→ui 反向依赖）。

/**
 * 任意 unknown 错误 → 用户可读文案：Error 取 message，其余 String 化。
 * @param cause 捕获到的 unknown
 * @returns 文案
 */
export function errorMessageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
