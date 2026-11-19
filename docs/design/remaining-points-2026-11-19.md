# 全仓遗留点总表（2026-11-19 收口）

> 「完善全部剩余点」轮的产物：把散在各账本的遗留项合并成一张总表，逐项标注
> **现状 / 处置 / 复活条件**。此后新遗留进各批次账本，本表按轮更新状态列。

| # | 项 | 来源 | 处置 | 复活条件 |
| --- | --- | --- | --- | --- |
| 1 | 内核新版本跟进 | deps-upgrade | ✅ 持续完成：alpha.24→**alpha.33**（R12→R19 七轮，消费面始终零变化） | alpha.34 发版 → `OMNI_KERNEL_TAG` vendored 例行公事 |
| 2 | 后端 RPC 错误码位化 | hardcode-cleanup 遗留 | ✅ 本轮完成：共享分类器 `core/rpcErrorCodes.ts`（WS/HTTP 同源），调用方参数问题判 **-32602**（JSON-RPC 标准 Invalid params）；前端 failureHint 增专属提示 | 域模块新增错误形态 → 扩 `CALLER_FAULT_RE`（判据钉住的三类形态外保持保守） |
| 3 | fetchMetrics / SSE 分类 | hardcode-cleanup 遗留 | ✅ fetchMetrics 已 RpcError 化；**SSE 维持**（EventSource 原生重连、无错误对象可分类——设计上无抛错点） | 无（除非 SSE 换自定义重连实现） |
| 4 | 桌面 DesktopConfigLoader 警告 i18n | hardcode-cleanup 遗留 | ⏸ 维持登记：警告仅写日志文件（用户可见度低），i18n 化需改 ~15 处调用点 + 返回形状 breaking——收益/成本比过低 | 将来要在设置页/对话框呈现配置警告时一并本地化 |
| 5 | Electron 46 | deps-upgrade 遗留 | ⏸ 未发布（官方时间线 2027-01）；45.3.4 即受支持最新稳定线 | 46 stable → 例行升级（沙箱 preload 收紧已提前核对零交集） |
| 6 | TypeScript 跟进 | deps-upgrade 遗留 | ✅ 已收编 **7.0.2**（2026-11-19 实证通过）；7.1+ 按官方节奏跟进 | — |
| 7 | @types/node 26 | npm outdated | ⏸ 绑定 engines（node ≥22.14）——类型大版本须对齐运行时 | engines 升级决策（产品口径：用户部署基线）后跟进 |
| 8 | 输入历史跨重启持久化 | ux-audit 遗留 | ⏸ 刻意不做（内存态设计：旧任务语境不带进新的一天） | 用户明确要求时再议 |
| 9 | 会话成本服务端单价表下发 | ux-audit 遗留 | ⏸ 前端参考价版已落地（ModelPricing，内置价表 + ≈ 声明）；服务端下发需后端先行 | 用户要精确账单口径时启动 |
| 10 | 页头与右栏项目路径重复 | ux-audit 遗留 | ⏸ 挂起待用户口径（动中栏页头影响面大） | 用户给出口径后收口 |
| 11 | 上游 tests/unit 判据移植 | README §8 声明 | ⏸ 上游 tests/ 未切过是仓间关系事实（本仓判据已自建 1005 用例全覆盖），非本仓可执行项 | — |
| 12 | desktop electron-builder publish 指上游 | 记忆登记 | ✅ 已收口（2026-11-19 盘点升级轮，commit d32ff79）：publish + repositoryUrl 改指本仓 omniharness-app，draft 渠道不变 | 目标 repo 再变更时同步三处（builder.yml / desktop.config.json / defaults.ts） |
| 13 | 内核 R18（resume 盲区收口） | 内核仓 | ✅ 已闭合：alpha.32（R18）+ alpha.33（R19 遗留总清偿）同日 vendored（commits c49bb34 / 9b030e1） | — |
| 14 | 并行会话 UI 打磨 WIP（4 文件） | 工作树 | ⏸ 活跃中，保留不碰（2026-11-19 盘点轮已 review：tr-btn 拆类 + ctx-note 色轨撤除，改动自洽完整，验收结论无阻断） | 其会话自行收口后照常随分支推送 |

**已清零的历史遗留**（跨轮）：面板级 antd 循环块（2026-11-11 合并 vendor-antd）、
PanelPicker 零消费债务（并行会话清偿）、队列续发陈旧 busy 回归（批次 0）、i18n 键表
漂移（判据三）、「专注模式」漏译、RPC 110/110 账实、picomatch ReDoS 链（上游 4.0.7）。
