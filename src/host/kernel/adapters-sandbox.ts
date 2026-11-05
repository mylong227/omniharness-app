/**
 * 内核对接面 · adapters-sandbox 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
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
