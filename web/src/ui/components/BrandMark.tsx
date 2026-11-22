// 品牌标识（Ω 芯片）：全站唯一的「实心品牌件」，侧栏头、工作状态条与思考轨迹共用。
//
// 为什么单独成组件：品牌形状/底色/动效只有一处定义，避免「侧栏是圆角方块、状态条是另一个圆点」
// 这种同一品牌两种长相的漂移。
//
// 2026-11-14（用户口径，三轮收敛）：工作态动画定为「月弧」——细底环 + 圆头亮弧匀速
// 旋转，Ω 居中静置。此前两版（水感粒子、星际穿越 3D 星环）都被否了：小尺寸里堆多层
// 元素必然乱杂，而单弧 + 匀速是加载器里最经得起看的形式。环收回芯片内（不再溢出），
// 色随主题 accent-2（不再用独立蓝青色组）。动画全在 CSS（minimal.css 的 bm-arc 系列），
// reduced-motion 时弧静止。
//
// 纯展示、aria-hidden：标识是装饰，产品名由旁边的文字承担朗读职责。

import type { ReactElement } from 'react';

/** BrandMark 组件的入参。 */
export interface BrandMarkProps {
  /**
   * 紧凑版（工作状态条用）：白芯片 + 月弧 + 居中 Ω。
   */
  compact?: boolean;
  /**
   * 裸字版（思考轨迹的「运行中」信号用）：同款月弧 + Ω，但不带芯片底——
   * 环直接坐在行里，替换掉原来的转圈描边环。
   */
  bare?: boolean;
}

/**
 * 月弧 + 居中 Ω 的公共内层。动画全在 CSS（minimal.css 的 bm-arc 系列）。
 * 周长 2π×10≈62.8：亮弧 dasharray「17 45.8」≈ 27% 弧长，圆头端点。
 * @returns 内层节点
 */
function SpinOmega(): ReactElement {
  return (
    <>
      <svg className="bm-arc" viewBox="0 0 24 24">
        <circle className="bm-arc-track" cx="12" cy="12" r="10" />
        <circle className="bm-arc-lead" cx="12" cy="12" r="10" />
      </svg>
      <span className="bm-omega">Ω</span>
    </>
  );
}

/**
 * 品牌标识：把 Ω 放进一枚扁平的圆角墨芯片（紧凑版/裸字版共享同一套月弧动效）。
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
