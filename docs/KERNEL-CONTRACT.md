# 本仓与内核（`@omniharness/kernel`）的关系与缺口

> 实测日期 2026-11-04。**结论分两句**：
> ① 本仓当前**是完整应用**（后端在 `src/`，87 个 RPC 方法都在、能跑、冒烟 5/5）；
> ② 它**还没有**依赖 `@omniharness/kernel` —— `src/{kernel,contracts,protocols}` 是上游 0.4.0 的
> 内嵌副本。把这份副本换成包里的一份，是本文档第 4 节的迁移，不是"接线"。

## 1. 两侧实测

| | 本仓（应用） | `omniharness-kernel` |
| --- | --- | --- |
| 形态 | 应用宿主：静态托管 + JSON-RPC + SSE + CLI | 可嵌入库：`Runtime` + `Agent` + 端口 + workbench 桥 |
| 后端文件 | `src/` 1334 个文件（1331 `.ts`；`src/apps` 167，其中 server 62） | `src/` 约 1200 个文件；公开面 **60 符号**（`api:check` 严守） |
| HTTP 面 | `POST /rpc`（**87** 方法）、`GET /events`、`GET /files`、`GET /healthz`、`/readyz`、工作区预览源 | `GET /api/sessions`、`/api/sessions/:id/events`、`/state`、`POST /api/sessions/:id/answers`、`POST /api/audit/verify`、`GET /health` |
| 事件模型 | 全局 `/events` → `ThreadEvent`（UI 侧再归约成 20+ 种面板状态） | 每会话 SSE → `SessionEvent`（`seq` 追加、`Last-Event-ID` 续传）+ 服务端 `WorkbenchState` 投影 |
| 依赖关系 | 内嵌内核副本；**不 import 包**（包名导入 0 处） | 不知道 CLI/HTTP/React 的存在 |

> 数字口径：`Select-String -Path (Get-ChildItem src/apps -Recurse -Filter *.ts) -Pattern "from '[^']*(kernel|contracts|protocols)/"`
> → **421 处 / 104 个文件**（与上游 `docs/M2_APP_MIGRATION.md` 的测绘完全一致：切分时未改动应用代码）。

## 2. 为什么不能"直接把 UI 接到内核 workbench 上"

UI 需要 87 个方法，内核 workbench 只提供 4 个端点。按域展开：

| 域 | 方法（节选） | 内核现状 |
| --- | --- | --- |
| 回合 | `turns.run/abort/steer/interject`、`threads.get/rewind` | 能力在内核（`Agent.runTask`、`CancellationToken`、rewindRegistry），**无 HTTP 面** |
| 会话 | `sessions.list/archive/delete/fork/rename/reorder/setWorkspace` | 部分（storage + hub）；归档/分叉/排序是应用逻辑 |
| 配置/模型 | `config.get/update`、`model.catalog/probe`、`profile.*`、`quota.*`、`modes.*` | `ConfigFactory` 有；目录/探测/配额是应用服务 |
| 工作区/文件 | `workspace.*`、`fs.*`、`search.all`、`attach.read`、`changes.*`、`checkpoint.*` | 文件工具在内核；浏览/差异/暂存/检查点是应用编排 |
| 审批/提问 | `approval.*`、`question.pending/respond` | `ApprovalPort` + `WorkbenchHub` 提问桥 ✅ |
| 审计/追踪 | `audit.query`、`trace.read`、`governance.history`、`usage.stats` | 回执链/审计包复核 ✅；查询/追踪在应用侧 |
| 扩展 | `plugins.*`、`skills.list`、`memory.*`、`automations.*`、`graph.*`、`bundle.*`、`vault.*`、`doctor.report`、`daemon.status` | 内核有 skill/memory 原语；插件宿主/自动化/图谱/打包/保险库在应用侧 |

## 3. 三条路径（本仓已选 A 的第一段）

| 路径 | 做法 | 代价 | 现状 |
| --- | --- | --- | --- |
| **A. 应用自带宿主**（当前） | `src/apps` 实现 87 个方法；内核只作为库被 `src/apps` 使用 | 应用与内核同仓共演进；内核副本需迁移 | ✅ 已完整切出并跑通 |
| **B. UI 直连 workbench** | 砍到 4 端点能表达的面板 | UI 功能大幅缩水、159 个前端判据多数重写 | 未选 |
| **C. RPC 面下沉内核** | 87 方法进 `@omniharness/kernel/rpc` | 违反内核公开面 ≤60 与"内核卖边界" | 不选 |

## 4. 把内嵌副本换成内核包的迁移（M2 口径）

当前 `src/{kernel,contracts,protocols}` 是副本；迁移 = 删副本 + 钉 `@omniharness/kernel` 版本。
上游已测绘过，数字可直接复用：

| 类别 | 规模 | 处置 |
| --- | --- | --- |
| A. 契约类型（`contracts/ports/**`） | 144 处 | 换公开面/子路径；缺的类型先在内核加导出（受 ≤60 约束） |
| B. 通用工具（`kernel/util/**`、`kernel/plugin`） | 105 处 | 要么内核公开，要么应用自带 |
| C. 装配面（`kernel/adapters/**`、`kernel/config/**`） | 86 处 | 改 `ConfigFactory` 注入，不 import 适配器 |
| 合计 | **421 处 / 104 文件** | 没有一处应原样保留 |

**顺序**（每批 ≤15 文件、一个可回归 commit）：

1. 基线：本仓 `npm run verify` 记下绿/红（当前绿）；
2. A 类（类型面）→ C 类（装配面）→ B 类（工具面）；
3. 删 `src/{kernel,contracts,protocols}`，`package.json` 钉版本；
4. 再跑 `npm run verify`——**删了还绿**才算迁移完成（否则只是两套内核并存）。

**已知风险**：内核 alpha 仍在演进（如 `adapters/laya` 已移出、`decisionEngine` 改为注入）。
上游 `migration/kernel-package` 分支是 WIP（tsc 绿、75 个测试文件待分流），不能直接当基线；
应按当前内核版本重跑类型检查，缺的符号走内核 issue。

## 5. 本仓已做的适配（可审计，见 git log）

| 位置 | 改动 | 目的 |
| ---- | ---- | ---- |
| 根 `package.json` | 前后端依赖合并、`build`/`dev`/`start`/`smoke`/`verify` | 一套安装、一套命令，不依赖上游 |
| `vite.config.ts` / `vitest.config.ts` | 独立配置；`OMNI_BACKEND_ORIGIN` 可覆盖代理目标 | 前端可指向任意后端；判据单项目运行 |
| `tsconfig.json` | include 收窄为 `src/**/*.ts`（不再含 tests/examples） | 后端只编自己的源码 |
| `scripts/copyAssets.mjs` | 额外镜像 `native/*.node → dist/native` | 从 `dist` 启动时 `NativeKernel` 能加载（否则必回退 TS） |
| `scripts/smoke.mjs` | 新增：真起 serve 的五条端到端判据 | "能构建"不等于"能跑"，冒烟给出可复核证据 |
| `desktop/src/main/lib/paths.ts` | `OMNI_BACKEND_ROOT` / `OMNI_HARNESS_ENTRY` | 桌面后端根可配（联调/回滚/未来内核宿主） |
| `desktop/scripts/stageHarness.mjs` | `appRoot`（web 产物）与 `backendRoot`（dist/native/依赖）分开 | 打包时前端取本仓、后端可指向另一份工作树 |
| `web/test/vendorAndTypeSource.test.ts` | 判据指向本仓真实门禁（`vitest.config.ts`、`web/tsconfig.json` 的 `.tsx` 覆盖） | 不抄上游 lint 配置，避免"配置存在但没人跑"的假绿 |

## 6. 下一步（按价值排序）

1. **把 421 处导入换成包路径**（第 4 节 A→C→B）；完成后删除 1160 个文件的内嵌副本；
2. 内核若需要新的宿主端点，先在内核开 issue 并过 `api:check`，不在本仓私接；
3. 桌面 GUI 验收：在真实桌面跑 `npm run desktop:smoke`（受限会话起不来 Electron）。
