/**
 * 内核对接面 · plugin 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { PluginManager } from '@omniharness/kernel/kernel/plugin/pluginManager.js';
export { PermissionGate } from '@omniharness/kernel/kernel/plugin/permissionGate.js';
export { PermissionDeniedError } from '@omniharness/kernel/kernel/plugin/permissionDeniedError.js';
export type { PluginPermission } from '@omniharness/kernel/contracts/ports/plugin/pluginPermission.js';
export type { Plugin } from '@omniharness/kernel/contracts/ports/plugin/plugin.js';
export { PluginProfileStore } from '@omniharness/kernel/kernel/plugin/pluginProfileStore.js';
export type { PluginProfile } from '@omniharness/kernel/contracts/ports/plugin/pluginProfile.js';
export type { ApplyProfileResult } from '@omniharness/kernel/contracts/ports/plugin/applyProfileResult.js';
export { PluginRegistry } from '@omniharness/kernel/kernel/plugin/pluginRegistry.js';
export { PluginLoader } from '@omniharness/kernel/kernel/plugin/pluginLoader.js';
export { PluginBundler } from '@omniharness/kernel/kernel/plugin/pluginBundler.js';
export { BundleCodec } from '@omniharness/kernel/kernel/plugin/bundleCodec.js';
export { PackGrader } from '@omniharness/kernel/kernel/plugin/packGrader.js';
export type { SandboxLegVerdict } from '@omniharness/kernel/kernel/plugin/packGrader.js';
export type { PackCapability } from '@omniharness/kernel/kernel/plugin/packStaticScanner.js';
export { PrivateSkillSource } from '@omniharness/kernel/kernel/plugin/privateSkillSource.js';
export { Manifest } from '@omniharness/kernel/kernel/plugin/manifest.js';
export type { PluginManifest } from '@omniharness/kernel/contracts/ports/plugin/pluginManifest.js';
export { PluginWorkerMetrics } from '@omniharness/kernel/kernel/plugin/worker/pluginWorkerMetrics.js';
export { ALL_PERMISSIONS, DANGEROUS_PERMISSIONS, Permission } from '@omniharness/kernel/kernel/plugin/permission.js';
export type { MediaAnalysisConfig } from '@omniharness/kernel/contracts/ports/media/mediaAnalysisConfig.js';
export { AssetPackCodec } from '@omniharness/kernel/kernel/asset/assetPackCodec.js';
export type { PackSigningIdentity } from '@omniharness/kernel/kernel/asset/assetPackCodec.js';
export { AssetPackInstaller } from '@omniharness/kernel/kernel/asset/assetPackInstaller.js';
