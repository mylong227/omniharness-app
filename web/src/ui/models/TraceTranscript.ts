// 轨迹导出（2026-11-17 粘性批次，纯函数、零 DOM）：把筛选后的工具轨迹行整理成 Markdown 文稿。
//
// 与 SessionTranscript 的分工：那份导出**对话正文**（user/assistant 全文），这份导出
// **工具时间线**（第几轮 · 时刻 · 类别 · 工具 · 状态 · 动作）——排查/复盘「这一轮到底干了
// 什么」时，轨迹比对话更有信息量，且筛选后的行正是用户此刻关心的子集（导出跟随筛选）。
// 行数据来自 TraceView 的 collectRows + filterTraceRows（前端聚合，无新 RPC）。

import type { TraceRow } from './TraceFilter.ts';
import { t } from '../i18n/i18n.ts';

/** 轨迹导出选项。 */
export interface TraceTranscriptOptions {
  /** 会话标题（空串时用 `会话`）。 */
  readonly title?: string;
  /** 导出时刻（毫秒；缺省取当前时间）。 */
  readonly now?: number;
  /** 导出时是否处于筛选态（文稿开头如实标注「只包含筛选结果」）。 */
  readonly filtered?: boolean;
  /** 筛选类别 / 搜索词（标注用；空串 = 全部）。 */
  readonly filterLabel?: string;
}

/** 轨迹文稿生成器。 */
export class TraceTranscript {
  /**
   * 生成 Markdown（按轮分节，行格式 `时刻 · 类别 · 工具 · 状态 · 动作`）。
   * @param rows 筛选后的轨迹行（TraceView 当前可见集合）
   * @param options 标题 / 时间 / 筛选标注
   * @returns Markdown 文本
   */
  public static markdown(rows: readonly TraceRow[], options: TraceTranscriptOptions = {}): string {
    const title = (options.title ?? '').trim() || t('会话');
    const now = options.now ?? Date.now();
    const lines: string[] = [
      `# ${t('轨迹导出')}${title === '' ? '' : ' · ' + title}`,
      '',
      `> ${t('导出时间：')}${new Date(now).toISOString()}`,
    ];
    if (options.filtered === true) {
      lines.push(`> ${t('说明：本稿只包含当前筛选结果（{condition}）。', { condition: options.filterLabel ?? t('自定义筛选') })}`);
    }
    lines.push('', '---', '');
    let lastTurn = 0;
    for (const row of rows) {
      if (row.turn !== lastTurn) {
        lastTurn = row.turn;
        lines.push('', `## ${t('第 {n} 轮', { n: row.turn })}`, '');
      }
      const status = row.failed ? t('失败') : row.done ? t('完成') : t('进行中');
      lines.push(`- ${row.time} · ${row.category} · \`${row.name}\` · ${status} · ${row.action}`);
    }
    if (rows.length === 0) {
      lines.push(t('（没有轨迹行）'));
    }
    return lines.join('\n').trimEnd() + '\n';
  }

  /**
   * 生成安全的下载文件名（与 SessionTranscript.filename 同规则，前缀换成轨迹）。
   * @param title 会话标题
   * @param now 导出时刻（毫秒）
   * @returns 形如 `轨迹-会话标题-2026-11-17.md`
   */
  public static filename(title: string, now: number = Date.now()): string {
    const safe = title
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 60)
      .trim();
    const day = new Date(now).toISOString().slice(0, 10);
    return `${t('轨迹')}-${safe === '' ? t('会话') : safe}-${day}.md`;
  }
}
