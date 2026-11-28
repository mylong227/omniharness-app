// 运行中才跳动的低频时钟（2026-11-17 全面 review 抽取）：ThinkingTrail 与 useFleet 各有一份
// 「active 时 setInterval(setNow) + cleanup」，收成单源；useSessionClock 的
// 时钟带各自的边缘检测 / elapsed 语义，不强行套壳。

import * as React from 'react';

/**
 * 每 ms 跳一拍的当前时刻：仅在 active 为 true 时启动 interval，false / 卸载即停
 * （避免历史回放 / 隐藏面板空转）。
 * @param active 是否跳动（false 时钟停摆，保持最后一次取值）
 * @param ms 间隔（缺省 1000）
 * @returns 当前时刻（ms）
 */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}
