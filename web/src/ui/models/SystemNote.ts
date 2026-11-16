// 系统注记的归一化：把一条 system 事件文本判成「折叠卡的视图模型」（纯逻辑，零 React 依赖）。
//
// 背景（2026-11-16 用户截图反馈）：对话流里的 system 事件此前只有两种形态——
// 一行 `— 旁白 —`，或（压缩游标特例）一整段平铺的原文。但真实会话里存在**第三类**：
// 上下文中继内容（工作流记忆召回、带证据的压缩游标、长期记忆对齐……）。它们的共同点不是
// 「长」，而是**机器写给机器看的**：一行上千字的 `→ shell … → read_file …`、几 KB 的
// `evidence=` base64、`【任务目标】` 这类无排版的段落标签。把它们按纯文本平铺，用户得到的
// 就是一张没有格式的墙（截图原话：「不要这样没有格式展示，不美观」）。
//
// 本模型负责「怎么收」与「收起来之后先让人看到什么」：
//   · 压缩游标：标题 + 游标/字数 + 首行摘要 + 证据 chip；展开是**分节后的 Markdown**；
//   · 工作流记忆：标题 + 步数 + 引导语；展开是**逐条编号的步骤**，而不是一串 `→`；
//   · 其余长注记：标题（取行首 `【标签】`）+ 字数 + 首行摘要；展开保留换行的原文。
// 短注记（一两句旁白）不在这里处理：调用方仍按一行 `— 旁白 —` 渲染，别让每句系统话术都变成卡。
//
// 判据全部是纯函数（阈值 / 摘录 / 分节），故可在 node 下直接单测；组件只消费结论。

import {
  CompactionNote,
  type CompactionEvidenceParts,
  type CompactionNoteParts,
} from './CompactionNote.ts';
import { WorkflowMemoryNote, type WorkflowMemoryParts } from './WorkflowMemoryNote.ts';
import { NumberFormatter } from './NumberFormatter.ts';
import { t } from '../i18n/i18n.ts';

/** 注记种类（决定图标、标题与展开后的正文形态）。 */
export type SystemNoteKind = 'compaction' | 'memory' | 'plain';

/** 展开态正文：分节后的 Markdown / 有序步骤 / 保留换行的原文。 */
export type SystemNoteBody =
  | { readonly type: 'markdown'; readonly markdown: string }
  | { readonly type: 'steps'; readonly steps: readonly string[] }
  | { readonly type: 'text'; readonly text: string };

/** chip 的信号色温：前置圆点用什么语义色（文字本身保持中性，信号不铺满）。 */
export type SystemNoteChipTone = 'ok' | 'warn' | 'err' | 'info';

/** 展开态头条 chip：文案 + 信号色温。 */
export interface SystemNoteChip {
  /** chip 文案（已本地化 / 已插值）。 */
  readonly text: string;
  /** 信号色温。 */
  readonly tone: SystemNoteChipTone;
}

/** 折叠卡的视图模型（全部字段已本地化 / 已插值，组件不再做判断）。 */
export interface SystemNoteView {
  /** 注记种类。 */
  readonly kind: SystemNoteKind;
  /** 折叠态标题。 */
  readonly title: string;
  /** 折叠态元信息（游标、字数、步数…）。 */
  readonly meta: string;
  /** 折叠态一行摘要（纯文本，已剥掉 markdown 修饰）。 */
  readonly excerpt: string;
  /** 展开态头条 chip（压缩证据等；可为空）。 */
  readonly chips: readonly SystemNoteChip[];
  /** 展开态正文。 */
  readonly body: SystemNoteBody;
}

/** 系统注记归类器：判定一条 system 文本该不该收成折叠卡，并产出视图模型。 */
export class SystemNote {
  /** 普通注记的字符阈值：超过即折叠。旁白本就该短，阈值刻意远低于助手长文。 */
  public static readonly PLAIN_FOLD_CHARS = 240;
  /** 普通注记的行数阈值：清单式内容按行兜底（单行很长的情况由字符阈值接住）。 */
  public static readonly PLAIN_FOLD_LINES = 4;
  /** 折叠态摘要的最大字符数。 */
  public static readonly EXCERPT_CHARS = 96;
  /** 行首方括号标签的最大长度（`【长期记忆 · 开工前对齐】` 这类结构标题）。 */
  private static readonly LABEL_MAX = 32;

  /**
   * 归类一条系统事件文本。
   * @param content 系统事件 payload.content
   * @returns 折叠卡视图；短旁白（应保持一行渲染）时为 null
   */
  public static classify(content: string): SystemNoteView | null {
    if (!content) return null;
    const compaction = CompactionNote.parse(content);
    if (compaction !== null) return SystemNote.compactionView(compaction);
    const memory = WorkflowMemoryNote.parse(content);
    if (memory !== null) return SystemNote.memoryView(memory);
    if (!SystemNote.isLongPlain(content)) return null;
    return SystemNote.plainView(content);
  }

  /**
   * 分节：把「独占一行（或行首）的 `【标签】`」提升为四号标题，其余原样保留。
   *
   * 为什么值得做：压缩摘要的骨架就是这些方括号标签（`【任务目标（用户原始请求）】` /
   * `【历史经过】` / `【前期摘要】`），平铺时它们和正文一样灰、一样长，读者找不到段落边界。
   * 只改结构、不改一个字：标签保留，标签后同一行的内容挪到下一段（否则标题会把正文吞进去）。
   * 围栏代码块内一律不动（那里可能是 Markdown 语法示例本身）。
   * @param markdown 摘要原文（Markdown）
   * @returns 分节后的 Markdown
   */
  public static sectionize(markdown: string): string {
    const out: string[] = [];
    let inFence = false;
    for (const raw of markdown.split(/\r?\n/u)) {
      if (/^\s*(?:```|~~~)/u.test(raw)) {
        inFence = !inFence;
        out.push(raw);
        continue;
      }
      if (inFence) {
        out.push(raw);
        continue;
      }
      const hit = /^\s*【([^】\n]{1,40})】\s*(.*)$/u.exec(raw);
      if (hit === null) {
        out.push(raw);
        continue;
      }
      out.push('', `#### 【${hit[1] ?? ''}】`, '');
      const rest = (hit[2] ?? '').trim();
      if (rest !== '') out.push(rest, '');
    }
    return out.join('\n');
  }

  /**
   * 折叠态摘要：取首个「有内容」的行，剥掉结构标签与 markdown 修饰，压成单行。
   * 结构标签**独占一行**时跳过（它已经进了标题）；标签后面跟着正文时取标签之后的正文
   * （`【长期记忆 · 开工前对齐】以下是…` 的摘要应该是「以下是…」，而不是再念一遍标签）。
   * @param text 注记正文
   * @returns 摘要（≤96 字符 + 省略号）；取不到内容时为空串
   */
  public static excerptOf(text: string): string {
    for (const raw of text.split(/\r?\n/u)) {
      const line = raw.trim();
      if (line === '' || line === '---') continue;
      if (/^#{1,6}\s/u.test(line)) continue;
      let body = line;
      if (SystemNote.labelOf(line) !== undefined) {
        body = line.replace(/^\s*【[^】\n]{1,40}】\s*/u, '').trim();
        if (body === '') continue;
      }
      const plain = body
        .replace(/^>\s?/u, '')
        .replace(/^[-*+]\s+/u, '')
        .replace(/^\d+[.)]\s+/u, '')
        .replace(/【[^】\n]{1,40}】/gu, '')
        .replace(/[*_`~]/gu, '')
        .replace(/\s+/gu, ' ')
        .trim();
      if (plain === '') continue;
      return plain.length > SystemNote.EXCERPT_CHARS
        ? plain.slice(0, SystemNote.EXCERPT_CHARS) + '…'
        : plain;
    }
    return '';
  }

  /**
   * 取行首方括号标签（`【长期记忆 · 开工前对齐】以下是…` → `长期记忆 · 开工前对齐`）。
   * @param line 单行文本
   * @returns 标签文本；行首不是合法标签时为 undefined
   */
  public static labelOf(line: string): string | undefined {
    const hit = /^\s*【([^】\n]{1,40})】/u.exec(line);
    if (hit === null) return undefined;
    const label = (hit[1] ?? '').trim();
    if (label === '' || label.length > SystemNote.LABEL_MAX) return undefined;
    return label;
  }

  /**
   * 压缩游标视图：游标与摘要字数进元信息，证据解成 chip，摘要分节后交 Markdown 渲染。
   * @param note 已解析的压缩游标
   * @returns 视图模型
   */
  private static compactionView(note: CompactionNoteParts): SystemNoteView {
    return {
      kind: 'compaction',
      title: t('上下文已压缩'),
      meta: [
        t('游标 {n}', { n: String(note.upTo) }),
        t('摘要约 {n} 字', { n: NumberFormatter.abbrev(note.summary.length) }),
      ].join(' · '),
      excerpt: SystemNote.excerptOf(note.summary),
      chips: SystemNote.evidenceChips(note.evidenceRaw, note.evidence),
      body: { type: 'markdown', markdown: SystemNote.sectionize(note.summary) },
    };
  }

  /**
   * 工作流记忆视图：步数进元信息，引导语当摘要，步骤逐条排版。
   * @param note 已解析的召回事件
   * @returns 视图模型
   */
  private static memoryView(note: WorkflowMemoryParts): SystemNoteView {
    const preamble = note.preamble.replace(/[：:]\s*$/u, '').trim();
    return {
      kind: 'memory',
      title: t('工作流记忆参考'),
      meta: [t('{n} 步', { n: note.steps.length }), t('仅作参考')].join(' · '),
      excerpt: preamble === '' ? note.steps[0] ?? '' : preamble,
      chips: [],
      body: { type: 'steps', steps: note.steps },
    };
  }

  /**
   * 普通长注记视图：行首 `【标签】` 当标题（没有就退回「系统注记」），正文按形态选渲染方式。
   *
   * 为什么正文分两种：系统旁白常是「一句话 + 若干换行」，直接上 Markdown 会把单换行折成空格、
   * 丢掉分行的信息；而带列表 / 标题 / 围栏的注记又恰恰需要 Markdown 才排得开。所以只在
   * **块级标记至少出现两处**时才走 Markdown（`looksLikeMarkdown`），否则保留换行的原文。
   * @param content 系统事件原文
   * @returns 视图模型
   */
  private static plainView(content: string): SystemNoteView {
    const firstLine = content.split(/\r?\n/u).find((line) => line.trim() !== '') ?? '';
    const label = SystemNote.labelOf(firstLine);
    return {
      kind: 'plain',
      title: label ?? t('系统注记'),
      meta: t('{n} 字', { n: NumberFormatter.abbrev(content.length) }),
      excerpt: SystemNote.excerptOf(content),
      chips: [],
      body: SystemNote.looksLikeMarkdown(content)
        ? { type: 'markdown', markdown: content }
        : { type: 'text', text: content },
    };
  }

  /**
   * 正文是否具备 Markdown 的块级结构（标题 / 列表 / 引用 / 表格 / 围栏各算一处）。
   * @param text 注记正文
   * @returns 至少两处块级标记则 true
   */
  private static looksLikeMarkdown(text: string): boolean {
    let blocks = 0;
    for (const raw of text.split(/\r?\n/u)) {
      if (/^(?:#{1,6}\s|```|~~~|>|[-*+]\s|\d+[.)]\s|\|)/u.test(raw.trim())) blocks++;
      if (blocks >= 2) return true;
    }
    return false;
  }

  /**
   * 压缩证据 chip：审计齐全度 + 触发信号；有证据但解不开时如实说明（不静默吞掉）。
   * 色温随语义走：审计齐全=ok、缺项=warn、触发预算=info、证据解不开=err——
   * 收起态看不到正文，展开后第一眼就该由色点告诉用户「这轮压缩干不干净」。
   * @param raw 原始证据串（未附带时为 undefined）
   * @param evidence 解码结果（失败时为 undefined）
   * @returns chip 数组（文案 + 信号色温）
   */
  private static evidenceChips(
    raw: string | undefined,
    evidence: CompactionEvidenceParts | undefined,
  ): readonly SystemNoteChip[] {
    if (raw === undefined) return [];
    if (evidence === undefined) return [{ text: t('压缩证据无法解码'), tone: 'err' }];
    const chips: SystemNoteChip[] = [];
    const audit = evidence.audit;
    if (audit !== undefined) {
      chips.push(
        audit.ok
          ? {
              text: t('审计 ✓ 文件 {f} · 命令 {c} · 待办 {o}', {
                f: String(audit.checked.editedFiles),
                c: String(audit.checked.commands),
                o: String(audit.checked.openTodos),
              }),
              tone: 'ok',
            }
          : { text: t('审计缺 {n} 项', { n: String(audit.missing.length) }), tone: 'warn' },
      );
    }
    const signals = evidence.signals;
    if (signals !== undefined) {
      chips.push({
        text: t('触发预算 {p}% · {n} 轮', {
          p: String(Math.round(signals.budgetRatio * 100)),
          n: String(signals.turns),
        }),
        tone: 'info',
      });
    }
    return chips;
  }

  /**
   * 普通注记是否该折叠：字符数或行数任一超限。
   * @param content 系统事件原文
   * @returns 应收起则 true
   */
  private static isLongPlain(content: string): boolean {
    if (content.length > SystemNote.PLAIN_FOLD_CHARS) return true;
    let lines = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) lines++;
      if (lines > SystemNote.PLAIN_FOLD_LINES) return true;
    }
    return false;
  }
}
