// 失败归因契约：RPC 超时/HTTP 异常**不得**退化成一句无归因的「RPC 错误」。
//
// 复现的缺陷（2026-09-27 用户截图）：
//   后端 `turns.run` 超过 60s 预算 → 超时 reject 冒泡 → httpServer 兜底写 `500 {"error":"internal"}`
//   → 前端 `ApiClient.rpc` 无条件读 `data.error.message`（`"internal"` 是字符串 ⇒ undefined）
//   → 界面只剩「运行失败：RPC 错误。可尝试切换模型或检查 API Key。」，真实的超时原因彻底丢失，
//     且把用户引向「换模型 / 查 API Key」这条错误方向。
//
// 这里钉住三件事：
//   ① HTTP 500 + 非 JSON-RPC 形状的 error ⇒ 报出 HTTP 状态，而不是「RPC 错误」；
//   ② JSON-RPC error 对象 ⇒ 原样报出服务端 message（含超时毫秒数）；
//   ③ 建议语按原因分流：超时给「回合可能仍在后台」而不是「换模型查 Key」。
// 直跑 web/dist（web:build 编译后），node --test web/test/*.test.mjs。

import assert from 'node:assert/strict';
import { test } from 'vitest';

const { ApiClient, RpcError, SERVER_WAIT_TIMEOUT_CODE, INVALID_PARAMS_CODE } = await import(
  '../src/core/ApiClient.ts'
);
const { ComposerController } = await import('../src/ui/controllers/ComposerController.ts');

/** 运行时导入的 RpcError 值的实例类型（静态 import type 会与解构绑定同名冲突）。 */
type RpcErrorInstance = InstanceType<typeof RpcError>;

/**
 * 用给定响应冒充 fetch，返回 ApiClient.rpc 抛出的错误消息（不抛则返回 null）。
 * @param res 冒充的 fetch 响应（形如 { ok, status, json }，在调用边界按 Response 收窄）
 * @returns 错误消息；未抛错则 null
 */
async function rpcError(res: unknown): Promise<string | null> {
  global.fetch = async () => res as unknown as Response;
  const api = new ApiClient();
  try {
    await api.rpc('turns.run', {});
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}

test('① HTTP 500 且 error 不是对象 ⇒ 报出 HTTP 状态（旧实现在此只给「RPC 错误」）', async () => {
  const msg = await rpcError({
    ok: false,
    status: 500,
    json: async () => ({ error: 'internal' }),
  });
  assert.ok(msg !== null, 'HTTP 失败必须抛错');
  assert.notEqual(msg, 'RPC 错误', '不得退化成无归因的「RPC 错误」');
  assert.match(msg, /HTTP 500/);
});

test('② JSON-RPC error 对象 ⇒ 原样报出服务端 message（超时毫秒数可见）', async () => {
  const msg = await rpcError({
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32002, message: 'RPC 超时（1800000ms）' },
    }),
  });
  assert.strictEqual(msg, 'RPC 超时（1800000ms）');
});

test('②b error 对象缺 message ⇒ 带上错误码，仍不留白', async () => {
  const msg = await rpcError({
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: '2.0', id: 1, error: { code: -32000 } }),
  });
  assert.match(String(msg), /-32000/);
});

test('②c fetch 拒答（网络不可达）⇒ RpcError kind=network，文案含原因', async () => {
  global.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  const api = new ApiClient();
  let thrown: unknown = null;
  try {
    await api.rpc('config.get', {});
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof RpcError, 'fetch 拒答必须抛 RpcError');
  assert.equal((thrown as RpcErrorInstance).kind, 'network');
  assert.match((thrown as Error).message, /无法连接服务端/);
});

test('②d fetchMetrics 同一分类口径：HTTP 失败 ⇒ http-status、拒答 ⇒ network', async () => {
  const api = new ApiClient();
  // HTTP 503 ⇒ kind=http-status（带 status）
  global.fetch = async () =>
    ({ ok: false, status: 503, json: async () => ({ error: 'internal' }) }) as unknown as Response;
  let thrown: unknown = null;
  try {
    await api.fetchMetrics();
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof RpcError, 'metrics HTTP 失败必须抛 RpcError');
  assert.equal((thrown as RpcErrorInstance).kind, 'http-status');
  assert.equal((thrown as RpcErrorInstance).status, 503);
  // fetch 拒答 ⇒ kind=network
  global.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  thrown = null;
  try {
    await api.fetchMetrics();
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof RpcError, 'metrics 网络失败必须抛 RpcError');
  assert.equal((thrown as RpcErrorInstance).kind, 'network');
});

test('③ 建议语按稳定分类分流（kind/status/code 驱动，不再匹配翻译后文案）', () => {
  // 桥接等待超时：后端协议码 -32002（结构化判定——en 词条变化不再让提示失效）。
  const timeoutHint = ComposerController.failureHint(
    new RpcError('rpc-error', 'RPC 超时（1800000ms）', undefined, SERVER_WAIT_TIMEOUT_CODE),
  );
  assert.match(timeoutHint, /后台|background/u);
  assert.doesNotMatch(timeoutHint, /API Key/u);

  // 调用方参数问题（-32602，后端域模块「X 需要 Y / 未找到 X / 拒绝」形态）：
  // 错误信息本身已说明缺什么——换模型/查 Key 都是误导（2026-11-19 遗留清偿）。
  const paramsHint = ComposerController.failureHint(
    new RpcError('rpc-error', 'graph.save 需要 def（含 name 与 steps）', undefined, INVALID_PARAMS_CODE),
  );
  assert.match(paramsHint, /参数|parameter/u);
  // 不得落进**通用**建议（其前缀是「可尝试切换模型」；本提示自带「无需切换模型」属否定语义，不算）
  assert.doesNotMatch(paramsHint, /可尝试切换模型|Try switching models/u);

  // HTTP 500：服务端错误 ⇒ 同一条「仍在后台」提示。
  const httpHint = ComposerController.failureHint(new RpcError('http-status', 'RPC 请求失败：HTTP 500', 500));
  assert.doesNotMatch(httpHint, /API Key/u);

  // 网络不可达 ⇒ 专属提示（不再落进误导性的「检查 API Key」）。
  const networkHint = ComposerController.failureHint(new RpcError('network', '无法连接服务端'));
  assert.match(networkHint, /服务端不可达|unreachable/u);
  assert.doesNotMatch(networkHint, /API Key/u);

  // 授权 ⇒ 指向 token 横幅。
  const authHint = ComposerController.failureHint(new RpcError('auth', '需要授权'));
  assert.match(authHint, /授权|authorization|token/u);

  // 其它协议错误（鉴权/模型报错）仍保留通用建议。
  const otherHint = ComposerController.failureHint(new RpcError('rpc-error', 'model rejected'));
  assert.match(otherHint, /API Key/u);
});

test('③b 文案兜底（非 RpcError 的旧式字符串/Error）：中止不提示、HTTP 5xx 判后台、未知给通用', () => {
  // 旧式字符串（2026-09-27 案例的历史形态）也按文案兜底——契约不回退。
  assert.doesNotMatch(ComposerController.failureHint('HTTP 500'), /API Key/u);
  // 缺省语言是中文：中止提示是全角句号（en 词条为 '.'，本文件不切语言）。
  assert.strictEqual(ComposerController.failureHint('操作已中止'), '。');
  assert.strictEqual(ComposerController.failureHint('Operation aborted'), '。');
  assert.match(ComposerController.failureHint('model rejected the request'), /API Key/u);
});
