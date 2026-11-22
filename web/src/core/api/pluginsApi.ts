// plugins 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type {
  PluginManifest,
  PluginSearchEntry,
  PluginReloadResult,
} from '../../types/models.ts';
import type { ApiTransport } from './rpcTransport.ts';

/** plugins 域的 RPC 面。 */
export class PluginsApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listPlugins(): Promise<PluginManifest[]> {
    return this.rpc('plugins.list', {});
  }
  /**
   * `/` 技能选择器数据（Skill Lab v1 起含 source/editable/overridden 增量字段）。
   * @returns 技能清单
   */
  public searchPlugins(query = ''): Promise<PluginSearchEntry[]> {
    return this.rpc('plugins.search', { query });
  }
  public installPlugin(name: string): Promise<unknown> {
    return this.rpc('plugins.install', { name });
  }
  public removePlugin(name: string): Promise<unknown> {
    return this.rpc('plugins.remove', { name });
  }
  public reloadPlugins(): Promise<PluginReloadResult> {
    return this.rpc('plugins.reload', {});
  }

  // ---- 长期记忆 ----
}
