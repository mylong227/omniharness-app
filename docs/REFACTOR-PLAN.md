# 全仓 .ts 化 · 内核归属收编 · 前端整体重构 —— 执行计划

> 盘点日期 2026-11-21（基线：feat/kernel-package @ e9e7c7e，vendored kernel alpha.36，
> 内核源仓 HEAD 24ba977 同版）。本文是**计划**，不是执行记录；各批次落地后回填 CHANGELOG。
> 三路只读深盘（脚本 ts 化牵连面 / web 前端架构 / extensions 归属判定）的完整事实已内化于下文，
> 每条结论带文件证据。

## 执行进度（2026-11-22 全部终态回填）

- **T 全仓 .ts 化 ✅**（T0+T1 / T2a / T2b / T2c / T3 / T4a 六 commit + CHANGELOG 批次九；
  verify 全链绿）——附带清偿：vitest.config 残留 Vitest 4 poolOptions（maxWorkers 限幅
  升级后一直未生效，已恢复）、childRunFailure 孤儿删除（L8）、35 处 plugin.js 后缀（T4a）、
  vendorKernel 显式 cwd。终态复核：源码区 `.mjs/.cjs` 仅 `examples/embed-demo.mjs` +
  `desktop/scripts/fakeElectron.cjs`；engines/CI = 22.18；`desktop/scripts/testGlobals.d.mts`
  是 fakeElectron 全局替身的类型声明（非手维 .mjs 声明壳）。
- **K3 serveInstance 双副本收敛 ✅**（677862d；cli 副本删除、5 消费点改指 extensions；
  K2 后连 extensions 副本一并清零）。
- **W1 类型护栏 ✅ → 已扩面**（b2c00a1 首版；2026-11-22 扩到 8 条探针：ThreadEvent / Fleet /
  Decision×2 / ContextStudio / Profile / Vault×2，**扩面即抓四处真漂移**并清偿）。
- **W2 settingsCatalog ✅**（57dfdf2；settings/ 六域文件 + 12 条结构判据，816 行零判据清零）。
- **W3 面板单源 ✅**（4013a1e；PaneKey 联合 + Router 迁 ui/models + VALID_PANES 派生 +
  paneRenderers 渲染器表编译期完整；App.ts -170 行）。
- **W7 清理包 ✅**（a6868eb Icon→kit / 56f8bd3 命名+i18n 分片 / 4ee13a0 legacy 引用面锁死 /
  2026-11-22 尾巴：删除 ComposerOptions 离线兜底模型清单）。
- **遗留**：L1 ✅（并行轮 f5d16c0）/ L2 ✅ / **L4 ✅（裁定 B：删除 boost 命令族）** /
  L5 ✅ 关闭 / L6 ✅ 关闭 / L8 ✅ / L9 ✅（knip 60→0 并闸入 verify）/
  **L7 ✅ 终态关闭（触发条件不成立）**。
- **K1/K2 ✅**（2026-11-21 晚，K1 由内核仓并行轮完成 R26 并随 alpha.37 发版）：
  内核 `v0.1.0-alpha.37`（d8d9ce7）承诺 `compactionStateCodec` 深路径 + maintenance 域
  ServeInstance/MaintenanceRunner + autonomy 域 GraphStore/GraphSummary 契约；app 侧
  K2 接收删除 extensions 四件 938 行（compactionMarkerReader 192 / serveInstance 229 /
  maintenanceRunner 372 / graphStore 145），登记表归零；`kernel:check` 九条绿。
  **R25d（CliWorker 族 483 行，二档）未随本轮**，仍待内核 worker 域排期。
  联动核对结论：内核 R25 的「Node 24 切换」仅门禁工具链口径（内核 package engines 仍
  `>=22.14.0`、CI 仍 node 22），**app engines/CI 无需升版**。
- **W4 ApiClient 域拆分 ✅**（620e146）：1058 行单类 → 传输本体 318 行 + `core/api/` 19 域类；
  `apiClientParity` 提取源先行扩到目录（含注释剥离），fast 193 文件 / 968 用例 + chrome
  37 文件 / 85 用例全绿；typecheck/build/build:web/smoke/desktop 全链绿。
- **W6 双选择器收编 ✅**（cba215e）：懒加载机制（节点状态机/占位行/递归回填）抽到
  `ui/models/FsLazyTree.tsx` 单一核，两选择器只留「回包 → 子节点」映射；新增 4 条机制行为
  判据（此前只能端到端间接覆盖）。**净行数 -13**（核 190 行含文档 + 判据 110 行）——
  与计划 300-500 行估计有偏差：P2 重设计已抽出 FsPickerLazy/PickerKeys/PathJoiner，
  剩余重复只在机制层，故以「单源 + 判据」为收口标准。
- **L9 零消费导出首轮 ✅**（a3ac491）：knip 6.47 扫描 60 → 0。34 个内部专用导出降级为
  模块私有；清真死码 9 处（withWorkspaceLease 族 / pathJoin / PROOF·FLEET 测试别名 /
  FLAG_ENUM_VALUES / ConsoleKeycap / subscribeLocale / decisionModel.checkStatusLabel）；
  knip 入 devDep + `knip.json` + `check:exports` 纳入 verify 链。ignoreIssues 仅 4 文件
  （kernel 生成物 / extensions 端口聚合桶 / enterprise LegacyOidcFlow 回退资产）。
- **L9 全类别 ✅**（2026-11-22 批次十四）：类型 143→0（90 降级私有 + 3 删除 + 再导出清理）、
  文件 5→0（脚本入口标记 entry，删 `src/omniError.ts`）、依赖 2→0（删 `zod` 与 MCP SDK）、
  删除自引用无消费的 cosmicWeb/resonantField 端口族；`knip` 全量闸 0 issue。
- **W5 五资源钩子收编 ✅**（2026-11-22）：`useSessionResource` 升级为唯一取数核
  （pollMs / cacheTtlMs / resetKey / keepDataWhenDisabled + refreshing/settled/updatedAt），
  票号守卫抽成 `LatestRequest`；上下文工作室 / 编队 / 决策账本（两流）/ 变更审查 /
  厂商目录全部收编；新增 7 条核心行为判据。
- **L4 ✅**：boost 命令族（4 文件 1609 行 + 14 旗标 + 3 帮助条目）删除——上游
  `runGates.mjs` / `tools/probes/` 未随迁，fail-closed 零产出。
- **最终验收**：`npm run verify` 全链绿（kernel:check 九条 / typecheck 五闸 / check:exports /
  232 文件 1064 用例 / build + build:web + smoke / desktop:build + desktop:test 44）。
- **外部机会项（不是本仓剩余项，无待办动作）**：R25d CliWorker 族（483 行）上内核——需内核
  worker 域排期后按 K2 例行接收；W1 zod 化——高漂移域已有 8 条编译期探针，zod 为中期末来项；
  L7 反向 locale 事件——桌面壳新增运行期语言入口时才触发。

---

## 一、盘点结论（事实底座）

### 1.1 全仓 .ts 化：只剩最后一公里

源码已是 **751 ts + 120 tsx**；未 ts 化的只有 **27 个脚本文件（约 4,784 行）**：
根 `scripts/` 16 件（含 `lib/` 2 件、`eval/` 2 件）、`desktop/scripts/` 10 件（含 `lib/` 1 件、唯一 `.cjs`）、
`examples/embed-demo.mjs` 1 件。另有 **2 个手维声明壳** `scripts/devConfig.d.mts`、
`scripts/workspaceLease.d.mts`（TS 吃不了 .mjs 的类型才存在，转 .ts 后即废）。

**牵连面（改名必同改）**：
- npm scripts 17 条（根 9 + desktop 8）；
- 5 个测试文件：`tests/devAddressContract.test.ts`（动态 import + **:38 正则钉死 vite.config 源码里的
  `from './scripts/devConfig.mjs'` 字符串**）、`tests/launchReadiness.test.ts`、
  `tests/kernelShadowScan.test.ts:20`、`tests/kernelShadowScanBarrel.test.ts:49`、
  `tests/kernelSurface.test.ts:15`（后三者以 **execFileSync 子进程 spawn 原生 Node**——
  这是 Windows CI 上「Vite 转译动态 import .mjs 报 SyntaxError、本地绿 CI 红」事故后的刻意隔离设计，
  2026-11-08 入账，**必须保留**）；`tests/productFurniture.test.ts:61`（embed-demo 存在性）；
- 构建期真实依赖：`vite.config.ts:17` import `scripts/devConfig.mjs`；`web/test/browserHarness.ts:17`、
  `web/test/e2e.test.ts:56` 同；
- 脚本间 import/spawn：buildDist→workspaceLease(import)+copyAssets(spawn 字符串)；
  checkKernelBoundary→kernelSurface+kernelShadowScan(import)；startAll/devAll→devConfig+launchReadiness；
  desktop test.mjs→payloadCheck(动态 import)+fakeElectron(**esbuild alias 字符串**)；
- CI：`verify.yml` 走 npm script，仅 desktop-gui-smoke 手动门是字面路径
  `node scripts/smoke.mjs --workspace $ws`（cwd=desktop）；docs 引用：README、CONTRIBUTING、
  desktop/README、docs/KERNEL-CONTRACT.md:153、extensions/README.md:11。

**结构性风险点**：
1. **desktop 包 `"type":"commonjs"`**：.ts 会被 Node 按 CJS 解析，而 desktop/scripts 全是 ESM——
   必须走 **.mts** 后缀（不动 package type，不牵连 dist/main.cjs 语义）。
2. **engines >=22.14 vs strip-types 默认开启版 22.18+**：22.14 跑 .ts 需显式
   `--experimental-strip-types`；且 `scripts/eval/webStressProbe.mjs` **今天就已事实依赖**
   原生类型剥离（动态 import `web/test/browserHarness.ts`，头注自述）——现存矛盾，转换时转正。
3. 计算型动态 import 19 处（desktop test.mjs 17 处指 esbuild 产物 .cjs、startAll 1 处、eval 2 处）——
   运行时无碍，tsc 侧需声明/断言。
4. `desktop/scripts/fakeElectron.cjs` 是 esbuild alias 目标（非 Node 模块），CJS module.exports
   语义，**保持 .cjs** 收益最大。
5. `examples/embed-demo.mjs` 随 `files:["examples"]` **发行给用户**（README 教程 + productFurniture
   判据三重身份），用户机器 Node 未必支持 strip-types——**保持 .mjs**。
6. **typecheck 盲区**：根 tsconfig 只 include `src/**`，web/desktop 各自 include src——
   `scripts/`、`tests/`、`examples/`、根 vite/vitest.config 全部游离于 typecheck 之外。
7. 孤儿：`scripts/lib/childRunFailure.mjs`（31 行）**全仓零引用**（来源脚本 coverageGate 已退役）。
8. src/ 有 **35 处 `host/kernel/plugin.js` 后缀残留**（NodeNext 下解析到 plugin.ts，能跑但违
   2026-10-17 统一 .ts 后缀约定；分布：apps/cli 7 文件、apps/server 4 文件、host/extensions 1 文件）。
9. `src/apps/cli` 存在指向**本仓不存在**脚本的悬空引用（`scripts/runGates.mjs`、
   `scripts/auditStandards.mjs`、`scripts/check.mjs`、`scripts/buildAuditBin.mjs`——
   上游继承的 fail-closed 代码）。

### 1.2 前端现状（web/，295 文件 / 54,210 行）

分层：`core/`（8 件 ~1,900 行服务层）/ `ui/controllers/`（16 件 4,210 行，ES class + AppHost.patch
桥接 React，无 store 库）/ `ui/components/`（137 件 ~22,800 行）/ `ui/models/`（96 件 ~9,600 行
纯模型）/ `types/models.ts`（1278 行手维 RPC 类型镜像，126 条 export）。

**结构性债务（按证据列；下表是 2026-11-21 盘点底稿——十项均已在批次十~十三落地，状态见执行进度与终态清单）**：
| # | 债务 | 证据 |
|---|---|---|
| 1 | 126 条手维 RPC 类型**零逐字段 parity**（只有方法名 parity：apiClientParity / serverModulesParity 总数钉 117） | `types/models.ts:1-3`、`tests/apiClientParity.test.ts`、`tests/serverModulesParity.test.ts` |
| 2 | `settingsCatalog.ts` 816 行纯数据**全仓 0 判据提及**（控制台最高频触达面） | grep 全测试无命中；settingsPane.test 已改内核差集断言但只对账枚举 |
| 3 | 面板 key **三处手维**：Router VALID_PANES(21) + PanelRegistry PANELS(21) + App paneOf switch(22 case)；lazy 声明与预取表又各一份 20 项 | `core/Router.ts:23-47`、`ui/components/PanelRegistry.ts`、`ui/App.ts:59-148,253-332` |
| 4 | ApiClient **上帝类**：1058 行单类 114 处 this.rpc，服务端已域重排（21 模块）客户端未跟 | `core/ApiClient.ts` |
| 5 | 资源钩子 5 份变体未收编：useDecisionLedger(197)/useFleet(178)/useContextStudio/useChangesReview(456)/useProviderCatalog(504) 各自维护 seq/quiet/轮询/缓存 | ✅ W5 已收编（`useSessionResource` 增强核 + `LatestRequest`） |
| 6 | FilePicker(694)+FolderPicker(515) 疑似大面积重复（各配 FileTree/FileTreeFlattener/FsPickerLazy，判据各仅 1 条） | 待 diff 评估 |
| 7 | `ui/models/Icon.ts` 364 行 import React 产 JSX——models 层唯一越界 | Icon.ts:18 |
| 8 | format.ts `legacyRenderMarkdown`（:682-707）生产不可达，按依赖政策有意保留但未隔离 | `ui/format.ts:682`、`ui/markdown.ts:20-23` |
| 9 | i18n 分片 `tabs_a/b/c` 是行数切分产物非域语义；en 1,942 词条 / t() 3,443 处 | `ui/i18n/en/` |
| 10 | 命名不一致：ui/models 94 个 PascalCase 中 `checkpoint.ts`、`settingsCatalog.ts` 两个小写 | — |

**红线（明确不动）**：antd `advancedChunks` 分包（Vite 8 下 manualChunks 静默丢弃 + 细拆白屏事故
记录在 vite.config.ts:42-56）、darkAlgorithm（W0 四路实测否决，两主题同走 defaultAlgorithm）、
vitest 双项目拓扑（2026-11-20 刚调优：chrome 36 文件串行 + fast maxForks 6）、
useSessionResource 既有 12 面板接线、theme.css 唯一配色 token 事实源纪律。

**护栏强度**：1033+ 用例（web 189 test 文件 + tests 根 38）；大文件中最薄的是
settingsCatalog(0)、GraphTab(1)、FleetMode(1)、ContextMode(1)、ProofMode(3)、SessionViews(4)。

### 1.3 内核归属现状（extensions/ 48 件 / 4,748 行）

- **(a) 内核已承诺等价物：0 件**——gate 9（穿透再导出桶的影子扫描）在守。
- **(b) 适合上内核的候选（按收益/阻塞排序）**：

| # | 候选 | 行数 | 对应内核域 | 阻塞点 |
|---|---|---|---|---|
| 1 | CompactionMarkerReader 清偿（内核 dist 已有同体 `kernel/context/compactionStateCodec.js`，只差 exports 一条深路径） | 删 app 件 192 行 | context 域 8→9 条深路径 | **零新代码**，纯内核记账（api:check/boundary:check/exportsClosure） |
| 2 | ServeInstance | 229 | maintenance（桶已存在） | 无技术阻塞；**额外发现：app 内双副本**（§1.4-L3） |
| 3 | MaintenanceRunner | 372 | maintenance（现只有 3 个底层件缺编排面） | 依赖 #2 先行；`OMNI_MAINTENANCE`/`OMNI_GC_*` env 解释层留 app，内核收纯 options |
| 4 | GraphStore（WorkflowDef 定义持久化） | 145 | autonomy（26 文件运行面**唯独缺定义存储**） | 极小：workspaceRoot 已是注入参数 |
| 5 | CliWorker + ExternalCliWorker + WindowsShim | 483 | worker（依赖的 ProcessTreeKiller 内核已承诺） | WindowsShim 有 windowsNativeSandbox 先例；二档优先 |
| 6 | InjectionSelfCheck 计算部分 + 快照资产 | ~170 | security/eval | curated 快照需随内核 defaults 发布；doctorReport 渲染留 app |
| 7 | cronerSchedule + 端口 | 202 | 无 schedule 域（需内核新增 croner 依赖） | 收益中等，缓 |
| 8 | memory 端口族（vortexRing/cosmicWeb/resonantField） | ~150 | contracts/ports/memory | **无实现无消费**——先实现再谈上内核，不动 |

- **(c) 真应用形状、留 extensions**：Laya 全家 11 件（2,056 行——内核仓 docs/BOUNDARY.md
  2026-11-03 显式裁决：第三方 venv 绑定不进内核，只留 DecisionEngine 注入缝）、webLiveView、
  decisionEngineResolver、wasmSkillPack、doctorReport 契约（防 cli→server→cli 环）、protocolSchema、
  mcp registry 两件、daemon 端口四件、subagentPorts。
- **上内核工作流已确认**：内核仓分支实现（过 AGENTS.md 宪法 + 17 门 verify）→ R 轮发 tag →
  app `OMNI_KERNEL_TAG=… npm run kernel:vendor` → `npm ci` → `kernel:surface` → 改消费点 →
  删 extensions 件 → 登记表清条 → `kernel:check` 九条 + verify 全链。
- **重叠区核查**：R22-R24（alpha.36）**没有**做 jsonlStorage eventsOf 缓存（app 缓偿项
  「等 R22 内核侧」落空，app 侧 sessionEventsCache/sessionScanCache 双缓存继续兜）；内核
  modelCapabilityProbe/routePricing/live/maintenance 底层件均已承诺、app 无影子。

### 1.4 遗留问题合并清单（旧账终态 + 本次新发现）

旧账：遗留总表 14 项已于 2026-11-20 全部终态；缓偿登记中 B1(eventsOf app 侧)/B2(markdown 惰性)/
B3(语言五层) 批次八已清。**仍在册/新发现**：

| # | 项 | 状态 |
|---|---|---|
| L1 | decisionLedgerService / DesktopConfigLoader 内聚单类切分（缓偿登记） | 2026-11-21 已开始拆，未完 |
| L2 | `web/test/format.test.ts` 未提交改动（1 行 unused `beforeAll` import 清理，上轮 B2/B1 判据适配残留） | 工作树现存 |
| L3 | **serveInstance 双副本**（本次盘点新发现）：`src/apps/cli/serveInstance.ts` ≡ `src/host/extensions/kernel/util/serveInstance.ts` 229 行逐字节同体（diff 仅 import 一行），消费分裂 6 处（cli 5 文件 + maintenanceRunner）——gate 9 盲区内的 app 内单点真源违例 | ✅ 已清偿（K3 + K2 副本清零） |
| L4 | src/apps/cli 悬空脚本引用（runGates/auditStandards/check/buildAuditBin） | ✅ 裁定 B（2026-11-22）：boost 命令族删除，-1609 行 |
| L5 | eventsOf 内核侧缓存（缓偿登记「等 R22」——R22 已发未兑现；app 侧双缓存已兜） | 待判定：关闭登记或升内核提案 |
| L6 | markdown legacy/full 混渲统一重渲设计（缓偿登记） | 待判定 |
| L7 | 语言双真源互通（桌面 IPC+壳层重建设计，缓偿登记；B3 已五层收敛主体） | ✅ 终态关闭：web→桌面已通，桌面无运行期语言入口 ⇒ 反向事件触发条件不成立 |
| L8 | childRunFailure.mjs 孤儿（并入批次 T 处置） | ✅ 已删除（批次 T） |
| L9 | 零消费导出批量收敛（B5 判定「纯噪音」不做） | 维持不做，除非 knip 扫描出新证据 |

---

## 二、批次划分与执行顺序

```text
第一波（app 仓内、低耦合）   T 全仓.ts化 + L2/L8 随批清偿
第二波（跨仓协调）           L3 serveInstance 收敛 → K1 内核仓 R25 轮 → K2 app 接收
第三波（app 仓内、大体量）   W1 类型护栏 → W2/W3 → W4 → W5 → W6 → W7
穿插                         L1 / L4 / L5-L7 随波插空
```

原则：每批独立可验收、conventional commit 小粒度、每批过 `npm run verify` 全链
（typecheck×3 → kernel:check 九条 → 1033+ 用例 → build → smoke → desktop）；动仓前复核
HEAD 与工作树（并行会话纪律）；共享文档改前重读。

---

## 三、批次 T：全仓 .ts 化

### T0 前置决策（先定后动）
| 决策 | 结论 | 理由 |
|---|---|---|
| D1 运行时 | **engines 升 `>=22.18.0`**，`node scripts/x.ts` 直跑，CI node 版本同步 | strip-types 无旗标默认开启；webStressProbe 已事实依赖；避免全链 npm scripts 加旗标的噪音 |
| D2 desktop | scripts 改 **`.mts`**；`fakeElectron.cjs` 保持 | desktop 包 type=commonjs；.mts 明确按 ESM 解析；fakeElectron 是 esbuild alias 目标非 Node 模块 |
| D3 embed-demo | **保持 .mjs** | 随 files 发行给用户；「3 行跑起来」的 README 承诺不破 |
| D4 typecheck | 新建 `scripts/tsconfig.json`（include scripts + examples + 根 vite/vitest.config，noEmit），加 `typecheck:scripts` 并入 typecheck 链；desktop/scripts 并入 `desktop/tsconfig.json` include（noEmit 下 rootDir 无影响，需实测确认） | 不污染 dist 布局（buildDist 原子换入与 files=["dist/src"] 假设 dist 只装 src 产物）；消除 typecheck 盲区 |
| D5 语法纪律 | 脚本区只允许 **erasable 语法**（无 enum/namespace/参数属性），在 scripts/ 头注与 CONTRIBUTING 各注一句 | Node strip-types 约束 |

### T1 病例件：devConfig（牵连面最单点集中）
`scripts/devConfig.mjs → devConfig.ts`（补全真类型，删 `devConfig.d.mts` 31 行）；
同改 9 处消费：`vite.config.ts`、`web/test/browserHarness.ts`、`web/test/e2e.test.ts`、
`tests/devAddressContract.test.ts`（import + **:38 正则改钉 `from './scripts/devConfig.ts'`**）、
`tests/launchReadiness.test.ts`、`scripts/devAll`、`scripts/startAll`、`scripts/lib/launchReadiness`。
**期望**：唯一被构建工具运行期消费的脚本转完；9 处消费从「手维声明壳」升级为编译期真类型；
正则判据与 vite 源码同步漂移验证通过。

### T2 根 scripts 其余 15 件
- 库件：`launchReadiness.ts`、`workspaceLease.ts`（删 `workspaceLease.d.mts` 39 行）、
  **`childRunFailure.mjs` 删除**（孤儿，L8 清偿）；
- 双形态：`kernelShadowScan.ts`、`kernelSurface.ts`（主模块检测 `import.meta.url vs argv[1]` 惯例平移）；
- 入口：`buildDist.ts`、`checkKernelBoundary.ts`、`cleanDist.ts`、`copyAssets.ts`、`smoke.ts`、
  `startAll.ts`、`devAll.ts`、`vendorKernel.ts`、`eval/hostRpcHammer.ts`、`eval/webStressProbe.ts`；
- 同改：`buildDist` 内 spawn copyAssets 路径字符串；3 个测试的 spawn 路径
  （kernelShadowScan×2、kernelSurface）；根 package.json 9 条 npm scripts；
  35 处 `plugin.js` → `plugin.ts` 后缀残留（T 批次顺带核销）；
- 转换纪律：**逻辑零改动、diff 最小、逐文件 commit**；只补接口边界类型。
**期望**：根 scripts 16 件全 .ts；typecheck 链覆盖 scripts；`npm run verify` 全绿。

### T3 desktop/scripts 8 件 .mts
`build/buildInstaller/smoke/stageHarness/startupReport/test/verifyPackage/releaseManifest`
+ `lib/payloadCheck` 全改 `.mts`；desktop package.json 8 条 npm scripts 同步；
`test.mts` 内 esbuild alias 字符串（fakeElectron.cjs 不变）与 17 处计算型动态 import（.cjs 产物）
维持运行形态、补类型断言；CI verify.yml desktop-gui-smoke 字面路径改 `.mts`；
desktop/README 结构树、installer/README 同步。
**期望**：desktop 36/36 测试 + verifyPackage + smoke 照常；fakeElectron alias 在 .mts 形态下实测
22.18 跑通；typecheck 覆盖 desktop/scripts。

### T4 收尾
- 悬空引用判定（L4）：逐个读 `boostCommand.ts:53`、`boostSurfaceAudit.ts:207,232`、`boostProbes.ts`
  的 runGates/auditStandards/check/buildAuditBin 引用——修注释 / 删死路径 / 登记，给结论；
- engines + CI node 版本对齐（22.18）；
- README/CONTRIBUTING/desktop/README 命令面全量复核（.mjs 字样清零，embed-demo 除外）；
- `npm run verify` 全链 + 推送后 CI 绿。

**批次 T 终态**：`.mjs/.cjs` 全仓仅剩 `examples/embed-demo.mjs` + `desktop/scripts/fakeElectron.cjs`
（两件刻意保留、各有身份注释）；2 个 `.d.mts` 退役（-70 行手维声明）；typecheck 盲区消除；
childRunFailure 孤儿删除；35 处 .js 后缀残留核销；webStressProbe 的 strip-types 依赖转正。

---

## 四、批次 K：内核归属收编

### K3（先行，不等 K1）：serveInstance 双副本收敛（L3）
`src/apps/cli/serveInstance.ts` 删除，cli 侧 5 消费点（cliServerCmds/serveAnnounce/
servePortConflict/gcCommand/serveShutdown）改指 `src/host/extensions/kernel/util/serveInstance.ts`。
**期望**：单一真源；若 K1b 内核轮紧随，此步是它的前置（先单源再上搬）。

### K1：内核仓 R25 轮（D:\deepseek\omniharness-kernel 开分支）
1. **R25a**：exports 承诺 `kernel/context/compactionStateCodec.js` 深路径（context 域 8→9 条）——
   **零代码**，只记账（api:check / boundary:check / exportsClosure）；
2. **R25b**：ServeInstance + MaintenanceRunner 上 maintenance 域——env 旋钮解释层留 app，
   内核收纯 options（`MaintenanceOptions` 注入面已有）；
3. **R25c**：GraphStore 上 autonomy 域（workspaceRoot 注入参数化）；
4. **R25d（二档，视轮容量）**：CliWorker 族上 worker 域；
5. 缓：InjectionSelfCheck（快照资产随内核 defaults）、cronerSchedule（需内核加依赖）。
每项过内核 AGENTS.md 宪法 + 17 门 verify，随 R25 发 tag。

### K2：app 侧接收（例行四步 + 清偿）
`OMNI_KERNEL_TAG=v0.1.0-alpha.37 npm run kernel:vendor` → `npm ci` → `npm run kernel:surface` →
消费点改对接面（compactionMarkerReader 3 处：contextCompactionService/StudioService/StudioSnapshot；
serveInstance 6 处；maintenanceRunner 2 处；graphStore 2 处）→ 删 extensions 对应件 →
`extensions/README.md` 登记表清条（compactionMarkerReader 2026-11-11 条目终态）→
`kernel:check` 九条 + verify 全链。

**批次 K 终态**：extensions 48 → 44 件（**-938 行**：compactionMarkerReader 192 + serveInstance 229 +
maintenanceRunner 372 + graphStore 145；若含 R25d 再 -483 行）；登记表归零；
serveInstance 内外双副本全清；内核 maintenance/autonomy/context 域补齐缺口。

---

## 五、批次 W：前端整体重构

### W1 类型护栏补钉（收益最高 / 风险最低）
对漂移敏感域（ThreadEvent payload、Control*/Fleet*/Decision* view 类型）加
「**后端构造样本 assignable-to 前端类型**」round-trip 判据（放 tests/，node 直测）；
中期把高漂移域 zod schema 化（zod 已在 dependencies）。
**期望**：「改后端忘改前端」从运行期 404/undefined 变 CI 红；126 条手维类型从零护栏到高漂移域全覆盖。

### W2 settingsCatalog 拆域 + 判据
816 行纯数据按域拆分（general/agent/data…）；补静态判据（key 唯一、icon 合法、分组覆盖完整——
与已有 settingsPane 内核差集断言互补）。**期望**：控制台改动半径变小；816 行零判据 → 拆分+判据。

### W3 面板 key 单源化
PanelRegistry 为唯一源：Router VALID_PANES 从它派生校验、App.ts `paneOf` 改
`Record<paneKey, Component>` 表驱动、lazy 声明与空闲预取表（App.ts:59-148 两份 20 项列表）并入表。
**期望**：新增面板从改 4-5 处变 1 处；App.ts 约减 80-100 行装配代码；判据面板较厚可兜。

### W4 ApiClient 域拆分
按服务端 21 域模块拆 client 域对象（sessions/workspace/changes/graph/…），共享 rpc/RpcError 入口；
**apiClientParity 判据同步适配**（现扫 `this.rpc('X')` 字面量，域对象化后形态变化——改判据先于改码，
判据与实现同 commit）；与 W1 类型拆分联动。
**期望**：1058 行上帝类域化，与服务端结构对齐。

### W5 资源钩子二次收编（5 变体 ~1,500 行）✅ 2026-11-22 已收编
在 useSessionResource 之上提增强核（poll/TTL/多流/选中详情）；迁移顺序按判据厚度：
useProviderCatalog（判据厚）→ useFleet → useContextStudio → useDecisionLedger → useChangesReview。
**行为判据先行**（批次七 --reasoning 教训：新行为必须配独立判据）。
**期望**：竞态/刷新/轮询语义单源，5 份守卫变体收敛进一个核。

### W6 双文件系统选择器收编
先 diff FilePicker(694)/FolderPicker(515) 行为差异 → **先补行为判据**（现各 1 条，薄）→
抽公共树/导航核。**期望**：约 300-500 行净删。

### W7 小项清理包（一个批次做完）
`ui/models/Icon.ts` → `ui/kit/Icon.tsx`（越界迁出）；`checkpoint.ts`/`settingsCatalog.ts` 补
PascalCase；`legacyRenderMarkdown` 隔离进显式 legacy 模块 + 判据锁死零外部引用（L6 随此判定）；
i18n 分片 tabs_a/b/c → 域语义名（词条键不动，3,443 处 t() 零牵连）；跑一次 knip 扫跨模块未用导出
（L9 以此重判）；ComposerOptions 离线兜底模型候选评估删除。
**期望**：命名/归属一致，死代码显性化，i18n 分片可按域查找。

**W 红线（不动）**：antd advancedChunks 分包、darkAlgorithm、vitest 双项目拓扑、
useSessionResource 12 面板既有接线、theme.css token 纪律。

---

## 六、批次 L：遗留清偿（穿插执行）

| # | 项 | 动作 | 波次 |
|---|---|---|---|
| L1 | decisionLedgerService / DesktopConfigLoader 切分 | 按「账本存取 vs 编排」继续拆完（判据已钉行为）；DesktopConfigLoader 单类内聚切分 | 第三波插空 |
| L2 | format.test.ts 未提交 1 行 | 随 T 批次首个 commit 顺带入库 | 第一波 |
| L3 | serveInstance 双副本 | 见 K3 | 第二波 |
| L4 | src/apps/cli 悬空脚本引用 | ✅ 裁定 B：删除 boost 命令族（2026-11-22） | 已完成 |
| L5 | eventsOf 内核侧缓存缓偿登记 | 与内核仓对账后二选一：登记关闭（app 侧双缓存已兜，触发条件不再成立）或升 K1 提案 | 第二波 |
| L6 | markdown 混渲统一设计 | 随 W7 legacy 隔离一并判定终态 | 第三波 |
| L7 | 语言双真源互通（桌面 IPC） | ✅ 终态关闭（触发条件不成立；见批次十三） | 已完成 |
| L8 | childRunFailure.mjs 孤儿 | 随 T2 删除 | 第一波 |
| L9 | 零消费导出收敛 | knip 扫描出硬证据才重启（W7） | 第三波 |

---

## 七、风险与红线（全程有效）

1. **并行会话**：app 仓与内核仓都有活跃并行轮（vendored 升级 / UI 打磨）。每次动仓前
   `git log --oneline -3` + `git status --short` 复核；改共享文档（README/CHANGELOG/CONTRIBUTING/
   extensions README）前重读现文件；commit 粒度切小。
2. **Windows CI 隔离设计保留**：kernelSurface/kernelShadowScan 的测试子进程 spawn 是 2026-11-08
   事故（Vite 转译动态 import .mjs，本地绿 CI 红）后的刻意设计——改名只同步路径字符串，**不把
   这三个脚本改回 import 消费**。
3. **strip-types 语法子集**：脚本 .ts 只能 erasable 语法；新写代码进脚本区同样受约束（D5 注记）。
4. **embed-demo 发行身份**：不转 .ts；productFurniture 判据不动。
5. **desktop .mts 实测门**：fakeElectron esbuild alias + 17 处动态 import .cjs 在目标 Node 上
   实测跑通才收批。
6. **判据纪律**：新增旗标/行为必须配独立判据（--reasoning 误嵌分支教训）；机械转换的 5 处
   spawn/import 硬编码字符串必须同 commit 同改（devConfig 正则、kernelShadowScan×2、
   kernelSurface、buildDist copyAssets、test.mjs fakeElectron alias）。
7. **verify 全链是唯一验收门**；`npm run kernel:surface` 忘跑会红（第 8 条裁决点）。

---

## 八、终态验收清单

- [x] `.mjs/.cjs` 仅余 embed-demo.mjs + fakeElectron.cjs（刻意保留、有注释；已用 `git ls-files` 复核）
- [x] scripts/ + desktop/scripts + 根配置文件纳入 typecheck；2 个 `.d.mts` 退役（`testGlobals.d.mts` 是 fakeElectron 全局替身的必要声明，非手维壳）
- [x] engines/CI = node >=22.18 对齐；webStressProbe strip-types 依赖转正
- [x] childRunFailure 孤儿删除；35 处 plugin.js 后缀核销；悬空脚本引用有结论（L4）
- [x] extensions 登记 0 条；上内核件删除（-938 行；二档 CliWorker -483 未随本轮）；README 归属契约同步
- [x] serveInstance 内外双副本清零（K3 + K2 后 extensions 副本一并删除）
- [x] 126 条手维类型：8 条 round-trip 探针覆盖高漂移域（ThreadEvent/Fleet/Decision×2/ContextStudio/Profile/Vault×2）
- [x] PanelRegistry 单源：新增面板 1 处完成；App.ts 装配减重
- [x] ApiClient 分域 + apiClientParity 适配绿
- [x] 5 资源钩子收编（W5：useSessionResource 增强核 + LatestRequest）
- [x] FilePicker/FolderPicker 公共核（W6；机制层单源 + 4 条行为判据）
- [x] W7 清理包全落（Icon 迁移/PascalCase/legacy 隔离/i18n 分片改名/knip）
- [x] L9 全类别零消费：knip（files/deps/exports/types）全 0 + devDep 闸入 verify（ignoreIssues 有据）
- [x] 遗留台账 L1-L9 全终态（L4 裁定 B 已删 boost；L7 终态关闭）
- [x] `npm run verify` 全链绿（2026-11-22 实跑：232 文件 1064 用例 + desktop 44；CI 待推送后复核）

## 工作量粗估

| 波次 | 批次 | 约量 |
|---|---|---|
| 一 | T（含 T0 决策） | 2-3 个工作会话 |
| 二 | K3 + K1 + K2 | 内核轮 1-2 个会话 + app 接收 1 个 |
| 三 | W1-W7 | 4-5 个会话（每批一验） |
| 穿插 | L1/L4/L5-L7 | 随批 |
