import { afterAll, describe, expect, it } from 'vitest';
import { createOmniHarness, defineModule, type OmniHarnessHandle } from '../src/apps/embed/createOmniHarness.ts';

/**
 * 嵌入 API 自动判据（2026-11-06 审计 #24 修）：本仓旗舰对接面此前只有手工样例
 * （examples/embed-demo.mjs），verify/CI 从不执行——「3 行跑起来」的承诺没有机检背书。
 * 这里直接以 vitest node 环境走一遍真实 HTTP 生命周期：boot → 自定义模块 → rpc.list →
 * 自定义 RPC → 优雅关闭（close 后 fetch 必须失败，证明端口真的释放）。
 */

let harness: OmniHarnessHandle | null = null;
const token = 'e2e-token-0123456789abcdef';

afterAll(async () => {
  if (harness !== null) await harness.close();
});

/** 带授权的 JSON-RPC 调用助手。 */
async function rpc<T>(h: OmniHarnessHandle, method: string, params: Record<string, unknown> = {}): Promise<T> {
  const origin = new URL(h.url!).origin;
  const res = await fetch(`${origin}/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error !== undefined) throw new Error(body.error.message ?? 'rpc error');
  return body.result as T;
}

describe('createOmniHarness（嵌入 API 生命周期）', () => {
  it('boot → 自定义模块注册 → rpc.list 自描述 → 自定义 RPC → close 后端口释放', async () => {
    harness = await createOmniHarness({
      transport: { http: { port: 0, token } },
      modules: [
        defineModule({
          name: 'test.echo',
          register(ctx) {
            ctx.rpc('test.echo', async (params) => ({ echo: params['text'] ?? '' }));
          },
        }),
      ],
    });
    expect(harness.url).toContain(`token=${token}`);
    expect(harness.port).toBeGreaterThan(0);

    // 自描述：内置 92 方法（无 registry 部署少 5 个市场方法 = 87）+ 本判据的自定义 1 个。
    // 自定义**模块**的方法归入 builtin 台账（owner = 模块名）；source:'plugin' 只属于
    // 插件运行时经 registerRpc 注册的方法（ctx.services.plugins.pluginRpcMethods）。
    const list = await rpc<{ count: number; methods: { method: string; owner: string; source: string }[] }>(
      harness,
      'rpc.list',
    );
    expect(list.count).toBeGreaterThanOrEqual(88);
    expect(list.methods.some((m) => m.method === 'rpc.list' && m.source === 'builtin')).toBe(true);
    expect(list.methods.some((m) => m.method === 'test.echo' && m.owner === 'test.echo')).toBe(true);

    // 自定义 RPC 与内置方法同一分发路径
    expect(await rpc(harness, 'test.echo', { text: '你好' })).toEqual({ echo: '你好' });

    // 优雅关闭：close 后同端口的 RPC 必须失败（端口真的释放，而非悬挂）
    const origin = new URL(harness.url!).origin;
    const port = harness.port!;
    await harness.close();
    harness = null;
    await expect(
      fetch(`${origin}/rpc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'rpc.list', params: {} }),
      }),
    ).rejects.toThrow();
    // 关闭后再起一个同端口服务验证可复用（端口确实交还 OS）
    const second = await createOmniHarness({ transport: { http: { port, token } } });
    const list2 = await rpc<{ count: number }>(second, 'rpc.list');
    expect(list2.count).toBeGreaterThan(0);
    await second.close();
  }, 60_000);
});
