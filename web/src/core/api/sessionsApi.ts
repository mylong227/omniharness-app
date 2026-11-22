// sessions 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** sessions 域的 RPC 面。 */
export class SessionsApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listSessions(opts?: {
    includeArchived?: boolean;
    /** 是否包含 mock/演示会话（缺省 false：服务端默认过滤，避免淹没真实会话）。 */
    includeMock?: boolean;
    /** 工作区作用域：`'*'` = 全部项目；缺省＝服务端按当前项目过滤。 */
    workspace?: string;
  }): Promise<{
    dir: string;
    sessions: {
      sessionId: string;
      workspace?: string;
      label: string;
      turns: number;
      updatedAt: string;
      /** 有效时长（ms，已剔除 >5 分钟挂机间隔）。 */
      activeMs?: number;
      /** 被剔除的空闲间隔个数。 */
      idleGaps?: number;
      mock?: boolean;
      model?: string;
      running?: boolean;
      archived?: boolean;
      /** 是否已置顶（服务端侧车 `sessions.pinned.json`；跨设备共享）。 */
      pinned?: boolean;
    }[];
  }> {
    return this.rpc('sessions.list', {
      includeArchived: opts?.includeArchived !== false,
      ...(opts?.includeMock === true ? { includeMock: true } : {}),
      // `workspace` 只在显式给出时下发：`'*'` = 全部项目（跨项目视图），缺省＝服务端按当前项目过滤。
      ...(opts?.workspace !== undefined ? { workspace: opts.workspace } : {}),
    });
  }
  /**
   * 归档 / 取消归档会话（只写侧车，不动事件流）。
   * @param sessionId 会话 id
   * @param archived true 归档、false 恢复
   * @returns `{ ok }`；会话不存在时 `{ ok:false, error:'session_not_found' }`
   */
  public archiveSession(
    sessionId: string,
    archived: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.rpc('sessions.archive', { sessionId, archived });
  }

  /**
   * 置顶 / 取消置顶（`sessions.setPinned`）：只写服务端侧车（随存档目录走 ⇒ 跨设备共享）。
   * @param sessionId 会话 id
   * @param pinned true 置顶、false 取消
   * @returns `{ ok }`；id 形态非法时 `{ ok:false, error:'bad_session_id' }`
   */
  public setSessionPinned(
    sessionId: string,
    pinned: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.rpc('sessions.setPinned', { sessionId, pinned });
  }

  /**
   * 保存左栏拖拽排序（用户指定顺序；未登记的会话仍按时间倒序排在其后）。
   * @param ids 有序会话 id 列表
   * @returns `{ ok }`；id 形态非法时 `{ ok:false, error:'bad_session_id' }`
   */
  public reorderSessions(ids: string[]): Promise<{ ok: boolean; error?: string }> {
    return this.rpc('sessions.reorder', { ids });
  }
  /** 重命名会话（自定义标题，空串清除）；服务端写入侧车，列表回落首条用户消息。 */
  public renameSession(sessionId: string, title: string): Promise<{ ok: boolean; error?: string }> {
    return this.rpc('sessions.rename', { sessionId, title });
  }
  /** 删除会话存档；运行中的会话被服务端拒绝。 */
  public deleteSession(sessionId: string): Promise<{ ok: boolean; error?: string }> {
    return this.rpc('sessions.delete', { sessionId });
  }
  /** 分叉会话为带新 id 的副本；返回新会话 id。 */
  public forkSession(sessionId: string): Promise<{ ok: boolean; newSessionId?: string; error?: string }> {
    return this.rpc('sessions.fork', { sessionId });
  }
  /** 工作区变更记录（git 式）；传 path 时返回该文件 patch。 */
  public setSessionWorkspace(
    sessionId: string,
    workspace: string,
  ): Promise<{ ok: boolean; workspace?: string }> {
    return this.rpc('sessions.setWorkspace', { sessionId, workspace });
  }
  public listCheckpoints(sessionId: string): Promise<{
    sessionId: string;
    checkpoints: { label: string; ts: string; eventCount: number; hasFileSnapshot: boolean }[];
  }> {
    return this.rpc('checkpoint.list', { sessionId });
  }
  /** 为当前会话创建一个检查点（对话 + 工作区文件快照）。 */
  public createCheckpoint(
    sessionId: string,
    label: string,
  ): Promise<{ ok: boolean; checkpoint: { label: string; ts: string; eventCount: number; hasFileSnapshot: boolean } }> {
    return this.rpc('checkpoint.create', { sessionId, label });
  }
  /** 回滚到指定检查点（不传 label 回滚到最近一个）；对话与代码一并还原。 */
  public rollbackCheckpoint(
    sessionId: string,
    label?: string,
  ): Promise<{ ok: boolean; checkpoint: { label: string; ts: string; eventCount: number; hasFileSnapshot: boolean } }> {
    return this.rpc('checkpoint.rollback', { sessionId, label });
  }

  // ---- 内联 diff 审查----

  /** stage 整个文件（git add）。 */
}
