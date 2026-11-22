// 输入历史（2026-11-17 粘性批次）：空输入框按 ↑ 调上一条已发送消息，↑/↓ 翻阅，↓ 越过
// 最新一条回到按下 ↑ 之前的草稿——终端 / IDE 输入框的通用习惯，省掉「编辑重发只认末条」
// 的局限（历史可以从任意一条开始改）。
//
// 纯逻辑（无 React / DOM 依赖）；接管规则（何时翻、何时放行给光标移动）在 composerKeyboard.ts。
//
// 持久化（2026-11-20 遗留 #8 闭环，按天档）：同一天重启可找回「刚才发过的」（浏览器刷新
// 不再丢），跨天自动清空——「旧任务语境不带进新的一天」的原设计精神保留。存储通道构造注入
// （node 判据传桩）；缺省单例接 localStorage，不可用（隐私模式/quota）静默退回内存态。

/** 持久化通道（注入以便 node 直测；键 = omni.inputHistory.<YYYY-MM-DD>，值 = {day, items}）。 */
export interface HistoryStorage {
  /** 读键值；无该键返回 null。 */
  read(key: string): string | null;
  /** 写键值。 */
  write(key: string, value: string): void;
}

/** 历史条目上限。 */
const MAX_ITEMS = 50;

/** 存储键前缀（后缀为当天日期键）。 */
const STORAGE_PREFIX = 'omni.inputHistory.';

/** 存储载荷形状（带日期键，装载时据此拒绝隔天数据）。 */
interface StoredHistory {
  day: string;
  items: string[];
}

/**
 * 当天日期键（本地时区 YYYY-MM-DD；按天档的判定源）。
 * @param now 当前时刻
 * @returns 日期键
 */
function dayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 浏览器存储适配：localStorage 可用则包装成通道，否则返回 undefined（纯内存态）。
 * @returns 通道；不可用时 undefined
 */
function browserStorage(): HistoryStorage | undefined {
  try {
    const ls = globalThis.localStorage;
    if (ls === undefined) return undefined;
    return {
      read: (key) => ls.getItem(key),
      write: (key, value) => {
        ls.setItem(key, value);
      },
    };
  } catch {
    return undefined;
  }
}

/** 输入历史：已发送消息的环形翻阅（按天持久化）。 */
export class ComposerHistory {
  private items: string[] = [];
  /** 当前翻阅下标（-1 = 未在翻阅态）。 */
  private idx = -1;
  /** 进入翻阅态那一刻输入框里的文本（↓ 越过最新时归还）。 */
  private saved = '';
  /** 当前历史所属日期键（跨天即清空重计）。 */
  private day: string;
  /** 持久化通道（undefined = 纯内存态）。 */
  private readonly storage: HistoryStorage | undefined;
  /** 时钟（注入以便判据模拟跨天）。 */
  private readonly clock: () => Date;

  /**
   * @param storage 持久化通道（缺省 undefined = 纯内存态）
   * @param clock 时钟（缺省系统时间）
   */
  public constructor(storage?: HistoryStorage, clock?: () => Date) {
    this.storage = storage;
    this.clock = clock ?? (() => new Date());
    this.day = dayKey(this.clock());
    if (this.storage !== undefined) this.load();
  }

  /** 从通道装载当天的历史；隔天载荷 / 解析失败一律忽略（fail-soft 回内存态）。 */
  private load(): void {
    if (this.storage === undefined) return;
    try {
      const raw = this.storage.read(STORAGE_PREFIX + this.day);
      if (raw === null) return;
      const parsed = JSON.parse(raw) as Partial<StoredHistory>;
      if (parsed.day !== this.day || !Array.isArray(parsed.items)) return;
      this.items = parsed.items.filter((item): item is string => typeof item === 'string').slice(-MAX_ITEMS);
    } catch {
      // 损坏载荷不阻断输入框：静默当空历史。
    }
  }

  /** 持久化当前列表（带日期键；通道异常静默吞掉——历史丢一页不致命）。 */
  private persist(): void {
    if (this.storage === undefined) return;
    try {
      this.storage.write(STORAGE_PREFIX + this.day, JSON.stringify({ day: this.day, items: this.items }));
    } catch {
      // quota / 隐私模式：内存态继续用。
    }
  }

  /** 跨天滚动：日期键变化即清空重计（重启按天装载与会话内跨零点同规）。 */
  private ensureDay(): void {
    const today = dayKey(this.clock());
    if (today !== this.day) {
      this.day = today;
      this.items = [];
      this.idx = -1;
      this.saved = '';
    }
  }

  /**
   * 追加一条已发送消息（连续重复去重；进入翻阅态即复位）并持久化。
   * @param text 已发送文本
   * @returns 无
   */
  public push(text: string): void {
    this.ensureDay();
    const trimmed = text.trim();
    if (trimmed === '') return;
    if (this.items[this.items.length - 1] === trimmed) return;
    this.items.push(trimmed);
    if (this.items.length > MAX_ITEMS) this.items.shift();
    this.idx = -1;
    this.persist();
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

/** 应用级单例：接浏览器 localStorage（按天档）；node/不可用环境自动退内存态。 */
export const composerHistory = new ComposerHistory(browserStorage());
