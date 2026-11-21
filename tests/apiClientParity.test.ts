import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coreModules } from '../src/apps/server/modules/index.ts';
import type { ServerModuleContext } from '../src/apps/server/core/serverModule.ts';
import type { ServerServices } from '../src/apps/server/core/serverServices.ts';

/**
 * Web 客户端 ↔ 后端 RPC 面**漂移守卫**。
 *
 * 方向性：客户端每个 `this.rpc('X', …)` 字面量都必须是**后端真实存在**的方法
 * ——「客户端调到不存在的方法」是真机 404 缺陷（后端多出方法而客户端没跟上是信息差，不拦）。
 * 与 `serverModulesParity.test.ts`（后端全集钉子）互补，共同构成协议面的双向护栏。
 *
 * W4 域拆分（2026-11-21）：字面量自 `core/ApiClient.ts` 单体迁到 `core/api/<domain>Api.ts`
 * 各域类（统一入口只留 `rpc()` 本体，不再有业务字面量）。提取源随之扩为**目录**——
 * 漏扫目录会让本判据静默退化成 0 条（假绿），是拆域时最先要同步的地方。
 */

/** 后端当前全量方法（与 parity 快照同一来源）。 */
function backendMethods(): string[] {
  const out: string[] = [];
  for (const module of coreModules()) {
    const ctx: ServerModuleContext = {
      services: { options: { registry: {} } } as unknown as ServerServices,
      rpc: (method) => out.push(method),
      notify: () => undefined,
      messageOf: (error) => String(error),
    };
    module.register(ctx);
  }
  return out;
}

/** 抹掉注释：避免文档示例里的 `this.rpc('x.y')` 被当作真实调用（原单体文件同样有此风险）。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

/** 客户端 RPC 字面量的提取源：ApiClient 本体 + core/api/ 各域类。 */
function clientSources(): string[] {
  const dir = resolve('web/src/core/api');
  return [
    readFileSync(resolve('web/src/core/ApiClient.ts'), 'utf8'),
    ...readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .sort()
      .map((name) => readFileSync(join(dir, name), 'utf8')),
  ];
}

/** 从客户端源码提取 `this.rpc('X'` 的全部方法字面量（单/双引号/模板串均收）。 */
function clientMethods(): string[] {
  const out = clientSources().flatMap((source) => [
    ...stripComments(source).matchAll(
      /this\.rpc(?:HandleErrors)?[<(]?\s*(['"`])([a-z]+\.[a-zA-Z.]+)\1/g,
    ),
  ]).map((m) => m[2]!);
  return [...new Set(out)];
}

describe('ApiClient ↔ 后端 RPC 漂移守卫', () => {
  const backend = new Set(backendMethods());
  const client = clientMethods();

  it('客户端调用的每个方法都在后端存在（调不存在的方法 = 真机 404 缺陷）', () => {
    const phantom = client.filter((method) => !backend.has(method));
    expect(
      phantom,
      '客户端调用了后端不存在的方法——后端删改 RPC 时必须同步 web/src/core/api/<domain>Api.ts',
    ).toEqual([]);
  });

  it('客户端确实覆盖了大部分方法面（覆盖快照，防大面积脱钩；有意识地增减并更新数字）', () => {
    expect(client.length).toBeGreaterThanOrEqual(80);
    const covered = client.filter((method) => backend.has(method)).length;
    expect(covered).toBe(client.length);
  });
});
