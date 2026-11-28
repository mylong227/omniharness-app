// todo 状态词表谓词（2026-11-28 口径收口）。
//
// 为什么单独成文件：todo 状态有两个时代的词表——生产者（内核 TodoStatus）只发
// `pending | in_progress | completed`，而历史事件里存在旧词表 `doing / done`（2026-09-26
// 审计 F8 后渲染层双词表兼容）。此前判定逻辑在 todoView / todoBrief / TodoDock /
// TodoDockModel 四处各写一份，且 **TodoDock 只认新词表**——历史 `doing` 项在坞里退化成
// 「无进行项」（自动展开不触发、圆点降级）。现在四处共用这一组谓词，新增判定点一律走这里。

/** todo 的渲染口径状态（归一后的新词表）。 */
export type TodoRenderStatus = 'pending' | 'in_progress' | 'completed';

/**
 * 是否已完成（新词表 completed / 旧词表 done）。
 * @param status 事件里的原始状态串
 * @returns 已完成为 true
 */
export function isTodoDone(status: string | undefined): boolean {
  return status === 'completed' || status === 'done';
}

/**
 * 是否进行中（新词表 in_progress / 旧词表 doing）。
 * @param status 事件里的原始状态串
 * @returns 进行中为 true
 */
export function isTodoDoing(status: string | undefined): boolean {
  return status === 'in_progress' || status === 'doing';
}

/**
 * 是否待处理（新词表 pending；旧词表无此态，缺省归此类）。
 * @param status 事件里的原始状态串
 * @returns 待处理为 true
 */
export function isTodoPending(status: string | undefined): boolean {
  return !isTodoDone(status) && !isTodoDoing(status);
}

/**
 * 把事件里的原始状态串归一成渲染口径（未知/缺省 → pending）。
 * @param status 事件里的原始状态串
 * @returns 归一后的状态
 */
export function todoStatusOf(status: string | undefined): TodoRenderStatus {
  if (isTodoDone(status)) return 'completed';
  if (isTodoDoing(status)) return 'in_progress';
  return 'pending';
}
