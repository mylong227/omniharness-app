import type { AppPluginPermission } from '../../../kernel/plugin/permission.ts';

/**
 * @beta
 * 插件元信息。
 *
 * 已从 `plugin/plugin.ts` 外迁到 ports 域：原文件退化为纯再导出桶，调用点零改动。
 * `permissions` 用 app 宿主全集（内核闭集 ∪ `rpc.register` 等 app 扩展权限）。
 */
export interface PluginMeta {
  readonly name: string;
  readonly inject?: readonly string[] | undefined;
  /** 插件声明的权限（需在白名单内才允许注册启动，缺省=无能力声明）。 */
  readonly permissions?: readonly AppPluginPermission[] | undefined;
}
