// memory.facts 快照纯函数判据（2026-11-20，Memory Atlas 接入）：
// 图探测命中（卡透传 + 计数）/ 无图如实降级 supported:false / 取代语义字段（validTo）原样透传。
// 内核语义对照：temporalFactGraph.cards()（"调试/管理 UI 用"）+ activeSize(now) 的 `<=` 到点即失效。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { factsSnapshot } from '../src/apps/server/modules/memory.ts';

/** 造一个最小事实图桩（与 FileLongTermMemory.factGraph 的消费面同形；active 以 1500 为界）。 */
function graphOf(cards: readonly unknown[], active: number): object {
  return {
    cards: () => cards,
    size: () => cards.length,
    activeSize: (nowMs: number) => (nowMs >= 1500 ? active : 0),
  };
}

test('factsSnapshot：有图 → 卡透传 + total/active 计数', () => {
  const card = {
    factId: 'mem-1',
    subject: 'user',
    predicate: 'prefers',
    object: 'camelcase',
    text: '用户偏好 camelCase',
    validFrom: 100,
    validTo: undefined,
    trust: 'trusted',
  };
  const snap = factsSnapshot({ factGraph: graphOf([card], 1) }, 2000);
  assert.equal(snap.supported, true);
  assert.equal(snap.total, 1);
  assert.equal(snap.active, 1);
  assert.deepEqual(snap.cards, [card]);
});

test('factsSnapshot：无图（端口没带 factGraph）→ supported:false 如实降级', () => {
  assert.deepEqual(factsSnapshot({}, 2000), { supported: false, cards: [], total: 0, active: 0 });
  assert.deepEqual(factsSnapshot(undefined, 2000), { supported: false, cards: [], total: 0, active: 0 });
  // factGraph 显式 undefined（图被禁用）同口径。
  assert.deepEqual(factsSnapshot({ factGraph: undefined }, 2000), {
    supported: false,
    cards: [],
    total: 0,
    active: 0,
  });
});

test('factsSnapshot：activeSize 按传入 nowMs 裁决（取代/过期卡不计入 active）', () => {
  const graph = graphOf(
    [
      { factId: 'a', subject: 's', predicate: 'p', object: 'old', validFrom: 100, validTo: 1500 },
      { factId: 'b', subject: 's', predicate: 'p', object: 'new', validFrom: 1500 },
    ],
    1,
  );
  const before = factsSnapshot({ factGraph: graph }, 1000);
  assert.equal(before.active, 0, 'now < validTo 时 activeSize 桩返回 0');
  const after = factsSnapshot({ factGraph: graph }, 2000);
  assert.equal(after.active, 1, 'now 越过取代点后 active 归 1');
  // 取代语义字段原样透传（validTo 在卡上，UI 据此渲染「已被取代」）。
  assert.equal((after.cards[0] as { validTo?: number }).validTo, 1500);
});
