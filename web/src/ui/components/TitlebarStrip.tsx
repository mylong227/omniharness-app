// 桌面标题条（win32 隐藏系统标题栏后的窗口 chrome）：
// 整条是拖拽区（-webkit-app-region: drag），右端是「快速提问」与自绘窗口控制。
//
// 2026-11-15（用户截图「都是重复内容」）：不再在标题条重复品牌与项目名——
// 品牌已在左栏、项目已在页头/左栏/右栏各有一处，标题条只保留窗口操作。
//
// 只在「桌面桥存在且壳上报 windowFrame === 'hidden'」时渲染；浏览器与旧版壳
// （没有该字段/方法）一律返回 null——窗口控制仍由系统标题栏承担，不出现第二条 chrome。
// 纯展示组件（函数组件范式）：无内部状态；最大化/还原细节（双击、图标形态）由 CSS + 事件承担。

import type { ReactElement } from 'react';
import { desktopBridge } from '../../core/desktop/DesktopBridge.ts';
import { icon } from '../models/Icon.ts';
import { t } from '../i18n/i18n.ts';

/** TitlebarStrip 组件的入参。 */
export interface TitlebarStripProps {
  /** 「快速提问」：唤起输入框（缺省不渲染按钮）。 */
  readonly onQuickCapture?: (() => void) | undefined;
}

/**
 * 快速提问的键帽文案（与主进程 QUICK_CAPTURE_SHORTCUT 同一组合）。
 * @returns `⌘⇧Space`（Mac）或 `Ctrl+Shift+Space`
 */
function quickCaptureKbd(): string {
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘⇧Space' : 'Ctrl+Shift+Space';
}

/**
 * 桌面标题条：快速提问 + 窗口控制按钮（品牌与项目不在这里重复）。
 * @param props 快速提问回调
 * @returns 标题条节点；非桌面壳或壳未隐藏系统标题栏时为 null
 */
export function TitlebarStrip(props: TitlebarStripProps): ReactElement | null {
  const bridge = desktopBridge();
  if (bridge === null || bridge.windowFrame !== 'hidden') return null;
  const canControl =
    typeof bridge.minimizeWindow === 'function' &&
    typeof bridge.toggleMaximizeWindow === 'function' &&
    typeof bridge.closeWindow === 'function';
  const kbd = quickCaptureKbd();
  return (
    <div
      className="titlebar"
      onDoubleClick={() => {
        void bridge.toggleMaximizeWindow?.().catch(() => undefined);
      }}
    >
      <div className="titlebar-actions">
        {props.onQuickCapture === undefined ? null : (
          <button
            className="tb-quick"
            type="button"
            title={`${t('快速提问')} · ${kbd}`}
            aria-label={`${t('快速提问')} ${kbd}`}
            onClick={props.onQuickCapture}
          >
            {icon('plus', { size: 14 })}
          </button>
        )}
        {canControl ? (
          <div className="titlebar-controls">
            <button
              className="tb-btn"
              title={t('最小化')}
              aria-label={t('最小化窗口')}
              onClick={() => {
                void bridge.minimizeWindow?.().catch(() => undefined);
              }}
            >
              {'\u2500'}
            </button>
            <button
              className="tb-btn"
              title={t('最大化 / 还原')}
              aria-label={t('最大化或还原窗口')}
              onClick={() => {
                void bridge.toggleMaximizeWindow?.().catch(() => undefined);
              }}
            >
              {'\u25A1'}
            </button>
            <button
              className="tb-btn tb-close"
              title={t('关闭窗口')}
              aria-label={t('关闭窗口')}
              onClick={() => {
                void bridge.closeWindow?.().catch(() => undefined);
              }}
            >
              {'\u2715'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
