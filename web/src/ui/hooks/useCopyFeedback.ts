// 复制反馈 hook（2026-11-17 全面 review 从 AssistantCard 抽出收编）：真实写入成功才亮 ✓
// （1.4s 后回落）——「勾选感」必须等于**真实写入成功**，失败（两条路径都被拒）不放假勾。
// 定时器经 schedule 注入点驱动（单测可替换）。消费方：AssistantCard / UserCard / 后续任何
// 需要「点一下复制 + 成功反馈」的地方。

import * as React from 'react';
import { ClipboardCopier } from '../models/ClipboardCopier.ts';

/**
 * 复制反馈 hook。
 * @param full 要复制的正文全文。
 * @param schedule 定时器注入点（单测可替换；缺省用全局 setTimeout）。
 * @returns copied 当前是否处于成功反馈态；onCopy 复制按钮的点击处理。
 */
export function useCopyFeedback(
  full: string,
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>,
): { copied: boolean; onCopy: (e: React.MouseEvent) => void } {
  const [copied, setCopied] = React.useState(false);
  const copiedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
  }, []);
  const onCopy = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const fire = (): void => {
      setCopied(false);
      copiedTimerRef.current = null;
    };
    void ClipboardCopier.copy(full).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      const after = (fn: () => void, ms: number): ReturnType<typeof setTimeout> =>
        schedule ? schedule(fn, ms) : setTimeout(fn, ms);
      copiedTimerRef.current = after(fire, 1400);
    });
  };
  return { copied, onCopy };
}
