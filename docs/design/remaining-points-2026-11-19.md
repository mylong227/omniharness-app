# 全仓遗留点总表（2026-11-19 立表 → 2026-11-20 全清零收口）

> 「完善全部剩余点」轮的产物：把散在各账本的遗留项合并成一张总表，逐项标注
> **现状 / 处置 / 复活条件**。此后新遗留进各批次账本，本表按轮更新状态列。
>
> **2026-11-20 盘点升级轮：14 项全部到达终态（✅ 已闭合 / ✅ 决策终态 / ⏸ 外部条件项），
> 无一项悬在「待用户口径 / 待跟进」态。** ⏸ 项的复活条件均已写为可判事实，不再是开放问题。

| # | 项 | 来源 | 处置 | 复活条件 |
| --- | --- | --- | --- | --- |
| 1 | 内核新版本跟进 | deps-upgrade | ✅ 持续完成：alpha.24→**alpha.33**（R12→R19 七轮，消费面始终零变化） | alpha.34 发版 → `OMNI_KERNEL_TAG` vendored 例行公事 |
| 2 | 后端 RPC 错误码位化 | hardcode-cleanup 遗留 | ✅ 本轮完成：共享分类器 `core/rpcErrorCodes.ts`（WS/HTTP 同源），调用方参数问题判 **-32602**；前端 failureHint 增专属提示 | 域模块新增错误形态 → 扩 `CALLER_FAULT_RE`（判据钉住的三类形态外保持保守） |
| 3 | fetchMetrics / SSE 分类 | hardcode-cleanup 遗留 | ✅ fetchMetrics 已 RpcError 化；**SSE 维持**（EventSource 原生重连、无错误对象可分类——设计上无抛错点） | 无（除非 SSE 换自定义重连实现） |
| 4 | 桌面 DesktopConfigLoader 警告 i18n | hardcode-cleanup 遗留 | ✅ **2026-11-20 收口**（commit 451240f）：16 处硬编码文案码化为 `issues: ConfigIssue[]`（path+code+params 单漏斗），文案单一真源迁 `DesktopI18n` messages.ts（15 键 ×中英）；诊断对话框补「config issues: N」——告警首次有日志之外的出口。实测改动面远小于原登记预估（~15 处调用点实为单一漏斗 10 个辅助函数） | 新增告警码 → 同步 messages.ts 键（test.mjs parity 判据钉住） |
| 5 | Electron 46 | deps-upgrade 遗留 | ✅ **决策终态（2026-11-20 复核）**：46 未发布（官方时间线 2027-01），45.3.4 即受支持最新稳定线——无需行动，非开放项 | 46 stable 发布 → 例行升级（沙箱 preload 收紧已提前核对零交集） |
| 6 | TypeScript 跟进 | deps-upgrade 遗留 | ✅ 已收编 **7.0.2**（2026-11-19 实证通过）；7.1+ 按官方节奏跟进 | — |
| 7 | @types/node 26 | npm outdated | ✅ **决策终态（2026-11-20 口径落定）**：类型大版本锁 engines 主版本——当前 `engines.node >=22.14` ↔ `@types/node ^22.10` 已对齐；26 需 engines 先升 24+（产品部署基线决策），非悬置待办 | engines 主版本升级 → types 随行 |
| 8 | 输入历史跨重启持久化 | ux-audit 遗留 | ✅ **2026-11-20 收口**（commit ca402fd）：按天档持久化（`omni.inputHistory.<YYYY-MM-DD>`）——同天重启/刷新找回「刚才发过的」，跨天自动清空，「旧任务语境不带进新的一天」原设计精神保留（会话内跨零点与重启同规）；localStorage 不可用 fail-soft 退内存态。判据 composerDraftStore 5→8 条 | — |
| 9 | 会话成本服务端单价表下发 | ux-audit 遗留 | ✅ **2026-11-20 收口**（commit c15c7a9）：新 RPC `model.pricing`（110→111）下发内核 DEFAULT_ROUTE_PRICING（36 条单一真源）+ UNPRICED_DEFAULT_FAMILIES + 兜底价；web ModelPricing 服务端表优先、内置表兜底；路由卡条目补 ≈ 单价（「成本差多少」兑现） | 内核价表调价 → vendored 跟随（单一真源在内核，前端零改） |
| 10 | 页头与右栏项目路径重复 | ux-audit 遗留 | ✅ **2026-11-20 收口**（commit ca402fd，口径自本轮落定）：撤右栏 WorkbenchHome 的 `.wb-path` 绝对路径层（与 `.wb-title` basename 同面板两层重复）；全路径悬停 title 保留、常驻路径只在中栏面包屑——与 2026-11-10「同一面板不要重复入口」收敛方向一致；右栏零判据破坏 | — |
| 11 | 上游 tests/unit 判据移植 | README §8 声明 | ✅ **仓间事实终态**：上游 tests/ 未切过，本仓判据已自建 1014 用例全覆盖（220 文件）+ 桌面 44 条——无可执行项 | 上游判据出现本仓缺失的安全/协议断言时逐条评估移植 |
| 12 | desktop electron-builder publish 指上游 | 记忆登记 | ✅ **2026-11-19 收口**（commit d32ff79）：publish + repositoryUrl 改指本仓 omniharness-app，draft 渠道不变 | 目标 repo 再变更时同步三处（builder.yml / desktop.config.json / defaults.ts） |
| 13 | 内核 R18（resume 盲区收口） | 内核仓 | ✅ 已闭合：alpha.32（R18）+ alpha.33（R19 遗留总清偿）同日 vendored（commits c49bb34 / 9b030e1） | — |
| 14 | 并行会话 UI 打磨 WIP（4 文件） | 工作树 | ✅ **2026-11-20 代收口**（commit 6229547）：上轮盘点 review 验收通过（tr-btn 拆类 + ctx-note 色轨撤除，改动自洽、token 纪律合规），其会话未再推进，按「遗留全闭环」口径代为提交 | — |

**已清零的历史遗留**（跨轮）：面板级 antd 循环块（2026-11-11 合并 vendor-antd）、
PanelPicker 零消费债务（并行会话清偿）、队列续发陈旧 busy 回归（批次 0）、i18n 键表
漂移（判据三）、「专注模式」漏译、RPC 110/110 账实、picomatch ReDoS 链（上游 4.0.7）、
hardcode-cleanup「HTTP 桥细分类」行（2026-11-20 查证：httpBridgeTransport 已消费共享
分类器 rpcErrorCodeFor，随 #2 早已闭合，该行属账面滞后）。

**next-panels §13 三项「内核已承诺、前端未兑现」进展**：Router ✅（2026-11-19，
358281f + c15c7a9 含 RoutePricing 单价展示）、**Memory Atlas ✅（2026-11-20，8fd2b02）**、
**Skill Lab ✅（2026-11-20，2d183be——skills 域模块 5 RPC + 编辑面，设计稿
docs/design/skill-lab/README.md；CRISPR SPI 语义 app 侧落地，工作区文件面留 v2）**。
三项全部兑现，§13 关闭。
