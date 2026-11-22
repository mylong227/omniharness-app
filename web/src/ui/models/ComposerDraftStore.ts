import { UI_TUNABLES } from '../../config/RuntimeConfig.ts';
// 会话草稿库（2026-11-17 粘性批次）。
//
// ## 为什么需要它
//
// 底部输入框是非受控 textarea 且**不按会话重挂**（App 的 StreamView 无 key）：切会话时
// 同一份文本残留到另一个会话（串稿），刷新 / 重开即丢（白打一段长 prompt）。用户预期是
// 「每个会话有自己的一块草稿纸」——这正是 IDE / IM 的通用行为。
//
// ## 语义
//
//   · 以 threadId 为键；null / undefined（新会话态）归入空串键——新会话的草稿同样保留；
//   · write 空文本 = 删除该键（发送后不留空壳条目）；
//   · localStorage 兜底（刷新可恢复），读写全部 try/catch：存储不可用（隐私模式 / 配额）
//     时退化为「内存级不串稿」，绝不因存储失败抛错；
//   · 条目上限 32：超出时按插入序淘汰最旧（草稿不是收藏夹，太久远的必然已经发出去）。

/** 存储键（localStorage）。 */
const STORAGE_KEY = 'omni-composer-drafts';
/** 条目上限：超出按插入序淘汰最旧。 */
const MAX_ENTRIES = UI_TUNABLES.draftMaxEntries;

/** 输入框草稿库：按会话 id 保留未发送文本。 */
export class ComposerDraftStore {
  /** 内存缓存（懒加载自 localStorage；存储不可用时仅内存）。 */
  private static cache: Map<string, string> | null = null;
  /** localStorage 是否可用（不可用则只进内存）。 */
  private static persistent = true;

  /**
   * 读一个会话的草稿。
   * @param threadId 会话 id（null / undefined = 新会话态）
   * @returns 草稿文本；无草稿为空串
   */
  public static read(threadId: string | null | undefined): string {
    return ComposerDraftStore.map().get(ComposerDraftStore.keyOf(threadId)) ?? '';
  }

  /**
   * 写一个会话的草稿（空文本 = 删除）。
   * @param threadId 会话 id（null / undefined = 新会话态）
   * @param text 草稿文本
   * @returns 无
   */
  public static write(threadId: string | null | undefined, text: string): void {
    const key = ComposerDraftStore.keyOf(threadId);
    const map = ComposerDraftStore.map();
    if (text === '') {
      if (!map.delete(key)) return;
    } else {
      if (map.get(key) === text) return;
      // 先删后插：Map 保持插入序，重写的条目挪到末尾（淘汰时按「最久未写」序）。
      map.delete(key);
      map.set(key, text);
    }
    while (map.size > MAX_ENTRIES) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
    ComposerDraftStore.persist();
  }

  /**
   * 清除一个会话的草稿（发送后的清场）。
   * @param threadId 会话 id
   * @returns 无
   */
  public static clear(threadId: string | null | undefined): void {
    ComposerDraftStore.write(threadId, '');
  }

  /** 键归一：新会话态（null / undefined）统一为空串键。 */
  private static keyOf(threadId: string | null | undefined): string {
    return threadId ?? '';
  }

  /** 内存缓存（首次访问时从 localStorage 恢复）。 */
  private static map(): Map<string, string> {
    if (ComposerDraftStore.cache !== null) return ComposerDraftStore.cache;
    const map = new Map<string, string>();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v !== '') map.set(k, v);
        }
      }
    } catch {
      // 恢复失败按无草稿处理（隐私模式 / 损坏数据）：绝不因存储抛错。
    }
    ComposerDraftStore.cache = map;
    return map;
  }

  /** 落盘（写失败只降级为内存态，并把后续写入也停掉以免重复尝试）。 */
  private static persist(): void {
    if (!ComposerDraftStore.persistent) return;
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of ComposerDraftStore.cache ?? []) obj[k] = v;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      ComposerDraftStore.persistent = false;
    }
  }
}
