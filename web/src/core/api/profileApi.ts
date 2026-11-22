// profile 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type {
  Profile,
  ActivePlugins,
  ProfileApplyResult,
  BundlePackResult,
  BundleUnpackResult,
} from '../../types/models.ts';
import type { ApiTransport } from './rpcTransport.ts';

/** profile 域的 RPC 面。 */
export class ProfileApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listProfiles(): Promise<Profile[]> {
    return this.rpc('profile.list', {});
  }
  public getActiveProfile(): Promise<ActivePlugins> {
    return this.rpc('profile.active', {});
  }
  public saveProfile(profile: { name: string; plugins: string[]; description: string }): Promise<unknown> {
    return this.rpc('profile.save', { profile });
  }
  public applyProfile(id: string): Promise<ProfileApplyResult> {
    return this.rpc('profile.apply', { id });
  }
  public deleteProfile(id: string): Promise<unknown> {
    return this.rpc('profile.delete', { id });
  }
  public packBundle(params: { id?: string; profile?: { name: string; plugins: string[] } }): Promise<BundlePackResult> {
    return this.rpc('bundle.pack', params);
  }
  public unpackBundle(zipPath: string): Promise<BundleUnpackResult> {
    return this.rpc('bundle.unpack', { zipPath });
  }

  // ---- 多 Agent 编排 ----
}
