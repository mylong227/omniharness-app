// 品牌标识（Ω 芯片）：全站唯一的「实心品牌件」，侧栏头、工作状态条与思考轨迹共用。
//
// 为什么单独成组件：品牌形状/底色/动效只有一处定义，避免「侧栏是圆角方块、状态条是另一个圆点」
// 这种同一品牌两种长相的漂移。
//
// 2026-11-14（用户口径，二轮）：工作态动画升级为「星际穿越星环」——3D 立体旋转的
// 吸积盘面（rotateX 透视倾斜 + 面内匀速旋转）+ 正交背环（陀螺式轨道交叉）+ 星云雾晕
// + 4 颗随轨道运行的星尘；Ω 居中静置（不参与任何 transform，与既有口径一致）。
// 环线必须用 **SVG 矢量描边**（CSS border 在 3D 光栅化下会碎成锯齿段，真机放大实测），
// 倾斜与旋转仍由 CSS 3D transform 包裹（SVG 根元素参与 CSS transform-style）。
// 色相全部来自 theme.css 的 --cosmos-* 固定组（不随主题/方案变调）；动画全在 CSS，
// reduced-motion 时全静止、星尘收起。
//
// 纯展示、aria-hidden：标识是装饰，产品名由旁边的文字承担朗读职责。

import type { ReactElement } from 'react';

/**
 * 星环旋转面（SVG 矢量）：主环 + 盘面细环 + 四方位星尘。
 * viewBox 100×100；星尘贴在主环径（r≈46）的上下左右四点，随面一起转 = 轨道运动。
 * @returns 旋转面节点
 */
function RingFace(): ReactElement {
  return (
    <svg className="bm-ring-face" viewBox="0 0 100 100">
      <circle className="bm-ring-major" cx="50" cy="50" r="46" />
      <circle className="bm-ring-minor" cx="50" cy="50" r="37" />
      <circle className="bm-star" cx="50" cy="4" r="1.6" />
      <circle className="bm-star" cx="50" cy="96" r="1.6" />
      <circle className="bm-star" cx="4" cy="50" r="1.6" />
      <circle className="bm-star" cx="96" cy="50" r="1.6" />
    </svg>
  );
}

/**
 * 星环 + 居中 Ω 的公共内层。动画全在 CSS（minimal.css 的 bm-* 系列）。
 * @returns 内层节点
 */
function SpinOmega(): ReactElement {
  return (
    <>
      <span className="bm-nebula" />
      <span className="bm-tilt" />
      <span className="bm-orbit">
        <RingFace />
      </span>
      <span className="bm-omega">Ω</span>
    </>
  );
}

/** BrandMark 组件的入参。 */
export interface BrandMarkProps {
  /**
   * 紧凑版（工作状态条用）：白芯片 + 星际穿越星环 + 居中 Ω。
   */
  compact?: boolean;
  /**
   * 裸字版（思考轨迹的「运行中」信号用）：同款星环 + Ω，但不带芯片底——
   * 环直接坐在行里，替换掉原来的转圈描边环。
   */
  bare?: boolean;
}

/**
 * 品牌标识：把 Ω 放进一枚扁平的圆角墨芯片（紧凑版/裸字版共享同一套星环动效）。
 * @param props 组件入参
 * @returns 标识节点
 */
export function BrandMark(props: BrandMarkProps): ReactElement {
  const { compact, bare } = props;
  if (bare === true) {
    return (
      <span className="brand-mark brand-mark--spin brand-mark--bare" aria-hidden="true">
        <SpinOmega />
      </span>
    );
  }
  if (compact === true) {
    return (
      <span className="brand-mark brand-mark--spin brand-mark--compact" aria-hidden="true">
        <SpinOmega />
      </span>
    );
  }
  return (
    <span className="brand-mark" aria-hidden="true">
      Ω
    </span>
  );
}
