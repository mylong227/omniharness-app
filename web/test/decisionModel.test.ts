import { describe, expect, it } from 'vitest';
import {
  basisLabel,
  dispositionLabels,
  filterRows,
  formatBytes,
  shortHash,
} from '../src/ui/components/tabs/decision/decisionModel.ts';
import type { DecisionRowLike } from '../src/types/models.ts';

/** 造一条最小行。 */
function row(overrides: Partial<DecisionRowLike> = {}): DecisionRowLike {
  return {
    recordId: 'aat_1',
    turnIndex: 0,
    displayIndex: 1,
    at: '2026-11-11T10:00:00.000Z',
    toolName: 'write_file',
    result: 'allow',
    disposition: 'allowed_by_conformal',
    basis: 'conformal',
    ...overrides,
  };
}

describe('decisionModel', () => {
  it('过滤：结果 / 回合 / 工具名', () => {
    const rows = [
      row({ recordId: 'a', turnIndex: 0, disposition: 'allowed_by_conformal', toolName: 'write_file' }),
      row({ recordId: 'b', turnIndex: 1, disposition: 'denied', basis: 'rule', toolName: 'shell' }),
      row({ recordId: 'c', turnIndex: 1, disposition: 'escalated_pending', basis: 'human', toolName: 'apply_patch' }),
    ];
    expect(filterRows(rows, 'all', null, '').length).toBe(3);
    expect(filterRows(rows, 'allow', null, '').map((item) => item.recordId)).toEqual(['a']);
    expect(filterRows(rows, 'deny', null, '').map((item) => item.recordId)).toEqual(['b']);
    expect(filterRows(rows, 'escalate', null, '').map((item) => item.recordId)).toEqual(['c']);
    expect(filterRows(rows, 'conformal', null, '').map((item) => item.recordId)).toEqual(['a']);
    expect(filterRows(rows, 'all', 1, '').map((item) => item.recordId)).toEqual(['b', 'c']);
    expect(filterRows(rows, 'all', null, 'SHELL').map((item) => item.recordId)).toEqual(['b']);
  });

  it('共形被后续拒绝必须显示“拒绝”，不能显示“放行”', () => {
    expect(dispositionLabels('denied_after_conformal').disposition).toBe('拒绝');
    expect(dispositionLabels('denied_after_conformal').tone).toBe('deny');
    expect(basisLabel('conformal')).toBe('共形放行');
  });

  it('短 hash / 体积格式化', () => {
    expect(shortHash('abcdef0123456789')).toBe('abcdef012345…');
    expect(shortHash(null)).toBe('—');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
