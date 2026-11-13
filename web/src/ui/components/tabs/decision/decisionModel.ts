import { timeOf } from '../../../format.ts';
import { t } from '../../../i18n/i18n.ts';
import type {
  DecisionBasisLike,
  DecisionCheckLike,
  DecisionDispositionLike,
  DecisionEffectClassLike,
  DecisionRowLike,
} from '../../../../types/models.ts';

/** 结果筛选项（含共形属性）。 */
export type DecisionFilter = 'all' | 'allow' | 'escalate' | 'deny' | 'conformal';

/** 详情面板需要的显示文案。 */
export interface DecisionLabels {
  readonly disposition: string;
  readonly basis: string;
  readonly tone: 'allow' | 'escalate' | 'deny' | 'neutral';
}

/**
 * 最终去向文案（共形被后续拒绝必须显式写出来）。
 * @param disposition 服务端去向。
 * @returns 文案 + 语义色。
 */
export function dispositionLabels(disposition: DecisionDispositionLike): DecisionLabels {
  switch (disposition) {
    case 'allowed':
      return { disposition: t('放行'), basis: t('默认'), tone: 'allow' };
    case 'allowed_by_conformal':
      return { disposition: t('放行'), basis: t('共形'), tone: 'allow' };
    case 'allowed_by_approval':
      return { disposition: t('放行'), basis: t('人工'), tone: 'allow' };
    case 'denied':
      return { disposition: t('拒绝'), basis: t('规则/策略'), tone: 'deny' };
    case 'denied_after_conformal':
      return { disposition: t('拒绝'), basis: t('共形后被拦'), tone: 'deny' };
    case 'escalated_pending':
      return { disposition: t('升级'), basis: t('等待审批'), tone: 'escalate' };
    case 'approved_not_executed':
      return { disposition: t('已批准'), basis: t('未执行'), tone: 'escalate' };
    default:
      return { disposition: t('不可用'), basis: t('未证明'), tone: 'neutral' };
  }
}

/**
 * 依据分类文案。
 * @param basis 服务端分类。
 * @returns 文案。
 */
export function basisLabel(basis: DecisionBasisLike): string {
  switch (basis) {
    case 'conformal':
      return t('共形放行');
    case 'human':
      return t('人工审批');
    case 'rule':
      return t('规则裁决');
    case 'default':
      return t('默认裁决');
    case 'unavailable':
      return t('裁决不可用');
    default:
      return t('未知依据');
  }
}

/**
 * 效果类文案（保留内核枚举，不翻译成模糊词）。
 * @param effectClass 效果类。
 * @returns 文案。
 */
export function effectClassLabel(effectClass: DecisionEffectClassLike | undefined): string {
  switch (effectClass) {
    case 'READ_ONLY':
      return 'READ_ONLY';
    case 'STATE_MUTATING':
      return 'STATE_MUTATING';
    case 'PRIVILEGED_ACTUATE':
      return 'PRIVILEGED_ACTUATE';
    default:
      return '—';
  }
}

/**
 * 单项复核状态文案。
 * @param status 状态。
 * @returns 文案。
 */
export function checkStatusLabel(status: DecisionCheckLike['status']): string {
  switch (status) {
    case 'pass':
      return t('通过');
    case 'warn':
      return t('未证明');
    default:
      return t('失败');
  }
}

/**
 * 过滤列表（结果 / 回合 / 工具名）。
 * @param rows 行。
 * @param filter 结果筛选。
 * @param turnIndex 回合下标（null = 全部）。
 * @param query 工具名片段（空 = 不筛）。
 * @returns 过滤后的行。
 */
export function filterRows(
  rows: readonly DecisionRowLike[],
  filter: DecisionFilter,
  turnIndex: number | null,
  query: string,
): readonly DecisionRowLike[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (turnIndex !== null && row.turnIndex !== turnIndex) return false;
    if (needle !== '' && !row.toolName.toLowerCase().includes(needle)) return false;
    if (filter === 'allow') {
      return (
        row.disposition === 'allowed' ||
        row.disposition === 'allowed_by_conformal' ||
        row.disposition === 'allowed_by_approval'
      );
    }
    if (filter === 'escalate') {
      return row.disposition === 'escalated_pending' || row.disposition === 'approved_not_executed';
    }
    if (filter === 'deny') {
      return row.disposition === 'denied' || row.disposition === 'denied_after_conformal' || row.disposition === 'unavailable';
    }
    if (filter === 'conformal') return row.basis === 'conformal';
    return true;
  });
}

/**
 * 时间显示（iso → 本地时分秒；无效为空串）。
 * @param iso ISO 时间。
 * @returns 可读时间。
 */
export function decisionTime(iso: string): string {
  return timeOf(Date.parse(iso));
}

/**
 * 短 hash（8 位 + 省略号）。
 * @param value 完整 hash。
 * @returns 短 hash。
 */
export function shortHash(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

/**
 * 字节数可读化。
 * @param bytes 字节数。
 * @returns `184 KB` / `5.2 MB`。
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 行 tone（用于 CSS 类名）。
 * @param row 行。
 * @returns tone。
 */
export function rowTone(row: DecisionRowLike): 'allow' | 'escalate' | 'deny' | 'neutral' {
  return dispositionLabels(row.disposition).tone;
}

/**
 * 触发本地文件下载（Blob + 临时 <a>；纯本地，无网络上传）。
 * @param filename 建议文件名。
 * @param content 文本内容。
 * @param mime MIME 类型。
 * @returns 无返回值。
 */
export function downloadText(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
