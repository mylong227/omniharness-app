/**
 * 内核对接面 · config 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { ConfigError } from '@omniharness/kernel/kernel/config/configError.js';
export { ConfigFactory } from '@omniharness/kernel/kernel/config/configFactory.js';
export type { ExtraTool, OmniHarnessConfig } from '@omniharness/kernel/kernel/config/configFactory.js';
export { ConfigFile, configFile } from '@omniharness/kernel/kernel/config/configFile.js';
export type { FileConfig, FileMcpServer, LayeredOptions, ModelRouterConfig, PermissionRuleConfig, PermissionRuleDecision, SsrfPolicyConfig, WorkspaceTrustOptions } from '@omniharness/kernel/kernel/config/configFile.js';
export { DefaultPromptFragments } from '@omniharness/kernel/kernel/config/defaultPromptFragments.js';
export { ProfileLoader } from '@omniharness/kernel/kernel/config/profileLoader.js';
export { PROVIDER_PRESETS, providerPresets } from '@omniharness/kernel/kernel/config/providerPresets.js';
export type { ProviderPreset } from '@omniharness/kernel/kernel/config/providerPresets.js';
export { WorkspaceTrust } from '@omniharness/kernel/kernel/config/workspaceTrust.js';
