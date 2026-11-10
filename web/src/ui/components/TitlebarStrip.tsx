// 桌面标题条（win32 隐藏系统标题栏后的一体化顶栏，参考 ZCode 桌面端的窗口形态）：
// 整条是拖拽区（-webkit-app-region: drag），左端是品牌 + 当前项目，右端是「快速提问」
// 与自绘「最小化 / 最大化 / 关闭」。
//
// 只在「桌面桥存在且壳上报 windowFrame === 'hidden'」时渲染；浏览器与旧版壳
// （没有该字段/方法）一律返回 null——窗口控制仍由系统标题栏承担，不出现第二条 chrome。
// 纯展示组件（函数组件范式）：无内部状态；最大化/还原细节（双击、图标形态）由 CSS + 事件承担。

import type { ReactElement } from 'react';
import { desktopBridge } from '../../core/desktop/DesktopBridge.ts';
import { icon } from '../models/Icon.ts';
import { PathJoiner } from '../models/PathJoiner.ts';
import { t } from '../i18n/i18n.ts';

/** TitlebarStrip 组件的入参。 */
export interface TitlebarStripProps {
  /** 当前项目绝对路径（只取末段显示；空串不渲染）。 */
  readonly workspacePath?: string;
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
 * 桌面标题条：品牌 / 项目 + 快速提问 + 窗口控制按钮。
 * @param props 项目路径与快速提问回调
 * @returns 标题条节点；非桌面壳或壳未隐藏系统标题栏时为 null
 */
export function TitlebarStrip(props: TitlebarStripProps): ReactElement | null {
  const bridge = desktopBridge();
  if (bridge === null || bridge.windowFrame !== 'hidden') return null;
  const canControl =
    typeof bridge.minimizeWindow === 'function' &&
    typeof bridge.toggleMaximizeWindow === 'function' &&
    typeof bridge.closeWindow === 'function';
  const workspace =
    props.workspacePath === undefined || props.workspacePath === ''
      ? ''
      : PathJoiner.basename(props.workspacePath);
  const kbd = quickCaptureKbd();
  return (
    <div
      className="titlebar"
      onDoubleClick={() => {
        void bridge.toggleMaximizeWindow?.().catch(() => undefined);
      }}
    >
      <div className="titlebar-brand">
        <span className="titlebar-omega" aria-hidden="true">
          Ω
        </span>
        <span className="titlebar-name">OmniHarness</span>
        {workspace === '' ? null : (
          <span className="titlebar-workspace" title={props.workspacePath}>
            {workspace}
          </span>
        )}
      </div>
      <div className="titlebar-actions">
        {props.onQuickCapture === undefined ? null : (
          <button
            className="tb-quick"
            type="button"
            title={`${t('快速提问')} · ${kbd}`}
            aria-label={`${t('快速提问')} ${kbd}`}
            onClick={props.onQuickCapture}
          >
            {icon('plus', { size: 13 })}
            <span className="tb-quick-label">{t('快速提问')}</span>
            <kbd className="tb-quick-kbd">{kbd}</kbd>
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
