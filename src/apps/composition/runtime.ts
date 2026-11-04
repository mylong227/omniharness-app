/**
 * app Runtime —— 内核 Runtime 的薄扩展（0.6.0 对接 alpha.6 起）。
 *
 * 历史注记：本文件曾是内核 composition/runtime.ts 的应用侧拷贝（543 行编排 +
 * a2a/spark/共振场/CRISPR 接线）。内核 0.1.0-alpha.6 完成切片（M4）与确定性重建后，
 * 编排收敛回内核**单源**——本类不再携带任何编排实现，全部静态面
 * （`createRuntime` / `evolutionOf` / `assembleKernelEvolution` / `applySkillRestore`…）
 * 经继承走内核最新实现；缺省审批/沙箱/回执链等工作台与审计能力随内核版本同步演进。
 *
 * a2a 互操作随内核 M4 决策退役（v0.3 线格式，待 v1.0 重基后按新契约另行接入）；
 * app 侧残件（host/protocols/a2a）一并移除。
 */
import { Runtime as KernelRuntime } from '@omniharness/kernel';

export class Runtime extends KernelRuntime {}

// 保持既有公共 API：`ServiceKeys` 定义在 app 侧（./serviceKeys.ts），既有调用点零改动。
export { ServiceKeys } from './serviceKeys.ts';
export type { OmniHarnessRuntime } from '@omniharness/kernel/contracts/ports/composition/omniHarnessRuntime.js';
