/**
 * 内核对接面 · runtime 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { ServiceKeys } from '@omniharness/kernel/kernel/composition/serviceKeys.js';
export { Runtime } from '@omniharness/kernel/kernel/composition/runtime.js';
export type { RpcMessage } from '@omniharness/kernel/contracts/ports/server/rpcMessage.js';
export type { RpcRequest } from '@omniharness/kernel/contracts/ports/server/rpcRequest.js';
export type { SdkSocket } from '@omniharness/kernel/contracts/ports/server/sdkSocket.js';
export type { Transport } from '@omniharness/kernel/contracts/ports/server/transport.js';
export { jsonRpc } from '@omniharness/kernel/kernel/rpc/jsonRpc.js';
export { SdkClient } from '@omniharness/kernel/kernel/rpc/sdkClient.js';
export { LineTransport } from '@omniharness/kernel/kernel/transport/lineTransport.js';
export { WebSocketSdkSocket } from '@omniharness/kernel/kernel/transport/webSocketSdkSocket.js';
export { WsConnection, WsServer } from '@omniharness/kernel/kernel/transport/wsConnection.js';
