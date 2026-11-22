// 输入区键盘处理：补全弹层打开时接管方向键 / Enter / Tab / Esc，避免误发送；否则 Enter 发送；
// 空输入框（或历史翻阅态）按 ↑/↓ 翻输入历史（2026-11-17 粘性批次）。
//
// 抽成模块级纯函数（无 React 状态，只读写传入的补全接口）后，Composer 里只剩一行接线；
// 行为与原 `onKeyDown` 逐分支一致（顺序：`/` 优先 → `@` → 历史 → 发送）。

import type * as React from 'react';
import { MentionResolver } from '../../models/MentionResolver.ts';
import type { ComposerCompletions } from './useComposerCompletions.ts';

/** 输入历史的键盘接口（ComposerHistory 的视图子集；测试可传桩）。 */
export interface ComposerHistoryKeys {
  /**
   * 按 ↑：空文本进入翻阅态取最新一条；翻阅态往更早走。
   * @param current 输入框当前文本
   * @returns 应回填文本；null = 无历史（放行给默认行为）
   */
  up(current: string): string | null;
  /**
   * 按 ↓：翻阅态往最新走，越过最新归还原草稿。
   * @returns 应回填文本；null = 无下一步（放行给光标移动）
   */
  down(): string | null;
  /** 是否处于翻阅态（翻阅态下非空文本也接管）。 */
  active(): boolean;
  /** 用户继续输入时退出翻阅态。 */
  break(): void;
}

/**
 * 键盘：补全打开时接管方向键 / Enter / Tab / Esc，避免误发送；否则 Enter 发送 / 翻历史。
 * @param e 键盘事件
 * @param completions 补全态与操作
 * @param onSubmit 提交（Enter 且无 Shift）
 * @param history 输入历史（缺省不接管 ↑/↓——单测与嵌入场景可省略）
 * @returns 无
 */
export function handleComposerKeyDown(
  e: React.KeyboardEvent,
  completions: ComposerCompletions,
  onSubmit: () => void,
  history?: ComposerHistoryKeys,
): void {
  const { slash, mention } = completions;
  if (slash !== null && slash.items.length > 0) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      completions.setSlash({
        ...slash,
        idx: MentionResolver.move(slash.idx, slash.items.length, e.key === 'ArrowDown' ? 1 : -1),
      });
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      completions.applySlash(slash.items[slash.idx] ?? slash.items[0]!);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      completions.setSlash(null);
      return;
    }
  }
  if (mention !== null && mention.items.length > 0) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      completions.setMention({
        ...mention,
        idx: MentionResolver.move(
          mention.idx,
          mention.items.length,
          e.key === 'ArrowDown' ? 1 : -1,
        ),
      });
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      completions.applyMention(mention.items[mention.idx] ?? '');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      completions.setMention(null);
      completions.setSlash(null);
      return;
    }
  }
  if (history !== undefined && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const ta = e.currentTarget as HTMLTextAreaElement;
    // 接管条件：空输入框（开始翻阅）或已在翻阅态。非空且不在翻阅 → 放行给光标移动
    // （多行文本里的 ↑/↓ 是移动光标，不能抢）。
    if (history.active() || ta.value === '') {
      const next = e.key === 'ArrowUp' ? history.up(ta.value) : history.down();
      if (next !== null) {
        e.preventDefault();
        ta.value = next;
        ta.setSelectionRange(next.length, next.length);
        return;
      }
    }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSubmit();
  }
}
