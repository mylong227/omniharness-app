import * as React from 'react';
import Empty from 'antd/es/empty';
import Tag from 'antd/es/tag';
import { icon } from '../../../models/Icon.ts';
import { t } from '../../../i18n/i18n.ts';
import type { DecisionRowLike, DecisionTurnSummaryLike } from '../../../../types/models.ts';
import {
  basisLabel,
  decisionTime,
  dispositionLabels,
  effectClassLabel,
  rowTone,
} from './decisionModel.ts';

/** 决策列表入参。 */
export interface DecisionListProps {
  /** 按回合分组后的行。 */
  readonly groups: readonly { readonly turn: DecisionTurnSummaryLike; readonly rows: readonly DecisionRowLike[] }[];
  /** 当前选中记录 id。 */
  readonly selectedRecordId: string | null;
  /** 选择记录。 */
  readonly onSelect: (recordId: string) => void;
}

/**
 * 决策列表（按回合分组；行是原生 button，保留键盘可达性）。
 * @param props 分组、选中与选择回调。
 * @returns 列表节点。
 */
export function DecisionList(props: DecisionListProps): React.ReactElement {
  if (props.groups.length === 0) {
    return (
      <div className="decision-empty">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('没有匹配的决策记录')} />
      </div>
    );
  }
  return (
    <div className="decision-list" aria-label={t('决策记录')}>
      {props.groups.map((group) => (
        <section key={group.turn.turnIndex} className="decision-turn" aria-label={t('第 {n} 回合', { n: group.turn.displayIndex })}>
          <header className="decision-turn__head">
            <span className="decision-turn__title">
              {group.turn.displayIndex === 0 ? t('系统回合') : t('第 {n} 回合', { n: group.turn.displayIndex })}
            </span>
            <span className="decision-turn__time">{timeRange(group.turn)}</span>
            <span className="decision-turn__count">{t('{n} 条决策', { n: group.rows.length })}</span>
          </header>
          <div className="decision-turn__rows">
            {group.rows.map((row) => (
              <DecisionRow
                key={row.recordId}
                row={row}
                selected={row.recordId === props.selectedRecordId}
                onSelect={() => props.onSelect(row.recordId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** 单行入参。 */
interface DecisionRowProps {
  readonly row: DecisionRowLike;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

/**
 * 单条决策行。
 * @param props 行 / 选中 / 选择回调。
 * @returns 行节点。
 */
function DecisionRow(props: DecisionRowProps): React.ReactElement {
  const labels = dispositionLabels(props.row.disposition);
  const tone = rowTone(props.row);
  const conformalDetail =
    props.row.basis === 'conformal' && props.row.riskScore !== undefined && props.row.threshold !== undefined
      ? `r ${formatNumber(props.row.riskScore)} < τ ${formatNumber(props.row.threshold)}`
      : '';
  return (
    <button
      type="button"
      className={`decision-row${props.selected ? ' is-selected' : ''}`}
      aria-pressed={props.selected}
      onClick={props.onSelect}
      data-decision-row="1"
    >
      <span className={`decision-dot decision-dot--${tone}`} aria-hidden="true" />
      <span className="decision-row__main">
        <span className="decision-row__line">
          <span className="decision-row__tool">{props.row.toolName}</span>
          <Tag className={`decision-tag decision-tag--${tone}`} bordered>
            {labels.disposition}
          </Tag>
          {conformalDetail !== '' ? <span className="decision-row__why">{conformalDetail}</span> : null}
        </span>
        <span className="decision-row__meta">
          <span>{basisLabel(props.row.basis)}</span>
          <span className="decision-row__dot-sep" aria-hidden="true">
            ·
          </span>
          <span>{effectClassLabel(props.row.effectClass)}</span>
          {props.row.authorizationId !== undefined ? (
            <>
              <span className="decision-row__dot-sep" aria-hidden="true">
                ·
              </span>
              <span className="decision-row__auth">{props.row.authorizationId}</span>
            </>
          ) : null}
        </span>
      </span>
      <span className="decision-row__side">
        <span className="decision-row__time">{decisionTime(props.row.at)}</span>
        <span className="decision-row__chevron" aria-hidden="true">
          {icon('chevron-down', { size: 14, className: 'decision-row__chevron-icon' })}
        </span>
      </span>
    </button>
  );
}

/**
 * 回合时间范围。
 * @param turn 回合摘要。
 * @returns `14:32 – 14:41`；无效时间返回空串。
 */
function timeRange(turn: DecisionTurnSummaryLike): string {
  const start = decisionTime(turn.startedAt);
  const end = decisionTime(turn.endedAt);
  if (start === '') return '';
  return end === '' || end === start ? start : `${start} – ${end}`;
}

/**
 * 数字短格式（0.122 / 0.18）。
 * @param value 数字。
 * @returns 最多 3 位小数。
 */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '');
}

