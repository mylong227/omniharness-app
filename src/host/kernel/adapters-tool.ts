/**
 * 内核对接面 · adapters-tool 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
 */

export { CodeExecutorTool } from '@omniharness/kernel/kernel/adapters/tool/code/codeExecutorTool.js';
export type { CodeExecutorOptions } from '@omniharness/kernel/kernel/adapters/tool/code/codeExecutorTool.js';
export { CodeInterpreter } from '@omniharness/kernel/kernel/adapters/tool/code/codeInterpreter.js';
export type { CodeInterpreterDeps, CodeRunResult } from '@omniharness/kernel/kernel/adapters/tool/code/codeInterpreter.js';
export { ApplyPatchTool } from '@omniharness/kernel/kernel/adapters/tool/fs/applyPatchTool.js';
export { EditFileTool } from '@omniharness/kernel/kernel/adapters/tool/fs/editFileTool.js';
export { GlobTool } from '@omniharness/kernel/kernel/adapters/tool/fs/globTool.js';
export { GrepTool } from '@omniharness/kernel/kernel/adapters/tool/fs/grepTool.js';
export { ListDirTool } from '@omniharness/kernel/kernel/adapters/tool/fs/listDirTool.js';
export { PatchApplier } from '@omniharness/kernel/kernel/adapters/tool/fs/patchApplier.js';
export { ReadFileTool } from '@omniharness/kernel/kernel/adapters/tool/fs/readFileTool.js';
export { WriteFileTool } from '@omniharness/kernel/kernel/adapters/tool/fs/writeFileTool.js';
export { SpillReadTool } from '@omniharness/kernel/kernel/adapters/tool/meta/spillReadTool.js';
export { RegistryToolPort } from '@omniharness/kernel/kernel/adapters/tool/registryToolPort.js';
export { ProcessTreeKiller } from '@omniharness/kernel/kernel/adapters/tool/shell/processTreeKiller.js';
export { ShellTool } from '@omniharness/kernel/kernel/adapters/tool/shell/shellTool.js';
export { WebSearchTool } from '@omniharness/kernel/kernel/adapters/tool/web/webSearchTool.js';
export type { WebSearchToolOptions } from '@omniharness/kernel/kernel/adapters/tool/web/webSearchTool.js';
export { DelegateTool } from '@omniharness/kernel/kernel/adapters/tool/workflow/delegateTool.js';
