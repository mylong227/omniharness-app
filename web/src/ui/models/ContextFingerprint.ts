// 上下文快照的内容指纹（2026-11-28 S-2 稳定化）。
//
// 为什么需要：ContextMode 的快照每 300ms tick 重取一次，服务端每次都回**新对象**——
// 内容没变引用也变，面板 527 行整树陪跑重渲染（构成条/数字每 tick 跳变一次）。
// 指纹把「内容是否真的变了」变成一个可比较的字符串：内容没变 ⇒ 上游可以复用旧引用，
// 下游 memo 分区天然跳过。指纹覆盖的**恰好是面板渲染的字段**——渲染读不到的字段
// 不进指纹（否则永不变化的字段会压住真实变化）。
//
// 纯函数、零 React：node 直测（web/test/contextFingerprint.test.ts）。

import type { ContextStudioSnapshotLike } from '../../types/models.ts';

/**
 * 计算上下文快照的内容指纹：覆盖面板渲染的全部字段（构成/缓存命中/内核策略/压缩切点/便签）。
 * @param snapshot 上下文快照
 * @returns 指纹串（同内容恒同串；任一渲染字段变化即变）
 */
export function contextFingerprintOf(snapshot: ContextStudioSnapshotLike): string {
  const parts: string[] = [
    snapshot.error ?? '',
    snapshot.report.source,
    String(snapshot.report.usedTokens),
    String(snapshot.report.windowTokens),
    String(snapshot.report.percent),
    ...snapshot.report.rows.map((row) => `${row.key ?? 'other'}:${row.tokens}:${row.percent}`),
    String(snapshot.report.cache.calls),
    snapshot.report.cache.hitRate === undefined ? '-' : String(snapshot.report.cache.hitRate),
    snapshot.kernel.retrievalContext.mode,
    snapshot.kernel.retrievalContext.rewriter,
    snapshot.kernel.retrievalContext.rerank,
    snapshot.kernel.semanticRecall.requested ? 'r1' : 'r0',
    snapshot.kernel.semanticRecall.active ? 'a1' : 'a0',
    snapshot.kernel.semanticRecall.degraded ? 'd1' : 'd0',
    snapshot.kernel.contextPolicy.shapersAggressive ? 's1' : 's0',
    snapshot.kernel.contextPolicy.compactionForce ? 'c1' : 'c0',
    snapshot.kernel.contextPolicy.cacheGuardFloor === undefined
      ? '-'
      : String(snapshot.kernel.contextPolicy.cacheGuardFloor),
    snapshot.handoffAvailable ? 'h1' : 'h0',
    String(snapshot.handoff.length),
    snapshot.handoff.length === 0
      ? ''
      : `${snapshot.handoff[snapshot.handoff.length - 1]!.id}:${snapshot.handoff[snapshot.handoff.length - 1]!.text.length}`,
    String(snapshot.compactions.length),
    ...snapshot.compactions.map((mark) =>
      [
        mark.at,
        String(mark.turnIndex),
        String(mark.compactedUpTo),
        mark.headHash,
        String(mark.summary.length),
        mark.audit === undefined ? 'no-audit' : `${mark.audit.ok}:${mark.audit.missing.length}`,
      ].join('~'),
    ),
  ];
  return parts.join('|');
}
