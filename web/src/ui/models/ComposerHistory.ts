// 输入历史（2026-11-17 粘性批次）：空输入框按 ↑ 调上一条已发送消息，↑/↓ 翻阅，↓ 越过
// 最新一条回到按下 ↑ 之前的草稿——终端 / IDE 输入框的通用习惯，省掉「编辑重发只认末条」
// 的局限（历史可以从任意一条开始改）。
//
// 纯逻辑（无 React / DOM 依赖，可最小桩单测）；接管规则（何时翻、何时放行给光标移动）
// 在 composerKeyboard.ts。内存态即可：历史的价值是「刚才发过的」，跨重启持久化反而会把
// 旧任务语境带进新的一天。

/** 历史条目上限。 */
const MAX_ITEMS = 50;

/** 输入历史：已发送消息的环形翻阅。 */
export class ComposerHistory {
  private items: string[] = [];
  /** 当前翻阅下标（-1 = 未在翻阅态）。 */
  private idx = -1;
  /** 进入翻阅态那一刻输入框里的文本（↓ 越过最新时归还）。 */
  private saved = '';

  /**
   * 追加一条已发送消息（连续重复去重；进入翻阅态即复位）。
   * @param text 已发送文本
   * @returns 无
   */
  public push(text: string): void {
    const trimmed = text.trim();
    if (trimmed === '') return;
    if (this.items[this.items.length - 1] === trimmed) return;
    this.items.push(trimmed);
    if (this.items.length > MAX_ITEMS) this.items.shift();
    this.idx = -1;
  }

  /**
   * 按 ↑：空文本进入翻阅态取最新一条；翻阅态里往更早走（到最早后停住）。
   * @param current 输入框当前文本（首次进入时存作 saved）
   * @returns 应回填的文本；无历史时为 null（调用方放行给默认行为）
   */
  public up(current: string): string | null {
    if (this.idx === -1) {
      if (this.items.length === 0) return null;
      this.saved = current;
      this.idx = this.items.length - 1;
      return this.items[this.idx] ?? null;
    }
    if (this.idx > 0) this.idx--;
    return this.items[this.idx] ?? null;
  }

  /**
   * 按 ↓：翻阅态里往最新走；越过最新一条时归还进入翻阅态前的文本（saved）。
   * 非翻阅态返回 null（放行给光标移动）。
   * @returns 应回填的文本；无下一步为 null
   */
  public down(): string | null {
    if (this.idx === -1) return null;
    if (this.idx < this.items.length - 1) {
      this.idx++;
      return this.items[this.idx] ?? null;
    }
    this.idx = -1;
    return this.saved;
  }

  /** 是否处于翻阅态（翻阅态下非空文本也接管 ↑/↓）。 */
  public active(): boolean {
    return this.idx !== -1;
  }

  /** 退出翻阅态（用户在回填的文本上继续输入时调用）。 */
  public break(): void {
    this.idx = -1;
  }
}

/** 应用级单例：Composer 不按会话重挂，但保持跨组件实例一致更稳（测试自建实例）。 */
export const composerHistory = new ComposerHistory();
