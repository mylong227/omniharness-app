/**
 * 会话置顶（2026-11-06 实用性打磨）：把常用会话钉在列表最前。
 *
 * 为什么只存**客户端**：置顶是纯界面偏好（不改变服务端会话顺序与归档语义），
 * 服务端 SessionArchive 的排序契约（mtime + 手动 reorder）不为它加字段——
 * localStorage `omni-pinned-sessions` 即唯一事实源，跨重启保留，不随设备同步。
 *
 * 容量上限（50）：防「什么都置顶」退化成无置顶；超出后最旧的自动落榜（FIFO）。
 */

/** localStorage 键。 */
export const SESSION_PINS_KEY = 'omni-pinned-sessions';

/** 置顶容量上限（超出 FIFO 淘汰最旧）。 */
export const SESSION_PINS_CAP = 50;

/** 只读存储的最小接口（测试可注入内存实现）。 */
interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 会话置顶登记表。 */
export class SessionPins {
  /**
   * 读全部置顶 id（保持置顶先后顺序；存储缺失/损坏一律按空表处理——偏好数据不值得 fail-closed）。
   * @param store 存储源（缺省 localStorage；非浏览器环境回空表）。
   * @returns 置顶 id 集合（按置顶先后排序）。
   */
  public static all(store: KeyValueStore | undefined = SessionPins.defaultStore()): Set<string> {
    const raw = store?.getItem(SESSION_PINS_KEY) ?? null;
    if (raw === null) return new Set();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    } catch {
      return new Set();
    }
  }

  /**
   * 切换某会话的置顶态（已置顶 → 取消；未置顶 → 追加，超容量淘汰最旧）。
   * @param id 会话 id。
   * @param store 存储源（缺省 localStorage）。
   * @returns 切换后的全量置顶 id（先后顺序）。
   */
  public static toggle(id: string, store: KeyValueStore | undefined = SessionPins.defaultStore()): string[] {
    const current = [...SessionPins.all(store)];
    // 追加后保留**最后** CAP 个 = FIFO 淘汰最旧（置顶是偏好不是档案，值得给上限）。
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id].slice(-SESSION_PINS_CAP);
    store?.setItem(SESSION_PINS_KEY, JSON.stringify(next));
    return next;
  }

  /** 浏览器存储（非浏览器环境 undefined ⇒ 全部操作安全退化为空转）。 */
  private static defaultStore(): KeyValueStore | undefined {
    const g = globalThis as unknown as { localStorage?: KeyValueStore };
    return g.localStorage;
  }
}
