# 内核能力 ↔ 应用 UI 对齐审计（alpha.24）

> 2026-11-15 综合研究产出。范围：vendored `@omniharness/kernel@0.1.0-alpha.24` 的公共能力
> 与本仓 UI/宿主入口的对齐现状；结论落到「已对齐 / 本轮补齐 / 明确不接 / 待排期」四档，
> 避免 UI 文案与内核实际能力脱节（本仓反复记录的「看着绿」形态）。

## 1. 研究方法

1. 以内核 `CHANGELOG`（M55–M76）与 `docs/BOUNDARY.md` 的公开面为清单，逐项找本仓入口；
2. 只认**真实接线**：有 RPC/配置键/运行时探针才算对齐，仅文档提及不算；
3. 对每个未接项记录原因（产品不需要 / 风险 / 内核未承诺），不把「没做」写成「不支持」；
4. UI 文案必须与接线状态一致（absent、降档、未接线都显式呈现）。

## 2. 对齐矩阵

| 内核能力（alpha.24） | 应用入口 | 状态 |
| --- | --- | --- |
| 配置三段 `retrievalContext` / `semanticRecall` / `contextPolicy` | 设置 → 运行时 → 上下文与检索（9 行） | ✅ 已对齐（2026-11-15） |
| 上下文生效值（检索 mode/改写/精排/预算、语义召回 requested/active、降档两级、缓存守卫） | 控制室 → 上下文 → 内核上下文策略 | ✅ 本轮补齐（`context.studio.kernel`） |
| 内核哨兵七分区健康（M55） | 诊断 → 内核健康（哨兵桥）`kernel.health` | ✅ 已对齐（2026-11-15） |
| 回合成本信封 / 预算降级（M57） | 健康桥 budget 分区 + 设置成本预算三键 | ✅ 已对齐 |
| 审计时间线 / 回执链（M58、receipts） | 凭证 `proof.*` + 审计 `audit.query`；健康桥 receipts 分区如实 absent | ✅ 已对齐（应用侧按回合） |
| 确定性读缓存（M56 `toolCache`） | 设置 → 运行时 → 缓存与防火墙（alpha.21 内核文件面 + 宿主装配） | ✅ 已对齐（2026-11-15） |
| CapFlow（M59） | 同上（off/shadow/enforce + 策略文件；缺省 off） | ✅ 已对齐（2026-11-15） |
| VectorStorePort（M72） | 无入口（检索走内核内建 BM25/嵌入） | ⏸ 不接：应用无向量库诉求 |
| `eval:inject` / `route:compare`（M69/M75） | 无 UI 入口（内核侧脚本/对照实验） | ⏸ 不接：开发期工具，不是产品面 |
| SubagentOrchestrator / 父子树（alpha.21） | 编队 `fleet.list`：共享 `SubagentTree` 读出运行中子会话 id，事件流仍为事实源 | ✅ 已对齐（2026-11-15；深度/并发/树由内核编排器维护） |
| 压缩状态审计 / 触发信号（alpha.21 持久化） | 上下文面板：审计通过/有缺失、核对计数、触发信号 | ✅ 已对齐（2026-11-15；旧游标如实显示「未记录审计」） |
| 语义召回嵌入栈（M61） | 设置开关 + 上下文面板 active/degraded | ✅ 已对齐（缺依赖时如实降档） |

## 3. 本轮落地

- **上下文工作室**：`context.studio` 新增 `kernel` 字段，来自 `KernelContextViewBuilder`
  （与健康桥 context 分区同一读模型）；运营面板新增「内核上下文策略」卡：
  检索供给（BM25 + 单步预算）、查询改写/精排、语义召回（含降档告警）、降档阶梯、
  缓存守卫（下限 + 当前命中率）。
- **健康桥**：`semanticRecallRequested` 收敛到 `kernelContextView.ts`（单一真源），
  健康桥不再保留第二份解析。
- **内容口径**：context studio 里过时的「alpha.16 不落事件流 / exports 未承诺」说明改为
  「当前内核」事实（exports 仍只承诺 `contextCompactor.js`）。
- **alpha.22 三项**：设置页「缓存与防火墙」卡（`toolCache`/`capflow` 文件面）、编队运行中
  子会话 id（共享 `SubagentTree`）、压缩审计/信号（游标 `evidence=` 持久化）全部落地；
  alpha.22 另含信任闸分类修复（`capflow` 权威键 / `toolCache` 安全键）。同时修复上下文三段
  `FileConfig → CliArgs → ConfigFactory` 通道断链。
- **alpha.23/24**：R9–R11 的端到端评测、`ModelRequestHash`、`CitationChecker`、压缩长段落与
  checkpoint 文件态恢复均为内核/评测/回滚内部面，**不新增应用 UI 入口**；本矩阵无新增行，
  现有「上下文 / 编队 / 诊断 / 回滚」入口继续按同一读模型呈现。
- **判据**：`tests/configSectionWiring.test.ts`、`tests/controlRoom.test.ts`（树补 live child）、
  `tests/controlContext.test.ts`（证据解码）、`web/test/contextMode.test.ts`（审计徽标）、
  `web/test/settingsPane.test.ts` / `web/test/configWiring.test.ts`（新段）。

## 4. 设计原则（后续新增内核能力时复用）

1. **一处解析**：同一语义只允许一个读模型（本轮 `KernelContextViewBuilder`），UI 不做配置推导；
2. **absent ≠ off ≠ degraded**：未装配 / 未启用 / 请求失败三态必须可分且文案不同；
3. **入口可回溯**：面板上的值要能指出「去哪改」（本轮副标题指向设置路径）；
4. **不冒充内核**：应用自有实现（如压缩游标解码、编队事件解析）在注释里写明原因，
   内核已承诺后要么接线、要么把「未接线」写成待排期，不写成「不支持」。

