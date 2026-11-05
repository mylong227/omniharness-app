/**
 * 30 行嵌入示例：不依赖 CLI / Web，把完整 OmniHarness 服务端嵌进你的 Node 进程。
 *
 * 运行（本仓内，先 `npm run build`）：
 *   node examples/embed-demo.mjs
 * 或 `npm run example:embed`。
 *
 * 演示三件事：
 *   1. `createOmniHarness` 一次调用起服务（http 模式，带 token 门禁）；
 *   2. `defineModule` 加一个自定义 RPC 能力（与内置 92 个方法同权注册，同名冲突启动即抛错）；
 *   3. `rpc.list` 自描述内省 —— 不翻源码就知道服务端提供什么。
 */
import { createOmniHarness, defineModule } from '../dist/src/index.js';

// ① 自定义模块：一个 echo 能力（这就是「加能力 = 1 个文件」的嵌入方形态）
const pingModule = defineModule({
  name: 'demo.ping',
  register(ctx) {
    ctx.rpc('demo.ping', async (params) => ({
      ok: true,
      echo: params['text'] ?? '',
      at: new Date().toISOString(),
    }));
  },
});

// ② 起服务：缺省 MockModel（零凭据可跑）；要接真厂商传 model: new OpenAiCompatibleModel(...)
const harness = await createOmniHarness({
  transport: { http: { port: 0 } }, // 0 = 由 OS 分配端口
  modules: [pingModule],
});
process.stdout.write(`工作台: ${harness.url}\n`);

// ③ 调用：rpc.list 自描述 + 自定义方法（与内置方法同一分发路径）
const token = new URL(harness.url).searchParams.get('token');
const rpc = async (method, params) => {
  const response = await fetch(`${harness.url.split('/?')[0]}/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return (await response.json()).result;
};
const list = await rpc('rpc.list', {});
process.stdout.write(`服务端提供 ${String(list.count)} 个 RPC 方法（示例: ${list.methods[0].method} ← ${list.methods[0].owner}）\n`);
process.stdout.write(`自定义方法: ${JSON.stringify(await rpc('demo.ping', { text: '你好，内核' }))}\n`);

// ④ 优雅收尾（取消在跑回合 → 关服务器）
await harness.close();
process.stdout.write('已收尾 ✔\n');
