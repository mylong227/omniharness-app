/**
 * JSON-RPC 错误码分类单一真源（2026-11-19 遗留清偿：错误码位化）。
 *
 * 后端有两个错误→码位映射点（appServer 的 WS 分发与 httpBridgeTransport 的 HTTP 路径），
 * 此前各自硬编码 -32000，且「调用方参数问题」与「服务端内部故障」同码——排查时无法区分
 * 是谁的问题。本模块把分类收敛为一处，码位全部采用 **JSON-RPC 2.0 / 自定义服务端区间**
 * 的标准语义：
 *
 *   · `-32700` parse error / `-32601` method not found（appServer 既有，不在此处）；
 *   · `-32602` invalid params —— **调用方参数问题**（域模块约定形态：「X 需要 Y」参数缺失、
 *     「未找到 X」资源不存在、「X 拒绝…」校验拒绝）；
 *   · `-32002` 服务端等待超时（桥接 60s 窗，回合可能仍在后台继续——前端 failureHint 据此
 *     给「可继续等待/中止」提示，2026-09-27 案例的协议面锚点）；
 *   · `-32000` 其它服务端错误（兜底）。
 *
 * 纯函数、零依赖——appServer（WS）与 httpBridgeTransport（HTTP）同源消费，前端
 * `RpcError.code` 透传后按码位分类（文案与判定解耦）。
 */

/** 服务端等待超时码（桥接窗口；前端「回合可能仍在后台继续」提示的协议锚点）。 */
export const SERVER_WAIT_TIMEOUT_CODE = -32002;

/** 调用方参数问题码（JSON-RPC 2.0 标准 Invalid params）。 */
export const INVALID_PARAMS_CODE = -32602;

/** 其它服务端错误码（兜底；与 -32001 未认证、-32601 方法不存在并列的既有口径）。 */
export const SERVER_ERROR_CODE = -32000;

/**
 * 调用方参数问题的消息形态（域模块约定：出错即抛这些前缀形态的 Error）。
 * 保守起见只认三类已被判据钉住的真实形态，不猜宽——漏网的继续落 -32000 兜底，
 * 宁可少分类也不误分类。注意「未找到」后直接跟资源名（如 `未找到图:xxx`），无空格。
 */
const CALLER_FAULT_RE = /^(?:[^：\n]{1,80} 需要 |未找到|[^：\n]{1,80} 拒绝)/;

/**
 * 把失败原因文本分类成 JSON-RPC 错误码（纯函数，便于单测）。
 * @param text 失败原因文本（Error.message）。
 * @returns `-32002` 等待超时 / `-32602` 调用方参数问题 / `-32000` 其它服务端错误。
 */
export function rpcErrorCodeFor(text: string): number {
  if (text.startsWith('RPC 超时')) return SERVER_WAIT_TIMEOUT_CODE;
  if (CALLER_FAULT_RE.test(text)) return INVALID_PARAMS_CODE;
  return SERVER_ERROR_CODE;
}
