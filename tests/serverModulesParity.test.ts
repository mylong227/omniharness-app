import { describe, expect, it } from 'vitest';
import { coreModules } from '../src/apps/server/modules/index.ts';
import type { ServerModuleContext } from '../src/apps/server/core/serverModule.ts';
import type { ServerServices } from '../src/apps/server/core/serverServices.ts';

/**
 * RPC parity 快照 —— 模块化重构后的「方法全集钉子」。
 *
 * 为什么需要：91 个 RPC 方法曾散布 6 个层文件、协议 schema 只覆盖 8 个、Web 客户端手写镜像。
 * 模块化后方法清单有唯一出处（`coreModules()`），本快照保证：
 *  1. 任何新增/删除 RPC 都**有意识**地改这份快照（顺手同步 web/src/core/ApiClient.ts 与文档）；
 *  2. 永不出现同名方法被两个模块静默覆盖（registerModules 启动期也会抛错，这里是测试面镜像）。
 */

/** 用桩 services 走一遍 register，只收集方法名（闭包不会真的解引用服务）。 */
function collectMethods(modules: readonly { name: string; register(ctx: ServerModuleContext): void }[]): {
  method: string;
  owner: string;
}[] {
  const out: { method: string; owner: string }[] = [];
  const seen = new Map<string, string>();
  for (const module of modules) {
    const ctx: ServerModuleContext = {
      // 桩：只承载 `options`（plugins/automations 模块在 register 期读取一次）。
      // registry 给空对象（truthy）：市场 5 方法才会计数；闭包在调用期才会真正用到它。
      services: { options: { registry: {} } } as unknown as ServerServices,
      rpc: (method) => {
        const previous = seen.get(method);
        expect(previous, `方法 ${method} 被重复注册：${String(previous)} 与 ${module.name}`).toBeUndefined();
        seen.set(method, module.name);
        out.push({ method, owner: module.name });
      },
      notify: () => undefined,
      messageOf: (error) => String(error),
    };
    module.register(ctx);
  }
  return out;
}

describe('RPC parity 快照（coreModules）', () => {
  const entries = collectMethods(coreModules());
  const methods = entries.map((e) => e.method).sort();

  it('方法总数 == 92（重构基线 91 + rpc.list 内省；有意识地增减并同步 web ApiClient）', () => {
    expect(methods.length).toBe(92);
  });

  it('全量方法清单（按域前缀分组快照）', () => {
    expect(methods).toMatchInlineSnapshot(`
      [
        "agents.list",
        "approval.pending",
        "approval.respond",
        "approval.tiers",
        "attach.read",
        "audit.query",
        "automations.create",
        "automations.delete",
        "automations.list",
        "automations.run",
        "automations.setEnabled",
        "bundle.pack",
        "bundle.unpack",
        "changes.comments.add",
        "changes.comments.delete",
        "changes.comments.list",
        "changes.list",
        "changes.revertFile",
        "changes.revertHunk",
        "changes.stageFile",
        "changes.stageHunk",
        "checkpoint.create",
        "checkpoint.list",
        "checkpoint.rollback",
        "config.get",
        "config.update",
        "context.usage",
        "daemon.status",
        "doctor.report",
        "fs.browse",
        "fs.list",
        "fs.mkdir",
        "fs.read",
        "governance.history",
        "governance.rollbackTargets",
        "graph.delete",
        "graph.get",
        "graph.list",
        "graph.resume",
        "graph.run",
        "graph.save",
        "graph.status",
        "memory.add",
        "memory.delete",
        "memory.list",
        "memory.search",
        "memory.update",
        "model.catalog",
        "model.probe",
        "modes.get",
        "modes.set",
        "plugins.install",
        "plugins.list",
        "plugins.reload",
        "plugins.remove",
        "plugins.search",
        "profile.active",
        "profile.apply",
        "profile.delete",
        "profile.list",
        "profile.save",
        "question.pending",
        "question.respond",
        "quota.get",
        "quota.set",
        "rpc.list",
        "search.all",
        "sessions.archive",
        "sessions.delete",
        "sessions.fork",
        "sessions.list",
        "sessions.rename",
        "sessions.reorder",
        "sessions.setWorkspace",
        "skills.list",
        "threads.continue",
        "threads.create",
        "threads.fork",
        "threads.get",
        "threads.rewind",
        "trace.read",
        "turns.abort",
        "turns.interject",
        "turns.run",
        "turns.steer",
        "usage.stats",
        "vault.delete",
        "vault.list",
        "vault.set",
        "workspace.add",
        "workspace.list",
        "workspace.switch",
      ]
    `);
  });

  it('每族方法归属唯一模块（抽样核对台账）', () => {
    const byOwner = new Map(entries.map((e) => [e.method, e.owner]));
    expect(byOwner.get('threads.create')).toBe('threads');
    expect(byOwner.get('turns.run')).toBe('threads');
    expect(byOwner.get('approval.respond')).toBe('uplink');
    expect(byOwner.get('config.update')).toBe('config');
    expect(byOwner.get('automations.run')).toBe('automations');
    expect(byOwner.get('workspace.switch')).toBe('workspace');
    expect(byOwner.get('sessions.reorder')).toBe('sessions');
    expect(byOwner.get('context.usage')).toBe('surface');
    expect(byOwner.get('plugins.reload')).toBe('plugins');
    expect(byOwner.get('graph.resume')).toBe('graphs');
    expect(byOwner.get('memory.search')).toBe('memory');
    expect(byOwner.get('checkpoint.rollback')).toBe('checkpoints');
    expect(byOwner.get('changes.stageHunk')).toBe('review');
    expect(byOwner.get('trace.read')).toBe('observability');
    expect(byOwner.get('vault.set')).toBe('vault');
    expect(byOwner.get('governance.history')).toBe('governance');
    expect(byOwner.get('rpc.list')).toBe('introspect');
  });
});
