// 上下文快照内容指纹判据（2026-11-28 S-2 稳定化）：
//  · 同内容 ⇒ 同指纹（tick 重取的新对象不影响 memo 复用）；
//  · 面板渲染的任一字段变化 ⇒ 指纹变（构成/来源/缓存命中/内核策略/压缩切点/便签/错误）；
//  · 面板不渲染的字段变化 ⇒ 指纹不变（collectedAt / threadId / handoff 旧条目增删文本长度之外的细节）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { contextFingerprintOf } from '../src/ui/models/ContextFingerprint.ts';
import type { ContextStudioSnapshotLike } from '../src/types/models.ts';

/** 造一份基线快照（形状对齐 types/models.ts 的 Like 接口）。 */
function snapshotOf(overrides: Partial<ContextStudioSnapshotLike> = {}): ContextStudioSnapshotLike {
  return {
    threadId: 's1',
    report: {
      threadId: 's1',
      windowTokens: 100000,
      usedTokens: 40000,
      percent: 40,
      rows: [
        { key: 'systemPrompt', label: '系统', tokens: 12000, percent: 30 },
        { key: 'messages', label: '对话', tokens: 20000, percent: 50 },
        { key: 'systemTools', label: '工具', tokens: 8000, percent: 20 },
      ],
      mcpToolCount: 2,
      systemToolCount: 12,
      source: 'measured',
      cache: { promptTokens: 90000, cachedPromptTokens: 45000, calls: 20, hitRate: 50 },
      collectedAt: '2026-11-28T00:00:00.000Z',
    },
    kernel: {
      retrievalContext: { mode: 'bm25', rewriter: 'off', rerank: 'off' },
      semanticRecall: { requested: false, active: false, degraded: false },
      contextPolicy: { shapersAggressive: false, compactionForce: false },
    },
    compactions: [],
    handoff: [],
    handoffAvailable: true,
    collectedAt: '2026-11-28T00:00:00.000Z',
    ...overrides,
  };
}

test('指纹：同内容（不同引用、不同 collectedAt）⇒ 同指纹', () => {
  const a = contextFingerprintOf(snapshotOf());
  const b = contextFingerprintOf(
    snapshotOf({ collectedAt: '2026-11-28T00:01:00.000Z', report: { ...snapshotOf().report, collectedAt: '2026-11-28T00:01:00.000Z' } }),
  );
  assert.strictEqual(a, b, '内容没变（哪怕引用与采集时间变了）必须同指纹');
});

test('指纹：面板渲染字段变化 ⇒ 指纹变（逐字段抽样）', () => {
  const base = contextFingerprintOf(snapshotOf());
  const cases: Partial<ContextStudioSnapshotLike>[] = [
    { report: { ...snapshotOf().report, usedTokens: 40001 } },
    { report: { ...snapshotOf().report, percent: 41 } },
    { report: { ...snapshotOf().report, source: 'estimated' } },
    { report: { ...snapshotOf().report, cache: { ...snapshotOf().report.cache, hitRate: 51 } } },
    { report: { ...snapshotOf().report, rows: [{ key: 'systemPrompt', label: '系统', tokens: 12001, percent: 30 }, ...snapshotOf().report.rows.slice(1)] } },
    { kernel: { ...snapshotOf().kernel, semanticRecall: { ...snapshotOf().kernel.semanticRecall, degraded: true } } },
    { kernel: { ...snapshotOf().kernel, retrievalContext: { ...snapshotOf().kernel.retrievalContext, rerank: 'model' } } },
    { compactions: [{ at: '2026-11-28T01:00:00.000Z', turnIndex: 3, compactedUpTo: 20, headHash: 'aa', summary: '摘要', auditRecorded: false }] },
    { handoff: [{ id: 'h1', text: '下一步 B', tags: [], createdAt: '2026-11-28T01:00:00.000Z', source: 'agent' }] },
    { handoffAvailable: false },
    { error: '事件流不可读' },
  ];
  for (let i = 0; i < cases.length; i++) {
    assert.notEqual(
      contextFingerprintOf(snapshotOf(cases[i]!)),
      base,
      `第 ${String(i)} 组渲染字段变化必须改变指纹`,
    );
  }
});

test('指纹：面板不渲染的字段变化 ⇒ 指纹不变（threadId / 更旧便签条目）', () => {
  const base = contextFingerprintOf(snapshotOf());
  const thread = contextFingerprintOf(snapshotOf({ threadId: 'OTHER' }));
  assert.strictEqual(thread, base, 'threadId 不在面板渲染面，不进指纹');
  const two = contextFingerprintOf(
    snapshotOf({
      handoff: [
        { id: 'h0', text: '旧便签', tags: [], createdAt: '2026-11-27T00:00:00.000Z', source: 'user' },
        { id: 'h1', text: '下一步 B', tags: [], createdAt: '2026-11-28T01:00:00.000Z', source: 'agent' },
      ],
    }),
  );
  const swapped = contextFingerprintOf(
    snapshotOf({
      handoff: [
        { id: 'h0x', text: '换了内容的更旧便签', tags: [], createdAt: '2026-11-27T00:00:00.000Z', source: 'user' },
        { id: 'h1', text: '下一步 B', tags: [], createdAt: '2026-11-28T01:00:00.000Z', source: 'agent' },
      ],
    }),
  );
  assert.strictEqual(swapped, two, '面板只读末条便签——更旧条目变化不影响指纹（长度与末条同）');
});
