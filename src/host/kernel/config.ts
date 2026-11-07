/**
 * 内核对接面 · config 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
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
export { ConfigRebase } from '@omniharness/kernel/kernel/config/configRebase.js';
export { CredentialResolver } from '@omniharness/kernel/kernel/config/credentialResolver.js';
