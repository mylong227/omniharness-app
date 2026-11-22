import { UI_TUNABLES } from '../../config/RuntimeConfig.ts';
// 消息引用追问（2026-11-17 粘性批次）：把任意一条 user / assistant 消息以 Markdown 引用块
// 填回底部输入框，用户在引用下面直接补问题发送——模型天然能从 blockquote 分辨「哪段是历史、
// 哪段是新问题」，比口头说「关于你刚才说的…」精确得多。纯前端拼接（复用 composerSeed 回填），
// 不新造 RPC。
//
// 纯函数（零 DOM / React 依赖，可最小桩单测）。

/** 引用正文的最大字符数（超长截断；输入框塞几千字 UX 不可用，用户需要全文请走导出）。 */
const MAX_CHARS = UI_TUNABLES.quoteMaxChars;
/** 截断省略号。 */
const TAIL = '…';

/** 消息引用组装器。 */
export class MessageQuote {
  /**
   * 把消息正文组装成引用块（`>` 前缀逐行包裹 + 尾部空行，光标自然落在追问位）。
   * @param text 消息正文
   * @returns 引用文本；正文为空（无可引用内容）时为 null
   */
  public static compose(text: string): string | null {
    const body = (text ?? '').trim();
    if (body === '') return null;
    const clipped = body.length > MAX_CHARS ? body.slice(0, MAX_CHARS) + TAIL : body;
    return '> ' + clipped.split('\n').join('\n> ') + '\n\n';
  }
}
