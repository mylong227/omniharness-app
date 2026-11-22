import { AppText } from '../i18n/AppText.ts';
import { AuditFormatting } from './auditFormatting.ts';
import { AuditRedactor } from './auditRedactor.ts';
import type { AuditChainedRecord, AuditReport } from './auditTypes.ts';

/**
 * Markdown 报告渲染器（给 issue / PR / 邮件正文用）。
 *
 * 完整载荷以 `<details>` + 围栏 JSON 附在文末，前面有固定标记
 * {@link AuditMarkdownRenderer.PAYLOAD_MARKER}，`audit verify` 靠它取出载荷。
 */
export class AuditMarkdownRenderer {
  /** 载荷标记（解析器与渲染器共用的唯一字面量）。 */
  public static readonly PAYLOAD_MARKER = '<!--oh-audit-payload-->';

  /**
   * 渲染 Markdown 报告。
   * @param report 报告。
   * @returns Markdown 文本。
   */
  public render(report: AuditReport): string {
    const payload = JSON.stringify(report);
    return [
      `# ${report.title}`,
      '',
      AppText.t('> {name} {version} · 生成于 {date} · schema `{schema}`', {
        name: report.generator.name,
        version: report.generator.version,
        date: report.generatedAt,
        schema: report.schema,
      }),
      '',
      AppText.t('## 来源'),
      '',
      AppText.t('- 文件：`{path}`', { path: this.code(report.source.path) }),
      AppText.t('- 格式：`{format}` · 会话：`{session}`', {
        format: report.source.format,
        session: this.code(report.source.sessionId ?? AppText.t('未知')),
      }),
      AppText.t('- 工作区：`{workspace}` · 模型：`{model}`', {
        workspace: this.code(report.source.workspace ?? AppText.t('未知')),
        model: this.code(report.source.model ?? AppText.t('未知')),
      }),
      AppText.t('- 输入 SHA-256：`{sha}`', { sha: report.source.sha256 }),
      AppText.t('- 时间范围：{start} → {end}（{duration}）', {
        start: AuditFormatting.timestamp(report.source.startedAt),
        end: AuditFormatting.timestamp(report.source.endedAt),
        duration: AuditFormatting.duration(report.summary.durationMs),
      }),
      '',
      AppText.t('## 摘要'),
      '',
      AppText.t('| 项目 | 值 |'),
      '| ---- | -- |',
      AppText.t('| 记录 | {count} |', { count: AuditFormatting.number(report.summary.total) }),
      ...(report.coverage === undefined
        ? []
        : [
            AppText.t('| 未识别 | {count} |', {
              count: AuditFormatting.number(report.coverage.unrecognized),
            }),
          ]),
      ...(report.redaction === undefined
        ? []
        : [AppText.t('| 脱敏 | {mode} |', { mode: AuditRedactor.modeLabel(report.redaction) })]),
      AppText.t('| 工具调用 | {count} |', { count: AuditFormatting.number(report.summary.toolCalls) }),
      AppText.t('| 工具失败 | {count} |', { count: AuditFormatting.number(report.summary.toolFailures) }),
      AppText.t('| 涉及文件 | {count} |', { count: AuditFormatting.number(report.summary.filesChanged) }),
      AppText.t('| 审批 | {count} |', { count: AuditFormatting.number(report.summary.approvals) }),
      ...this.tokenRows(report),
      '',
      AppText.t('## 完整性'),
      '',
      AppText.t('- 算法：`sha256` · 链头：`{head}`', { head: report.integrity.head }),
      AppText.t('- 记录数：{count} · 创世：`{genesis}`', {
        count: AuditFormatting.number(report.integrity.count),
        genesis: report.integrity.genesis,
      }),
      AppText.t('- 复核：`omniharness audit verify <本文件>`（或与报告内嵌载荷逐字节对照）'),
      '',
      ...this.filesSection(report),
      ...this.timelineSection(report),
      AppText.t('## 完整载荷'),
      '',
      AppText.t('<details><summary>展开 JSON（哈希链覆盖其中每条记录）</summary>'),
      '',
      AuditMarkdownRenderer.PAYLOAD_MARKER,
      `${this.fenceFor(payload)}json`,
      payload,
      this.fenceFor(payload),
      '',
      '</details>',
      '',
      '---',
      '',
      AppText.t('哈希链证明“报告自生成后未被改动”，不证明会话本身真实、也不证明生成者身份。'),
    ].join('\n');
  }

  /**
   * token 行。
   * @param report 报告。
   * @returns 表格行。
   */
  private tokenRows(report: AuditReport): string[] {
    if (report.tokens === null) {
      return [];
    }
    return [
      AppText.t('| 输入 token | {count} |', { count: AuditFormatting.number(report.tokens.prompt) }),
      AppText.t('| 输出 token | {count} |', { count: AuditFormatting.number(report.tokens.completion) }),
      AppText.t('| 缓存读 token | {count} |', { count: AuditFormatting.number(report.tokens.cached) }),
      AppText.t('| 总 token | {count} |', { count: AuditFormatting.number(report.tokens.total) }),
    ];
  }

  /**
   * 文件表段。
   * @param report 报告。
   * @returns Markdown 行。
   */
  private filesSection(report: AuditReport): string[] {
    if (report.files.length === 0) {
      return [
        AppText.t('## 文件变更'),
        '',
        AppText.t('源里没有可识别的写类工具调用或 diff。'),
        '',
      ];
    }
    return [
      AppText.t('## 文件变更'),
      '',
      AppText.t('| 路径 | 触及 | 新增 | 删除 |'),
      '| ---- | ---- | ---- | ---- |',
      ...report.files.map(
        (file) =>
          `| \`${this.code(file.path)}\` | ${String(file.touches)} | +${String(file.added)} | −${String(file.removed)} |`,
      ),
      '',
    ];
  }

  /**
   * 时间线段。
   * @param report 报告。
   * @returns Markdown 行。
   */
  private timelineSection(report: AuditReport): string[] {
    const shown = report.records.slice(0, AuditFormatting.MAX_DISPLAY_RECORDS);
    const lines = [
      AppText.t('## 时间线'),
      '',
      ...(report.records.length > shown.length
        ? [
            AppText.t('> 仅展示前 {shown} 条（共 {total} 条）；完整数据见文末载荷。', {
              shown: String(shown.length),
              total: String(report.records.length),
            }),
            '',
          ]
        : []),
      AppText.t('| # | 时间 | 类别 | 事件 | 详情 |'),
      '| - | ---- | ---- | ---- | ---- |',
    ];
    for (const item of shown) {
      lines.push(this.timelineRow(item));
    }
    lines.push('');
    return lines;
  }

  /**
   * 一条时间线行。
   * @param item 带链记录。
   * @returns Markdown 行。
   */
  private timelineRow(item: AuditChainedRecord): string {
    const record = item.record;
    const status = record.status === undefined ? '' : ` (${record.status})`;
    return `| ${String(record.seq)} | ${AuditFormatting.timestamp(record.ts)} | ${record.kind} | ${AuditFormatting.markdownCell(record.title)}${status} | ${AuditFormatting.markdownCell(record.text)} |`;
  }

  /**
   * 选择围栏长度：必须比载荷里任意连续反引号更长，否则正文里的 ``` 会提前闭合围栏，
   * 回读时拿到被截断的 JSON（报告"看起来有载荷"，复核却报坏 JSON）。
   * @param payload 载荷 JSON。
   * @returns 围栏字符串。
   */
  private fenceFor(payload: string): string {
    const runs = payload.match(/`+/g) ?? [];
    const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
    return '`'.repeat(Math.max(3, longest + 1));
  }

  /**
   * 行内代码转义（反引号替换为直角引号，避免提前闭合）。
   * @param text 原始文本。
   * @returns 可放进反引号内的文本。
   */
  private code(text: string): string {
    return text.replace(/`/g, 'ˋ');
  }
}
