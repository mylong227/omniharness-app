// web 端 localStorage/sessionStorage 键注册表（2026-11-20 批次五 5.3）。
//
// 为什么收口：15 个键此前靠 `omni-*` 前缀惯例各自声明，其中「厂商目录缓存」三键在
// AppController（写）与 LayoutController（读）两处字面量各写一份——改键名要跨文件人肉
// 同步。本文件是**键名单一真源**；值语义（真源归属：服务端派生缓存 / 本机偏好 / 本机
// 数据 / 会话态）随键注释说明，不再集中改道。
//
// 定位说明（2026-11-20 深研结论）：12 个键已是「谁的键谁管」的正确形态，不整体集中；
// theme/theme-scheme 上收用户级配置需内核 FileConfig 加键（vendored 固定形状，等 R 轮）。

/** 服务端派生缓存：可用模型清单（catalog RPC 返回前首屏回落）。 */
export const MODEL_OPTIONS = 'omni-model-options';
/** 服务端派生缓存：当前厂商展示名。 */
export const PROVIDER_LABEL = 'omni-provider-label';
/** 服务端派生缓存：每模型推理档位表（adaptive-reasoning）。 */
export const EFFORTS_BY_MODEL = 'omni-efforts-by-model';
