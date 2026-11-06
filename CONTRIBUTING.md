# 贡献指南（Contributing）

## 心法（三条，其余都是细节）

1. **fail-closed**：没接线就如实报「未接线」，绝不返回空值冒充正常——「看着绿」是本仓历史缺陷的头号形态。
2. **单点真源**：内核导入只走 `src/host/kernel/`、RPC 注册只走 `src/apps/server/modules/`、厂商目录只读 `providerPresets`。发现第二份拷贝，收敛它而不是绕过它。
3. **改一处，验证全链**：`npm run verify` 是唯一裁决（kernel:check 8 判据 → typecheck×3 → 748 判据 → build → smoke → desktop）。

## 常见任务的最短路径

| 任务 | 步骤 |
| ---- | ---- |
| **加一个 RPC 能力** | 新建 `src/apps/server/modules/<域>.ts`（`ctx.rpc('x.y', handler)`）→ `modules/index.ts` 登记 1 行 → `tests/serverModulesParity.test.ts` 快照有意识 +1 → 需要客户端就在 `web/src/core/ApiClient.ts` 加方法 |
| **升级内核** | `OMNI_KERNEL_TAG=v0.1.0-alpha.X npm run kernel:vendor` → `npm ci` → `npm run kernel:surface` → typecheck 指出真正不兼容的符号 → `npm run verify` |
| **加一个内核符号** | 业务代码照常 `import { X } from '../../host/kernel/<域>.ts'` → `npm run kernel:surface` → typecheck（门禁第 8 条拒绝漂移） |
| **改 CLI 行为** | 协作者模式：`src/apps/cli/<名>Command.ts` 单文件 + `cliDataCmds.ts`/`execLocal.ts` 分发 1 行 + `defaults/cliHelp.json` 用法条目 |
| **写插件** | `omni.plugin.json` + 入口 JS；加 RPC 需声明危险权限 `rpc.register`（缺省拒绝）；`plugin load --file …` 安装 |
| **改文档** | 事实必须可复核——数字与命令跑过再写（README 的「今日实测」表就是这么来的） |

## 提交规范

- 格式：`type(scope): 祈使句摘要`（refactor / feat / fix / docs / test / chore）。破坏性变更加 `!` 并在正文写迁移说明。
- 每个提交自成一体：typecheck + 相关判据过；不提交「半截 dist」或 `.zcode/`、`.tmp/` 产物。
- 大重构按「基线 → 机械搬移（行为等价）→ 行为变更」拆提交，diff 可审。

## 判据布局

| 目录 | 内容 | 运行 |
| ---- | ---- | ---- |
| `web/test/**` | 前端 149 文件（组件/逻辑/a11y，文件级串行） | `npm run web:test` |
| `tests/**` | 后端判据（RPC parity、ApiClient 漂移守卫、家具守卫、嵌入 API 生命周期、旗标注册纪律、内核对接面生成物） | 同上 |
| `desktop/scripts/test.mjs`（内联 30 条） | 桌面纯逻辑判据 | `npm run desktop:test` |
| `scripts/checkKernelBoundary.mjs` | 内核边界门禁 8 条（含对接面生成物不漂移） | `npm run kernel:check` |
| `scripts/kernelSurface.mjs` | 从业务 import 生成 17 个内核对接面文件 | `npm run kernel:surface` |
| `scripts/smoke.mjs` | 端到端 7 项（真起 serve） | `npm run smoke` |

环境：Node ≥ 22.14（`engines` 钉定），Windows/macOS/Linux 均可开发；桌面打包当前仅 Windows。
