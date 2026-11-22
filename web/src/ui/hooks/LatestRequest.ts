// 「后发必胜」请求代际守卫（W5，2026-11-22）。
//
// 同一份异步取数逻辑此前在多个 hook 里各写一遍 `const seq = ++seqRef.current` +
// `if (seq !== seqRef.current) return`（上下文工作室 / 编队 / 决策账本 ×2 / 变更 patch /
// 厂商目录）。判定三行、散落六处，每处都要记得在「禁用 / 切会话 / 收起」时作废在飞请求，
// 漏一处就是「迟到响应覆盖新状态」。本类把**票号 + 有效性判定 + 作废**收成单一实现。
//
// 用法：
// ```ts
// const request = useLatestRequest();
// const ticket = request.begin();
// const result = await load();
// if (!request.isCurrent(ticket)) return;  // 期间有人 begin()/invalidate() ⇒ 弃掉
// ```

import * as React from 'react';

/** 请求代际守卫（实例状态只要一个单调票号）。 */
export class LatestRequest {
  /** 最近一次发出的票号（0 = 从未发过）。 */
  private seq = 0;

  /** 开始一次新请求并拿到票号；此前所有票号立即失效。 */
  public begin(): number {
    this.seq += 1;
    return this.seq;
  }

  /**
   * 票号是否仍是当前票号。
   * @param ticket `begin()` 返回的票号
   * @returns 仍是当前请求则 true（false = 已被更新的请求或作废取代）
   */
  public isCurrent(ticket: number): boolean {
    return ticket === this.seq;
  }

  /** 作废全部在飞请求（禁用 / 切会话 / 收起详情时调用；不产生新票号）。 */
  public invalidate(): void {
    this.seq += 1;
  }
}

/**
 * 取一个组件生命周期内稳定的请求守卫。
 * @returns 该组件实例专属的守卫
 */
export function useLatestRequest(): LatestRequest {
  const ref = React.useRef<LatestRequest | null>(null);
  if (ref.current === null) ref.current = new LatestRequest();
  return ref.current;
}
