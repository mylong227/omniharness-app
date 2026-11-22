// vault 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type { ApiTransport } from './rpcTransport.ts';

/** vault 域的 RPC 面。 */
export class VaultApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public vaultList(): Promise<import('../../types/models.ts').VaultListResult> {
    return this.rpc('vault.list', {});
  }

  /**
   * 写入（或覆盖）一项凭据。**单向**：服务端不提供读回接口。
   * @param name 凭据名
   * @param secret 凭据值（只上行，不回显）
   * @returns `{ok:true, name}` 或 `{ok:false, reason}`
   */
  public vaultSet(
    name: string,
    secret: string,
  ): Promise<import('../../types/models.ts').VaultWriteResult> {
    return this.rpc('vault.set', { name, secret });
  }

  /**
   * 删除一项凭据。
   * @param name 凭据名
   * @returns `{ok:true, name, removed}`（removed=false 表示本来就没有）或 `{ok:false, reason}`
   */
  public vaultDelete(name: string): Promise<import('../../types/models.ts').VaultWriteResult> {
    return this.rpc('vault.delete', { name });
  }

  /**
   * 只读 trace 自省（T4.5，2026-10-11 Web 交付）：取某会话的冻结条目快照。
   * @param params 会话 id + 可选条数上限 / 类别过滤
   * @returns `{session, entries, count, error?}`
   */
}
