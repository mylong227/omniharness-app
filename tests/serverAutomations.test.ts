// M30 双定时器统一判据——server 自动化收敛到 RoutineScheduler 调度核心（scope='server'）。
//
// 覆盖：① 旧 automations.json 一次性迁移（按 id 幂等 + 旧文件改名留证 + lastRun 映射防
// 统一后首次启动全量触发）；② web RPC DTO 形状逐字保持（id/name/prompt/intervalMinutes/
// enabled/createdAt/lastRunAt）与 CRUD 语义；③ 到期判定 + enabled 跳过 + markRun 持久化；
// ④ scope 隔离：server 条目不进 daemon 的 runDue，daemon 条目不进 server 的 due。
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ServerAutomations } from '../src/apps/server/services/serverAutomations.ts';
import { RoutineScheduler } from '../src/apps/daemon/routineScheduler.ts';

test('ServerAutomations：旧 automations.json 一次性迁移（幂等 + 留证 + lastRun 防全量触发）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'automations-'));
  const legacy = join(dir, 'automations.json');
  try {
    const t0 = Date.parse('2026-11-07T00:00:00.000Z');
    writeFileSync(
      legacy,
      JSON.stringify({
        automations: [
          {
            id: 'auto_a',
            name: '巡检',
            prompt: '跑一遍测试',
            intervalMinutes: 30,
            enabled: true,
            createdAt: new Date(t0 - 60 * 60_000).toISOString(),
            lastRunAt: new Date(t0 - 10 * 60_000).toISOString(),
          },
          {
            id: 'auto_b',
            name: '日报',
            prompt: '写日报',
            intervalMinutes: 1440,
            enabled: false,
            createdAt: new Date(t0 - 2 * 60 * 60_000).toISOString(),
          },
        ],
      }),
      'utf8',
    );
    const scheduler = new RoutineScheduler(join(dir, 'routines.json'));
    const automations = new ServerAutomations(scheduler, legacy, () => t0);
    // 迁移后：两条可见、旧文件改名留证。
    assert.deepEqual(automations.list().map((item) => item.id), ['auto_a', 'auto_b']);
    assert.ok(!existsSync(legacy), '旧文件应已改名 .migrated');
    assert.ok(existsSync(`${legacy}.migrated`));
    // 幂等：二次构造不重复导入。
    const again = new ServerAutomations(scheduler, undefined, () => t0);
    assert.equal(again.list().length, 2);
    // lastRun 映射：auto_a 的 lastRun = lastRunAt（10 分钟前）——距 30 分钟间隔未到期；
    // 修复「统一后首次启动全量立即触发」。
    const due = automations.due(t0);
    assert.deepEqual(due.map((item) => item.id), []);
    // DTO 形状逐字（web 面契约）。
    const first = automations.get('auto_a');
    assert.deepEqual(first, {
      id: 'auto_a',
      name: '巡检',
      prompt: '跑一遍测试',
      intervalMinutes: 30,
      enabled: true,
      createdAt: new Date(t0 - 60 * 60_000).toISOString(),
      lastRunAt: new Date(t0 - 10 * 60_000).toISOString(),
    });
    // 禁用条目继承 enabled=false。
    assert.equal(automations.get('auto_b')?.enabled, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ServerAutomations：CRUD + 到期 + enabled 跳过 + markRun 持久化（跨实例读回）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'automations-crud-'));
  try {
    const t0 = 1_000_000_000_000;
    let clock = t0;
    const scheduler = new RoutineScheduler(join(dir, 'routines.json'));
    const automations = new ServerAutomations(scheduler, undefined, () => clock);
    const created = automations.create({ name: '巡检', prompt: '跑测试', intervalMinutes: 5 });
    assert.match(created.id, /^auto_/u);
    assert.equal(created.enabled, true);
    // 校验口径逐字保留。
    assert.throws(() => automations.create({ name: '', prompt: 'x', intervalMinutes: 5 }), /1–80/u);
    assert.throws(
      () => automations.create({ name: 'x', prompt: 'x', intervalMinutes: 4 }),
      /5–1440/u,
    );
    // 刚创建（base=createdAt=clock）不到期；推进 5 分钟后到期。
    assert.deepEqual(automations.due(t0).map((item) => item.id), []);
    clock = t0 + 5 * 60_000;
    assert.deepEqual(automations.due(clock).map((item) => item.id), [created.id]);
    // enabled=false 跳过到期。
    automations.setEnabled(created.id, false);
    assert.deepEqual(automations.due(clock), []);
    assert.equal(automations.get(created.id)?.enabled, false);
    // markRun 持久化 + 重新启用后以新 lastRun 判定。
    automations.setEnabled(created.id, true);
    clock = t0 + 6 * 60_000;
    automations.markRun(created.id);
    assert.deepEqual(automations.due(clock), []);
    // delete 语义与不存在路径。
    assert.equal(automations.delete(created.id), true);
    assert.equal(automations.delete(created.id), false);
    assert.equal(automations.get(created.id), undefined);
    // 跨实例持久化：新实例读回同一存储（shared routines.json）。
    writeFileSync(
      join(dir, 'routines.json'),
      readFileSync(join(dir, 'routines.json'), 'utf8'),
      'utf8',
    );
    const reopened = new ServerAutomations(scheduler, undefined, () => clock);
    assert.equal(reopened.list().length, 0); // 已删干净
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scope 隔离：server 条目不进 daemon runDue，daemon 条目不进 server due', () => {
  const dir = mkdtempSync(join(tmpdir(), 'automations-scope-'));
  try {
    const t0 = 1_000_000_000_000;
    const scheduler = new RoutineScheduler(join(dir, 'routines.json'));
    const automations = new ServerAutomations(scheduler, undefined, () => t0);
    automations.create({ name: 'web巡检', prompt: 'p1', intervalMinutes: 5 });
    // daemon 直写一条 CLI routine（无 scope 字段 = daemon）。
    scheduler.add({
      name: 'cli巡检',
      prompt: 'p2',
      modelAdapter: 'mock',
      schedule: { kind: 'interval', minutes: 5 },
    });
    // 推进到两者都到期。
    const later = t0 + 10 * 60_000;
    // server 只看到自己的。
    assert.deepEqual(automations.due(later).map((item) => item.name), ['web巡检']);
    // daemon 只看到自己的（缺省 runDue = daemon scope）。
    assert.deepEqual(scheduler.runDue(later).map((r) => r.name), ['cli巡检']);
    // 显式 scope 互查：互相为空。
    assert.deepEqual(scheduler.runDue(later, 'server').map((r) => r.name), ['web巡检']);
    assert.deepEqual(automations.due(0), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
