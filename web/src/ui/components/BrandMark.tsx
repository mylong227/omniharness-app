// 品牌标识（Ω 芯片）：全站唯一的「实心品牌件」，侧栏头与工作状态条共用。
//
// 为什么单独成组件：品牌形状/底色/动效只有一处定义，避免「侧栏是圆角方块、状态条是另一个圆点」
// 这种同一品牌两种长相的漂移；工作状态条要的只是同一枚标识的紧凑版。
//
// 纯展示、aria-hidden：标识是装饰，产品名由旁边的文字承担朗读职责。

import type { ReactElement } from 'react';

/** BrandMark 组件的入参。 */
export interface BrandMarkProps {
  /**
   * 紧凑版（工作状态条用）：白芯片 + 「水感 Ω」动画（流水渐变字 + 液态晃动 + 发散水滴）。
   */
  compact?: boolean;
  /**
   * 裸字版（思考轨迹的「运行中」信号用）：同一枚水感 Ω，但不带芯片底图——
   * 字母直接坐在行里，替换掉原来的转圈描边环。
   */
  bare?: boolean;
}

/**
 * 水感 Ω 的公共内层：光幕 + 渐变字 + 发散水滴。动画全在 CSS（minimal.css 的 bm-* 系列）。
 * @returns 内层节点
 */
function WaterOmega(): ReactElement {
  return (
    <>
      <span className="bm-aurora" />
      <span className="bm-omega">Ω</span>
      <span className="bm-drops">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </>
  );
}

/**
 * 品牌标识：把 Ω 放进一枚扁平的圆角墨芯片（紧凑版/裸字版共享同一套水感动效）。
 * @param props 组件入参
 * @returns 标识节点
 */
export function BrandMark(props: BrandMarkProps): ReactElement {
  const { compact, bare } = props;
  if (bare === true) {
    return (
      <span className="brand-mark brand-mark--water brand-mark--bare" aria-hidden="true">
        <WaterOmega />
      </span>
    );
  }
  if (compact === true) {
    return (
      <span className="brand-mark brand-mark--water brand-mark--compact" aria-hidden="true">
        <WaterOmega />
      </span>
    );
  }
  return (
    <span className="brand-mark" aria-hidden="true">
      Ω
    </span>
  );
}
