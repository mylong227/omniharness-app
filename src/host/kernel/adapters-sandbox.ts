/**
 * 内核对接面 · adapters-sandbox 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { ContainerSandbox } from '@omniharness/kernel/kernel/adapters/sandbox/containerSandbox.js';
export type { ContainerSandboxOptions } from '@omniharness/kernel/kernel/adapters/sandbox/containerSandbox.js';
export { DangerousCommands, dangerousCommands } from '@omniharness/kernel/kernel/adapters/sandbox/dangerousCommands.js';
export { LinuxBwrapSandbox } from '@omniharness/kernel/kernel/adapters/sandbox/linuxBwrapSandbox.js';
export { MacOsSeatbeltSandbox } from '@omniharness/kernel/kernel/adapters/sandbox/macosSeatbeltSandbox.js';
export { EgressBlockedError, NetworkEgressGuard } from '@omniharness/kernel/kernel/adapters/sandbox/networkEgressGuard.js';
export type { NetworkEgressOptions } from '@omniharness/kernel/kernel/adapters/sandbox/networkEgressGuard.js';
export { PassthroughSandbox } from '@omniharness/kernel/kernel/adapters/sandbox/passthroughSandbox.js';
export { PolicySandbox } from '@omniharness/kernel/kernel/adapters/sandbox/policySandbox.js';
export type { PolicySandboxOptions } from '@omniharness/kernel/kernel/adapters/sandbox/policySandbox.js';
export { RestrictedSandbox } from '@omniharness/kernel/kernel/adapters/sandbox/restrictedSandbox.js';
export type { RestrictedSandboxOptions } from '@omniharness/kernel/kernel/adapters/sandbox/restrictedSandbox.js';
export { SandboxCapabilityTable } from '@omniharness/kernel/kernel/adapters/sandbox/sandboxCapabilityTable.js';
export type { SandboxCapabilityEntry } from '@omniharness/kernel/kernel/adapters/sandbox/sandboxCapabilityTable.js';
export { SandboxManager } from '@omniharness/kernel/kernel/adapters/sandbox/sandboxManager.js';
export type { SandboxProfile } from '@omniharness/kernel/kernel/adapters/sandbox/sandboxManager.js';
export { UnsupportedSandbox } from '@omniharness/kernel/kernel/adapters/sandbox/unsupportedSandbox.js';
export { WindowsNativeSandbox } from '@omniharness/kernel/kernel/adapters/sandbox/windowsNativeSandbox.js';
