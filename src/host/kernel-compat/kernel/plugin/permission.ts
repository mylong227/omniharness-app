/**
 * 插件权限模型：声明式权限 + 危险权限集。
 *
 * 插件通过 `meta.permissions` 声明其所需能力，`PermissionGate` 依白名单校验，
 * 未声明或超白名单的能力一律拒绝（fail-closed）。权限名采用 `域.动作` 两级命名。
 */
import type { PluginPermission } from '../../../kernel/contracts.ts';

/**
 * Permission —— 由本文件原顶层函数归并而来（每个方法对应一个原函数，语义与签名逐字保留）。
 */
export class Permission {
  /**
   * @beta
   * 权限名是否合法。
   */
  public static isPluginPermission(value: string): value is AppPluginPermission {
    return (ALL_PERMISSIONS as readonly string[]).includes(value);
  }
}

/**
 * @beta
 * 插件可声明的权限范围（`域.动作`）——内核闭集。
 */
export type { PluginPermission } from '../../../kernel/contracts.ts';

/**
 * app 宿主扩展权限（内核闭集之外、本仓宿主自有面，2026-11 registerRpc 引入）：
 * 允许插件向服务端注册新的 RPC 方法（服务面扩张 → 归入危险权限，缺省拒绝）。
 */
export const PLUGIN_RPC_PERMISSION = 'rpc.register';
/** app 宿主权限全集 = 内核闭集 ∪ 本仓扩展。 */
export type AppPluginPermission = PluginPermission | typeof PLUGIN_RPC_PERMISSION;

/**
 * @beta
 * 全部已知权限。
 */
export const ALL_PERMISSIONS: readonly AppPluginPermission[] = [
  'fs.read',
  'fs.write',
  'fs.delete',
  'net.connect',
  'net.listen',
  'proc.exec',
  'env.read',
  'env.write',
  'store.read',
  'store.write',
  PLUGIN_RPC_PERMISSION,
];

/**
 * @beta
 * 危险权限集：这些能力可导致数据破坏 / 任意代码执行 / 系统改动，
 * 默认应被拒，需明确加入白名单才放行。
 */
export const DANGEROUS_PERMISSIONS: ReadonlySet<AppPluginPermission> = new Set<AppPluginPermission>([
  'fs.write',
  'fs.delete',
  'net.listen',
  'proc.exec',
  'env.write',
  'store.write',
  PLUGIN_RPC_PERMISSION,
]);
