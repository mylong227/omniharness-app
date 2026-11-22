// 右栏桌面展开/收起偏好的解析规则（纯逻辑、零 React）。
//
// 背景（2026-11-10 体验优化）：右栏默认宽 420px，中栏在 900–1100px 视口里只剩
// 200–400px，空态标题与输入条被挤成多行。此前只有用户手动收起过（localStorage
// `omni-right-collapsed`）才会收起右栏，于是 900px 的平板档默认就是「三栏硬塞」。
//
// 这里把「没有显式偏好时按视口自动收起」写成可单测规则：
//   · 有 `'1'` ⇒ 收起（用户明确收过）；
//   · 有 `''`  ⇒ 展开（用户明确展开过，哪怕窗口很窄——尊重选择）；
//   · 没有键   ⇒ 宽度低于阈值自动收起，否则展开。
//
// 注意不能用 `Boolean(getItem(...))`：`''` 与 `null` 必须是两种不同语义。

/** 存储键（与 LayoutController 共用）。 */
export const RIGHT_COLLAPSED_STORAGE_KEY = 'omni-right-collapsed';

/** 默认自动收起阈值（px）：低于它时三栏会把中栏压到不可读。 */
export const RIGHT_AUTO_COLLAPSE_BELOW = 1180;

/** 右栏开合偏好解析器。 */
export class RightPanePreference {
  /**
   * 解析右栏是否收起。
   * @param stored `localStorage.getItem` 的原始值（`'1'` / `''` / `null`）
   * @param viewportWidth 当前视口宽度（px）
   * @returns true = 右栏收起
   */
  public static resolve(stored: string | null, viewportWidth: number): boolean {
    if (stored === '1') return true;
    if (stored === '') return false;
    return Number.isFinite(viewportWidth) && viewportWidth < RIGHT_AUTO_COLLAPSE_BELOW;
  }

  /**
   * 无 DOM 环境（单测 / 非浏览器宿主）下的安全默认值。
   * @param viewportWidth 视口宽度
   * @returns 是否收起
   */
  public static autoCollapsed(viewportWidth: number): boolean {
    return RightPanePreference.resolve(null, viewportWidth);
  }
}
