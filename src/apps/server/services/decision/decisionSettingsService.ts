import type { DecisionSettings } from './decisionTypes.ts';
import type { DecisionSettingsStore } from './decisionSettingsStore.ts';

/** 主体长度上限（防止设置文件被塞入超长文本）。 */
const MAX_PRINCIPAL_LENGTH = 200;

/**
 * 决策审计设置服务：校验 + 持久化 + 失效 Agent 缓存。
 *
 * 写入后必须让运行时重建：`auditRecords` / `auditPrincipal` 在 Agent 构造时烘焙；
 * 不失效就会「设置已保存、下一回合仍用旧审计开关」。
 */
export class DecisionSettingsService {
  /** 设置存储。 */
  private readonly store: DecisionSettingsStore;
  /** 设置变更后的回调（组合根注入运行时失效）。 */
  private readonly onChanged: () => void;

  /**
   * @param store 用户级设置存储。
   * @param onChanged 变更回调（重建 Agent / 图端口）。
   */
  public constructor(store: DecisionSettingsStore, onChanged: () => void) {
    this.store = store;
    this.onChanged = onChanged;
  }

  /**
   * 当前设置。
   * @returns 关闭 / 开启 + 可选主体。
   */
  public get(): DecisionSettings {
    return this.store.load();
  }

  /**
   * 保存设置；写盘成功后回调失效运行时。
   * @param enabled 是否开启。
   * @param principal 授权主体（空白串归一为 undefined）。
   * @returns 保存后的设置。
   * @throws Error 主体超长 / 写盘失败（原样抛给 RPC 层）。
   */
  public configure(enabled: boolean, principal: string | undefined): DecisionSettings {
    const trimmed = principal?.trim() ?? '';
    if (trimmed.length > MAX_PRINCIPAL_LENGTH) {
      throw new Error(`授权主体最多 ${String(MAX_PRINCIPAL_LENGTH)} 个字符。`);
    }
    const next: DecisionSettings = {
      enabled,
      ...(trimmed !== '' ? { principal: trimmed } : {}),
    };
    this.store.save(next);
    this.onChanged();
    return next;
  }
}
