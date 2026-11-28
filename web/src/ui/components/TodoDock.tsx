import * as React from 'react';
import { timeOf, todoBrief } from '../format.ts';
import { type TodoDockItem } from '../models/TodoDockModel.ts';
import { isTodoDone, isTodoDoing } from '../models/TodoStatus.ts';
import { t } from '../i18n/i18n.ts';

/** 面板属性。 */
export interface TodoDockProps {
  /** 当前待办；null/空时不渲染。 */
  readonly items: readonly TodoDockItem[] | null;
  /** 快照事件时刻（毫秒；0 = 未知，不显示）。 */
  readonly updatedAt?: number;
}

/**
 * 输入框上方的计划进度条：始终显示「已完成/总数 + 当前进行项」，展开可看全量。
 *
 * 为什么需要：todo 事件原先只在流里出现一次，长会话滚上去就看不见；用户需要一个
 * 不用滚动就能知道「Agent 现在做到哪一步」的稳定位置。
 *
 * 开合纪律（2026-11-27）：`<details>` **非受控**——此前 `open={current !== undefined}`
 * 是受控口径，只要存在进行项就把用户的手动折叠在下一次渲染掰回去（用户报「收不起来」）。
 * 现在只在「进行项从无到有」时自动展开一次，其余时刻一律尊重用户的开合。
 * 摘要行右侧显示快照时刻：模型整回合不更新待办时（常见），陈旧数据自可读，而非伪装成实时。
 */
export function TodoDock({ items, updatedAt = 0 }: TodoDockProps): React.ReactElement | null {
  // hook 全部放在提前 return 之前：items 空与非空切换不得改变 hook 顺序。
  const detailsRef = React.useRef<HTMLDetailsElement | null>(null);
  const hadCurrentRef = React.useRef(false);
  const hasCurrent = (items ?? []).some((item) => isTodoDoing(item.status));
  React.useEffect(() => {
    const el = detailsRef.current;
    if (el === null) return;
    // 进行项从无到有：自动展开一次（含挂载即有进行项的会话）。其余时刻绝不强掰。
    if (hasCurrent && !hadCurrentRef.current) el.open = true;
    hadCurrentRef.current = hasCurrent;
  }, [hasCurrent]);
  if (items === null || items.length === 0) return null;
  // 摘要口径单源（2026-11-28 去重）：done/current/total 一律走 todoBrief（与流内摘要同一条
  // 纯函数），本组件不再各数一遍——两处口径此前已经出现漂移风险。
  const brief = todoBrief(items);
  const done = brief.done;
  const current = brief.current;
  const pending = brief.total - brief.done - (brief.current !== undefined ? 1 : 0);
  const percent = Math.round((done / items.length) * 100);
  const time = timeOf(updatedAt);
  return (
    <details ref={detailsRef} className="todo-dock">
      <summary className="todo-dock__summary">
        <span className="todo-dock__title">{t('计划')}</span>
        <span className="todo-dock__count">
          {done}/{items.length}
        </span>
        <span className="todo-dock__bar" aria-hidden="true">
          <span className="todo-dock__fill" style={{ width: `${String(percent)}%` }} />
        </span>
        <span className="todo-dock__current">
          {current ?? (pending > 0 ? t('待处理 {n} 项', { n: pending }) : t('全部完成'))}
        </span>
        {time === '' ? null : <span className="todo-dock__time">{time}</span>}
      </summary>
      <ul className="todo-dock__list">
        {items.map((item, index) => (
          <li key={`${String(index)}-${item.content}`} className={`todo-dock__item is-${item.status}`}>
            <span className="todo-dock__mark" aria-hidden="true">
              {isTodoDone(item.status) ? '✓' : isTodoDoing(item.status) ? '◐' : '○'}
            </span>
            {item.content}
            {item.dependsOn === undefined || item.dependsOn.length === 0 ? null : (
              <span className="todo-dock__deps">
                {t('依赖 {n}', { n: item.dependsOn.length })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
