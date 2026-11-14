// 厂商总览卡（2026-11-14 重设计，docs/design/provider-settings-redesign 方案 A）：
// 「模型与厂商」总览网格里的一张卡——首字徽标 + 名称 + **单一**状态档 + 一行摘要。
// 零输入框（写操作全部收进 ProviderEditor 抽屉）；点击任意处打开编辑抽屉。
//
// 状态归一为四档（同一时刻只显示一个，修掉旧版「已配置/当前/已保存未实测」三套并存）：
//   ● 当前使用（activeId 真源） / ✓ 已配置 / ○ 未配置 / ! 检测失败。
// 单色口径不变：状态用字形 + 明度表达，不引品牌色相（DESIGN_SYSTEM §2.4）。

import type { ReactElement } from 'react';
import type { ProviderPreset, ProviderProbeResult } from '../../../types/models.ts';
import { isActiveProvider } from '../console/useProviderCatalog.ts';
import { t } from '../../i18n/i18n.ts';

/** ProviderTile 的入参。 */
export interface ProviderTileProps {
  /** 厂商预设。 */
  preset: ProviderPreset;
  /** 目录下发的当前生效厂商 id（单一真源）。 */
  activeId: string | undefined;
  /** 已保存（打码）的 Key；未配置为 undefined。 */
  maskedKey?: string | undefined;
  /** 该厂商的检测结果。 */
  probe?: ProviderProbeResult | undefined;
  /** 打开编辑抽屉。 */
  onOpen: () => void;
}

/**
 * 厂商 label → 首字徽标文本：按驼峰/分词切段，取前两段首字符（中文逐字成段）。
 * DeepSeek → DS；Moonshot Kimi → MK；智谱 GLM → 智G；OpenAI → OA。
 * @param label 厂商展示名
 * @returns 徽标文本（1–2 字符）
 */
export function providerBadgeOf(label: string): string {
  const segs = label.match(/[A-Z]+[a-z0-9]*|[A-Z]{2,}|[\u4e00-\u9fa5]|[a-z0-9]+/g) ?? [];
  const first = segs[0];
  if (first === undefined) return label.slice(0, 2);
  if (segs.length === 1) return first.slice(0, 2);
  const second = segs[1];
  return (first[0] + (second !== undefined ? second[0] : '')).toUpperCase();
}

/** 总览卡状态档（文案 + 明度档）。 */
function tileStatus(
  preset: ProviderPreset,
  maskedKey: string | undefined,
  probe: ProviderProbeResult | undefined,
  activeId: string | undefined,
): { glyph: string; text: string; tone: '' | 'ok' | 'err' } {
  const active = isActiveProvider(preset.id, activeId);
  if (probe !== undefined && !probe.ok) {
    return { glyph: '!', text: t('检测失败'), tone: 'err' };
  }
  if (active) return { glyph: '●', text: t('当前使用'), tone: 'ok' };
  if (maskedKey !== undefined) return { glyph: '✓', text: t('已配置'), tone: '' };
  return { glyph: '○', text: t('未配置'), tone: '' };
}

/**
 * 厂商总览卡。
 * @param props 组件入参
 * @returns 网格卡节点
 */
export function ProviderTile(props: ProviderTileProps): ReactElement {
  const { preset, activeId, maskedKey, probe, onOpen } = props;
  const st = tileStatus(preset, maskedKey, probe, activeId);
  const active = isActiveProvider(preset.id, activeId);
  // 摘要行：检测成功显示模型数；已配置显示打码 Key；否则显示端点（超长省略）。
  const sub =
    probe !== undefined && probe.ok
      ? t('可用 · {n} 个模型', { n: probe.models.length })
      : maskedKey !== undefined
        ? maskedKey
        : preset.baseUrl;
  return (
    <button
      type="button"
      className={'sp-tile' + (active ? ' on' : '')}
      data-provider={preset.id}
      onClick={onOpen}
      aria-label={t('{name}，{status}，打开编辑', { name: preset.label, status: st.text })}
    >
      <span className="sp-tile-badge" aria-hidden="true">
        {providerBadgeOf(preset.label)}
      </span>
      <span className="sp-tile-name">{preset.label}</span>
      <span className={'sp-tile-status ' + st.tone}>
        <span className="sp-tile-glyph" aria-hidden="true">
          {st.glyph}
        </span>
        {st.text}
      </span>
      <span className="sp-tile-sub" title={preset.baseUrl}>
        {sub}
      </span>
    </button>
  );
}
