// context 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** context 域的 RPC 面。 */
export class ContextApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public contextUsage(threadId: string): Promise<import('../../types/models.ts').ContextUsageReport> {
    return this.rpc('context.usage', { threadId });
  }
  /**
   * 治理台台账（F2：进化晋升历史 + 回滚锚点视图；组件层统一走本封装，不直发 rpc）。
   * 返回形状（GovernanceHistory 联合类型）由调用方给出——它依赖组件本地的 GovernanceRow，
   * 不上提到 models（避免为单个面板污染公共类型面）。
   */
  public contextStudio(threadId: string): Promise<import('../../types/models.ts').ContextStudioSnapshotLike> {
    return this.rpc('context.studio', { threadId });
  }
  /** 追加一条跨重置交接便签（工作区级）。 */
  public contextHandoffAdd(
    text: string,
    tags?: readonly string[],
  ): Promise<import('../../types/models.ts').HandoffNoteLike | null> {
    return this.rpc('context.handoff.add', tags === undefined ? { text } : { text, tags });
  }
  /** 清空交接便签（破坏性；UI 必须二次确认）。 */
  public contextHandoffClear(): Promise<{ ok: boolean }> {
    return this.rpc('context.handoff.clear', {});
  }
  /** 强制压缩一个空闲会话（写回压缩游标；UI 必须二次确认）。 */
  public contextCompact(
    threadId: string,
  ): Promise<import('../../types/models.ts').ContextCompactionResultLike> {
    return this.rpc('context.compact', { threadId, confirm: true });
  }
  /** 凭证回合列表：按 user 事件切分的回合摘要（系统回合单独标注）。 */
}
