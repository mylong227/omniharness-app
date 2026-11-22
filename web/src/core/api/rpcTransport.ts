/** ApiClient 对域对象暴露的传输面（W4 域拆分）：统一 JSON-RPC 入口的**可调用函数型**——
 * 域类 `this.rpc('x.y', params)` 直呼形态保留（apiClientParity 按该字面量提取）；错误分类、
 * 鉴权头与 nextId 仍归 ApiClient 本体（构造时以泛型箭头绑定 `this.rpc`）。 */
export type ApiTransport = <T = unknown>(
  method: string,
  params?: Record<string, unknown>,
) => Promise<T>;
