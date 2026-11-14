// 品牌标识（Ω 芯片）：全站唯一的「实心品牌件」，侧栏头、工作状态条与思考轨迹共用。
//
// 为什么单独成组件：品牌形状/底色/动效只有一处定义，避免「侧栏是圆角方块、状态条是另一个圆点」
// 这种同一品牌两种长相的漂移。
//
// 2026-11-14（用户口径）：工作态动画收敛为「旋转虚线环 + 居中 Ω」——此前的小尺寸水感
// （光幕/渐变字/发散水滴）在 20px 里挤成一团乱麻；干净的单环旋转既有「进行中」的辨识度，
// 又不抢正文视线。动画全在 CSS（minimal.css 的 bm-ring 系列），reduced-motion 时环静止。
//
// 纯展示、aria-hidden：标识是装饰，产品名由旁边的文字承担朗读职责。

import type { ReactElement } from 'react';

/** BrandMark 组件的入参。 */
export interface BrandMarkProps {
  /**
   * 紧凑版（工作状态条用）：白芯片 + 旋转虚线环 + 居中 Ω。
   */
  compact?: boolean;
  /**
   * 裸字版（思考轨迹的「运行中」信号用）：同款旋转环 + Ω，但不带芯片底——
   * 环直接坐在行里，替换掉原来的转圈描边环。
   */
  bare?: boolean;
}

/**
 * 旋转环 + 居中 Ω 的公共内层。动画全在 CSS（minimal.css 的 bm-ring 系列）。
 * @returns 内层节点
 */
function SpinOmega(): ReactElement {
  return (
    <>
      <svg className="bm-ring" viewBox="0 0 24 24" aria-hidden="true">
        {/* 周长 2π*10≈62.8；dash 4.5 + gap 4 ≈ 8.5 × 7.4 ≈ 63 ⇒ 间隙均匀不叠段 */}
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="4.5 4" strokeLinecap="round" />
      </svg>
      <span className="bm-omega">Ω</span>
    </>
  );
}

/**
 * 品牌标识：把 Ω 放进一枚扁平的圆角墨芯片（紧凑版/裸字版共享同一套旋转环动效）。
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
