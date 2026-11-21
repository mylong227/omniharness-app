# 更新日志（Changelog）

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 惯例；
版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)（0.x 阶段 minor 即可含破坏性变更，以 `!` 标注）。

## [Unreleased]

### Changed（变更）
- **深研优化轮六批（2026-11-20，三路深研 → 全部落地）**：
  · **批次一（工程效率）**：vitest 单项目全串行 → **双项目**（chrome 36 文件保持串行纪律，
    fast ~187 文件 node/jsdom 并行，配置期内容扫描+helper 一层传递闭包识别）；desktop TS
    ^5.7.0(5.9.3)→^7.0.2 与根统一 + tsconfig 补 `exactOptionalPropertyTypes`/
    `noUncheckedIndexedAccess` 严格闸（desktopState 两布尔偏好改必填是类型收窄正解）。
    并行收益在本机（会话负载下）实测中性（1126s vs 串行 1045s），空闲机/CI 兑现——限幅 maxForks 6 是首轮无界并发实测 7 个 worker 启动超时后的稳定项。
  · **批次二（架构收口）**：`app/HarnessAttach.ts` 单一真源（附着序列三处拷贝收口，历史
    P2 事故面不可再复现）；Tray/Menu/IPC 三份动作回调收口单一 appActions；PERSISTABLE_KEYS
    下沉 services/configPersistKeys（core 反向依赖消除）；core→ui 反向依赖清除
    （localize 注入接缝，ApiClient/DialogService 7+5 处出口）。
  · **批次三（RPC 模块按域重排）**：control 三拆 fleet/contextStudio/proof（模块 19→21）；
    surface 杂物抽屉清仓（quota→observability、modes→threads、setWorkspace→sessions）；
    方法名零变化（parity 快照零漂移，owner 抽样断言同步 14 条）。
  · **批次四（运行时性能）**：threads.get 无 limit 缺省封顶 500（兼容洞闭合）；
    memory.changed 300ms 去抖 + MemoryTab deps 收窄；MetricsTab 后台标签页闸；
    启动装载两拍（归档补扫延后 1s）；buildConfig 三分支并行 + 维护巡检挪 listen 后；
    Resizer 宽度落盘 rAF 合并。
  · **批次五（配置化收尾）**：appLimits env 轴（附件/SSE 回放/预览/搜索/审计八旋钮，
    `OMNI_*` 约定）；StorageKeys 键注册表；settingsPane「字段全集」判据改内核差集断言
    （手维 EXPECTED 三处镜像 → 机器核对）。
  · **批次六（结构打磨）**：SSE 分流纯函数化 StreamEventRouter（node 直测判据 ×2）；
    desktop 令牌脱敏统一 DesktopLogger.redact；两端契约判据互链注记。
  · **批次七（2026-11-21 钩子收编 + model.adapters）**：useSessionResource 补 reloadTick
    option + refresh 返回在飞 Promise；六面板收编（Graph/Profiles/Skills/Rollback/Memory
    双钩子/Plugins 裸奔补 toast）——三处注释与代码不符顺带修正；model.adapters RPC
    （116→117）+ Router 卡凭据实时预检；--reasoning 旗标三通道补齐（自查抓到 handler
    误放 --model 分支内单独使用被吞 → 拆独立条目 + 行为判据三例）；三配置面写入者清单。
  · **缓偿登记**（理由在案）：eventsOf 读档缓存（内核 jsonlStorage，等 R22 内核侧）；
    markdown 惰性（legacy/full 混渲需统一重渲设计）；语言双真源互通（IPC+壳层重建
    设计）；decisionLedgerService/DesktopConfigLoader 切分（内聚单类，判据已钉行为）；
    零消费导出批量收敛（纯噪音）。
- **桌面「快速提问」快捷键配置化（2026-11-20）**：全局快捷键从 main.ts 模块常量 +
  menu.ts 内联 accelerator 两处硬编码，收进 `desktop.config.json` 的
  `app.quickCaptureShortcut`（缺省 `CommandOrControl+Shift+Space` 不变；accelerator
  形态校验 fail-closed 回落）——全局注册与菜单展示同源单一真源。
  `releaseManifest.mjs` 产品名同步单一真源化（读 electron-builder.yml `productName`）。
- **桌面发布面账实收口（2026-11-20）**：electron-builder publish 与 `repositoryUrl`
  （菜单「仓库」项同源）从上游旧仓 `OmniHarness` 改指本仓 `omniharness-app`（遗留总表
  #12 收口；draft release 渠道不变，electron-updater 自动更新改订本仓 release）；
  `releaseManifest.mjs` 安装包文件名从写死 0.2.0 改为按 package.json 版本推导。
- **metricsTabStale 判据硬化（2026-11-20）**：组件按 POLL_MS=2s 真实 setInterval 轮询，
  满载并发（223 worker）下 interval 可在 settle 微任务窗口内开火、多打一次失败调用
  让「健康时无陈旧提示」偶发翻车（单次实测 + 隔离恒绿取证）。判据改 fake timers：
  冻结轮询、断言后显式推进恰好一档——轮询次数确定化，负载不再影响判定。

### Added（新增）
- **内核升级 alpha.34（2026-11-20，R20 好用收口轮）+ mcpServers env/cwd 应用侧映射补全**：
  vendored kernel 升到 `v0.1.0-alpha.34`（M115–M119 + review 收口；公共根导出面 60/60，
  消费面零变化，kernel:check 287/290 复绿）。R20：厂商一键接线（embed `model` 字符串
  快捷）、close 生命周期收口（drain 有界等待 + `drainTimeoutMs`）、配置孤儿清偿
  （mcpServers 文件面补 env/cwd + `classifyInterjection` 接线）、配置错误自愈（未知键
  did-you-mean）。**应用侧工单同轮清偿**：`argConfigDefaults` mcpServers 映射补
  env/cwd 透传（连接器早已消费——此前用户在 omniharness.json 写了静默失效）；判据
  configSectionWiring 钉住两种形态（stdio 透传 env/cwd / 远端形状归一）。
- **设置页 v2 专家能力卡（2026-11-20，settings-completion 扩展）**：运行时栏新增「专家能力」
  卡——evolutionRlvr / decisionEngine / calibratedAutonomy / rbac 四结构段共 20 行叶子
  （进化闭环开关/自动运行/七环编排/预算与门禁、决策引擎模式/热进程/trace/超时、校准
  自主性开关/最少校准单元/三类风险预算 α、RBAC 开关/会话角色）。四段收编
  `SECTION_REPLACE_KEYS` + `PERSISTABLE_KEYS`（整段提交按段替换，内核各自严格校验器
  fail-closed）；needRestart 常驻标记（运行时装配在 boot 期）。路径语义字段
  （ledgerDir/pythonPath/modelDir/repo）与 roles 角色表经配置文件设置——pickerUniformity
  面约束的诚实边界，settings-completion 设计稿已回写。判据同步：settingsPane 字段全集
  清单 +20、OPTION_LABELS 补决策引擎三档、settingsPersistKeys 四键、i18n 全词条。
- **技能实验室 Skill Lab v1（2026-11-20，next-panels §13 第三项兑现，§13 关闭）**：
  新 skills 域模块（第 19 个域模块，RPC 112→116）——`skills.list`（**数据源修复**：旧读
  `AppServerOptions.skills` 三组合根均未注入、生产态恒空；改为 skillRegistry 装配真值 ∪
  `fileConfig().skills` 编辑面按名归并）/ `skills.get` / `skills.diff`（结构差异测试
  dry-run，fail-closed）/ `skills.apply`（通过才落 `config.skills` 整段）/ `skills.delete`
  （仅 config 内联可删）。`SkillEditorService` 纯逻辑层实现 CRISPR SPI 语义
  （定点编辑=精确点名 + 差异测试 fail-closed + 回滚=不落盘无副作用；Report 本地同构——
  `crisprEditReport.js` 不在内核 exports 承诺清单）。存储=config.skills[]（三条组合根
  通用、无信任闸；工作区文件面在 serve 默认不装配，留 v2，见设计稿
  docs/design/skill-lab/README.md）。SkillsTab 编辑面：来源列/覆盖徽标/编辑/删除 +
  编辑器 + 本地行级 LCS diff 预览（SkillDiff 纯模型，单一 diff 实现）。生效 = 下一会话。
  判据 tests/skillEditor + web/test/skillDiff + parity 116 + settingsPersistKeys。
- **记忆时间图 Memory Atlas v1（2026-11-20，next-panels §13 第二项兑现）**：新 RPC
  `memory.facts`（111→112，memory 域）：`factsSnapshot` 纯函数窄转型探测
  `FileLongTermMemory.factGraph`（图是实现细节不进端口契约——探测消费，零内核改动），
  返回全量 `TemporalFactCard` + total/active（内核 `<=` 到点即失效口径）；无图如实
  `supported:false`。记忆面板新增「时间图」区：三元组卡（subject·predicate·object +
  原文 + 起止日期）+ 生命状态徽标（有效/已被取代/已过期），有效卡在前、组内 validFrom
  降序——「这条偏好现在还有效吗？谁取代了谁？」一眼可读；SSE `memory.changed` 自动跟随。
  判据 tests/memoryFacts（探测命中/无图降级/取代字段透传）+ parity 112。已知边界如实
  继承内核 temporalTripleParser（中文关系句暂不入卡）。
- **服务端价表下发 `model.pricing`（2026-11-20，遗留 #9 收口）**：新 RPC（110→111，
  config 域）纯静态下发内核 `DEFAULT_ROUTE_PRICING`（36 条单一真源）+
  `UNPRICED_DEFAULT_FAMILIES`（故意不定价登记）+ 兜底价；web ModelPricing 服务端表优先、
  内置 20 条表兜底（两表并扫最长前缀），AppController 启动期拉取失败静默兜底；路由卡
  条目补 ≈ 单价或「未收录单价」——「成本差多少」兑现。口径提示：内核表经
  routePricingDefaults 判据核对，切换后成本读数变化属预期。
- **遗留全清零轮（2026-11-20）：总表 14 项全部终态**——
  · **输入历史按天持久化**（#8）：`omni.inputHistory.<YYYY-MM-DD>` 按天档，同天重启/刷新
    找回、跨天清空（「旧任务语境不带进新的一天」原设计精神保留）；存储注入可测，
    localStorage 不可用 fail-soft 退内存态；判据 5→8 条。
  · **桌面配置告警码化 i18n**（#4）：16 处硬编码文案 → `issues: ConfigIssue[]`
    （path+code+params 单漏斗），文案单一真源迁 DesktopI18n messages.ts（15 键 ×中英），
    诊断对话框补告警计数——告警首次有日志之外的出口；判据 43→44 条。
  · **页头与右栏路径去重**（#10）：撤右栏空态首页 `.wb-path` 绝对路径层（同面板两层
    重复）；全路径悬停保留，常驻路径只在中栏面包屑。
  · **#14 并行会话 UI WIP 代收口**（review 验收后提交）+ **#12 桌面发布面**（2026-11-19）
    + **#5/#7/#11 决策终态**（Electron 46 未发布 / types 锁 engines 主版本 / 仓间事实）
    ——总表与 desktop README §8 全部账实回写。

- **模型角色路由设置卡（2026-11-19，内核 #B4 接入，next-panels §13 Router 兑现）**：
  设置「模型与厂商」栏新增「模型角色路由」卡——按角色给规划/执行/审查/压缩等工作负载
  分配不同模型。未启用态引导 + 启用种子（默认模型 + 当前适配器做 entries[0]，未映射角色
  先与不路由行为一致）；策略 7 档 / 条目（模型名+适配器）/ 角色映射 8 角色（executor/
  planner/reviewer/compactor/memory/guardian/goal/subagent，仅 by-role 策略显示）；停用 =
  整段发 null。服务端 `SECTION_REPLACE_KEYS` 收编 `modelRouter`（整段提交按段替换，
  杜绝「roles 指到已删条目」的静默坏配置）；前端预挡四形态（空条目/缺模型名/重复/
  角色目标缺失——内核 by-role fail-closed 的同构预挡）。诚实边界写进卡脚注：条目凭据
  取自对应适配器环境变量（与 CLI 一致），主配置 API Key 不用于路由条目。纯逻辑层
  `ModelRouterDraft` node 直测（web/test/modelRouterDraft.test.ts）；i18n 全词条补齐。
- **内核升级 alpha.33（2026-11-19）**：vendored kernel 升到
  `v0.1.0-alpha.33`（R19 遗留总清偿轮：M112–M114 + 深度 review 收口 P1×1/P2×3/P3×9，
  0 P0）。**会话上下文贯穿**（`ToolContext` 增可选 `capflowSessionContext` 实时闭包：
  recorder 同源零滞后 + 继承指令信道 capflowInheritedTask，RunWorkflowTool resume 预检
  优先消费——review-r18 窗口滞后/派生会话继承源双收口）、**遗留台账总收口**（RESIDUAL.md
  全面刷新）、**EOL 卫生**（`.gitattributes` 钉未来 + 149 代码文件 CRLF→LF 归一）——
  均为内核/安全内部面，应用消费面零变化（19 域「无变化」、公共根导出面 60/60 无新增）；
  本仓 `kernel:check` 九条复绿（285 源文件 / 290 处包导入 / 原生内核实载）。版本历史见
  [vendor/README.md](vendor/README.md)，契约见 [KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。
- **内核升级 alpha.32（2026-11-19）**：vendored kernel 升到
  `v0.1.0-alpha.32`（R18 resume 盲区收口轮：M110–M111 + 深度 review 收口 P1×2/P2×2/P3×4，
  0 P0）。**resume 续跑档 CFI 闭合**（RunWorkflowTool resume 分支预检 `resumeCfiCheckOf`：
  WorkflowRunLog 预读存档 step prompts 逐条 × 当前会话最近工具输出重查，enforce 命中
  先于任何子会话拒绝；预检 specHash 传 runner 锁内复验）、**workflow 边四档实测**
  （`eval:propagation` 十三档：subagent/goal/workflow 三进程内派生边实测曲线收官）——
  均为内核/安全内部面，应用消费面零变化（19 域「无变化」、公共根导出面 60/60 无新增）；
  本仓 `kernel:check` 九条复绿（285 源文件 / 290 处包导入 / 原生内核实载）。版本历史见
  [vendor/README.md](vendor/README.md)，契约见 [KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。
- **内核升级 alpha.31（2026-11-19，连同 alpha.30 一并跨过）**：vendored kernel 升到
  `v0.1.0-alpha.31`（R16 跨代理 provenance 轮 + R17 派生边收口轮：M105–M109 + 深度
  review 收口，0 P0）。**委托边继承标记**（`inherited-untrusted` 第四能力维度：信任标签
  随委托交接保持而非逐代理重置）、**链式洗白窗口**（boundary laundering 逐代理防御的
  窗口闭合）、**paraphrase 三档曲线**、**全派生边执法扩面**（`IN_PROCESS_DERIVED_TOOL_NAMES`
  单一真源：subagent/run_workflow/run_goal/run_plan + CFI 指令信道文本按工具提取器
  强转镜像工具层）——均为内核/安全内部面，应用消费面零变化（19 域「无变化」、公共根
  导出面 60/60 无新增）；本仓 `kernel:check` 九条复绿（284 源文件 / 290 处包导入 /
  原生内核实载）。版本历史见 [vendor/README.md](vendor/README.md)，契约见
  [KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。
- **后端 RPC 错误码位化（2026-11-19，遗留清偿）**：新增共享分类器
  `core/rpcErrorCodes.ts`（appServer WS 与 httpBridgeTransport HTTP 两条路径同源消费）——
  调用方参数问题（域模块「X 需要 Y / 未找到 X / X 拒绝」约定形态）判 **-32602**（JSON-RPC
  标准 Invalid params），不再与内部服务端故障同码 -32000；等待超时保持 -32002。前端
  failureHint 增 -32602 专属提示（错误信息已说明缺什么，换模型/查 Key 是误导）。
  判据：tests/rpcErrorCodes（三类形态/超时/兜底）+ rpcFailureMessage ③ 增 -32602 路。
- **TypeScript 7 收编（2026-11-19）**：typescript 5.9.3→**7.0.2**（Go 原生化编译器）。
  实证迁移：desktop tsconfig 的 `moduleResolution: Node`（node10）在 TS 7 已移除 →
  换 `module: node16 / moduleResolution: node16`（typecheck-only 面，esbuild 产物不受
  影响）；后端（NodeNext）/ web（bundler）两配置零改动直过。门禁：typecheck×3 +
  build（tsc 产物原子换入）+ smoke 9 条 + 全量 218 文件 / 1005 用例 + desktop 43 条全绿。
- **内核升级 alpha.29（2026-11-19）**：vendored kernel 升到 `v0.1.0-alpha.29`
  （R15 遗留清偿轮：M102–M104 + 深度 review 收口，0 P0）。**参考轨迹匹配四档组合子**
  （`TraceMatch`：strict/unordered/subset/superset，带键多重集合 `name#argsDigest`，
  对齐 agentevals `TrajectoryMatchEvaluator`；`eval:trace --expected` 接线）、
  **Multi-CaMeL 双通道子代理契约**（variables 数据信道读取即审计 / 指令信道完整性）、
  **金丝雀感染曲线**（`eval:propagation` 逐跳双指标 + CFI 衰减对照）——均为内核/评测/
  安全内部面，应用消费面零变化（19 域「无变化」、公共根导出面 60/60；`./eval` 子路径
  新增 TraceMatch + 4 类型）；本仓 `kernel:check` 九条复绿（284 源文件 / 290 处包导入 /
  原生内核实载）。版本历史见 [vendor/README.md](vendor/README.md)，契约见
  [KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。
- **Vite 8 / Rolldown 迁移（2026-11-19）**：vite ^6.4.5→**^8.3.8**（esbuild/Rollup →
  Oxc/Rolldown）、@vitejs/plugin-react ^4.7.0→**^6.3.0**、esbuild ^0.25.12→**^0.28.2**
  （vite 8 peerOptional）。vite.config 换面：`rollupOptions`→`rolldownOptions`、
  `manualChunks` 函数→`advancedChunks.groups`（**Vite 8 下 manualChunks 函数返回值被
  静默丢弃**——不迁移分包即无声失效；原函数两规则殊途同归收敛为 vendor-react /
  vendor-antd 两条分组，katex/markdown-it/highlight.js 负向排除随 entry）、
  `minify:'esbuild'`+`esbuild.keepNames`→oxc 缺省 + `rolldownOptions.output.keepNames`
  （错误边界组件栈依赖）。两处判据随合法压缩产物形态放宽：CSS hex 3/6 位通用归一
  （Rolldown 把 `#0000ff` 缩成 `#00f`，语义等价）、keepNames 锚点双形态兼容（esbuild
  `__name()` 包装 vs Rolldown 具名函数表达式）。门禁：全量 verify **EXIT=0**（218 文件 /
  1004 用例 + CSP 哈希门禁 + smoke + desktop 43 条）+ 压测五场景全绿。
  账本见 [deps-upgrade-2026-11-18.md](docs/design/deps-upgrade-2026-11-18.md) 追加批次。
- **内核升级 alpha.28（2026-11-18）**：vendored kernel 升到 `v0.1.0-alpha.28`
  （R14：M99–M101 + 深度 review 收口，0 P0）。**CapFlow 确认门**（`require-approval`
  从枚举预留落地为真确认门：三态裁决 + 真实 target 单一真源 + per-call 确认不缓存 +
  fail-closed `CAPFLOW_APPROVAL_DENIED`）、**污点跨委托传播**（执法面闭合进子代理树，
  Multi-CaMeL boundary laundering 的执法面防御）、**确定性轨迹评测器**（`eval:trace`：
  `TraceFold` + 调用指纹循环检测等规则四件套，零凭据零模型调用）——均为内核/安全/评测
  内部面，应用消费面零变化（19 域「无变化」、公共根导出面 60/60）；本仓 `kernel:check`
  九条复绿（284 源文件 / 290 处包导入 / 原生内核实载）。路径上先并入了同日 alpha.27
  （R13：统一工具结果预算读数 / tail 侧确定性整形 / MCP 工具指纹 JCS 化 / 区分性检索
  对照池）。版本历史见 [vendor/README.md](vendor/README.md)，契约见
  [KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。
- **依赖安全升级批次（2026-11-18）**：`npm audit` 10 项（2 critical / 4 high）清至
  仅剩开发面 picomatch 链（上游无修复版待发）。**katex ^0.16.47→^0.19.1**（运行时原型
  污染绕过信任限制，用户可见面修复）；**vitest ^2.1.9→^5.1.0**（tinypool RCE critical ×2
  + mocker 路径穿越/代码注入 + ReDoS 链，本仓使用面与破坏面零交集——无 workspace/
  coverage/bench/sequential/vi.mock 跨用例状态）；markdown-it ^14.3.3→**^15.0.3**
  （CommonMark 一致性修复，自带类型故删 @types/markdown-it）；croner ^10.0.1→**^11.0.1**
  （OCPS 1.4 + DST 对齐 Vixie）；antd 6.6.8→**6.7.1**；jose/openid-client/playwright-core/
  axe-core/user-event 补丁位跟进；桌面 electron 44.7.0→**45.3.4**（Chromium 156 / Node 24.22；
  沙箱 preload 收紧与本仓 preload 零交集）。门禁：typecheck×3 + 全量 web 218 文件/1004 用例
  + desktop 43 判据 + smoke 全过。账本见
  [deps-upgrade-2026-11-18.md](docs/design/deps-upgrade-2026-11-18.md)（含 Vite 8/TS 7/
  @types/node 26/esbuild 0.28 的登记不升理由与 Vite 8 独立迁移路径）。
- **依赖收尾批 + fetchMetrics 分类补齐（2026-11-19）**：vitest 5.1.0→**5.1.1**；
  jsdom 25.0.1→**29.1.1**（major：CSS 引擎重写/computed-style 变化——全量 jsdom 组件判据
  复验零破坏）；桌面 esbuild 0.25.12→**0.28.2**（对齐根，desktop:build + 43 判据 ✓）；
  `fetchMetrics` 补齐 **RpcError 分类**（HTTP 失败 → kind=http-status + status / 拒答 →
  kind=network，与 rpc() 主路径同口径；**SSE 维持原样**——EventSource 原生重连无错误对象
  可分类）。账本修正一处：Electron 46 尚未发布（预计 2027-01），45.3.4 即受支持最新线。
  门禁：全量 verify EXIT=0（218 文件 / 1005 用例 + smoke + desktop）。
- **错误链路结构化分类（2026-11-18，硬编码清理批次）**：`ApiClient` 引入 `RpcError`
  （稳定 kind：rpc-error / auth / http-status / bad-json / **network**，携带 HTTP status 与
  JSON-RPC 协议码）；运行失败建议语改按 **kind / status / code** 分类——后端桥接等待超时
  （协议码 `-32002`，回合可能仍在后台）与 HTTP ≥500 给「仍在后台」提示；**网络不可达首次
  有了专属提示**（此前落进误导性的「检查 API Key」）；授权失败指向 token 横幅。判定不再
  匹配翻译后文案（en 词条变化不再让提示静默失效），`/RPC 超时/` 中文字面量匹配从源码移除。
  账本见 [hardcode-cleanup-2026-11-18.md](docs/design/hardcode-cleanup-2026-11-18.md)。
- **i18nCoverage 判据四（2026-11-18）**：web/src 的 JSX 文本节点与展示属性（title /
  aria-label / placeholder / alt 裸引号值）**零 CJK 直写**——普查为 0，钉住防回归；
  桌面壳同步新增「ipc.ts / window.ts 剥离注释后零裸字面量」判据。
- **压测 / 极限探针 + 后端并发锤（2026-11-18，批次 4）**：新增两个零第三方依赖的可复现探针
  （真 Chrome + CDP + 确定性假后端 / 嵌入 API 起真实宿主），本轮数据：大会话 2000 事件打开
  ~2s（DOM 3.2k，窗口化有界）；流式 600 delta 543ms 且 longtask **0ms**；轨迹 1500 行首屏
  ~130ms、分页式全量展开 ~430ms（**轨迹虚拟化据此决策不做**——首屏与内存都已在量级内，
  探针留仓可复测）；会话列表 800 行 ~1.4s；队列 50 项连续续发 51 轮 7.4s；后端 32 并发
  640 只读调用 0 错误（p50 87ms / p95 191ms）。账本见
  [ux-audit-2026-11-17.md](docs/design/ux-audit-2026-11-17.md) 第三批 P1/P2/D1。
- **i18nCoverage 键表模式判据（2026-11-17，沉淀批次 C 的一次性脚本）**：设置字段 / 快捷键行 /
  命令面板 buildCommands / 权限档 / 轨迹筛选 chips 等表驱动文案走 `t(var.label)` 查表，
  en 是否覆盖只能从「表的值」侧比对——新增第三条静态判据：源码里 `label` / `hint` /
  `name` / `group` 四键的 CJK 值都必须在 en 分片有条目。首跑即抓到命令面板「专注模式」
  缺 en 词条（en 用户见中文），已补。
- **内核升级 alpha.26（2026-11-17）**：vendored kernel 升到 `v0.1.0-alpha.26`
  （R12 两批一并 vend）。alpha.25：缓存命中率三层修复（finalize 兜底请求保留主请求工具前缀 /
  缓存读数逐步入账，实测旧口径低估 1.99× / gapMs 分因）、内存上界收口（磁盘嵌入镜像
  256 MiB 预算 / watcher 峰值哨兵）、内部缓存一致性三项、会话级前缀计量器与零凭据稳定性探针；
  alpha.26：工具暴露稳定杠杆 `OMNI_TOOL_EXPOSURE=monotonic`（显式第三模式，缺省仍 `plan`；
  A/B 实测 tools 前缀复用 0.8197→1，窗口退出不再灾难性重写）与三轮 review 收口。
  均为内核内部面，应用消费面零变化（19 域再生成「无变化」、公共根导出面 60/60）；
  本仓 `kernel:check` 九条复绿（284 源文件 / 290 处包导入 / 原生内核实载）。
  版本历史见 [vendor/README.md](vendor/README.md)，契约见 [KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。
- **粘性与美观第二批（2026-11-17，接全面 review，账本见
  [ux-audit-2026-11-17.md](docs/design/ux-audit-2026-11-17.md) 第二批）**：
  ① **消息引用追问**：任意一条 user / assistant 消息一键以引用块填回输入框（复用
  composerSeed 通道零新 RPC，4000 字符截断）；② **轨迹导出 Markdown**：跟随当前筛选
  按轮分节导出，下载链路与会话导出共用；③ **轨迹「回到当前轮」**锚点；
  ④ **上下文余量预测**：「按近 N 轮增速，大约还能再撑 M 轮」（压缩骤降不参与中位数，
  数据不足不渲染——预测是参考，宁缺毋滥）；⑤ **厂商卡「本地 / 云端」微标签**
  （回环 + 私有网段 + 内网主机名判定）；⑥ 左栏空态一行化、宽度滑块「已应用」反馈。
- **全面 review 打磨批次（2026-11-17，四路源码普查 → 五批还原，账本见
  [ux-audit-2026-11-17.md](docs/design/ux-audit-2026-11-17.md)）**。新增能力：
  ① **输入草稿按会话保留**（此前切会话串稿、刷新即丢；localStorage 兜底 + 32 条上限 +
  换会话回填不抢焦点）；② **输入历史**（空输入框 ↑ 调上一条，↓ 越过最新归还原稿）；
  ③ **用户消息一键复制**（`useCopyFeedback` 收编为公共 hook）；④ **上下文主动预警**
  （容量坞 ≥80% 转琥珀 + 展开态「去压缩」直达控制室）；⑤ **后台会话完成站内提醒**
  （运行态下降沿 toast，与失败提示对称）；⑥ **「?」快捷键速查浮层**（数据与设置页同源）；
  ⑦ **多会话并行聚合徽标**（页脚「N 在跑」）。
- **上下文注记卡（2026-11-16，用户截图反馈）**：对话流里的 `system` 中继内容不再按纯文本
  平铺。① **压缩游标**：header 尾巴的 `evidence=<base64url>` 让 Web 侧旧正则失配，整条事件
  回落到 `— 全文 —`，几 KB 证据 + 数千字摘要糊满一屏；现在证据是可选字段（坏证据只丢证据、
  保留游标），并解出「审计齐全度 / 触发预算」两枚 chip；摘要展开是**分节 Markdown**
  （`【标签】` 升为小节标题并加发丝线，围栏代码原样保留）。② **工作流记忆召回**：单行
  `→ shell … → read_file …` 收成「N 步 · 仅作参考」折叠卡，展开是逐条编号步骤（工具名 dim、
  目标等宽），不再让用户读一串箭头。③ **其余长注记**：超过 240 字 / 4 行的旁白统一收成同款卡，
  标题取行首 `【标签】`（如「长期记忆 · 开工前对齐」）。默认全部收起（一行摘要 + 元信息），
  展开正文在卡内滚动（≤min(56vh,460px)）、收起即卸载 DOM；卡头是 `button`
  （`aria-expanded`、空格可开合、焦点环内缩）。判据 `web/test/systemNote.test.ts`（10 条：
  归类/分节/摘要/证据坏掉/阈值边界）、`web/test/systemNoteCard.test.ts`（真浏览器：默认收起、
  展开分节、证据不上屏、键盘开合、双主题截图）。
- **内核升级 alpha.24（2026-11-16）**：vendored kernel 升到 `v0.1.0-alpha.24`
  （alpha.23 R9/R10 + alpha.24 R11，含长任务端到端评测、请求哈希回溯、引用检查、
  压缩长段落保真、checkpoint 文件态恢复与回滚原子性）。这些能力均在内核/评测/回滚内部面，
  应用消费面零变化（19 域、公共根导出 60/60）；本仓完成 vendor 重建、tarball integrity、
  `kernel:check`（284 源文件 / 290 导入 / 原生实载）与文档账实闭环，并重打桌面安装包。
  版本历史见 [vendor/README.md](vendor/README.md)，契约见 [KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。
- **厂商编辑「可用模型」空白修复（2026-11-15，用户截图反馈）**：探测成功但手选模型
  残留空串/已下线模型时，antd Select 拿不到匹配项显示为空白；现在统一回退到「当前
  清单内的当前模型 → 清单首项」，并同步修正启用请求使用的模型，避免启用一个不存在的
  模型。判据 `web/test/providerEditor.test.tsx`（2 条：展示回退 + `selectedModelFor`）。
- **回合结果卡自动剔除「写过又删除」的临时文件（2026-11-15，用户截图反馈）**：
  结果卡挂载时通过新增的 `fs.exists` 只读 RPC 核对本轮 **created** 行；文件已不存在
  （临时脚本/探针在回合内自删）即自动从卡里摘掉，不再需要用户逐行点击才发现。
  查询失败 fail-open（保留行，绝不误删真实交付物）；`fs.exists` 走
  `SafeFs.safeStat`，越界/目录/不存在一律 false。判据
  `web/test/turnSummaryFilter.test.tsx`（2 条）、`tests/workspaceTreeExists.test.ts`。
- **体验打磨第二批（2026-11-15，基于全量 UX 审计）**：
  ① **配置可读性**：设置下拉显示名表（`openai`→「OpenAI 兼容」、`policy`→「策略拦截」、
  `max`→「最高」…，机读值不变），未设置项回显已知出厂值「未设置（默认：JSONL/策略拦截…）」；
  ② **轨迹检索**：读/写/命令/搜索/失败/进行中筛选 chips + 文本搜索 + 轮次分隔，过滤算术下沉
  `TraceFilter`（`web/test/traceFilter.test.ts` 4 条）；
  ③ **设置搜索/跳转**：左栏字段级搜索（索引与 `SETTINGS_FIELDS` 同源），选中后切分栏、滚到行并高亮；
  ④ **键盘可达**：会话时间分组头改 `button`（`aria-expanded`）、事件卡新增 `ev-open` 详情按钮、
  移动端顶栏新增设置入口；⑤ **保存反馈**：保存成功后字段行级「已保存」徽标；
  ⑥ 模型芯片 `title` 改为完整「模型 · 厂商」；⑦ **桌面标题条去重**：不再重复品牌/项目名，
  只保留图标化快速提问与窗口控制（品牌在左栏、项目在页头/左右栏已各有一处）；
  ⑧ **轨迹长列表上限**：超过 300 行先渲染 300 行，剩余「显示剩余 N 条」手动展开
  （`traceLimit.test.tsx`）。
  判据：`settingsPane`（显示名/默认值）、`configWiring`（savedField）、`traceFilter`、`uxPolish`。
- **聊天流收纳审计与未知事件（2026-11-15，用户截图反馈）**：每轮 `audit` 事件不再逐条
  渲染成 JSON 卡，统一收进末尾**一条默认折叠**的「审计记录 × N」摘要（展开看逐条
  heartbeat/approval/decision 负载）；未知事件兜底也从常开 JSON 改为默认折叠。
  判据 `web/test/auditFold.test.ts`（3 条：单块聚合/默认收起/负载保留）。
- **轨迹视图版式与对话同轴（2026-11-15，用户截图反馈）**：`.trace` 内层新增
  `.trace-inner`，与 `.stream-inner` 共用 800px 居中正文列（专注模式 920px），外层内边距
  对齐 `.stream` 的 22/28/10——此前轨迹贴中栏左缘、状态/时间被甩到极右，与下方对话卡
  形成两条错位内容轴。同时状态徽标定宽居中、时间列等宽右对齐。判据
  `web/test/traceLayout.test.ts`（5 条，含「只改 CSS 不包容器 = 假对齐」与窄窗同步）。
- **内核升级 alpha.22 + 深度适配三项（2026-11-15）**：vendored kernel 升到
  `v0.1.0-alpha.22`（alpha.20 收尾基线 + alpha.21 三项 + 信任闸分类修复并入）。三项能力落地：
  ① **缓存与防火墙**：`FileConfig` 新增 `toolCache`/`capflow` 文件面（内核），设置页运行时栏新增
  「缓存与防火墙」卡（读缓存开关/条目上限、能力防火墙 off/shadow/enforce、策略文件选择），
  段名进 `PERSISTABLE_KEYS`/`SECTION_REPLACE_KEYS`；
  另：设置保存后 `capflow` 与上下文三段经 `liveRuntimeConfig` 覆盖启动快照，**下一回合生效**
  （`toolCache` 在装配期包裹工具端口，只能重启生效，hint 已写明）；
  ② **编队实时子会话**：内核 `SubagentTree` 共享父子树（编排器在子代理启动时写 `父→子` 与
  `callId→子`），serve 组合根在 `buildConfig` **之前**创建并注入，`fleet.list` 运行中车道
  立刻带出 `childSessionId`（不必等 `tool_result`）；
  ③ **压缩证据**：内核把 `stateAudit`/`signals` 以 ` evidence=<base64url-json>` 随
  `OMNI_COMPACTION_V1` 游标持久化（旧游标兼容、坏证据 fail-soft），上下文面板显示
  「审计通过/有缺失」与触发信号，未记录审计仍如实告警。
  内核侧 `v0.1.0-alpha.21` tag 含 11 条新判据（压缩证据 4 / 父子树 3 / 配置段 4）；
  本仓验证：`kernel:check` 九条（284 源文件 / 290 导入）、typecheck×3、
  web 212 文件 / 972 用例、build/build:web、smoke 9 条、desktop 41 条全过。
- **修复上下文三段配置通道断链（2026-11-15）**：alpha.19 批次里 `retrievalContext`/`semanticRecall`/
  `contextPolicy` 能经设置页落盘，但 `ArgParser.configDefaults` → `CliArgs` → `CliConfigSections`
  → `ConfigFactory.build` 从未映射 ⇒ CLI/serve 启动时内核收到 undefined、行为静默回落到 off。
  现已全链透传并以 `tests/configSectionWiring.test.ts` 钉住（I5a 同型判据）。
- **上下文工作室补内核上下文策略（2026-11-15）**：`context.studio` 增 `kernel` 字段
  （`KernelContextViewBuilder`：检索供给 mode/改写/精排/预算、语义召回 requested/active/degraded、
  降档两级、缓存守卫下限），与 `kernel.health` 的 context 分区**同一读模型**（`semanticRecallRequested`
  收敛到一处）。控制室「上下文」新增「内核上下文策略」卡：BM25 单步预算、改写/精排、
  语义召回（请求了但嵌入不在位 = 「降档运行」而不是「未启用」）、降档阶梯、缓存守卫（下限 +
  当前命中率）。内容口径修正：context studio / extensions / proof / fleet 里过时的
  「alpha.16」事实改为当前内核事实（含「SubagentOrchestrator 已导出、编队接线待排期」）。
  设计审计与对齐矩阵见 [kernel-ui-alignment/README.md](docs/design/kernel-ui-alignment/README.md)。
  判据 `tests/kernelContextView.test.ts`（默认全关/配置映射/降档）、`tests/controlContext.test.ts`
  （快照带出生效值）、`web/test/contextMode.test.ts`（三态渲染与徽标）。
- **内核健康桥 `kernel.health`（2026-11-15）**：`observability` 域新增 1 个只读 RPC（108 → 109），
  把本进程可观测的运行态聚合成七分区健康报告（`receipts/telemetry/budget/sessions/plugins/
  sandbox/context`，词表与内核哨兵一致：`ok/degraded/absent`，absent ≠ degraded）。诊断面板
  新增「内核健康（哨兵桥）」一屏：分区状态、问题码与 absent 原因逐条可见；未装配分区显示
  「未配置」而不是「正常」。实现 `services/kernelHealthBridge.ts` + `AgentRuntimeHost`
  只读探针（沙箱名/嵌入端口/预算读数），单探针抛错只降级该分区（`HEALTH_SECTION_FAILED`）。
  判据 `tests/kernelHealthBridge.test.ts`（七分区/越预算/语义召回降档/fail-soft）与
  `web/test/diagnosticsTab.test.ts`（⑥⑦）。
- **设置页 alpha.19 上下文三段入口（2026-11-15）**：运行时栏新增「上下文与检索」卡——
  `retrievalContext`（mode/rewriter/rerank/maxSnippets/maxTokens）、`semanticRecall.mode`、
  `contextPolicy`（降档两级 + 缓存命中率下限）共 9 行；三个段名进 `config.update` 白名单，
  服务端对 `SECTION_REPLACE_KEYS` **按段替换**（深合并无法删除嵌套键）。设置页字段模型新增
  `path` + `fieldId`（同段多行），数字留空=删除叶键、删空整段=显式清除。判据
  `settingsPane`（fieldId 全集/NUMBER_RANGES 对齐）、`configWiring`（⑬–⑯ 完整段提交/清空/
  越界）、`serverConfigStorePersist`（段替换往返/非法拒绝）、`settingsPersistKeys`（段校验器）。
- **决策账本 v1（2026-11-11）**：控制台「数据与统计 / 审计之后」新增 1 个面板——
  执行前决策、审批、授权、双链（原始 audit + AAT）与共形证据一屏可读；支持复核抽屉、
  AAT + `.sha256` 导出与用户级审计开关。新增 `decision.session/detail/export/configure`
  4 个 RPC（104 → 108），后端 `services/decision/*`，前端 React 19 + antd 6 面板
  `DecisionTab`（390 宽单栏、无横向滚动；preview axe 0 violations）。设计与验收见
  [decision-ledger/README.md](docs/design/decision-ledger/README.md)。
- **右栏「工作台概览」首页（2026-11-10）**：没有打开文件 / 网页时，右栏不再留白，只放三块：
  项目名与路径（分支 / 未提交变更数作为一行轻量元信息）、本会话一句话摘要（回合 / 工具 /
  文件 / 上下文 / 有效时长）、前 4 条工作区变更 + 一个「全部变更」。长会话首屏只加载尾部
  事件时，回合数与时长以服务端旁路摘要为准，避免「0 回合」与左栏「2 回合」自相矛盾；文件数
  会补上成功写文件工具的产物。上下文百分比直接读内核 `model` 事件最近一次 `payload.context`，
  不额外轮询。
  同一轮收敛掉了首页里的重复入口：「新建任务 / 命令面板 / 设置」由左栏与快捷键承担，
  「继续最近」由左栏会话列表承担，连接 / 模型状态由页脚承担，上下文明细由左栏容量图表承担，
  都不在右栏再放第二遍。
- **桌面端全局「快速提问」**：主进程注册 `Ctrl/Cmd+Shift+Space`，任意应用中按下即唤起窗口并把
  焦点送进输入框；托盘与应用「文件」菜单新增入口，无边框标题条显示品牌 / 当前项目并提供
  常驻按钮；设置 → 桌面显示该快捷键。旧 preload 不订阅该事件也照常工作（纯增量）。
- **命令面板两个会话实用命令**：`导出会话 Markdown`（当前已加载事件 → 本地 `.md`，更早历史
  未加载时在文稿开头标注）与 `复制会话链接`（不含一次性 token，同机同浏览器可直接打开）。
  对应模型 `SessionTranscript` / `SessionBrief` 均为零 React 纯逻辑，新增判据覆盖。
- **输入区空态快捷键提示**：四条示例下方补 `Ctrl/Cmd K`（命令面板）、`@`（引用文件）、
  `/`（调用技能）三枚键帽，不增加常驻说明文字。

- **Windows 一键入口**：仓库根新增 `start.cmd`（构建后端 + 前端 → 起 serve → 自动打开带 token 的工作台；
  `start.cmd mock` 走零凭据 mock，`start.cmd desktop` 启动 Electron 桌面应用）与 `package-desktop.cmd`
  （构建 → stage → NSIS 安装包，产物在 `desktop/release/`）。两者是 `npm start` / `npm run desktop:dist`
  的薄包装，缺依赖时自动 `npm ci`，失败时停在窗口里保留错误。

### Fixed（修复）
- **桌面壳硬编码中文绕过 i18n（2026-11-18，硬编码清理批次）**：目录选择框标题（en 用户
  看到中文「选择工作区」→ `dialog.pickWorkspace` 双语键）；切换工作区时守卫错误直弹
  中文句子（`assertDirectory` 抛稳定码 `WorkspaceGuardError`，对话框按
  `dialog.workspaceNotFound` / `dialog.workspaceNotDirectory` 本地化模板呈现）；启动页
  兜底文案复写副本删除（引用消息表单一真源）。
- **打开「正在运行」的会话后停止按钮失灵、可并出幽灵第二回合（2026-11-17 全面 review）**：
  busy 来自磁盘态而 `inFlight=false`，`stop()` 直接 return、`send()` 落进空闲分支直接 runRound。
  现在 `stop()` 在远端忙碌时降级收口（清 UI + 定向 abortTurn）、发送按聊天模式分流不并发，
  服务端收尾后 busy 自动解除并接队列续发。判据 `web/test/remoteTurnStop.test.ts` +
  `chatModeRouting` 远端回合两条。
- **六个右栏面板取数无竞态守卫（2026-11-17 全面 review）**：TraceTab 快速切会话时旧会话的
  迟到响应覆盖新会话数据（跨会话串数据）；useProof 双流共用 seq 可把骨架屏永久卡死。
  统一收编 `useSessionResource`（seq 守卫 + 失败保留旧数据 + loading 只在无数据时为 true，
  周期刷新不再把面板闪回骨架屏）。
- **设置「需重启」标记在英文界面失效（2026-11-17 i18n 收口）**：判定用的是 t() 翻译后的
  中文子串 `includes('重启')`——字段新增结构化 `needRestart` 标记，渲染层不再猜文案。
- **决策详情解释段 / 掉线授权横幅 / 会话导出文稿整段裸中文（2026-11-17 i18n 收口）**：
  37 处真硬编码过 t()；en 词条同步补齐，并清理 85 个无引用孤儿词条（脚本机械比对 +
  i18nCoverage 把关）。
- **任一右栏面板渲染抛错把整个工作台换成 crash 屏（2026-11-17 全面 review）**：
  RenderErrorBoundary 从根级一处下沉到按面板包裹（key=activePane，爆炸半径收敛到单面板）；
  另补全局 unhandledrejection 兜底（记日志 + 节流 toast）与 `--model-router` 非法 JSON 的
  可读报错。
- **安装版「本地 Harness 未能启动」（2026-11-14 用户报障）**：只重打 NSIS 的
  `npm run installer` 复用了 6 天前的 `release/win-unpacked`，安装包外观是新的、侧车却是旧
  `dist`（缺「PS7 终端启动时 DPAPI 凭据解密失败」修复，kernel 仍是 alpha.15），装完启动即退出。
  现在 `stage` 写入 `BUILD_INFO.json`（版本/kernel/产物哈希），`pack`/`dist`/`installer` 三处
  都用它把安装目录与**当前工作树**逐字节比对，旧载荷直接拒绝出包；启动失败对话框同时带上
  侧车最近 20 行输出（不再只有「超时/退出码」），日志新增 `harness start failed after <ms>`；
  就绪超时默认 30s → 60s（安装后首次启动实测 33.6s：新 exe 被 Defender 扫描 + 维护巡检）。
  回归判据 `desktop/scripts/test.mjs` 的 `PackagedPayloadCheck` / `HarnessStartFailure` 用例。
- **任务栏图标显示 Electron 默认原子而非 Ω（2026-11-14 用户报障）**：Windows 按
  AppUserModelID 匹配开始菜单快捷方式取图标；机器上残留了一枚测试用的 `Electron.lnk`
  （指向开发 `electron.exe`，却是产品 AUMID），任务栏因此显示 Electron 默认图标。已清理该
  快捷方式并重启 Explorer；安装器新增 `customInstall` 的 `SHChangeNotify`，升级替换 exe 后
  主动刷新图标缓存。排障步骤见 `desktop/README.md` §10.1。
- **没有 API Key 时桌面端直接进不去（侧车启动即退出，2026-11-08 用户报障）**：`serve` 的模型
  装配在「配置了需要 Key 的厂商、但 Key 缺失」时直接抛错，侧车在就绪前退出 ⇒ 主进程弹
  「Harness 启动失败」并 `app.quit()`，用户连「设置 → 模型接入」都进不去（启动被配置反向卡死）。
  现在 serve 路径改用 `UnconfiguredModel` 占位端口：窗口与 UI 正常打开，只有真正发送消息时才
  报「请到 设置 → 模型接入 填写 API Key」；保存 Key 后下一回合即换成真适配器，无需重启。
  一次性 CLI 仍保持缺 Key 当场失败（fail-fast 语义不变）。回归判据
  `tests/unconfiguredModel.test.ts`（真机桌面冒烟：无 Key 配置下 8 项全过）。
- **从 PowerShell 7 终端启动时 DPAPI 凭据解密失败（应用直接起不来）**：配置里的
  `apiKeyDpapi` / `providerKeysDpapi` 由 `powershell.exe`（5.1）解密，而从 PS7 终端启动时
  `PSModulePath` 里排前的全是 PS7 模块目录，5.1 会先加载到不兼容的
  `Microsoft.PowerShell.Security`，报「凭据解密失败」并退出。现在 CLI 入口在读取任何配置前
  把 5.1 自己的模块目录提到 `PSModulePath` 首位（纯环境归一化，不改配置、不吞解密错误）。
  真机复测：同一份 DPAPI 配置可直接启动，桌面冒烟 8 项全过；回归判据
  `tests/windowsPowerShellModulePath.test.ts`。
- **右栏纯文本预览下方空出一大块**（2026-11-08 用户截图，`TECH-UPGRADE-REPORT.md.bak`）：
  `.bak` 这类扩展名不在语言表里 ⇒ 走 `<pre class="file-content">` 纯文本分支，而 layout.css 的
  `max-height:70vh` 没有被 `.file-pane .file-content`（flex:1）覆盖，正文只长到七成视口高。
  面板内改为 `max-height:none`、填满剩余高度并由自身滚动；新增
  `web/test/plainTextFill.test.ts`（含「注回 70vh 必须变红」的正对照）。
- **切换项目必失败（`decisionEngine.mode` 非 off）**：`ConfigFactory.build` 只消费
  `decisionEnginePort`、不写回 `ResolvedConfig`，而 `workspace.switch` 的
  `ConfigRebase.forWorkspace` 以已解析配置为基线 ⇒ 重基后只剩声明段 `decisionEngine`（生产入口
  默认 `shadow`），内核 fail-closed 抛「未注入 decisionEnginePort」，UI 报「切换失败」。现由
  `ServerServices` 复用同一 `LayaDecisionEngine` 端口并在重基时重新注入；真机 RPC 实测
  `workspace.switch` 返回 `ok:true`。
- `scripts/startAll.mjs` 的 TmpSweep 导入仍指向 M32 已删除的
  `extensions/kernel/util/tmpSweep.js`（启动时静默跳过预清扫）——改经 `host/kernel/maintenance` 对接面。
- `desktop/scripts/verifyPackage.mjs` 的安装包提示写死 `0.2.0`：改为在 `release/` 里探测
  `OmniHarness Setup*.exe`，如实显示当前版本与体积。
- **桌面 GUI 冒烟在 CI 上以「超时」判死（2026-11-10，手动门首跑踩中两个坑）**：
  ① CI 装完依赖后 `electron` 二进制缺失，`electron/cli.js` 在冒烟窗口内临时下载 ~100MB，把
  90s 预算挤掉；② 无记忆工作区 ⇒ 启动时弹原生目录选择框，无人值守下没人点，一直挂到超时闸。
  处置：workflow 新增「预热 Electron 运行时」步骤（缺失时显式 `node desktop/node_modules/electron/install.js`
  并校验 `electron.exe`）；GUI 作业固定传 `--workspace` 临时目录并把 `OMNI_SMOKE_TIMEOUT_MS` 放宽到 300s；
  超时闸改为可配置（`SmokeHarness.timeoutMs`，缺省仍 90s，夹取 10–600s，脏值回落默认），超时行补打
  `sidecar`/`url` 现场；`OMNI_SMOKE` 下缺 `--workspace` 直接退出码 2 并说明原因，不再弹框空转。
  回归判据 `desktop/scripts/test.mjs` 增 1 条（34 → 35 条）。

- **性能与窄屏收口（2026-11-17 全面 review）**：流式会话的 hljs 高亮按代码内容缓存（闭合围栏
  不可变，重渲染直接命中——分块缓存因破坏 markdown-it 跨空行块结构被否决，决策记录见审计
  文档）；antd Theme 按 (theme, scheme) memo（此前每条 SSE patch 都重建 ThemeConfig）；对话
  流/轨迹/思考轨迹/待办坞的每帧 O(n) 派生全部 memo 化；会话卡片视图补分页；虚拟化窗口高度
  计算从每帧 3×O(blocks) 全扫收成单次扫描。窄屏（≤480px）四组件收口：容量坞柱阵、计划条
  标题省略、队列列表高度、输入区隐藏语音按钮。

- **UI 圆角感（2026-11-13）**：圆角阶梯整体提一档——`--r-xs/sm/md/lg` 6/8/10/14 →
  8/10/12/18（`--r-xl` 18 → 22），theme.css 明暗别名同步；antd 控件经
  `css-var-*` 作用域属性双写跟随同一阶梯（流内与 portal 弹层一致，药丸/圆点不变）；
  fp-shell / 崩溃面板 / 自写模态等 16px 残项对齐 token。纸与墨观感不变，控件更柔和。
### Changed（变更）
- **内核升级到 `0.1.0-alpha.19`（2026-11-14）**：vendored tarball 重建自内核 tag
  `v0.1.0-alpha.19`（内核 M55–M76：哨兵/缓存/成本信封/审计时间线/CapFlow/检索供给与语义召回/
  上下文策略/缓存读数联动/改写/精排/注入面 enforce/VectorStorePort/eval:inject/路由质量对照/
  SSE-Web 示例/残余台账）。`kernel:surface` 19 域零变化；`kernel:check` 九条复绿
  （282 源文件 / 288 处包导入 / 原生内核实载），typecheck×3、web 198 文件 / 905 用例、
  build/build:web、smoke 8 条、desktop 38 条全部通过；`package-lock.json` integrity 与
  tarball 逐字节一致。
- **UI 打磨：焦点环统一与弹窗头部材质（2026-11-13）**：工作台/控制台全界面真机巡检后收两处瑕疵——
  ① antd 6 的 genFocusStyle 给按钮/菜单项 3px 主色淡化环，与原生控件的双环
  （2px brand + offset 2 + --ring 外晕）同屏观感分裂，统一到双环；② `.ant-modal-header`
  自带实底，在磨砂弹窗上显出一条亮度不同的头带，改透明继承容器半透 blur。
- **磨砂材质补齐到 antd 基座 + 文案配置化收尾（2026-11-13）**：把 2026-10-31 的 iOS 磨砂口径
  补到 antd 控件与浮层——default 按钮 = 半透明磨砂填充（无边框、无 blur），Modal / Select
  下拉 / Popover / Dropdown / 命令面板 / 文件选择卡 = 半透 panel + backdrop blur；卡片仍是纸面。
  附 token 级降级：`prefers-reduced-transparency` 全部回实色并关 blur（含 antd 遮罩模糊），
  不支持 backdrop-filter 的引擎关 blur 保留填充。顺带修正三处 antd 6 之后的死选择器
  （`.ant-modal-content`→`.ant-modal-container` 等，命令面板/文件选择卡的透明覆盖由此恢复生效）
  与 `.stream-jump-bottom` 的嵌套 blur() 笔误。文案配置化：`useProof` 导出前置提示与
  GraphTab 示例提示词改走 i18n（新增 5 条 en 词条）。
- **控制台 UI 统一迁到 antd 控件基座（2026-11-12）**：工作台控制台全量换 antd（`antd/es/*`
  子路径导入）——设置原语（Select/Input/Switch/Segmented）、面板表格与表单、control 三模式
  （Tabs/Collapse/Row/Col/Segmented）、收尾候选面（ToolsTab 行 → Button+Badge 并补
  `toolsTab` 判据；ChangesPatchView hunk/行内评论按钮；RollbackTab 检查点条目按钮）。
  行为、文案、i18n、无障碍判据与信息架构不变：kit `PanelSection` 补回 region+h3 地标语义、
  设置卡标题保持真 h2（字号继承卡头，视觉不变）、控制室 tablist 经命名 region 恢复可访问名、
  车道重复选中恢复 no-op；测试锚点 className（hunk-btn/cp-main/tool-item 等）全部保留。
  被替代的自写控件样式已清（csl-select/input/switch 皮肤、行/钮表面），容器节奏层
  （面板根 gap、列表卡壳、空态卡面）经真机取证后恢复；浅/深色真机渲染逐面核对。
- **antd 分块合并（2026-11-11）**：删除异步 `panel-antd` 拆块，所有 antd / rc-component 收进
  单一 `vendor-antd`。原拆法在真机 E2E 中触发 `panel-antd → vendor-antd → panel-antd` 循环
  块，页面启动即 `ReferenceError: Cannot access 'Sr' before initialization`；合并后
  `DecisionTab` 30 KB gzip 9.5 KB、e2e 恢复绿。`vendorFreePipeline` 判据同步改为
  「panel-antd 必须为 0、Table 指纹在 vendor-antd」。
- **内核同步至 0.1.0-alpha.17（2026-11-11）**：内核仓把 27 条复核闭环（P0 3 / P1 6 / P2 16 / P3 2）
  打成 `v0.1.0-alpha.17` 并 tag；`vendor/omniharness-kernel-0.1.0-alpha.17.tgz` 重建自该 tag
  （tarball integrity 同步进 lock）。含 MCP Host/Origin 来源校验、工作区信任闸分类补齐、
  回滚后审计链自愈、会话隔离（审批观察者 / turn-diff）、取消边界、补丁行尾继承、晋升台账
  seq 连续性等；端口签名变化见内核 CHANGELOG「Changed」。本仓 `kernel:surface` 19 域零变化，
  `kernel:check` / 三份 typecheck / build 全绿。同步产出并实现新功能
  [决策账本](docs/design/decision-ledger/README.md)（v1：1 面板 / 4 RPC）。
- **同一面板去重（2026-11-10 第二轮）**：左栏「任务列表」头移除第二个「+ 添加项目」按钮，
  添加项目只保留项目切换器下拉里的唯一入口；会话行高 34 → 38px、纵向内边距 7 → 9px，
  组头也放宽 2px，长列表不再一行挨一行。
- **中等宽度不再三栏硬塞（2026-11-10）**：没有显式右栏偏好时，视口 <1180px 自动收起右栏
  （用户手动展开过则尊重选择，`RightPanePreference` 纯逻辑判据覆盖）；≤880px 的左右抽屉不再
  被 42vw / 34vw 的中窗规则压到 130–164px，恢复 `84% / max 340px` 的可读宽度。
- **工具错误摘要去掉 2px 左缘色条**：改为极淡的整块 error 底色 + 小圆角，避免生成式 UI 的
  「卡片单侧粗色条」痕迹。
- **品牌标识与桌面图标统一为白底版**（2026-11-08 用户口径「一起换统一下」）：新增固定 token
  `--brand-tile` / `--brand-tile-rim` / `--brand-tile-ink`（白底 + 靛墨 Ω + 淡靛描边，不随主题/方案
  变化），左栏品牌芯片、工作台状态条紧凑标识、站点 favicon、桌面启动页 `.mark` 全部改用同一配色。
- **桌面图标改为白底版**（2026-11-08 用户口径「用正常的 logo 白底的」）：`desktop/static/` 的
  `icon.svg` / `icon.png` / `icon.ico` / `icon-busy.png` 由深墨底浅字反转为**白底 + 靛墨 Ω**
  （`#3d4a86`，与应用内品牌芯片同源），描边取 accent 混白；ICO 仍为 16–256 七档。
- **M32 影子清零终盘（2026-11-08 傍晚，内核侧同批加跨仓消费契约）**：
  - **第 9 条门禁此前有两处漏检**：curated 子路径（`./sandbox` / `./mcp` / `./maintenance`）的
    `.d.ts` 是纯再导出桶，旧扫描①把 `./maintenance` 拼成 `dist/maintenance` 目录（永远不存在）、
    ②只认 `export class …` 直接声明、不解析 `export { X } from './…'`。于是承诺导出名扫成 0，
    11 个名字（5 类 + 6 类型）在门禁全绿时照旧双份维护。修复后扫描「直接声明 + 再导出名单 +
    `export *`」递归可达，11 个名字立刻判红。
  - **删除 5 件影子（约 760 行）**：`extensions/kernel/{util/sessionGc,util/tmpSweep,
    util/sessionStorageLocation,adapters/isolation/isolationLadderFactory,
    adapters/mcp/sdkPreferredMcpConnector}.ts` 退役；`MaintenanceRunner`、CLI（`argParser` /
    `sessionCommand` / `traceCommand` / `bundleCommand` / `execCli` / `cliBuildConfig` /
    `cliMcpCmds`）改经 `host/kernel/{maintenance,adapters-sandbox,adapters-misc}.ts` 对接面。
  - **对接面生成器支持 curated 子路径**：新增符号在「深路径未承诺」时落到内核的
    `./sandbox` / `./mcp` / `./maintenance` 桶（不再为应用消费倒逼深路径承诺膨胀）；
    新增 `maintenance` 域，域文件 18 → **19**、对接面 **408 符号 / 241 条模块落点**
    （238 深路径 + 3 curated）、源文件 260 → **256**、包导入 287 → **286**、影子 11 → **0**。
  - **新增桶再导出回归判据** `tests/kernelShadowScanBarrel.test.ts`：夹具「桶承诺 + extensions
    同名」必红、对照组必绿，钉死这次漏检。判据规模 164 文件 / 773 用例 → **165 文件 / 775 用例**。
  - `extensions/README` 登记表清零，并把 M31 的「内核未承诺」结论更正为「承诺在桶里」。
- **M31 对接收口（2026-11-08，按当日上午盘点结果逐条修复）**：
  - **`CryptoVault` / `EnvVault` 迁回对接面**：内核 alpha.14 已承诺这两个实现（scrypt 派生 +
    旧 SHA-256 密文回退 + 缓存上限 + 并发单飞，2026-11-07 审计 P1-2/P2），app 侧旧版只有单轮
    SHA-256 且无容量上限——同能力双份维护、安全修复吃不到。`src/host/extensions/kernel/adapters/vault/*`
    删除（332 行），`cliCredentialBuild` / `storeCommand` 改经 `host/kernel/adapters-misc.ts`；
    旧密文可读（内核版保留 SHA-256 候选），新写入自然迁到 scrypt 派生，`vault.key` 语义与 0600 不变。
  - **删除 compat 再导出桶** `src/host/extensions/kernel/adapters/index.ts`：70 条纯转口，全仓只有
    `cliServerCmds` 用其中 3 个，却让 33 个零真实消费者的内核符号钉在对接面里（生成器把「桶的再导出」
    也算作使用）。改直连后对接面 435 → **402 符号** / 262 → **242 条深路径**。
  - **`governance.rollbackTargets` 删除**：注册了但全仓零调用——UI 的 `GovernanceTab` 从
    `governance.history` 的 `view.rollbackTargets` 取同一份数据，两个入口只会慢慢漂移。
    RPC 全集 93 → **92**（parity 快照、README、注释同步）。
  - **门禁新增第 9 条**「已承诺能力无同名副本」：逐名比对内核 `exports` 承诺面与
    `src/host/extensions/**` 的声明名，回归即红（正/负向都已实测：放入临时同名类会红，删掉即绿）。
    判据实现独立成 `scripts/kernelShadowScan.mjs`，门禁与新增的常规判据
    `tests/kernelShadowScan.test.ts` 共用同一份（子进程调用，规避 Windows CI 上 `.mjs`
    动态 import 的打包器坑）；判据同时断言「承诺导出名 / extensions 声明名」两侧计数非零，
    防「扫描器扫空也绿」。`kernel:check` 由此 8 条 → **9 条**，判据 163 文件 / 772 用例 →
    **164 文件 / 773 用例**。
  - **记账对齐**：README / KERNEL-CONTRACT / vendor README / CHANGELOG 的 alpha.13 → alpha.14、
    17 域 → 18 域、265·316 → **260 源文件 / 287 处包导入**、93 → 92 方法；`extensions/README` 更正
    「不再含任何同名/同体影子副本」的不实自述，改为「已承诺=0（第 9 条把守）+ 内核未承诺的 5 件
    登记在册（`SessionGc` / `SessionStorageLocation` / `TmpSweep` / `IsolationLadderFactory` /
    `SdkPreferredMcpConnector`，相似度 0.72–0.92，待内核纳入承诺面后退役）」。
    > M32 复核：这 5 件其实**早已承诺在 curated 桶里**，是第 9 条漏检才被误判为「未承诺」；
    > 见上方 M32 条（已全部删除）。
- **内核钉版升级 alpha.13 → alpha.14（2026-11-08 审计整改同步）**：vendor 升级至
  `vendor/omniharness-kernel-0.1.0-alpha.14.tgz`（内核侧 25 个提交：P0 15 / P1 57 / P2/P3 分批闭环）。
  应用侧同步：
  - 对接面 `security.ContentTrustTier`（内核安全域 `TrustTier` 改名，与资产域 `TrustTier` 区分）；
    `injectionSelfCheck` / `injectionSnapshotAggregator` 随迁，`kernel:surface` 重新生成；
  - 内核恢复会话旁路摘要（`SessionSummaryBuilder` / `SessionSummarySidecar`）——应用
    `sessionScanCache` / `sessionArchive` 是其生产消费者，升级后无需改动；
  - `kernel:check` 通过（M31 收口后 260 源文件 / 287 处包导入 / vendored integrity / 原生内核）。
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





