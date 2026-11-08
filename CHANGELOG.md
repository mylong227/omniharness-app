# 更新日志（Changelog）

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 惯例；
版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)（0.x 阶段 minor 即可含破坏性变更，以 `!` 标注）。

## [Unreleased]

### Changed（变更）
- **内核钉版升级 alpha.13 → alpha.14（2026-11-08 审计整改同步）**：vendor 升级至
  `vendor/omniharness-kernel-0.1.0-alpha.14.tgz`（内核侧 25 个提交：P0 15 / P1 57 / P2/P3 分批闭环）。
  应用侧同步：
  - 对接面 `security.ContentTrustTier`（内核安全域 `TrustTier` 改名，与资产域 `TrustTier` 区分）；
    `injectionSelfCheck` / `injectionSnapshotAggregator` 随迁，`kernel:surface` 重新生成；
  - 内核恢复会话旁路摘要（`SessionSummaryBuilder` / `SessionSummarySidecar`）——应用
    `sessionScanCache` / `sessionArchive` 是其生产消费者，升级后无需改动；
  - `kernel:check` 通过（265 源文件 / 316 处包导入 / vendored integrity / 原生内核）。
- **web SSE 三态判据修正（2026-11-08）**：`streamStability.test.ts` 第 ④ 步原只等 1.2s 断言
  「断开」，而宽限期是 4s（判据按定义不可能通过，历史假绿）；改为在触发断线后替换为
  「永不 onopen」的同形 EventSource 桩，等待越过 4s 宽限期再断言，消除重连竞态。
- **smoke 与用户级配置解耦（2026-11-08）**：`npm run smoke` 显式以 `--model-adapter mock
  --model mock` 启动 serve。此前继承 `~/.omniharness` 的 `modelAdapter=openai`，没有可用
  `OPENAI_API_KEY` 的机器上 serve 启动即失败（默认配置污染导致判据假红）。
- **双定时器统一（M30）**：server 自动化收敛到 RoutineScheduler 调度核心（与 CLI daemon 共享 routines.json，scope 隔离驱动方），AutomationStore / AutomationScheduler 退役；`automations.*` RPC 形状与执行语义逐字不变（web 面零改动），旧 automations.json 首次启动自动迁移（按 id 幂等、改名 .migrated 留证）；自动化自此支持 cron 调度（注入 CronSchedulePort 即用）。
- **审计 canonical 收敛内核单一真源（M29）**：auditChain / auditReportBuilder / auditReportVerifier
  改用内核 `Jcs.serialize`（alpha.13 新承诺 `kernel/receipts/jcs.js` + 深度护栏 `MAX_DEPTH=64`），
  app 侧第二实现 `apps/audit/auditCanonical.ts` 退役；合并结论钉死于
  `tests/auditCanonicalJcsGolden.test.ts` 4 例（JSON 值域逐字 golden / fail-closed 加固 /
  审计链端到端 / HTML 内嵌复核脚本同口径）。裁决留应用：auditSink（链原语已共享内核
  HashChain，轮转/布局属部署形状）、auditExporter（导出格式属 server 层）。
  vendor 钉版升级至 `vendor/omniharness-kernel-0.1.0-alpha.13.tgz`。
- **兼容层清零（M27）**：`src/host/kernel-compat` 目录**不复存在**——目录更名
  `src/host/extensions/`（app 自有扩展层，只剩 Laya/CLI worker/doctor 等真应用形状件）。
  内核 v0.1.0-alpha.12（M26 终盘收编 36 件 + M27 SDK 客户端族/凭据打码单一真源）收编后，
  **41 件影子副本删除**（approval/escalation/event/kv/vault/trace 自省/util 补全/skill 签名/
  asset 编解码安装器 + server 侧 rpc/transport 四件套 + sdkClient + dumpRedactor）、
  47 个消费文件改经 `src/host/kernel/<域>.ts` 对接面、死代码 3 处清偿
  （dormantExecutorActivation 零消费链 / capability spec 契约 / safeFs 漂移孤儿）。
  应用对接内核自此只有一条路：`src/host/kernel/<域>.ts`（360 处包导入全部命中内核承诺闭包，
  `kernel:check` 把守）——不再有第二份实现可逃逸。vendor 钉版升级至
  `vendor/omniharness-kernel-0.1.0-alpha.12.tgz`（4569 KiB，tag v0.1.0-alpha.12 = 187fa15，
  含 M26/M27/M28）。附赠修复：内核 `SdkClient` 的 S14「就绪前 close 兑现 opened」
  在旧实现中被双 onClose 注册覆盖而静默失效，alpha.12 已修。
- **plugin 域退役至内核包**：`src/host/kernel-compat` 的 plugin 影子子树（44 文件）删除——内核
  v0.1.0-alpha.11（M22–M25）已收编 plugin 全量能力（含 RPC 宿主 `registerRpc` + 权限
  `rpc.register`），应用 16 个消费文件改经 `src/host/kernel/plugin.ts` 对接桶；资产域的 zip 依赖
  同步走桶。`AppPluginPermission` 别名保留（= PluginPermission）。vendor 钉版升级至
  `vendor/omniharness-kernel-0.1.0-alpha.11.tgz`（含 M22 认知域重入 / M23 断线清偿 / M24 评测闭环）。
- **内核词表配置化（M28）**：随 alpha.12 到货并入账（此前仅在 M27 条目括号带过）——词表数据进内核 defaults 单一真源，应用经对接面零适配消费。
- **对话底部宽度统一**：计划条 / 输入框 / 排队坞统一 `max-width: 800px`（专注模式 920px）并居中；专注时中栏变宽，它们不再跟着铺满整屏。计划条底色同时从实心 `panel` 收到 30% 透明、边框收到 soft 的 70%，贴近页面底色只留一层淡淡浮起。
- **事件字段口径收敛**：新增 `web/src/ui/models/EventFields.ts`，把原先散在 StreamView / ThinkingTrail / TurnSummary / TraceView / 三个控制器里的 `callId 回落 / rawCallId / content / toolName / timestamp` 收成一份；轨迹筛选的行折叠与结果卡、钻取、工具清单共用同一口径。
- **对接面目录纯化**：`src/host/kernel/` 现在**只放**自动生成的 re-export，不含任何实现。原混在其中的 app 自有代码已迁出——Laya 决策引擎（10 个 TS + `laya_infer.py`）与 `decisionEngineResolver` 收进自有扩展层，企业 OIDC / jose 适配器收进 `src/apps/enterprise/`，`toolHandler` 纯 shim 删除、消费点直连 `contracts` 对接面。
- **内核对接面自动生成**：新增 `npm run kernel:surface`（`scripts/kernelSurface.mjs`）——从「业务代码实际 import + 内核包 `.d.ts`」生成 `src/host/kernel/<域>.ts`（现 18 个域文件），只保留实际使用的符号。新增内核符号只需在业务代码里正常 import 再跑一次生成命令，不再手写 re-export；`kernel:check` 第 8 条「生成物不漂移」裁决，升级内核 = 换 tgz → `kernel:surface` → typecheck。
- 会话置顶不再写 localStorage（删除 `web/src/ui/models/SessionPins.ts`）：服务端侧车为**唯一真源**，面板从 `sessions.list` 的 `pinned` 字段派生置顶集合。

### Added（新增）
- **事件流时间旅行**：历史用户消息新增「从此处重开」——确认后走服务端 `threads.rewind` 截断 append-only 事件流，重新加载并把该条原文回填输入框。确认框不再只说「N 条事件」，而是拆出被丢弃的构成（工具调用 / 工具结果 / 助手回复 / 思考说明）；回退前自动尝试落一个检查点（失败不阻断回退，但 toast 如实说明），可在回滚面板恢复「回退前」的对话与文件。本操作本身不还原工作区文件，文件还原仍走检查点/Rollback。
- **命令面板直达最近会话**：Ctrl/Cmd+K 的结果里并入最近 10 条会话（置顶优先），输入标题即可跳转；打开后仍复用原有 `openThread` 的加载 + 队列续发语义，占位文案同步为「搜索命令、面板或会话…」。
- **专注模式**：`Ctrl/Cmd+Shift+F` 或中栏头四角按钮隐藏左右栏，只留中栏并放宽正文宽度；退出恢复**进入前的真实布局**（不是「两栏全开」）。命令面板、设置页快捷键表同步，手动开合任一面板即退出专注。
- **思考轨迹筛选**：展开「总思考」后可按 `全部 / 思考 / 说明 / 工具 / 失败` 过滤长回合，片子上带实时计数、失败片只在真有失败时出现；「失败」一键只看失败工具行，长过程的定位从「翻整条时间线」变成「点一下」。
- **会话置顶跨设备同步**：置顶从浏览器 localStorage 升级为服务端侧车 `sessions.pinned.json`——新 RPC `sessions.setPinned`（只写侧车）、`sessions.list` 回传 `pinned`。存档目录随工作区/同步盘走 ⇒ 换设备打开同一项目看到同一批置顶；左栏「置顶」组与行菜单「置顶 / 取消置顶」保持原样。
- **托盘 busy 态**：复用既有 `omni:setProgress` 信号（回合开始 `2` / 收尾 `-1`，与任务栏进度同源）切换托盘图标为带绿点的 `icon-busy.png`，悬停提示同步显示「回合进行中」；变体缺失时回退常规图标，重复设置去重，`destroy` 复位。
- **视觉探针基线**：`web/test/visualProbe.ts` 新增 `pinned`（置顶组 + 行内 pin 角标 + 行菜单「取消置顶」）与 `jump-bottom`（回到底部浮钮）交互态；会话夹具补齐 `workspace` / `pinned` 真实形状。

### Tests（判据）
- 新增 `web/test/sessionRewind.test.ts`（确认/取消、运行中/末条/服务端拒绝的分支、回退影响面分类、检查点成功/失败）与 `userCardDuration.test.ts` 的「历史消息重开 / 末条编辑重发」互斥判据；新增 `focusMode.test.ts`、`trailFilter.test.ts`、`eventFields.test.ts` 等随对应能力落地。
- 新增 `tests/sessionPinned.test.ts`（侧车读写 / 列表回传 / 换实例仍可见 / 非法 id 拒绝）与 `web/test/sessionPins.test.ts`（置顶组浮出 / 刷新映射 / 乐观回滚 / 接线守卫）。
- 新增 `tests/kernelSurface.test.ts`：把「对接面生成物一致 + 目录纯净」纳入常规 `web:test`，忘了跑 `kernel:surface` 时本地测试直接红。
- 桌面端新增托盘 busy 判据（切图 / 去重 / 缺失回退 / destroy 复位 / 创建即 busy + 图标资产 + IPC 接线）。
- **2026-11-08 审计判据批**：`web/test/eventStreamReconnect.test.ts`（reconnect 用当前令牌重建 / connect 幂等）、`web/test/approvalQueue.test.ts`（审批/提问单槽占用不覆盖 + 宽限期满重建 + omni:token-updated 即时重建 + unmount 摘除订阅）、`web/test/authRequiredBanner.test.ts`（横幅幂等 / 就地换令牌 / 空值忽略）、`tests/devAddressContract.test.ts`（devConfig ↔ serveDefaults 端口镜像——三处脚本头注长期声称的守卫补齐）与 `tests/launchReadiness.test.ts`（resolveServePort 三层优先级 / classifyReadyProbe 五分类 fail-closed / readinessUrl 钉 127.0.0.1）；桌面新增 ipcGuards 三组判据（notify fail-closed / trustRejection 三重校验 / revealPath 白名单）+ CSP 哈希门禁（30 → 34 条）。

### Fixed（修复）
- **SSE 令牌轮换后永不自愈**：EventSource 的自动重连永远复用构造时的 URL，服务端重启换令牌后它拿旧 `?token=` 无限重试，用户只看到红色「断开」。新增 `EventStream.reconnect()`，AppController 在断连宽限期满与 `omni:token-updated` 时用**当前**令牌重建。
- **401 只能整页重开**：授权失效横幅升级为可就地换令牌——粘贴新令牌 → `authToken.set` → 派发 `omni:token-updated` → SSE 重建、横幅收起；模块同时 `core/` → `ui/` 迁移（core 无 DOM 是既定约定，core 层唯一 DOM 违规件除名）。
- **并行会话审批/提问卡片互相顶掉**：单槽占用时不再无条件 patch（服务端挂起表为真源，处置后 `restorePendingCards` 接续），排队以 toast 可见；挂起恢复失败不再 `.catch(() => {})` 静默。
- **桌面杂项**：`desktop/package-lock.json` 版本对齐 0.6.0-alpha.2；`devAll` 停止改 Windows 树杀（`taskkill /T`，修 vite 孤儿占 5173）；`vendorKernel` 的 pack 改 node 直跑 npm-cli.js（带空格路径不再被 cmd 撕裂）；组合根显式登记 vault/automations 的 serve-only 边界（stdio 面 fail-closed 属设计而非缺陷）；「92 个 RPC 方法」过期注释四处对齐 93、门禁头注「七条判据」对齐八条。

### Security（安全）
- **桌面 CSP script-src 摘除 `unsafe-inline`**：唯一内联脚本（主题防闪烁）改 SHA-256 哈希白名单；style-src 的 unsafe-inline 为 antd cssinjs 必需，登记为接受项。CSP 门禁判据把 source 与 dist 产物的内联脚本哈希双钉，漂移即红。
- **`omni:revealPath` 白名单**：渲染层传入路径必须落在当前工作区子树内才允许唤起系统文件管理器（此前仅校验 string 即 shell 打开，被攻陷渲染层可侧探任意目录存在性）。
- **serve token 持久化 localStorage → sessionStorage**：会话级凭据不跨浏览器会话持久（刷新仍在、关浏览器即清），缩小令牌外泄面。

- **A2A 僵尸 CLI 旗标面退役**：`--a2a / --a2a-port / --a2a-peer / --a2a-transport` 与
  `A2A_TRANSPORTS` 枚举、帮助条目、`config.a2a` 段构造全部删除——A2A 互操作已随内核 M4
  退役（v0.3 线格式，runtime 自 alpha.6 起即忽略该段），此前帮助仍在许诺「起对等 agent
  服务端监听」的幽灵能力，违反本仓「帮助不许诺幽灵命令」纪律。待 v1.0 重基后按新契约另行接入。
- **defaults/ 五份文档性死拷贝删除**：providers / limits / endpoints / ssrf / injection-snapshot——运行时读内核包内那份（`builtinDefaults.locatePackageRoot` 锚定内核包根、明确不做 cwd 推断），本仓拷贝实测已逐字节漂移、「逐字节一致可 diff 自检」的 README 声明失真（含描述已不存在的 a2a 段，a6d4bd5 删除 limits.json a2a 段的入账欠账一并补记）；`defaults/README.md` 重写为「数据流真相 + 两件活数据」。
- **`src/indexBeta.ts` 删除**：自述的 `omniharness/beta` 发布通道不存在（package exports 无 `./beta`、注释里连包名都对不上、全仓零 import）——「以为发布了其实没发布」的发布面脱节。
- **`scripts/codemods/` 一次性迁移脚本删除**：旧版 kernelSurface.mjs（内嵌旧分域规则，误跑会按旧口径覆写 18 个生成物）与 m27ShadowRetire.mjs；git 历史可考。
- **`desktop/static/loading.html` 删除**：零引用死资源（security.ts 导航白名单注释与 desktop/README 同步事实）。

## [0.6.0-alpha.2] - 2026-11-05

### Added（新增）
- **自描述 RPC**：新增 `rpc.list` 内省方法（`introspect` 域模块）——一次调用返回全部方法 → 归属模块/插件，与分发顺序（内置 → 插件）同构。
- **协议面多向护栏**：`tests/serverModulesParity.test.ts`（后端 92 方法快照）+ `tests/apiClientParity.test.ts`（客户端每个 `this.rpc()` 字面量必须在后端存在）+ `tests/cliFlagsDiscipline.test.ts`（旗标「读取必须登记、登记必须有人读、帮助不许诺幽灵命令」双向核对）。
- **嵌入 API**：`createOmniHarness()` / `defineModule()`（`src/index.ts` 导出）——3 行把完整服务端嵌进任意 Node 进程；可运行样例 `examples/embed-demo.mjs`（`npm run example:embed`）。
- **一键初始化**：`omniharness init`（TTY 交互式 / 旗标直达）——选厂商、填 Key（Windows 落盘自动 DPAPI 加密；其余平台明文+0600）、合并写用户级 `~/.omniharness/omniharness.json`。
- **doctor 增强**：构建产物检查、缺省 serve 端口占用、插件目录自动创建、`--probe-model` 模型连通性探测（复用 UI 同源探针）、内核版本自述。
- **标品门面**：本 CHANGELOG、[CONTRIBUTING](CONTRIBUTING.md)、GitHub Actions 验证流水线、示例配置合法性判据、嵌入 API 生命周期判据（`tests/embedApi.test.ts`）。

### Changed（变更）
- **内核对接单点化**：637 处散布的 `@omniharness/kernel` 深路径导入收敛为 `src/host/kernel/`（17 个域文件、323 条再导出）；门禁第 7 条强制「唯一导入点」。升级内核 = 换 tgz + 适配一个目录。
- **后端模块化**：7 层 AppServer 继承链（91 个手工 `handlers.set` 散布 6 文件）改为 `ServerServices`（装配）+ 16 个域模块（声明式注册）+ 薄 AppServer（组装/分发/生命周期）。加一个能力 = 1 个模块文件 + index 登记 1 行。
- **组合根统一**：stdio 与 serve 两条路径共用 `composedServerCore()` 不变量核心，消除「改一处漏一处」缺陷类（历史上真实发生过：serve 漏接 doctor）。
- **kernel-compat 收编**：`src/host/kernel-compat/`（122 文件）确立为 app 自有扩展层（内核切片清理掉的能力），归属契约见[其 README](src/host/kernel-compat/README.md)。

### Fixed（修复）

### Security & Correctness（2026-11-06 全项目审计修复，7 个 P1）
- **嵌入 API 缺省不许本机配置覆盖模型**：createOmniHarness 原缺省漏 `modelOverrideEnabled:false`，开发机的用户级配置会拿真实凭据静默替换 MockModel；现缺省关、显式 `allowModelOverride` 才开。
- **桌面 CSP frame-src 放行 localhost 与远程**：工作区文件预览（故意走 localhost）与远程浏览面板在壳内全白屏的根因。
- **桌面 smoke 报告打码 token**：loadedUrl 带 token 进 smoke-result.json/issue 文案。
- **`model probe / goal / workflow --help` 不再执行真动作**（原 `?? CliDefaults` 兜底让求助直接发起真实网络请求/目标循环/工作流）。
- **`daemon start` 打印带 token 的 UI 地址**：CLI 生成令牌经环境变量固定给子进程（原令牌随 stdio:ignore 丢弃，打印的地址必然 401）。
- **打包 stage 补齐 examples/**：离线插件市场 catalog 在打包应用里永远空表的根因（fail-closed 断言 + vendor 同改）。
- **vendorKernel 原子替换**：pack 成功后才删旧 tgz（原实现 build 失败即把仓打到 npm ci 全红）。

### Fixed（同轮审计，P2/P3 精选）
- Web：URL token 挂载即抹除 + localStorage 持久化；401 全局「需要授权」横幅；重连后恢复**全部**挂起审批/提问（原只恢复第一条，收卡后自动接续下一条）；打开运行中会话采纳真实 running 态（不再丢流）；QuestionCard 倒计时跨请求重置；previewPort 失败不再永久缓存。
- CLI：doctor 现在能看到用户级配置（init 写的那份）；init 成功行如实显示生效适配器（沿用 mock 时当场点破）+ 分平台加密文案 + 未知旗标 fail-closed；doctor 补帮助条目与端口解析（OMNI_BACKEND_PORT 生效）。
- 脚本：smoke 启动超时路径不再泄漏子进程与临时目录；内核门禁扫描面扩展到 .cts/.js/.mjs/.cjs；CI 补 timeout/concurrency/permissions/桌面判据。
- 文档/数据：全仓计数对齐（92 方法/16 模块/350 文件/726 用例）；45 处 `tests/unit/*` 上游判据引用如实标注；harness-core 技能与 injection-snapshot 路径改指本仓现实；defaults/README 如实化（真实数据流：内核包内 defaults 才是活数据）；THIRD_PARTY_ASSETS.md 建立（NOTICE 悬空引用修复）；package.json 补 exports/files（打包形态可用）；桌面版本对齐 0.6.0-alpha.2。
- 死代码清理：TurnOrchestration.isWorkflowDefLike、ModuleRpcMap、AppServer.moduleOwners、desktop 4 个零消费 IPC 桥、file:///loading.html 导航白名单、will-quit 不可达钩子。
- `exec.ts` 帮助快路径吞掉子命令用法页：`omniharness <子命令> --help` 现在到达子命令自己的 USAGE（裸 `--help` 仍走零加载快速路径）。
- `scripts/startAll.mjs` 的 tmpSweep 导入指向已删除路径（预启动清扫静默失效）。
- 补齐 `examples/catalog/registry.json` 离线市场占位；订正 `native:build`、不存在的 `chat` 子命令等悬空提示。

## [0.6.0-alpha.1] - 2026-11-04

- 从上游 OmniHarness@0.4.0 切出独立应用仓（后端宿主 + React 工作台 + Electron 桌面端）。
- 完成内核包迁移（M2）：消费 vendored `@omniharness/kernel@0.1.0-alpha.4`，删除 1163 个内嵌内核文件。
