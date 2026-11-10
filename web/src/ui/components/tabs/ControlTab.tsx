/**
 * 控制室面板（2026-11-10）：编队 / 上下文 / 凭证三模式的唯一入口（设计 §2.3）。
 *
 * 职责边界：本组件只做 tab 容器、深链同步与会话级空态；三模式的数据请求由各自 hook
 * 负责（`useFleet` / `useContextStudio` / `useProof`），不混在一个 effect 里（设计 §7.6）。
 *
 * 深链口径（CR-03）：`#pane=control&view=fleet|context|proof`；view 变化经
 * `RouteBinding.navigate` 写 hash（幂等），未知 view 已在 Router 层落回 fleet。
 */

import * as React from 'react';
import type { ReactElement } from 'react';
import { useApp } from '../../context.ts';
import { t } from '../../i18n/i18n.ts';
import { FleetMode } from './control/FleetMode.tsx';
import { ContextMode } from './control/ContextMode.tsx';
import { ProofMode } from './control/ProofMode.tsx';

/** 控制室三模式 key。 */
export type ControlView = 'fleet' | 'context' | 'proof';

/** 模式定义（顺序即 tab 顺序；label 是词条 key，渲染时再 t()，切换语言即时生效）。 */
const VIEWS: readonly { readonly key: ControlView; readonly label: string }[] = [
  { key: 'fleet', label: '编队' },
  { key: 'context', label: '上下文' },
  { key: 'proof', label: '凭证' },
];

/**
 * 把任意 view 值收敛为合法 ControlView（未知值落回 fleet，与 Router 白名单一致）。
 * @param view 路由里的 view（可能 undefined / 脏值）。
 * @returns 合法 view。
 */
function normalizeView(view: string | undefined): ControlView {
  return view === 'context' || view === 'proof' || view === 'fleet' ? view : 'fleet';
}

/** 控制室面板入参。 */
export interface ControlTabProps {
  /** 当前会话 id（null = 未选会话，三模式统一空态）。 */
  readonly threadId: string | null;
  /** 路由里的 view（深链恢复 tab）。 */
  readonly view?: string | undefined;
  /** 切换 view 的回调（写 hash 由路由层收口；幂等）。 */
  readonly onNavigate: (view: ControlView) => void;
}

/** 控制室面板：header + ARIA tabs + 三模式。 */
export function ControlTab(props: ControlTabProps): ReactElement {
  const { sessionId } = useApp();
  const threadId = props.threadId ?? sessionId ?? null;
  const current = normalizeView(props.view);
  /** 每个 tab 的 DOM 引用：方向键切换后把焦点送到新 tab（WAI-ARIA selection follows focus）。 */
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  /**
   * 选中某个 view 并移动键盘焦点。
   * @param index 目标下标（已夹紧）。
   */
  const moveTo = React.useCallback(
    (index: number): void => {
      const next = Math.max(0, Math.min(index, VIEWS.length - 1));
      const view = VIEWS[next];
      if (view === undefined) return;
      props.onNavigate(view.key);
      window.requestAnimationFrame(() => tabRefs.current[next]?.focus());
    },
    [props],
  );

  /**
   * tab 键盘导航（WAI-ARIA tabs：←/→/Home/End；选择跟随焦点）。
   * @param e 键盘事件。
   */
  const onTabKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      const selected = VIEWS.findIndex((view) => view.key === current);
      const from = selected < 0 ? 0 : selected;
      if (e.key === 'ArrowRight') moveTo(from + 1);
      else if (e.key === 'ArrowLeft') moveTo(from - 1);
      else if (e.key === 'Home') moveTo(0);
      else if (e.key === 'End') moveTo(VIEWS.length - 1);
      else return;
      e.preventDefault();
    },
    [current, moveTo],
  );

  return (
    <div className="control-tab">
      <div
        className="control-tabs"
        role="tablist"
        aria-label={t('控制室模式')}
        onKeyDown={onTabKeyDown}
      >
        {VIEWS.map((view, index) => {
          const selected = view.key === current;
          return (
            <button
              key={view.key}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`control-tab-${view.key}`}
              aria-selected={selected}
              aria-controls={`control-panel-${view.key}`}
              tabIndex={selected ? 0 : -1}
              className={`control-tab__btn${selected ? ' is-active' : ''}`}
              onClick={() => props.onNavigate(view.key)}
            >
              {t(view.label)}
            </button>
          );
        })}
      </div>
      {VIEWS.map((view) => (
        <div
          key={view.key}
          role="tabpanel"
          id={`control-panel-${view.key}`}
          aria-labelledby={`control-tab-${view.key}`}
          hidden={view.key !== current}
          className="control-panel"
        >
          {view.key === 'fleet' ? <FleetMode threadId={threadId} active={current === 'fleet'} /> : null}
          {view.key === 'context' ? <ContextMode threadId={threadId} active={current === 'context'} /> : null}
          {view.key === 'proof' ? <ProofMode threadId={threadId} active={current === 'proof'} /> : null}
        </div>
      ))}
    </div>
  );
}
