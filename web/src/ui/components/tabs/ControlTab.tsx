/**
 * 控制室面板（2026-11-10）：编队 / 上下文 / 凭证三模式的唯一入口（设计 §2.3）。
 *
 * 职责边界：本组件只做 tab 容器、深链同步与会话级空态；三模式的数据请求由各自 hook
 * 负责（`useFleet` / `useContextStudio` / `useProof`），不混在一个 effect 里（设计 §7.6）。
 *
 * 深链口径（CR-03）：`#pane=control&view=fleet|context|proof`；view 变化经
 * `RouteBinding.navigate` 写 hash（幂等），未知 view 已在 Router 层落回 fleet。
 *
 * 2026-11-11 控制台 antd 化：tab 基座换成 antd `Tabs`（自带 WAI-ARIA tabs 关系与
 * ←/→/Home/End 键控），不再自持 tabRefs；键盘激活分支保留（CR-02 要求选择跟随焦点，
 * antd 默认只移焦点不激活）。
 */

import * as React from 'react';
import type { ReactElement } from 'react';
// 子路径导入（不走 barrel，理由见 vite.config.ts「分块改造」注释）。
import Tabs from 'antd/es/tabs';
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

/** 控制室面板：antd Tabs + 三模式。 */
export function ControlTab(props: ControlTabProps): ReactElement {
  const { sessionId } = useApp();
  const threadId = props.threadId ?? sessionId ?? null;
  const current = normalizeView(props.view);

  /**
   * tab 键控：antd Tabs 只把焦点移到下一枚 tab（手动激活口径），
   * 而控制室的设计判据 CR-02 要求 ←/→/Home/End 直接切模式（选择跟随焦点）。
   * 这里只接管落在 tablist 里的按键，面板内的输入框不受影响。
   * @param event 键盘事件（从 tablist 冒泡上来）。
   */
  const onTabKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const list = event.currentTarget.querySelector('[role="tablist"]');
      if (list === null || !list.contains(event.target as Node)) return;
      const from = VIEWS.findIndex((view) => view.key === current);
      const index = from < 0 ? 0 : from;
      const key = event.key === '' ? event.code : event.key;
      let next = -1;
      if (key === 'ArrowRight') next = (index + 1) % VIEWS.length;
      else if (key === 'ArrowLeft') next = (index - 1 + VIEWS.length) % VIEWS.length;
      else if (key === 'Home') next = 0;
      else if (key === 'End') next = VIEWS.length - 1;
      else return;
      event.preventDefault();
      const view = VIEWS[next];
      if (view !== undefined) props.onNavigate(view.key);
    },
    [current, props],
  );

  return (
    // 命名 region（2026-11-12 补回 2026-11-11 迁移丢掉的「控制室模式」可访问名）：
    // rc-tabs 的 tablist 节点不收 restProps，aria-label 只能落到这里的外层 region 上。
    <div role="region" aria-label={t('控制室模式')} onKeyDown={onTabKeyDown}>
      <Tabs
        activeKey={current}
        onChange={(key) => props.onNavigate(normalizeView(key))}
        items={VIEWS.map((view) => ({
          key: view.key,
          label: t(view.label),
          // 三个模式都只在首次激活时挂载，之后保活（切走不卸载，与设计 CR-05 的缓存口径一致）；
          // 各自的 `active` 仍决定是否发起 RPC。
          children:
            view.key === 'fleet' ? (
              <FleetMode threadId={threadId} active={current === 'fleet'} />
            ) : view.key === 'context' ? (
              <ContextMode threadId={threadId} active={current === 'context'} />
            ) : (
              <ProofMode threadId={threadId} active={current === 'proof'} />
            ),
        }))}
      />
    </div>
  );
}
