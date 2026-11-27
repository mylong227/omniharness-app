# vendor/

本目录只放**应用消费的内核发行物**（`npm` 依赖 `file:vendor/*.tgz`），不放源码。

| 文件 | 说明 |
| ---- | ---- |
| `omniharness-kernel-0.1.0-alpha.48.tgz` | 从内核源码 tag `v0.1.0-alpha.48` 构建，附带应用现有的 Windows x64 `native/omni_napi.node` / `omni-cli.exe`；未重新编译 Rust，也未发布到 npm |

## 重新生成

```powershell
# 缺省 tag = package.json 当前钉的版本（self-consistent，无手工漂移）
npm run kernel:vendor
npm ci
npm run kernel:surface   # 按业务实际 import 重新生成 20 个域文件
npm run typecheck        # 暴露真正不兼容的符号
npm run kernel:check     # 9 条判据（含生成物不漂移 / 已承诺能力无同名副本）
```

`kernel:vendor` 会同时更新根 `package.json` 的 `file:` 路径与 `package-lock.json` 的
`integrity`；不要手工改 tarball 或只改其中一处——`kernel:check` 会逐字节比对。
升其它版本时用 `OMNI_KERNEL_TAG=v0.1.0-alpha.X npm run kernel:vendor` 显式覆盖。

## 版本史

- **alpha.48**（当前）：模型路由条目支持 `provider` / `baseUrl` / `apiKey` / `apiKeyEnv`，
  并新增 `OmniHarnessConfig.unconfiguredModel` 宿主占位工厂——**缺凭据时 `serve` 先起来、
  再到设置页补配置**，不再在装配期 fail-closed 退出。tarball 由源码 tag 构建并核对 SHA-512；
  原生件沿用上一版 Windows 构建产物（本次未改 Rust）。

- **alpha.47**：内核修复版本，覆盖输入验证、路径和网络边界、恢复状态保护、
  环境配置与 CI 检查。tarball 由源码构建并核对 SHA-512；保留应用现有 Windows 原生件。

- **alpha.38**：R27 worker 域收编轮——`CliWorker` / `ExternalCliWorker` / `WindowsShim`
  上内核 worker 域（三条深路径承诺 + 23 条判据），应用侧接收后删除 extensions 三件 461 行；
  内核 17 门全绿（cross:check 应用侧影子清零后复绿）。
- **alpha.37**：R26 应用侧收编轮——`compactionStateCodec` 深路径 + maintenance/autonomy 四件\n  （ServeInstance/MaintenanceRunner/GraphStore/GraphSummary，947 行）上内核；应用接收提交 `b477365`。\n- **alpha.35–36**：R21–R24 内容并入 alpha.37 发布（未单独 publish）。\n- **alpha.34**：R20 好用收口轮（M115–M119 + 独立 review 收口 P0×1/P1×2/P2×3/P3×4；
  公共根导出面仍 60/60）——**厂商一键接线**（embed `model: '厂商id:模型名'` 字符串快捷，
  解析链单一真源：providers.json 预设 → env → 适配器注册表）、**close 生命周期收口**
  （cancel → drain 有界等待回合收尾 → 收口，`drainTimeoutMs` 缺省 10s）、**配置孤儿清偿**
  （mcpServers 文件面补 env/cwd + 未知键 fail-closed；`classifyInterjection` 全链接线）、
  **配置错误自愈**（未知键 did-you-mean 建议、合法键出口改机读清单）。应用消费面零变化
  （kernel:check 287/290 复绿）；**应用侧映射补全随本仓同日落地**（mcpServers env/cwd
  进 argConfigDefaults，判据 configSectionWiring 钉住）。
- **alpha.33**：R19 遗留总清偿轮（M112–M114 + 深度 review 收口 P1×1/P2×3/P3×9，
  0 P0）——**会话上下文贯穿**（`ToolContext` 增可选 `capflowSessionContext` 实时闭包：
  recorder 同源零滞后 + 继承指令信道 capflowInheritedTask，RunWorkflowTool resume 预检
  优先消费——review-r18 窗口滞后/派生会话继承源双收口）、**遗留台账总收口**（RESIDUAL.md
  全面刷新：外部阻塞复测 / 宿主职责增 H9 / 明确不做增 N14–N16 / R15–R19 候选逐条清偿）、
  **EOL 卫生**（`.gitattributes` 钉未来 + 149 代码文件 CRLF→LF 归一，src/scripts/tests
  零 CRLF 残留）。公共根导出面仍 60/60（无新增导出）；应用消费面零变化，`kernel:check`
  九条复绿（285 源文件 / 290 处包导入 / 原生内核实载）。
- **alpha.32**：R18 resume 盲区收口轮（M110–M111 + 深度 review 收口 P1×2/P2×2/P3×4，
  0 P0）——**resume 续跑档 CFI 闭合**（RunWorkflowTool resume 分支预检 `resumeCfiCheckOf`：
  WorkflowRunLog 预读存档 step prompts 逐条 × 当前会话最近工具输出重查，enforce 命中
  先于任何子会话拒绝；预检 specHash 传 runner 锁内复验——被查 prompts 与实际执行 spec
  逐字节绑定）、**workflow 边四档实测**（`eval:propagation` 十三档：三进程内派生边
  subagent/goal/workflow 全部具备实测曲线收官）。公共根导出面仍 60/60；应用消费面零变化，
  `kernel:check` 九条复绿（285 源文件 / 290 处包导入 / 原生内核实载）。
- **alpha.31**：R17 派生边收口轮（M108–M109 + 深度 review 收口 P1×1/P2×4/P3×9，
  0 P0）——**全派生边执法扩面**（`IN_PROCESS_DERIVED_TOOL_NAMES` 单一真源：subagent/
  run_workflow/run_goal/run_plan；CFI 指令信道文本按工具提取器强转镜像工具层）+ 四边
  统一打 `inherited-untrusted` + 继承源透传。公共根导出面仍 60/60（无新增导出）；应用
  消费面零变化，`kernel:check` 九条复绿（284 源文件 / 290 处包导入 / 原生内核实载）。
  同日一并跨过的 **alpha.30**（R16 跨代理 provenance 轮：M105 `inherited-untrusted`
  第四能力维度 / M106 链式洗白窗口 / M107 paraphrase 三档曲线）消费面同样零变化。
- **alpha.29**：R15 遗留清偿轮（M102–M104 + 深度 review 收口 P1×2/P2×9/P3×11，
  0 P0）——**参考轨迹匹配四档组合子**（`TraceMatch`：strict/unordered/subset/superset，
  带键多重集合 `name#argsDigest` 统一实现，对齐 agentevals `TrajectoryMatchEvaluator`；
  `eval:trace --expected` 接线）、**Multi-CaMeL 双通道子代理契约**（variables 数据信道
  读取即审计 + 指令信道完整性）、**金丝雀感染曲线**（`eval:propagation` 逐跳双指标 +
  CFI 衰减对照）。`./eval` 子路径新增 TraceMatch + 4 类型；公共根导出面仍 60/60；应用
  消费面零变化，`kernel:check` 九条复绿（284 源文件 / 290 处包导入 / 原生内核实载）。
- **alpha.28**：R14 全轮（M99–M101 + 深度 review 收口 P1×3/P2×9/P3×11，0 P0）——
  **CapFlow 确认门**（`require-approval` 从枚举预留落地为真确认门：三态裁决 + 真实 target
  单一真源 + per-call 确认不缓存 + fail-closed `CAPFLOW_APPROVAL_DENIED`）、**污点跨委托
  传播**（执法面闭合进子代理树：装配点单点构造共享 assessor，父能力集对子可见 / 子 observe
  感染整树，Multi-CaMeL boundary laundering 的执法面防御）、**确定性轨迹评测器**
  （`eval:trace`：`TraceFold` + 调用指纹循环检测等规则四件套，零凭据零模型调用）。
  公共根导出面仍 60/60；应用消费面零变化，`kernel:check` 九条复绿（284 源文件 / 290 处
  包导入 / 原生内核实载）。
- **alpha.27**：R13 全轮（M94–M98 + 深度 review 收口 P1×2/P2×7/P3×8，0 P0）——
  统一工具结果预算读数（`ToolResultBudgetReadout`/回合级计量器/哨兵 `budget` 分区，
  spill/trim/snip 三处决策首次统一账目）、tail 侧整形收口（`compose.over_budget` 从只记不治
  到预算内确定性整形，`HeadTailTrimmer` 头尾整形 + `shaped` 留痕）、MCP 工具指纹 JCS 化
  （rug-pull 闸改 `Canonical.stableStringify`，键序重排不再误触 fail-closed）、区分性检索
  对照池（hard 档 baseline recall 0.8<1.000，mock 精排价值首次可测）、RNG 收敛。公共根导出
  面仍 60/60；应用消费面零变化，`kernel:check` 九条复绿（284 源文件 / 290 处包导入 /
  原生内核实载）。
- **alpha.26**：R12 两批一并收口。alpha.25（M88–M92）：缓存命中率三层修复
  （finalize 兜底请求保留主请求工具前缀 / 缓存读数逐步入账，探针实测旧口径低估 1.99× /
  gapMs 分因面）+ 内存上界收口（磁盘嵌入镜像 256 MiB 字节预算、watcher 峰值哨兵）+
  内部缓存一致性三项 + 会话级前缀计量器（跨回合/resume 同实例）与零凭据稳定性探针；
  alpha.26（M93）：工具暴露稳定杠杆 `OMNI_TOOL_EXPOSURE=monotonic`（显式第三模式，缺省仍
  `plan`；A/B 实测 tools 前缀复用 0.8197→1，窗口退出不再灾难性重写）+ 三轮 review 收口。
  均为内核内部面，应用消费面零变化：`kernel:surface` 19 域再生成「无变化」、公共根导出面
  60/60；本仓 typecheck×3 + `kernel:check` 九条复绿（284 源文件 / 290 处包导入 / 原生内核实载）。
- **alpha.24**：alpha.23/24 的 R9–R11 批次——长任务端到端评测（pass@k/预算画像）、
  模型请求哈希与回滚等价、结论引用检查、问题拆分基准、压缩摘要长段落保真与 checkpoint
  文件态恢复；公共根导出面仍 60/60。应用消费面零变化，`kernel:check` 284 源文件 / 290 导入、
  tarball integrity 与原生实载全绿。
- **alpha.23**：R9/R10 能力批次（`LongTaskAgentRunner` / `ModelRequestHash` / `CitationChecker` /
  `FILE_WRITE_TOOL_NAMES` / 压缩保真 / 拆分基准）；应用消费面零变化，随 alpha.24 一并以 tag
  `v0.1.0-alpha.24` 收口。
- **alpha.22**：应用侧深度适配三项——`FileConfig` 增 `toolCache`/`capflow` 文件面；
  `SubagentTreePort`/`SubagentTree` + `OmniHarnessConfig.subagentTree` 注入（编排器写父子/调用映射）；
  `CompactionState` 增 `audit`/`signals` 并以 ` evidence=<base64url-json>` 持久化（旧游标兼容）。
  alpha.22 另含信任闸分类修复（`capflow` 权威键 / `toolCache` 安全键）。公共根导出面仍 60/60；
  本仓 19 域新增 `SubagentTree` 一个消费符号，`kernel:check` 九条复绿
  （284 源文件 / 290 处包导入 / 原生内核实载）。
- **alpha.20**：alpha.19 后的收尾基线（上帝类拆分 / 文档账实 / 发布自检 / 路由对照可判分 / 回环
  端口修复）；公共导出面 60/60，行为面等价（本仓跳过该基线直接 vendor alpha.22）。
- **alpha.19**：内核 M55–M76 批次（内核哨兵 / 确定性读缓存 / 回合成本信封 / 审计时间线 /
  CapFlow / 检索供给与语义召回 / 上下文策略 / 缓存读数与命中率联动 / 查询改写 / 精排 /
  注入面 enforce / VectorStorePort / eval:inject / 供给压力 / 干净检出 tsc / SSE-Web 示例 /
  路由质量对照 / 残余台账）。公共导出面仍 60/60；本仓 19 域零变化，`kernel:check` 九条判据复绿
  （282 源文件 / 288 处包导入 / 原生内核实载）。
- **alpha.18**：内核 M48–M53 收敛发版（账本可靠性基建 DurableJsonlAppender + PathLock / 取消语义完整性 + CancellationClassifier 单一真源 / 协议边界加固 + 决策白名单 / 模型适配器收敛 ToolCallIdAllocator 单一真源 / 安全边界二轮 SSRF·注入收口 + 验证器诚实标记 + TSA 锚 nonce 回验 / 核心正确性收敛 语料签名单一真源·合并后配置复验·基元入参校验·账本补偿）。公共导出面不变；契约增量：锚新增 `nonce?`、问题码新增 `ANCHOR_NONCE_MISMATCH` / `COMMITMENT_UNVERIFIED`；`kernel:check` 九条判据复绿（19 域零变化）。
- **alpha.17**：内核 27 条复核闭环发版（P0 3：MCP Host/Origin 来源校验、工作区信任闸
  分类补齐、回滚后审计链自愈；P1 6：会话隔离三件套 / 取消边界 / 补丁行尾与终止换行 / 晋升台账
  seq 连续性；P2 16 + P3 2，见内核 `docs/AUDIT-2026-11-11-R2.md`）。端口签名有变化但本仓未直接
  使用（`kernel:surface` 19 域零变化）；tarball 换成 alpha.17，`kernel:check` 九条判据复绿。

- **alpha.15**：内核 P1 信任边界收敛（`shell_interactive` 补 OS 沙箱包装 / RFC3161 证书链 / 浏览器页面内请求拦截）+ 16 件 `L0-unverified` 清零 + MCP 客户端反向请求 + 覆盖率二次收紧 + 跨仓消费契约层（alpha.14 未发布，本版合并其全部内容）；app 侧契约不变（对接面 19 域 / 256 文件 / 286 导入 / 影子 0），tarball 换成 alpha.15、`kernel:check` 九条判据复绿。
- **alpha.14**：内核审计整改同步（25 个提交：P0 15 / P1 57 / P2/P3 分批），
  安全域 `TrustTier` 更名 `ContentTrustTier`、`AesGcmSealer` 单一密码学实现（scrypt + 旧密文回退）；
  app 侧 M31 对接收口：`CryptoVault` / `EnvVault` 迁回对接面、compat 再导出桶删除、
  `kernel:check` 增第 9 条「已承诺能力无同名副本」；M32 影子清零终盘：第 9 条修复两处漏检
  （curated 键拼接成目录 / 再导出桶未解析）后删除 `SessionGc` / `TmpSweep` /
  `SessionStorageLocation` / `IsolationLadderFactory` / `SdkPreferredMcpConnector`，
  改经 `@omniharness/kernel/maintenance` / `/sandbox` / `/mcp` 子路径消费
  （tarball 版本不变——alpha.14 本就承诺这些 curated 子路径）。
- **alpha.13**：内核 M29——审计 canonical 收敛 `kernel/receipts/jcs.js` 单一真源
  （app 侧 `auditCanonical.ts` 退役，golden 四例钉死）。
- **alpha.12**：M26 终盘收编 36 件 + M27 SDK 客户端族/凭据打码单一真源 + M28 词表配置化；
  app 侧 M27 兼容层清零（`kernel-compat/` 更名 `extensions/`，41 件影子删除）。
- **alpha.11**：M22–M24——plugin / 评测域退役至内核包（44 件影子删除）。
- **alpha.9**：M21 Phase 2——exports 通配删除 → 251 条显式承诺闭包。
- **alpha.7**：M9——内核删除能力的自有化（11 模块随迁 `kernel-compat/`）。
- **alpha.6**：内核 M4/M5/M6 闭环——切片清理 + 编排收敛为内核单源（app `Runtime`
  成为内核 Runtime 的薄扩展）+ a2a 互操作退役。
- ~~alpha.4~~：曾因内核切片删除 app 所需能力而钉定（「最后一个完整面」）；alpha.6 迁移时
  app 侧以自有扩展层接住了被删能力，遂升级。完整迁移总账见
  [docs/KERNEL-CONTRACT.md](../docs/KERNEL-CONTRACT.md)。

