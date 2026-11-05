import type { ServerModule } from '../core/serverModule.ts';
import { automationsModule } from './automations.ts';
import { checkpointsModule } from './checkpoints.ts';
import { configModule } from './config.ts';
import { governanceModule } from './governance.ts';
import { introspectModule } from './introspect.ts';
import { graphsModule } from './graphs.ts';
import { memoryModule } from './memory.ts';
import { observabilityModule } from './observability.ts';
import { pluginsModule } from './plugins.ts';
import { reviewModule } from './review.ts';
import { sessionsModule } from './sessions.ts';
import { surfaceModule } from './surface.ts';
import { threadsModule } from './threads.ts';
import { uplinkModule } from './uplink.ts';
import { vaultModule } from './vault.ts';
import { workspaceModule } from './workspace.ts';

/**
 * AppServer 内置模块清单 —— 91 个 RPC 方法的**唯一**注册出处（parity 快照测试钉住）。
 *
 * 加新能力 = 在本目录新建一个模块文件（或往同域模块里加 `ctx.rpc`），再在此登记一行。
 * 嵌入方经 `createOmniHarness({ modules })` / `new AppServer({ modules })` 追加的模块
 * 与本表同权注册；任何同名冲突在启动期抛错（fail-closed，见 registerModules）。
 */
export function coreModules(): readonly ServerModule[] {
  return [
    threadsModule(),
    uplinkModule(),
    configModule(),
    automationsModule(),
    workspaceModule(),
    sessionsModule(),
    surfaceModule(),
    pluginsModule(),
    graphsModule(),
    memoryModule(),
    checkpointsModule(),
    reviewModule(),
    observabilityModule(),
    vaultModule(),
    governanceModule(),
    introspectModule(),
  ];
}
