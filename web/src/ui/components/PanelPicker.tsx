// 「全部面板」入口：只保留一枚触发按钮。
//
// 2026-10-26 用户要求删除三处 chrome 图标后，RightPanel 不再渲染本按钮；
// 组件保留给命令面板/未来入口使用，避免以后又把入口写回右栏头。
//
// 2026-10-19 起不再弹下拉菜单，而是打开「左导航 + 右内容」的页面；2026-10-26 起
// 该页面与设置合并为 `components/console/ConsoleModal.tsx`（工作台控制台）。
// 用户原话：「点击按钮不要弹出这个下拉面板了，而是像设置按钮一样弹窗、分左右显示」。
//
// ⚠️ 债务登记（2026-11-06 审计）：本组件在 src 内已零消费（仅 3 个 a11y/mount 测试直接挂载），
// 保留原因：其键盘导航/焦点管理判据仍是活跃的无障碍回归面；整体下线需先把判据折叠到
// ConsoleModal 的等价测试上——见审计问题清单 #40。
// 菜单相关的定位 / 外部点击 / 滚动关闭逻辑随之删除（模态自己处理遮罩与 Esc）。

import { icon } from '../models/Icon.ts';
import { t } from '../i18n/i18n.ts';

/** PanelPicker 组件的入参。 */
export interface PanelPickerProps {
  /** 打开工作台控制台（功能面板与设置共用）。 */
  onOpen: () => void;
}

/**
 * 「全部面板」按钮：点开工作台控制台（默认落在上次的面板页）。
 * @param props 组件入参
 * @returns 触发按钮节点
 */
export function PanelPicker(props: PanelPickerProps): ReactElement {
  const { onOpen } = props;
  return (
    <div className="pp-wrap">
      <button
        className="iconbtn pp-btn"
        title={t('全部面板')}
        aria-label={t('全部面板')}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        <span aria-hidden="true">{icon('columns', { size: 16 })}</span>
      </button>
    </div>
  );
}
