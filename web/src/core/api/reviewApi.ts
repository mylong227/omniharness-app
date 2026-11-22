// review 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** review 域的 RPC 面。 */
export class ReviewApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listChanges(path?: string): Promise<{
    source: string;
    branch?: string;
    files?: { path: string; status: string; additions: number; deletions: number }[];
    patch?: string;
  }> {
    return this.rpc('changes.list', path ? { path } : {});
  }
  /** 添加项目文件夹（服务端校验目录存在后持久化）。 */
  public stageFile(path: string): Promise<{ ok: boolean }> {
    return this.rpc('changes.stageFile', { path });
  }
  /** 丢弃整个文件的工作区改动（未跟踪文件服务端拒绝）。 */
  public revertFile(path: string): Promise<{ ok: boolean }> {
    return this.rpc('changes.revertFile', { path });
  }
  /** stage 单个 hunk；isNew=true 时服务端先 git add -N。 */
  public stageHunk(path: string, hunk: string, isNew?: boolean): Promise<{ ok: boolean }> {
    return this.rpc('changes.stageHunk', { path, hunk, isNew });
  }
  /** 丢弃单个 hunk 的工作区改动（git apply -R）。 */
  public revertHunk(path: string, hunk: string): Promise<{ ok: boolean }> {
    return this.rpc('changes.revertHunk', { path, hunk });
  }
  /** 全部行内评论（工作区级持久化）。 */
  public listDiffComments(): Promise<{
    comments: { id: string; path: string; side: 'old' | 'new'; line: number; text: string; ts: string }[];
  }> {
    return this.rpc('changes.comments.list', {});
  }
  /** 添加行内评论（锚定 文件 + 行号 + 侧别）。 */
  public addDiffComment(
    path: string,
    side: 'old' | 'new',
    line: number,
    text: string,
  ): Promise<{ ok: boolean; comment: { id: string; path: string; side: 'old' | 'new'; line: number; text: string; ts: string } }> {
    return this.rpc('changes.comments.add', { path, side, line, text });
  }
  /** 删除一条行内评论。 */
  public deleteDiffComment(id: string): Promise<{ ok: boolean }> {
    return this.rpc('changes.comments.delete', { id });
  }

  // ---- 文件树 ----
}
