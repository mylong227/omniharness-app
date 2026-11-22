// threads 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type {
  FileAttachment,
  TurnRunResult,
  InterjectResult,
  ThreadGetResult,
} from '../../types/models.ts';
import type { ApiTransport } from './rpcTransport.ts';

/** threads 域的 RPC 面。 */
export class ThreadsApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public runTurn(
    params: { threadId?: string; prompt: string; images?: { url?: string; data?: string; mediaType?: string }[]; files?: FileAttachment[] },
  ): Promise<TurnRunResult> {
    return this.rpc('turns.run', params);
  }
  /**
   * 中断在跑回合：后端取消令牌中止在飞模型请求，turns.run 自然收尾。
   * @param threadId 目标会话；**建议总是传**——服务端允许多回合并行，缺省会退化为取消全部在跑回合。
   * @returns 中断 RPC 的响应（{ ok: true, threadId }）。
   */
  public abortTurn(threadId?: string): Promise<unknown> {
    return this.rpc('turns.abort', threadId === undefined ? {} : { threadId });
  }
  /**
   * 回合中插话（A8）：把一条用户追加指令入队，服务端在下一步边界注入。
   * @param threadId 目标会话（必须在跑）。
   * @param text 追加指令（非空）。
   * @param images 可选图片/视频附件（2026-10-31：插话与正常发送同构）。
   * @param files 可选文件附件。
   * @returns `{ok, queued}`；会话未跑时 `ok:false`。
   */
  public steerTurn(
    threadId: string,
    text: string,
    images?: { url?: string; data?: string; mediaType?: string }[],
    files?: FileAttachment[],
  ): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
    const params: Record<string, unknown> = { threadId, text };
    if (images !== undefined && images.length > 0) params['images'] = images;
    if (files !== undefined && files.length > 0) params['files'] = files;
    return this.rpc('turns.steer', params);
  }
  /**
   * 插话模式分流（`turns.interject`，2026-10-31）：服务端按相关性判定，相关则并入当前回合，
   * 无关则立刻取消当前回合（`action:'interrupted'`），由客户端把内容作为新回合发送。
   * @param params 目标会话 + 本条消息（文本与附件，与 `turns.run` 同构）。
   * @returns 分流结果（见 {@link InterjectResult}）。
   */
  public interjectTurn(params: {
    threadId: string;
    prompt: string;
    images?: { url?: string; data?: string; mediaType?: string }[];
    files?: FileAttachment[];
  }): Promise<InterjectResult> {
    return this.rpc('turns.interject', params);
  }
  /**
   * 读取线程事件；可选分页（取尾部 / 用 `before` 向上补拉）。
   * @param threadId 目标线程
   * @param opts `limit` 页大小、`before` 上一页最早事件 id
   * @returns 线程事件页（`hasMore`/`oldestId` 供加载更早）
   */
  public getThread(
    threadId: string,
    opts: { readonly limit?: number; readonly before?: string } = {},
  ): Promise<ThreadGetResult> {
    return this.rpc('threads.get', {
      threadId,
      ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
      ...(opts.before !== undefined ? { before: opts.before } : {}),
    });
  }
  /**
   * 服务端回退：把持久化事件流截断到 keepEventId（含）。
   * 「重生成」必须经此返回**服务端**再重发——只截断视图层的话，服务端 jsonl 里的旧一轮仍在，
   * 下一回合的模型上下文照旧包含旧回答（刷新页面旧回答还会复现）。
   * @param threadId 目标线程
   * @param keepEventId 保留到哪条事件（含）
   * @returns 保留/丢弃条数；失败时为 `{ ok: false, error }`（不抛错，前端直接把原因展示出来）
   */
  public rewindThread(
    threadId: string,
    keepEventId: string,
  ): Promise<{ ok: boolean; kept?: number; dropped?: number; error?: string }> {
    return this.rpc('threads.rewind', { threadId, keepEventId });
  }

  // ---- 配置 / 审批 ----
  public modesGet(threadId: string): Promise<import('../../types/models.ts').SessionModes> {
    return this.rpc('modes.get', { threadId });
  }
  /** 更新会话模式；传空串 / false 即清除该项。 */
  public modesSet(
    threadId: string,
    patch: { goal?: string; planMode?: boolean; sketchMode?: boolean },
  ): Promise<import('../../types/models.ts').SessionModes> {
    return this.rpc('modes.set', { threadId, ...patch });
  }
  /** 审批档位表（后端单一来源，含描述与风险级别）。 */
}
