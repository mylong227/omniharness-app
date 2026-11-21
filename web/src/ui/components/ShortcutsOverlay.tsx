// 快捷键速查浮层（2026-11-17 粘性批次）：非输入焦点按「?」呼出，Esc / 点遮罩 / 关闭按钮收起。
//
// 为什么值得一个浮层：全部键位说明只存在于设置页深处（工作台控制台 → 键盘快捷键），
// 用户不知道有键可按就不会去找设置。速查的数据源**就是设置页那张表**（GLOBAL_SHORTCUTS /
// INPUT_KEYS 从 SettingsShortcutsPane 导出共享），杜绝「浮层说有、设置页没有」的漂移。
//
// 焦点纪律：内容只读、唯一可聚焦元素是关闭按钮（打开时自动聚焦，Tab 自然停在框内）；
// Esc 由全局 keydown 与本层 onKeyDown 双通道关闭（遮罩态下全局键仍可达）。

import * as React from 'react';
import { t } from '../i18n/i18n.ts';
import { icon } from '../kit/Icon.tsx';
import { KeyboardShortcuts } from '../models/KeyboardShortcuts.ts';
import { GLOBAL_SHORTCUTS, INPUT_KEYS } from './console/SettingsShortcutsPane.tsx';

/** 全局快捷键解析器只用于取展示文案（与设置页同一单例口径：无状态）。 */
const SHORTCUT_LABELS = new KeyboardShortcuts();

/** 速查浮层入参。 */
export interface ShortcutsOverlayProps {
  /** 是否打开。 */
  readonly open: boolean;
  /** 关闭回调（Esc / 遮罩 / 关闭按钮）。 */
  readonly onClose: () => void;
}

/** 一张速查小节的行。 */
function ShortcutRows(props: {
  readonly rows: readonly { key: string; label: string }[];
}): ReactElement {
  return (
    <ul className="sc-list">
      {props.rows.map((row) => (
        <li className="sc-row" key={row.key}>
          <span className="sc-label">{row.label}</span>
          <kbd className="sc-kbd">{row.key}</kbd>
        </li>
      ))}
    </ul>
  );
}

/**
 * 快捷键速查浮层。
 * @param props open / onClose
 * @returns 浮层节点（关闭时 null）
 */
export function ShortcutsOverlay(props: ShortcutsOverlayProps): ReactElement | null {
  if (!props.open) return null;
  const globalRows = GLOBAL_SHORTCUTS.map((row) => ({
    key: SHORTCUT_LABELS.label(row.action),
    label: t(row.label),
  }));
  return (
    <div
      className="sc-overlay"
      onClick={() => props.onClose()}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          props.onClose();
        }
      }}
    >
      <div
        className="sc-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('键盘快捷键速查')}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="sc-head">
          <span className="sc-title">{t('键盘快捷键')}</span>
          <button
            className="iconbtn"
            type="button"
            autoFocus
            aria-label={t('关闭速查')}
            onClick={props.onClose}
          >
            {icon('x', { size: 15 })}
          </button>
        </div>
        <ShortcutRows rows={globalRows} />
        <div className="sc-sub">{t('输入框与浮层')}</div>
        <ShortcutRows rows={INPUT_KEYS.map((row) => ({ key: row.combo, label: t(row.label) }))} />
        <div className="sc-foot">{t('快捷键是只读展示：本版本不提供自定义键位，避免与浏览器保留键冲突。')}</div>
      </div>
    </div>
  );
}
