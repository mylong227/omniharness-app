// fleet 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** fleet 域的 RPC 面。 */
export class FleetApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public fleetList(threadId: string): Promise<import('../../types/models.ts').FleetSnapshotLike> {
    return this.rpc('fleet.list', { threadId });
  }
  /** 只读预览一条子代理 patch；仅允许 `.omniharness/subagent-patches/` 内文件。 */
  public fleetPatch(path: string): Promise<import('../../types/models.ts').FleetPatchResultLike> {
    return this.rpc('fleet.patch', { path });
  }
  /** 取消一条正在运行的子代理（只中止该调用，不取消父会话）。 */
  public fleetCancel(callId: string): Promise<import('../../types/models.ts').FleetCancelResultLike> {
    return this.rpc('fleet.cancel', { callId });
  }
  /** 应用一条已预览的补丁到主工作区（必须显式 confirm）。 */
  public fleetApplyPatch(
    path: string,
  ): Promise<import('../../types/models.ts').FleetPatchApplyResultLike> {
    return this.rpc('fleet.applyPatch', { path, confirm: true });
  }
  /** 上下文工作室快照：六类构成 + 压缩记录 + 便签（v1 便签未接线如实标注）。 */
}
