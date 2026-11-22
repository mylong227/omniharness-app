// 会话导出（纯函数、零 DOM）：把事件流整理成一份可读的 Markdown 文稿。
//
// 用途：命令面板「导出当前会话」把对话落到本地 .md，便于归档 / 贴 issue / 交给别的模型。
// 只导**人读得懂的部分**：
//   · user / assistant / system 正文；
//   · 工具调用与结果各一行（名称 + 成败；不展开原始 JSON，避免把导出变成日志转储）；
//   · 时间戳用 ISO，便于跨时区复核；
//   · 不导出 reasoning（它是模型内部过程，且常含被撤回的中间判断）。
//
// 导出是**当前视图已加载的事件**，不是服务端全量：更早历史未加载时文稿开头会如实标注。

import type { ThreadEvent } from '../../types/models.ts';
import { EventFields } from './EventFields.ts';
import { t } from '../i18n/i18n.ts';

/** 导出选项。 */
export interface TranscriptOptions {
  /** 会话标题（空串时用 `会话`）。 */
  readonly title?: string;
  /** 导出时刻（毫秒；缺省取当前时间）。 */
  readonly now?: number;
  /** 是否还有更早历史未加载（为 true 时在文稿开头标注）。 */
  readonly partial?: boolean;
}

/** Markdown 文稿生成器。 */
export class SessionTranscript {
  /**
   * 生成 Markdown。
   * @param events 当前已加载事件
   * @param options 标题 / 时间 / 是否部分导出
   * @returns Markdown 文本
   */
  public static markdown(events: readonly ThreadEvent[], options: TranscriptOptions = {}): string {
    // 文案过 t()（2026-11-17 i18n 收口）：导出的 .md 会被归档/外发，en 界面下不该是中文文稿。
    const title = (options.title ?? '').trim() || t('会话');
    const now = options.now ?? Date.now();
    const lines: string[] = [`# ${title}`, '', `> ${t('导出时间：')}${new Date(now).toISOString()}`];
    if (options.partial === true) {
      lines.push(`> ${t('说明：更早的历史尚未加载，本稿只包含当前已加载区间。')}`);
    }
    lines.push('', '---', '');

    for (const ev of events) {
      const at = EventFields.timestamp(ev);
      const atText = at > 0 ? new Date(at).toISOString() : '';
      const suffix = atText === '' ? '' : ` · ${atText}`;
      if (ev.type === 'user') {
        SessionTranscript.pushSection(lines, `${t('你')}${suffix}`, EventFields.content(ev));
      } else if (ev.type === 'assistant') {
        SessionTranscript.pushSection(lines, `OmniHarness${suffix}`, EventFields.content(ev));
      } else if (ev.type === 'system') {
        SessionTranscript.pushSection(lines, `${t('系统')}${suffix}`, EventFields.content(ev));
      } else if (ev.type === 'tool_call') {
        const name = EventFields.toolName(ev) || 'tool';
        lines.push(`- ${t('工具调用：')}\`${name}\``, '');
      } else if (ev.type === 'tool_result') {
        const ok = ev.payload?.['ok'] === true;
        lines.push(`- ${t('工具结果：')}${ok ? t('成功') : t('失败')}`, '');
      }
    }

    return lines.join('\n').trimEnd() + '\n';
  }

  /**
   * 生成安全的下载文件名（去掉路径分隔符与保留字符）。
   * @param title 会话标题
   * @param now 导出时刻（毫秒）
   * @returns 形如 `会话标题-2026-11-10.md`
   */
  public static filename(title: string, now: number = Date.now()): string {
    const safe = title
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 60)
      .trim();
    const day = new Date(now).toISOString().slice(0, 10);
    return `${safe === '' ? t('会话') : safe}-${day}.md`;
  }

  /**
   * 追加一段正文（空正文不占位）。
   * @param lines 输出缓冲
   * @param heading 小节标题
   * @param body 正文
   * @returns 无
   */
  private static pushSection(lines: string[], heading: string, body: string): void {
    if (body.trim() === '') return;
    lines.push(`## ${heading}`, '', body.trim(), '');
  }
}
