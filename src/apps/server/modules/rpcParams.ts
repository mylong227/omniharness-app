// RPC 模块层的入参提取助手（2026-11-20 批次三从 control.ts/surface.ts 收口）：
// 各域模块共享同一套「宽容取参」实现，避免每个新模块再抄一份。

/**
 * 取字符串参数（缺省空串——服务层按「未选会话」处理）。
 * @param raw 原始参数值
 * @returns 字符串；非字符串时为空串
 */
export function stringOf(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

/**
 * 取数字参数（回合下标；非法值由服务层报 proof_invalid，不在此猜默认值）。
 * @param raw 原始参数值
 * @returns 数字；非有限数时为 NaN（透传给服务层校验）
 */
export function numberOf(raw: unknown): number {
  return typeof raw === 'number' ? raw : Number.NaN;
}

/**
 * 取标签数组（只保留字符串项；非数组返回 undefined）。
 * @param raw 原始参数
 * @returns 标签数组或 undefined
 */
export function tagsOf(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((item): item is string => typeof item === 'string');
}
