// 应用侧限制的 **env 轴**（2026-11-20 批次五 5.1）：内核 `limits` 段的类型是 vendored
// 固定形状（RuntimeLimitsConfig 七段），应用私有上限（附件/SSE 回放/预览/搜索/审计）
// 进不去——按内核既有「配置 > env > 出厂值」三通道里的 **env 通道**开轴
// （命名沿用 `OMNI_*` 约定；模块装载期快照一次，与内核 env 读取口径一致）。
// 进 `limits` 结构化段留内核 R 轮扩形状时再做（fail-closed 校验器在内核）。

/**
 * 读一个字节/条数型 env 旋钮。
 * @param name env 变量名（`OMNI_*`）
 * @param fallback 出厂默认值
 * @returns 非负整数；缺省/非法值回落出厂值
 */
function envLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** attach.read 单文件上限（出厂 20MB）。 */
export const ATTACH_FILE_MAX_BYTES = envLimit('OMNI_ATTACH_FILE_MAX_BYTES', 20 * 1024 * 1024);
/** attach.read 单次总字节上限（出厂 32MB）。 */
export const ATTACH_TOTAL_MAX_BYTES = envLimit('OMNI_ATTACH_TOTAL_MAX_BYTES', 32 * 1024 * 1024);
/** SSE 断线重放缓冲上限（出厂 8MB）。 */
export const SSE_HISTORY_MAX_BYTES = envLimit('OMNI_SSE_HISTORY_MAX_BYTES', 8 * 1024 * 1024);
/** 预览源响应上限（出厂 64MB）。 */
export const PREVIEW_SOURCE_MAX_BYTES = envLimit('OMNI_PREVIEW_SOURCE_MAX_BYTES', 64 * 1024 * 1024);
/** 工作区搜索访问条目上限（出厂 6000）。 */
export const SEARCH_MAX_VISITED = envLimit('OMNI_SEARCH_MAX_VISITED', 6000);
/** 审计源单文件上限（出厂 64MB）。 */
export const AUDIT_SOURCE_MAX_BYTES = envLimit('OMNI_AUDIT_SOURCE_MAX_BYTES', 64 * 1024 * 1024);
/** 审计目录展开文件数上限（出厂 2000）。 */
export const AUDIT_SOURCE_MAX_FILES = envLimit('OMNI_AUDIT_SOURCE_MAX_FILES', 2000);
/** 审计读取尾部窗口（出厂 64MB）。 */
export const AUDIT_READ_MAX_BYTES = envLimit('OMNI_AUDIT_READ_MAX_BYTES', 64 * 1024 * 1024);
