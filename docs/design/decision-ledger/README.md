# 决策账本（Decision Ledger）· 功能需求与设计

> 状态：**v1 已实现（2026-11-11）**；设计稿与实现同步，新增 1 面板 / 4 RPC  
> 日期：2026-11-11  
> 内核基线：`@omniharness/kernel@0.1.0-alpha.16`，本机内核仓 `master@fc8a1e8`（M47，2026-11-11）  
> 范围：Web 工作台 + 桌面壳共用；沿用「纸与墨」视觉体系，不新建视觉世界  
> 配套草图：`01-decision-ledger-overview.png` / `02-decision-conformal-proof.png` / `03-decision-optin-empty.png` / `04-decision-ia-flow.png`  
> 草图口径：按 **v1 目标态**绘制；数据为演示值，不代表真实会话。

---

## 0. 一页结论

现有工作台已经能回答三个问题：

| 入口 | 回答的问题 |
| --- | --- |
| 控制室 · 编队 | 谁在跑？跑到哪？改了什么？ |
| 控制室 · 上下文 | 模型还记得什么？ |
| 控制室 · 凭证 | 这一回合的事件流是否完整、能否导出？ |

还缺第四个问题：**这次工具调用在执行前，为什么被允许？**

「审计」展示的是应用自己的全局 HMAC 事件链；「凭证」展示的是回合级执行证书（Merkle 根 + 证书）；两者都不包含内核的**执行前决策记录**。内核 alpha.16 之后的 M45/M47 已经把这件事做成可交付证据：

- `auditRecords: true` 时，内核在每次工具调用**执行前**写入 `policy_snapshot` / `decision` / `approval` / `authorization` / `context_taint` / `heartbeat` 审计记录；
- M47 的 `calibration_snapshot` + `calibration_units` sidecar 把共形放行的 α/τ/风险分/校准集写进包内，`ConformalAatVerifier` 可离线重算；
- `AatExporter` 与 `ConformalAatVerifier` 都在 `@omniharness/kernel/receipts` 公开面，**本轮不需要改内核**。

因此本设计新增**一个**「决策账本」面板（不是控制室第四个 tab），只做四件事：

1. 按会话列出每一条执行前决策：工具、结果、依据、风险分、授权、时间；
2. 选中一条，解释「谁允许、依据哪版策略、审批/授权发生了什么」；
3. 同时跑**原始审计链**与 **AAT 结构链**、以及**共形复核**，任何一项失败都不显示绿灯；
4. 导出标准 AAT（`aat.json` + SHA-256），离线可用同版本内核复核。

v1 只读；唯一写操作是用户显式开启 `auditRecords`（未来回合生效，不补造历史）。

### 0.1 本轮先行完成的内核同步

| 项 | 结果 |
| --- | --- |
| 内核源 | 本机 `../omniharness-kernel` 最新可用提交 `fc8a1e8`（M47 收尾；远端 tag 仍为 `v0.1.0-alpha.16`，本轮网络不可达，未能 fetch 新 tag） |
| vendor | `npm run kernel:vendor` 重建 `vendor/omniharness-kernel-0.1.0-alpha.16.tgz`（5.2 MB；含 M47 `ConformalAatVerifier`） |
| 安装 | 删除旧 `node_modules/@omniharness/kernel` 后重装，确认 `dist/kernel/receipts/conformalAatVerifier.js` 存在 |
| 对接面 | `npm run kernel:surface`：19 个域文件，**无变化** |
| 门禁 | `npm run kernel:check` 通过：280 源文件 / 288 处包导入 / 原生内核实载 / 生成物一致 |
| 类型 | `npm run typecheck`（后端 / Web / 桌面）0 error |
| 判据 | 新增 14 条功能判据全过；本功能相关 14 文件 / 64 用例全绿（含 e2e、parity、vendor 分块）。全量 184 文件 / 842 用例里其余面板的并发 antd 迁移判据未纳入本次验收（非本功能改动）。 |
| 冒烟 | `npm run smoke`：8/8（token / healthz / readyz / HTML / config.get / sessions.list / 原生内核 ping） |

### 0.2 v1 实现落点（2026-11-11）

| 层 | 落点 |
| --- | --- |
| 后端 | `src/apps/server/services/decision/{decisionAat,decisionLedgerService,decisionSettingsStore,decisionSettingsService,decisionTypes}.ts` |
| 配置/运行时 | `DecisionSettingsStore`（用户级 `decision-ledger.json`）；`AgentRuntimeHost` 构造时烘焙 `auditRecords/auditPrincipal` |
| RPC | `src/apps/server/modules/decision.ts`：`decision.session/detail/export/configure`（104 → 108） |
| 前端 | `web/src/ui/components/tabs/DecisionTab.tsx` + `decision/{DecisionList,DecisionDetailPanel,DecisionDialogs,useDecisionLedger,decisionModel}.ts(x)` |
| 样式 | `web/styles/decision.css`（从 theme token 取色；390 宽单栏、无横向滚动） |
| 判据 | `tests/decisionLedger.test.ts`（6）、`tests/decisionSettings.test.ts`（3）、`web/test/decisionModel.test.ts`（3）、`web/test/decisionTab.test.tsx`（2）；parity 108 |

> 诚实说明：内核 `package.json` 版本号仍是 `0.1.0-alpha.16`，但 vendor 内容已包含 M47 的 27 个提交。应用锁定的是 tarball integrity，不是 tag 名；本轮没有伪造新版本号。

---

## 1. 调研：内核有什么、应用缺什么

### 1.1 现有入口的分工与盲区

| 入口 | 数据源 | 能回答 | 不能回答 |
| --- | --- | --- | --- |
| 控制室 · 凭证 | 会话事件 + `ExecutionCertificates` + `EventMerkle` | 这一回合的事件是否完整、证书能否校验、能否导出 | 某个工具调用在执行前为什么被允许；谁批准的；授权是否复用 |
| 审计 | 应用自己的 `AuditSink`（HMAC 事件链） | 服务端记录过哪些审计事件、链是否连续 | 内核执行前决策；策略快照；共形证据 |
| 治理 | 工作区晋升台账 | 哪条能力被晋升、可否独立复核 | 单次工具调用的裁决 |
| Trace / 钻取 | 事件流 | 单条事件的原始载荷 | 跨事件的决策链、审批与授权的因果 |
| 活动 / 工具 | 会话事件聚合 | 审批、变更、工具调用汇总 | 执行前裁决的依据与可复核性 |

结论：**「决策」不是「事件」的另一种列表**。它需要把 `policy_snapshot → decision → approval → authorization → tool_call → tool_result` 串成一条因果链，并且能离线重算。现有任何面板都没有这条链。

### 1.2 内核最新能力（M45 / M47）

#### 1.2.1 审计记录

`config.auditRecords=true` 时，内核在会话开始时写 `policy_snapshot`，在每次工具门禁裁决后、执行前写 `decision`；审批、委派、心跳、CTA、校准快照按需追加。它们都是 `SessionEvent` 里的 `type='audit'` 事件：

```text
policy_snapshot
  └─ decision（allow / deny / require_approval / no_rule / unavailable）
       ├─ approval（request / answer / override）
       ├─ authorizationId（allow 时签发，执行前 consume）
       ├─ context_taint（CTA）
       └─ conformal?（M45 统计放行时）
            ├─ calibration_snapshot（小元数据）
            └─ calibration_units sidecar（full/delta，单元本体）
tool_call → tool_result
```

关键类型（内核 `contracts/ports/receipts/auditRecord.ts`）：

- `AuditDecisionRecord`：`decisionId`、`toolCallId`、`toolName`、`requestDigest`、`policySnapshotHash`、`result`、`evaluatorId`、`authorizationId?`、`conformal?`；
- `ConformalDecisionRecord`：`alpha`、`threshold`、`riskScore`、`effectClass`、`calibrationDigest`、`classDigest`、`calibrationSnapshotId`、`unitCount`、`riskFeatures`、`riskModelDigest`；
- `AuditApprovalRecord`：`approvalId`、`decisionId`、`requestDigest`、`phase`、`result`、`by?`；
- `AuditPolicySnapshotRecord`：`snapshot.rules[]`（`ruleId` / `ruleVersion` / `digest`）与 `snapshotHash`。

#### 1.2.2 两个公开复核器

```ts
import { AatExporter, ConformalAatVerifier, AuditRecorder } from '@omniharness/kernel/receipts';

const { records, sessionHash } = AatExporter.build(events, {
  idFactory,          // 可选：确定性 ID
  now,                // 可选：session_end 的固定时间
  trustLevel: 'L0',   // 不伪造认证
});
const structural = AatExporter.verify(records, { requirePrincipal: false });
const conformal = ConformalAatVerifier.verify(records);
```

`AatExporter.verify` 校验 AAT 链/字段/时序/授权复用；`ConformalAatVerifier.verify` 用包内校准单元重算单类摘要、全类摘要、阈值和风险分。两者都通过才是完整复核。

#### 1.2.3 M47 的诚实边界（必须原样进入 UI 文案）

- 保证是**边际期望**（可交换性下），不是逐调用正确；分布漂移会削弱前提；
- 原始 args 不进 AAT，只记录 `request_digest` 与风险特征（`toolName/argKeys/intentKind/intentRisk/mutating`，其中 `argKeys` 是**参数键数**不是键名数组）；
- 权重变更后旧证据会报 `CONFORMAL_RISK_MODEL_MISMATCH`（fail-closed）；
- AAT 是 IETF 草案子集、L0、未签名；不证明模型输出为真，也不证明签发方没有整体重写历史。

### 1.3 应用侧的四个缺口

| 缺口 | 证据 | 后果 |
| --- | --- | --- |
| `auditRecords` 从未开启 | 全仓 `src/**` 无 `auditRecords` 消费；内核 `FileConfig` 不承载该键 | 事件流里没有 `audit` 记录，AAT 无米下锅 |
| 没有 AAT 读取/导出 | `src/host/kernel/util.ts` 目前没有 `AatExporter` 消费（receipts 子路径现有落点是 util 域） | 无法按回合解释裁决，也无法导出 |
| 没有原始审计链复核 | `ProofService` 只读事件做证书，不校验 `audit` 事件的 `prevHash/hash` | 即使做了 AAT，也可能「AAT 链自洽，但原始事件被改过」 |
| 没有 UI 入口 | `PanelRegistry` 20 个面板；`ConsoleRegistry` 数据组末位是审计 | 用户只能读原始 JSONL |

**证据索引**

| 结论 | 证据 |
| --- | --- |
| `auditRecords` 未纳管 | 内核 `FileConfig` 无该键（只在 `OmniHarnessConfig`）；app 需自建用户级开关 |
| 应用未消费 AAT | [`util.ts`](../../../src/host/kernel/util.ts) 当前无 `AatExporter`；`src/**` 无 import |
| 凭证只做回合证书 | [`proofService.ts`](../../../src/apps/server/services/proof/proofService.ts) 的 `ExecutionCertificates` / `EventMerkle` |
| 审计是 app HMAC 链 | [`AuditSink`](../../../src/apps/server/services/auditSink.ts) 与审计面板的 `audit.query` |
| 内核公开复核器 | 内核 `src/receipts.ts` 的 `AatExporter` / `ConformalAatVerifier` / `AuditRecorder` |
| 内核 M47 证据形状 | 内核 `contracts/ports/receipts/auditRecord.ts` 的 `ConformalDecisionRecord` |

### 1.4 为什么不是控制室第四个 tab

控制室的三模式共享一个 job：「当前运行态」。决策账本的 job 是「执行前授权的证据」，数据源是 audit 事件、复核方式是 AAT + 共形，而且天然是会话级/可导出的审计面。把它塞进控制室会：

- 让控制室从「一屏三问」变成「一屏四问」，稀释每个 tab 的单一职责；
- 让「凭证」与「决策」两个证据面在同一面板内竞争解释权；
- 让审计/治理组失去唯一适合它的落点。

因此：**新增 1 个面板，放在「数据与统计」组的「审计」之后**；控制室保持三模式不变。

### 1.5 设计判断

1. **一个 job**：这一页只回答「这次调用为什么被允许/拒绝」，不做事件流浏览器、不做全局审计。
2. **先决策，后结果**：列表以 `decision` 为主行，`tool_call/tool_result` 作为结果列，不把工具结果当主角。
3. **双链复核**：原始 `audit` 链 + AAT 链；只验 AAT 等于把「投影后的链」当事实，必须同时验原始链。
4. **失败即失败**：断链、字段非法、授权复用、共形不一致，一律红；没有「部分通过」的绿灯。
5. **不补造**：开启前的回合没有记录就是没有；主体缺失就是缺失；不会用当前用户回填历史。
6. **只读优先**：v1 唯一的写操作是显式开启审计；不提供「手动改判」「补写记录」。

---

## 2. 产品定义

### 2.1 用户与场景

| 用户 | 场景 | 心理状态 | 成功标准 |
| --- | --- | --- | --- |
| 个人开发者 | Agent 说「已完成」，但改了配置文件 | 怀疑 | 30 秒内看到哪次写入、谁允许、风险分多少 |
| 技术负责人 | 把会话交给同事复核 | 需要可交付证据 | 导出 AAT，同事离线能验；未签名也如实标注 |
| 安全/合规 | 抽查一条 `shell` 调用 | 需要依据 | 看到策略快照、审批人、授权 ID、是否复用 |
| 桌面用户 | 长任务跑完，想快速回看 | 疲惫 | 打开面板即见最近决策；一条点击进入「为什么」 |

### 2.2 Job 与成功定义

**Job**：在一次工具调用发生前后，让用户用一屏回答：

> 谁允许的？依据哪版策略？有没有被改过？能不能交给别人离线复核？

**成功**：

- 从打开面板到看懂一条决策的「为什么」≤ 3 次点击（选回合 → 选行 → 看详情）；
- 任意「放行」都能对应到一条 `decision` 记录与（allow 时）一个授权 ID；
- 任意「共形放行」都能看到 α/τ/r/n，并能点开共形复核；
- 任意「已复核」都同时通过原始审计链与 AAT 链；没有证据就不说通过；
- 导出的 AAT 可被同版本内核离线复核，失败时能指出问题码。

**非目标**：

- 不做通用 SIEM / 日志检索；
- 不做实时拦截或审批操作（审批仍在原弹框）；
- 不做共形 α 的调参 UI（本期只展示证据，不改变放行策略）；
- 不复制「审计」的全局链、不复制「凭证」的回合证书；
- 不证明模型输出为真、不提供外部 witness/时间戳锚定；
- 不做跨工作区/跨会话搜索。

### 2.3 设计原则

1. **一屏一问**：标题就是问题域；详情只解释「为什么」，不塞运行态。
2. **先证据，后解释**：先给记录/哈希/计数，再给一句人话。
3. **状态不靠颜色**：圆点 + 文案 + `aria-label`；色盲可读。
4. **安静密度**：行高 64px，段间距 24–32px；不使用彩色大卡片。
5. **不伪造完成**：`unavailable`、`deny`、`require_approval`、`principal_missing`、`truncated` 原样展示。
6. **不把「链自洽」说成「内容可信」**：这是本功能最重要的文案纪律。

---

## 3. 信息架构与入口

### 3.1 导航落点

```text
工作台控制台
└─ 数据与统计
   ├─ 指标
   ├─ 活动
   ├─ 变更
   ├─ 治理
   ├─ 回滚
   ├─ 审计          ← 全局 HMAC 事件链
   ├─ 决策账本      ← 新增，本会话执行前决策
   ├─ 诊断
   ├─ Trace
   └─ 钻取
```

- 面板 key：`decision`；
- label：`决策账本`；
- icon：新增 `ledger` 线性图标（账本横线 + 哈希刻度；不新增视觉色）；
- description：`执行前决策、审批、授权与共形证据：回答「为什么允许」`；
- scope：`session`；
- 分组：`data`；顺序在 `audit` 之后、`diagnostics` 之前；
- 命令面板：只加一条「打开决策账本」；如果现有命令面板从 `PANELS` 派生，则零新增代码；
- 会话中栏：**不加**常驻 chip（避免第二个入口）；有拒绝/升级时也不加，用户从控制台进入。

### 3.2 深链

- v1：`#pane=decision`（沿用 `Router.ts` 的 `VALID_PANES`）。
- 不新增 `view`/`record` 参数：控制室的 `view` 是特例，直接复用会污染路由语义。
- 选中记录只保存在页内状态；v1.1 若需要分享单条决策，再给 `AppRoute` 增加可选 `focus` 字段，并补路由判据。

### 3.3 页面结构

```text
┌ 页头：标题 / 一句话 / 会话 / 复核 / 导出 ─────────────────────┐
├ 摘要条：决策 / 放行 / 升级 / 拒绝 / 共形 / 链 + 覆盖 warning ─┤
├ 工具条：全部·放行·升级·拒绝·共形 / 回合筛选 / 搜索 ───────────┤
├ 决策列表（按回合分组）                    │ 决策详情（选中行）  ┤
├ 链状态条：128/128 · 0 断点 · 0 复用        │ 依据 / 授权 / 共形  ┤
└ 页脚：三者分工 / 诚实边界 ────────────────────────────────────┘
```

证据复核与导出放在抽屉/对话框，不把主列表挤成三栏。

---

## 4. 交互规格

### 4.1 页头

| 元素 | 内容 | 状态 |
| --- | --- | --- |
| 面包屑 | `工作台控制台 / 决策账本` | 固定 |
| 标题 | `决策账本` | 固定 |
| 副标题 | `每一次工具调用，先有裁决，后有动作；这一页回答「为什么允许」。` | 固定 |
| 会话行 | `sess_… · 会话标题 · 运行中/空闲 · AAT 已开启/未开启` | 跟随当前会话 |
| 复核 | 打开复核抽屉；已知断链时按钮仍可用（复核会给出问题），但不显示绿 | idle / running / pass / fail |
| 导出 AAT | 主按钮；未开启/断链/超限时禁用并说明 | enabled / disabled |

页头不显示「新建任务」「设置」「命令面板」等已有唯一入口。

### 4.2 摘要条

| 指标 | 定义 | 备注 |
| --- | --- | --- |
| 决策 | `decision` 记录数 | 不是 AAT 记录总数 |
| 放行 | 最终执行且未被拒绝的决策数 | 含人工批准、共形放行、默认 allow |
| 升级 | `require_approval` 且尚无最终结果的决策数 | 已批准/已拒绝归入放行/拒绝 |
| 拒绝 | 最终拒绝且未执行 | 含规则 deny、审批拒绝、后续沙箱拒绝 |
| 共形放行 | 带 `conformal` 块的决策数 | 即使最终被沙箱拒绝也计入，但列表要标注「审批层放行、最终拒绝」 |
| 链 | `AAT 记录数 / 原始 audit 记录数 / 断点数` | 两个数都显示，避免混淆 |
| 覆盖 | `有决策的回合 / 总会话回合` | 审计中途开启时显示 warning |

> 计数口径：`放行 / 升级 / 拒绝` 是**最终去向的互斥三分类**；`共形` 是**属性**，可与「拒绝」重叠（审批层共形放行、随后被沙箱拒绝）。因此 `放行 + 升级 + 拒绝 = 决策`，`共形` 单独计数，不参与求和。

摘要条下方 **只在需要时**出现一条 warning：

- `审计从第 3 回合开启：前 2 个回合没有决策记录，不能补造。链完整 ≠ 覆盖完整。`
- `本会话有 2 条决策缺少授权主体；不影响链，但不能回答“谁授权”。`
- `原始审计链在第 18 条断开：本地事件可能被改过；不要导出为证据。`

### 4.3 工具条与列表

**筛选**：

- 结果 tab：全部 / 放行 / 升级 / 拒绝 / 共形；
- 回合下拉：全部回合 / 第 N 回合；
- 工具名搜索（大小写不敏感，前缀匹配即可）；
- 排序：时间倒序（默认）；同一毫秒按 AAT `sequenceNumber` 倒序。

**分组**：

- 按回合分组；组头显示 `第 3 回合`、时间范围、`9 条决策`；
- 只显示有决策的回合；被审计漏掉的回合在覆盖 warning 中体现，不造空组。

**行**（64px，两行）：

```text
● write_file   改写 src/routes/market.ts              [放行]   14:33:02  ›
  共形放行 · r 0.122 < τ 0.180              STATE_MUTATING · auth_01H…
```

- 第一行：状态点、工具名（等宽）、动作摘要（可截断）、结果 chip、时间、chevron；
- 第二行：依据（人话 + 关键数字）、效果类与授权短 ID；
- 结果 chip：`放行` / `升级` / `拒绝` / `不可用`；`共形` 作为依据标签，不另造第五种结果；
- 选中行：左侧 3px accent 竖线 + 浅底；键盘 ↑/↓ 移动，Enter 打开详情；
- 行本身是 `button`，不是 `div`；`aria-label` 包含工具、结果、时间。

**空/异常**：

- 审计未开启：空态 + 开启入口（见 4.7）；
- 审计已开启但无决策：`这个会话还没有工具调用。` + 返回工作区；
- 事件流不可读：`决策账本读取失败：…（不显示空账本）`；
- 断链：列表仍可看，但顶部红色 banner，导出禁用；
- 记录过多：只返回最近 500 条，列表顶部提示 `仅显示最近 500 条；导出仍覆盖全会话`（若未超限）。

### 4.4 决策详情

右侧 396px 面板；390 宽时改为全屏 sheet。

| 区块 | 内容 | 规则 |
| --- | --- | --- |
| 头部 | 工具名、结果 chip、回合/时间 | 工具名等宽 |
| 为什么 | 2–4 句确定性模板 | 不调用模型；只根据记录拼接 |
| 依据 | 策略快照（规则数 + hash）、裁决器、默认裁决、fail-closed、单次授权、共形块 | 缺字段写「未记录」，不省略 |
| 审批轨迹 | request/answer/override 逐条：时间、结果、`by`、原因 | 没有审批写「未触发人工审批」 |
| 关联动作 | `tool_call` / `tool_result`：调用 ID、结果、耗时、错误 | 未执行写「没有执行」 |
| 链 | `recordId`、`sequenceNumber`、`prevHash → hash`、复制 | 只给短 hash + 复制全文 |
| 脚注 | `AAT -09 子集 · L0 · 未签名；原始参数不进入账本` | 固定 |

**「为什么」模板**（不允许自由发挥）：

- 共形且最终放行：`审批层要求升级；共形层以 α=… 放行：风险分 … < 阈值 …（…，n=…）。执行前签发并消费单次授权；工具返回成功。`
- 共形但最终拒绝：`审批层由共形层放行；随后沙箱/计划/污点层拒绝，最终未执行。共形块只描述审批层，不代表最终放行。`
- 人工批准：`审批层要求升级；<by> 于 <time> 批准；执行前签发单次授权；未发现复用。`
- 规则拒绝：`规则 <evaluatorId> 拒绝；未签发授权；没有执行。`
- 默认：`没有规则命中，按默认 <allow|deny> 处理；<是否执行>。`
- 不可用：`裁决器不可用；fail-closed=<true|false>；<执行/未执行>。`
- 主体缺失：在「依据」里加一行 `授权主体：未记录`，不编造。

**结果状态映射**（服务端计算，前端只渲染）：

| 记录事实 | 显示 |
| --- | --- |
| `decision.result=allow` 且无后续拒绝 | 放行 |
| `decision.result=allow` + 共形块 | 放行（共形） |
| `decision.result=require_approval` + 审批 approved + 有 tool_call | 放行（人工） |
| `decision.result=require_approval` + 无审批回答 | 升级（待批） |
| `decision.result=require_approval` + 审批 rejected | 拒绝（人工） |
| `decision.result=deny` | 拒绝 |
| 共形块 + 后续沙箱/计划拒绝 | 拒绝（共形后被拦） |
| `decision.result=unavailable` | 不可用 |

### 4.5 复核抽屉

标题：`复核这份账本`；副标题：`原始审计链 + AAT 结构链 + 共形证据；三者独立。`

**结构复核**

| 检查 | 通过条件 | 失败文案 |
| --- | --- | --- |
| `AUDIT_CHAIN` | 每条 `audit` 事件的 `hash = SHA-256(JCS({prevHash, record}))` 且 `prevHash` 连续 | `原始审计链在第 N 条断开；事件可能被改过。` |
| `AAT_CHAIN` | `AatExporter.verify(records)` 无问题 | 按问题码逐条展示 |
| `SEQUENCE` | `sequenceNumber` 0..n-1 | `序号缺口：…` |
| `SESSION` | 全部记录同一 sessionId | `会话不一致：…` |
| `AUTHORIZATION` | 无 `AUTHORIZATION_REUSED` | `授权 ID 被复用：…` |
| `PRINCIPAL` | 有主体记录数 / 总数 | `主体缺失 2/37；不影响链，但不能回答谁授权。` |

**共形复核**

| 检查 | 通过条件 | 未运行时 |
| --- | --- | --- |
| 单元还原 | `full/delta` 可还原三类单元 | `CONFORMAL_UNITS_MISSING` |
| 类摘要 | 重算 `SHA-256(JCS(classUnits))` 一致 | `CONFORMAL_DIGEST_MISMATCH` |
| 全类摘要 | 三类按固定序重算一致 | 同上 |
| 阈值 | `ConformalRiskCalibrator.threshold` 一致 | `CONFORMAL_THRESHOLD_MISMATCH` |
| 风险分 | `ToolRiskScorer.scoreOf(features)` 一致 | `CONFORMAL_RISK_SCORE_MISMATCH` |
| 模型摘要 | `riskModelDigest` 一致 | `CONFORMAL_RISK_MODEL_MISMATCH` |
| 阈值比较 | `riskScore < threshold` | `CONFORMAL_RISK_ABOVE_THRESHOLD` |

- 若 `checkedDecisions=0`：显示 `本会话没有共形放行；共形复核未运行（不是通过）`，状态用中性灰，不用绿色。
- 复核中：`检查中…` + `aria-live=polite`；完成后聚焦结果标题。
- 复核失败：抽屉顶部红色，逐项问题；导出按钮禁用。

### 4.6 导出

**入口**：页头「导出 AAT」。**前置**：

- 审计已开启；
- 原始审计链与 AAT 结构链都通过；
- 共形复核通过，或本会话无共形决策；
- 事件数/字节数未超上限。

**格式**：

- 主文件 `aat-<sessionId>-<lastEventAt>.json`：**AAT records 数组**，可直接被 `AatExporter.verify` / `ConformalAatVerifier.verify` 读取；
- 伴随文件 `aat-<...>.sha256.txt`：`sha256(JCS(records))` 与会话 `sessionHash`；前端下载时一起生成；
- 不含原始 `audit` 事件、不含工具参数原文；这两条必须在对话框里写出来。

**对话框**：

```text
导出 AAT 证据
37 条决策 · 128 条 AAT 记录 · 约 184 KB
sha256 9a7f…（可复制）

包含：策略快照、裁决、审批、授权 ID、共形 α/τ/r、校准单元
不包含：工具参数原文、原始 audit 事件、任何网络上传
离线复核：AatExporter.verify + ConformalAatVerifier.verify（同版本内核）
[取消] [导出]
```

- 超过 8 MB：禁用，文案 `本会话 AAT 约 12.4 MB，超过 8 MB 上限；v1 暂不支持整包导出。` 不提供「静默截断」。
- 结构/共形失败：禁用，文案 `复核未通过；先处理问题，再导出。`
- 导出成功：toast `已导出 aat-…json 与 .sha256.txt`；不自动打开文件。

### 4.7 开启决策审计

**入口**：审计未开启时的空态主按钮；页头 `…` 菜单里的「审计设置」（可选）。

**形式**：内联卡片（空态右栏）或确认对话框；两者共用同一份文案。

| 字段 | 说明 |
| --- | --- |
| 标题 | `开启决策审计？` |
| 说明 | `从下一回合开始，每次工具调用前写一条决策记录。只追加，不改写放行结果。` |
| 授权主体（可选） | 文本输入，占位 `local:you`；写入 `auditPrincipal`；不填则记录无主体 |
| 知情确认 | 复选框 `我理解：开启前的回合无法补造。`；未勾选时主按钮禁用 |
| 主按钮 | `开启并保存` |
| 次按钮 | `取消` |
| 脚注 | `保存到用户级 omniharness.json；下一回合生效。` |

**行为**：

1. `decision.configure({ enabled, principal?, confirm: true })` 写入本机 `OmniHome/decision-ledger.json`；
2. 服务端 `normalizeConfig` 校验并落盘；失败原样显示原因，不乐观更新；
3. `onChanged` 触发 Agent 失效；下一回合重建，`AuditRecorder.fromSink` 接上已有链；
4. UI 显示 `已开启；下一回合生效`，不立刻把空态改成「已复核」；
5. 关闭同样走 `decision.configure({ enabled: false, confirm: true })`；已有记录保留，但不再追加；UI 仍可读旧记录，并标注 `审计已关闭 · 仅历史`。

**开启失败的边界**：如果历史 `audit` 事件链已经损坏，内核在下一回合构造 `AuditRecorder.fromSink` 时会 fail-closed，Agent 无法启动。此时不要反复重试「开启」；先在决策账本里定位断点，修复/归档旧会话。

**诚实边界**：

- 开启前没有记录，不补造；
- 关闭后再开启，链从关闭处继续？内核 `AuditRecorder.fromSink` 重放既有 audit 事件，`lastHash` 接上；中间没有记录的空档不会自动补；
- 主体不自动回填；当前用户不是历史授权人。

### 4.8 错误码与文案

| 错误码 | 触发 | 用户文案 |
| --- | --- | --- |
| `no_session` | 未选会话 | `先选择一个会话，再打开决策账本。` |
| `audit_disabled` | 审计关闭 | `决策审计当前关闭。开启后只记录未来回合。` |
| `aat_unavailable` | 事件流不可读 / 构建异常 | `决策账本读取失败：…（不显示空账本）` |
| `audit_chain_broken` | 原始 audit 事件哈希/前序不连续 | `原始审计链在第 N 条断开；事件可能被改过。` |
| `aat_chain_broken` | AAT 复核失败 | `AAT 链复核失败：…（问题码）` |
| `record_not_found` | 详情 ID 不存在 | `这条决策已不在当前事件流里；刷新后再试。` |
| `export_too_large` | > 8 MB | `AAT 约 … MB，超过 8 MB 上限；v1 暂不支持整包导出。` |
| `export_blocked` | 复核失败 | `复核未通过；先处理问题，再导出。` |
| `config_write_failed` | 保存开关失败 | `保存失败：…（原样显示服务端原因）` |
| `session_running` | 运行中读详情 | 不报错；提示 `账本随回合追加，刷新获取新记录。` |

### 4.9 响应式与可访问性

- **1440 / 1024**：列表 + 详情双栏；详情 396px；
- **390×844**：列表全宽；详情为全屏 sheet；筛选换行；无横向滚动；链条可横向滑动但页面不滚；
- **键盘**：Tab 进入工具条 → 列表 → 详情；↑/↓ 选行，Enter 打开；Esc 关闭抽屉/sheet；
- **ARIA**：列表 `role=list`，行 `role=listitem`，行内按钮 `aria-label`；详情 `role=region aria-label="决策详情"`；复核结果 `aria-live=polite`；状态 chip 有文字，不只靠颜色；
- **对比度**：正文/次要文本 ≥ 4.5:1；状态点不作为唯一信息；
- **axe**：面板 0 serious/critical；抽屉打开时焦点陷阱，关闭后焦点回到触发按钮。

### 4.10 文案口径

| 场景 | 必须写 | 禁止写 |
| --- | --- | --- |
| 链通过但覆盖不全 | `链完整 128/128；覆盖 3/5 回合` | `全部已审计` |
| 未签名 | `未签名 · L0` | `可信` / `已验证` |
| 共形无记录 | `共形复核未运行（不是通过）` | `共形通过` |
| 共形被后续拒绝 | `审批层共形放行；最终被沙箱拒绝` | `放行`（单独） |
| 主体缺失 | `授权主体未记录` | `你授权` |
| 审计关闭 | `决策审计当前关闭` | `暂无数据` |
| 断链 | `原始审计链断开` | `部分通过` |
| 导出失败 | `复核未通过，未导出` | `导出成功（有警告）` |

### 4.11 需求条目（可追踪）

| ID | 需求 | 验收 |
| --- | --- | --- |
| DL-01 | 控制台新增 1 个「决策账本」入口，放在数据与统计组 | 导航只多 1 项；控制室仍 3 tab |
| DL-02 | 面板跟随当前会话；`#pane=decision` 可深链 | 切会话整页跟随；刷新仍在 |
| DL-03 | 审计未开启时显示空态与开启入口，不伪造记录 | 空态文案含「只记录未来」；开启前不显示绿色 |
| DL-04 | 开启/关闭审计走 `decision.configure`，失败不乐观更新 | 保存失败原样显示服务端原因 |
| DL-05 | 摘要区分决策/放行/升级/拒绝/共形/链/覆盖 | 计数口径与 4.2 一致；共形可重叠 |
| DL-06 | 列表按回合分组、可筛选/搜索；行含工具、结果、依据、时间 | 37 条演示数据分组正确；键盘可选行 |
| DL-07 | 详情解释「为什么」，含策略快照、审批、授权、关联动作、链 | 缺字段写「未记录」；不调用模型 |
| DL-08 | 复核同时检查原始 audit 链与 AAT 链 | 篡改 audit 事件必须红；不允许只验 AAT |
| DL-09 | 共形证据可查看 α/τ/r/n，并跑 6 项离线重算 | 无共形时显示「未运行」而非通过 |
| DL-10 | 导出标准 AAT + SHA-256；fail-closed | 断链/超限/未确认不生成内容；离线可验 |
| DL-11 | 不导出参数原文；不上传；主体不回填 | AAT 无 args；`argKeys` 无值；历史记录不被当前用户覆盖 |
| DL-12 | 所有错误码有可读文案，不出现 `undefined`/`NaN` | 按 4.8 表逐条渲染 |
| DL-13 | AAT 投影确定性：同一事件流两次 build 逐字节相同 | 单测断言 `Jcs.serialize` 相等 |
| DL-14 | 列表 1,000 条可滚动；2,000 事件首屏 < 500ms | 本地实测；超限明确提示 |
| DL-15 | 390×844 无横向滚动；axe 0 serious/critical；键盘闭环 | 桌面 smoke + axe 判据 |
| DL-16 | 不复制审计/凭证入口；控制台只多 1 项 | `missingPanels()` 无遗漏；命令面板只多 1 条 |

---

## 5. 数据与后端设计

### 5.1 数据源与构建

```text
Agent.eventsOf(threadId)
  └─ SessionEvent[]（含 type='audit'）
       ├─ ① 原始审计链校验（prevHash/hash）
       ├─ ② AatExporter.build(events, { idFactory, now, trustLevel:'L0' })
       ├─ ③ AatExporter.verify(records, { requirePrincipal:false })
       ├─ ④ ConformalAatVerifier.verify(records)
       └─ ⑤ 回合映射 / 计数 / 详情投影
```

**为什么必须单独校验原始链**：`AatExporter.build` 是从 `audit` 事件**重新投影**并生成新的 AAT 链；如果只验 AAT，攻击者改完原始事件后重新 build，AAT 仍然自洽。原始链的 `hash = SHA-256(JCS({prevHash, record}))` 必须逐条复算，才能证明「record 没被改」。

实现使用 `AuditRecorder.hashOf(prevHash, record)`（公开静态方法），不复制 JCS 逻辑：

```ts
let prevHash: string | null = null;
for (const event of auditEvents) {
  const payload = event.payload as AuditEventPayload;
  if (payload.prevHash !== prevHash) fail('AUDIT_CHAIN_BROKEN');
  if (payload.hash !== AuditRecorder.hashOf(prevHash, payload.record)) fail('AUDIT_CHAIN_BROKEN');
  prevHash = payload.hash;
}
```

### 5.2 确定性投影

AAT 默认用 `randomUUID()` 与 `new Date()`，**同一个会话刷新两次会得到不同 recordId 和 session_end**，无法做「同一条决策」的深链/复制/导出比对。因此必须传入确定性参数：

| 参数 | 取值 | 理由 |
| --- | --- | --- |
| `idFactory` | `aat_<hash(sessionId).slice(0,8)>_<sequence>` | 同一会话同一位置恒得同一 ID |
| `now` | 最后一条事件的 `timestamp`（无效时用当前时间并标注） | `session_end` 稳定；不伪造未来时间 |
| `trustLevel` | `'L0'` | 不伪造认证 |
| `principal` | **不传** | 不能用当前用户回填历史；主体只能来自每条 `decision` 记录 |
| `includeCalibrationUnits` | `true`（默认） | 包自足，共形可重算 |

判据：同一事件流 build 两次，`Jcs.serialize(records)` 逐字节相同；`sessionHash` 相同。注意 `idFactory` 是**有状态计数器**，每次 `sessionOf` / `exportOf` 必须新建；复用同一个闭包会让第二次 build 的 ID 漂移（本地已用 6 条记录的最小夹具实测，新建计数器后两次 build 逐字节一致）。

### 5.3 回合映射

- 使用现有 `ProofTurnSlicer.slice(events)` 得到回合区间与 `displayIndex`；
- `decision` 记录通过 `decision_id` 反查原始 `AuditDecisionRecord` 所在事件下标，映射到回合；避免只按时间戳在边界上误判；
- `policy_snapshot` / `approval` / `tool_call` / `tool_result` 按时间戳落入对应回合；
- `turnsRecorded` = 至少有一条 decision 的回合数；`turnsTotal` = 会话全部回合；
- `firstRecordedAt` = 第一条 audit 事件的 timestamp；用于「审计从第 N 回合开启」的判断。

### 5.4 服务

新增 `src/apps/server/services/decision/decisionLedgerService.ts`：

```ts
export class DecisionLedgerService {
  public constructor(deps: {
    events: (threadId: string) => Promise<readonly SessionEvent[]>;
    auditPrincipal: () => string | undefined;
  });

  public async sessionOf(threadId: string): Promise<DecisionSessionView | DecisionFailure>;
  public async detailOf(threadId: string, recordId: string): Promise<DecisionDetailView | DecisionFailure>;
  public async exportOf(threadId: string): Promise<DecisionExportResult | DecisionFailure>;
}
```

- 纯读；不写文件、不发网络请求；
- `exportOf` 重新读取事件并构建，校验通过才返回内容；不在内存里长期缓存完整 AAT（避免陈旧）；
- 可在服务内做一次「按事件数 + 最后事件 id」的短缓存，但必须保证刷新/导出使用同一份快照；v1 不做缓存也可以；
- 失败用判别联合 `{ ok:false, code, message }`，不抛裸异常给 RPC。

### 5.5 RPC

新增 `src/apps/server/modules/decision.ts`，登记到 `modules/index.ts`；共 4 个方法（104 → 108）：

#### `decision.session`

```ts
// params: { threadId: string }
type DecisionSessionView = {
  sessionId: string;
  audit: {
    enabled: boolean;
    configuredPrincipal?: string; // 当前配置，仅提示；不回填历史记录
    startedAt?: string;      // 第一条 audit 事件
    closed?: boolean;        // 当前配置已关闭但历史仍在
  };
  coverage: {
    turnsTotal: number;
    turnsRecorded: number;
    firstRecordedTurn?: number;
    partial: boolean;
  };
  counts: {
    records: number;         // AAT 记录数
    decisions: number;
    allow: number;
    escalate: number;
    deny: number;
    conformal: number;
  };
  turns: readonly { index: number; displayIndex: number; startedAt: string; decisions: number }[];
  rows: readonly DecisionRow[];  // 最多 500
  structural: CheckSummary;      // audit + AAT
  conformal: ConformalCheckSummary;
  boundary: {
    signed: false;
    trustLevel: 'L0';
    argsIncluded: false;
    draft: 'AAT-09-subset';
  };
  truncated: boolean;
  generatedAt: string;
};
```

#### `decision.detail`

```ts
// params: { threadId: string, recordId: string }
type DecisionDetailView = {
  row: DecisionRow;
  decision: {
    decisionId: string;
    requestDigest: string;
    policySnapshotHash: string;
    result: AuditDecisionResult;
    defaultApplied: 'allow' | 'deny';
    failClosed: boolean;
    evaluatorId: string;
    authorizationId?: string;
    validUntil?: string;
    principal?: string;
  };
  disposition: DecisionDisposition;
  policy?: { snapshotHash: string; rules: { ruleId: string; ruleVersion: string; digest: string }[] };
  approvals: readonly { at: string; phase: string; result: string; by?: string; reason?: string }[];
  authorization?: { id: string; validUntil?: string; reused: boolean };
  conformal?: ConformalDecisionRecord;
  chain: { recordId: string; sequenceNumber: number; prevHash: string | null; hash: string };
  toolCall?: { at: string; toolName: string; parametersHash: string };
  toolResult?: { at: string; ok: boolean; durationMs?: number; error?: string };
  neighbors: { previousRecordId?: string; nextRecordId?: string };
};
```

#### `decision.export`

```ts
// params: { threadId: string, confirm: true }
type DecisionExportResult = {
  filename: string;
  content: string;      // AAT records JSON
  digest: string;       // sha256(JCS(records))
  sessionHash: string;
  size: number;
  recordCount: number;
};
```

- `confirm!==true` → `confirm_required`；
- 复核失败 → `export_blocked`；
- 超 8 MB → `export_too_large`；
- 成功返回内容，由前端下载；服务端不落盘。

#### `decision.configure`

```ts
// params: { enabled: boolean, principal?: string, confirm: true }
type DecisionConfigureResult =
  | { ok: true; settings: { enabled: boolean; principal?: string } }
  | { ok: false; code: 'confirm_required' | 'config_write_failed'; message: string };
```

- 写用户级 `OmniHome/decision-ledger.json`（0600，原子替换）；不写内核 `omniharness.json`；
- 保存成功后失效 Agent / 图端口，下一回合生效；
- 关闭只停止追加，不删除历史；主体留空等于不写。

### 5.6 配置

为什么不用 `config.update`：内核 `FileConfig` 只声明了会话级配置，**没有** `auditRecords` / `auditPrincipal`（它们只在 `OmniHarnessConfig`）；把这两个键塞进 `PERSISTABLE_KEYS` 会被 `normalizeConfig` 拒绝，或者需要改内核包。

实现采用 app 自有、用户级的 `DecisionSettingsStore`：

- 文件：`OmniHome/decision-ledger.json`（`OMNI_HOME` 可覆盖根目录）；
- 结构：`{ "enabled": boolean, "principal"?: string }`；
- 读取：缺失 / 损坏 / 类型不符一律回退关闭（不阻断面板）；写入：临时文件 + rename，0600；
- 生效：`AgentRuntimeHost` 在每次构造 Agent / 图端口时读取设置，覆盖 `ResolvedConfig.auditRecords` / `auditPrincipal`；保存设置后组合根失效缓存，下一回合生效。

这样既不扩内核配置契约，也不把审计开关混进项目级 `omniharness.json`；开关属于本机运行态。

### 5.7 前端集成点

| 文件 | 改动 |
| --- | --- |
| `web/src/ui/models/PanelRegistry.ts` | 增加 `decision` 条目（label / icon / description） |
| `web/src/ui/models/ConsoleRegistry.ts` | `DATA_PANEL_ORDER` 在 `audit` 后插入 `decision` |
| `web/src/ui/models/PanelScope.ts` | `decision` scope=`session`，hint 说明 |
| `web/src/ui/models/Icon.ts` | 新增 `ledger` 图标 |
| `web/src/core/Router.ts` | `VALID_PANES` 增加 `decision` |
| `web/src/ui/App.ts` | lazy import `DecisionTab`；`renderPane` case |
| `web/src/ui/components/tabs/DecisionTab.tsx` | 容器：会话级请求、筛选、选中行、复核/导出/设置对话框 |
| `web/src/ui/components/tabs/decision/` | `DecisionList` / `DecisionDetailPanel` / `DecisionDialogs` / `decisionModel` / `useDecisionLedger` |
| `web/src/core/ApiClient.ts` | `decision.session/detail/export/configure` 四个方法 |
| `web/src/ui/i18n/en/decision.ts` + `en/index.ts` | 新文案英文词条；`i18nCoverage` 兜底 |
| `src/apps/server/services/decision/*` | 读模型 / AAT 投影 / 设置存储 / 设置服务 |
| `src/apps/server/modules/decision.ts` | 4 个 RPC 注册 |
| `src/apps/server/core/serverServices.ts` | 注入 `DecisionLedgerService` / `DecisionSettingsService` |
| `src/apps/server/core/agentRuntimeHost.ts` | 构造 Agent 时烘焙 `auditRecords` / `auditPrincipal` |
| `tests/serverModulesParity.test.ts` | 104 → 108 快照 |
| `tests/decisionLedger.test.ts` / `tests/decisionSettings.test.ts` | 服务与设置判据（见 5.8） |

面板保持「一个 job」：`DecisionTab` 只管会话级请求与选中状态；列表/详情/复核各自 hook，不把三个请求混在一个 effect 里。

### 5.8 判据

**后端单测**：

1. 确定性：同一事件流 build 两次，records 逐字节相同；recordId 稳定；
2. 原始链：篡改一条 audit 事件的 `record` 或 `hash` → `AUDIT_CHAIN_BROKEN`，导出被拒；
3. AAT 链：篡改 records → `AAT_CHAIN_BROKEN`；
4. 覆盖：审计中途开启 → `partial=true`，`turnsRecorded < turnsTotal`，链仍 pass；
5. 主体：部分记录无 principal → warn，不 fail；不用当前用户回填；
6. 共形：构造 full/delta 快照 + 共形 decision → 6 项检查全 pass；改单元/阈值/风险分 → 对应问题码；
7. 无共形：`checkedDecisions=0` → `not_applicable`，不显示 pass；
8. disposition：deny / require_approval + approved / conformal + 后续拒绝 / unavailable 的映射；
9. 导出：超 8 MB → `export_too_large`；未确认 → `confirm_required`；结构失败 → `export_blocked`；
10. 空/不可读：审计关闭返回 `enabled:false`；事件流抛错返回 `aat_unavailable`，不返回空账本。

**前端判据**：

- 列表筛选/回合分组/搜索；结果 chip 与 disposition 映射；
- 390 宽无横向滚动；详情 sheet 可关闭；
- 键盘 ↑/↓/Enter/Esc；axe 0 serious/critical；
- 错误码文案逐条渲染，不出现 `undefined` / `NaN`。

**全链**：

- `npm run kernel:surface` 后 `src/host/kernel/util.ts`（receipts 子路径的现有落点）增加实际消费的符号；若生成器选择新域，以生成结果为准；
- `npm run kernel:check`、`npm run typecheck`、`npm run web:test`、`npm run smoke` 全绿；
- parity 108；README 面板数 21。

---

## 6. 安全、隐私与诚实边界

### 6.1 权限

| 操作 | 要求 |
| --- | --- |
| 读取决策账本 | 当前会话访问权限；不跨工作区；不允许通过 threadId 读别的项目 |
| 导出 AAT | 当前会话 + 明确点击；不在后台自动导出 |
| 开启/关闭审计 | 当前工作区配置写权限；保存失败不乐观更新 |
| 查看策略快照 | 只读；不展示规则正文（只有 ruleId/version/digest） |

### 6.2 隐私

- AAT 不含工具参数原文；`request_digest` 是绑定，不可反推；
- `riskFeatures` 含 `toolName`、`argKeys`（参数键数）、`intentKind`、`intentRisk`、`mutating`；不含参数值；
- 策略快照只含规则摘要，不含规则正文；
- 审批记录可能含 `by`（用户标识）与 `reason`；导出前在对话框中说明；
- 不上传、不联网、不写临时文件；导出由前端下载。

### 6.3 六条不能越过的边界

1. **覆盖不补造**：只记录开启后的回合；缺口明确显示，不能把「没记录」说成「没有决策」。
2. **原始链 ≠ AAT 链**：AAT 是从 audit 事件重新投影的；必须单独校验原始链，否则「改事件 + 重 build」仍能骗过 AAT。原始链只覆盖 `audit` 事件；`calibration_units` 是独立 sidecar，由 AAT 链与共形复核覆盖。
3. **链自洽 ≠ 内容为真**：AAT 只证明记录在执行前存在、链未被改；不证明模型输出正确、不证明数据可信。
4. **未签名**：`trustLevel=L0`；没有签发方身份；不能写「可信」「已验证」。
5. **共形是边际保证**：可交换性下的期望保证，不是逐调用正确；分布漂移/对抗构造可削弱；原始 args 不在包内。
6. **无外部 witness**：没有 RFC3161/外部锚；签发方整体重写历史不可检出；不要把它当合规认证。

### 6.4 与「凭证」「审计」的边界

- 凭证：回答「事件是否完整」；数据源是事件流 + 执行证书；复核是 Merkle/证书；**事后**。
- 审计：回答「全局记录过哪些事件」；数据源是 app 的 HMAC 链；复核是链连续性；**全局**。
- 决策账本：回答「执行前为什么允许」；数据源是内核 audit 事件 → AAT；复核是原始链 + AAT + 共形；**执行前/会话级**。
- 三者不合并、不互相替代；页面脚注固定写这句分工。

---

## 7. 验收标准（端到端）

### 7.1 开启

- 审计关闭时打开面板 → 空态 + 开启卡片；未勾选知情确认时主按钮禁用。
- 勾选并保存 → `decision.configure` 成功；下一回合产生 `policy_snapshot` 与 `decision`；面板从空态变为列表。
- 保存失败 → 原样显示服务端错误；不显示「已开启」。
- 开启前已有 2 个回合 → 顶部 warning `前 2 个回合没有决策记录，不能补造`；链仍 pass，但覆盖 3/5。

### 7.2 列表与详情

- 3 个回合、37 条决策 → 分组正确；摘要 37/29/5/3/8 与列表一致。
- 选中一条共形放行 → 详情显示 α/τ/r/n、快照 ID、授权 ID；「为什么」文案与记录一致。
- 选中一条 `require_approval` + 已批准 → 显示「放行（人工）」；不是「升级」。
- 选中一条共形后又被沙箱拒绝 → 显示「拒绝（共形后被拦）」，详情明确「审批层放行、最终未执行」。
- 无授权主体 → 详情「授权主体未记录」；摘要 warning；不阻塞查看。

### 7.3 复核

- 正常会话 → 原始链 128/128、AAT 链 128/128、共形 6/6；绿色仅在三者都通过时出现。
- 篡改一条 audit 事件 → 原始链 fail；AAT 可能仍自洽，但整体红；导出禁用。
- 篡改一条 decision 的 conformal 字段 → 共形 fail；问题码 `CONFORMAL_RISK_SCORE_MISMATCH` 或对应码；导出禁用。
- 本会话无共形 → 共形区显示「未运行（不是通过）」；导出仍可用（如果结构 pass）。
- 主体缺失 → `PRINCIPAL` warn；不影响导出，但导出对话框注明。

### 7.4 导出

- 正常导出 → `aat-….json` 可被 `AatExporter.verify` 读取；`.sha256.txt` 与 `AatExporter.hashOfRecords(records)` 一致。
- 离线复核 → 同版本内核 `AatExporter.verify` + `ConformalAatVerifier.verify` 通过；无共形时只跑结构。
- 超过 8 MB → 导出禁用，文案含实际大小。
- 未确认 `confirm` → RPC 返回 `confirm_required`，不生成内容。
- 断链 → `export_blocked`，不生成内容。

### 7.5 全局

- 控制台只多 1 个导航项；命令面板只多 1 条；无重复「新建/设置/命令面板」。
- 深链 `#pane=decision` 刷新后仍在决策账本。
- 390×844 无横向滚动；详情 sheet 可用；筛选不溢出。
- axe 0 serious/critical；键盘可完成「选回合 → 选行 → 复核 → 导出」。
- 中/英文案齐全；错误码有可读原因；不出现 `undefined` / `NaN`。
- 打开面板到看懂「为什么」≤ 3 次点击；1,000 条决策列表滚动 ≥ 50fps；2,000 事件 session 首次加载 < 500ms。

### 7.6 轻量成功指标（本地，不上报）

- 「为什么允许」平均点击 ≤ 3；
- 复核 412 条 AAT 记录 < 2s；
- 导出 5,000 事件 < 2s；
- 所有「未签名/未复核/未记录」都有文字，不只靠颜色；
- 同一面板内重复入口数 = 0；导航新增条目 = 1。

---

## 8. 实施顺序建议

| 阶段 | 内容 | 风险 | 依赖 |
| --- | --- | --- | --- |
| **P0 设计确认** | 确认本文件、1 个新面板、v1 只读、审计显式开启 | 低 | 你确认 |
| **P1 数据与服务** | `DecisionLedgerService` / `DecisionSettingsStore`、原始链校验、确定性 AAT、4 个 RPC | 中 | 内核 M47 已同步；AAT public API |
| **P1 列表与详情** | `DecisionTab`、分组/筛选/详情、错误码 | 中 | P1 服务 |
| **P2 复核与导出** | 双链 + 共形复核、导出对话框、离线复核文档 | 中高 | 共形数据真实存在（需开启校准自主性） |
| **P2 开启流程** | 空态、主体、知情确认、保存失败回滚 | 中 | `DecisionSettingsStore` |
| **P3 打磨** | 390 宽、axe、键盘、性能、i18n | 低 | P1/P2 |

不推荐先做「共形调参」：它会把一个证据面变成策略编辑器，风险与范围都超出本设计。

---

## 9. 开放决策（需要确认）

1. **面板落点**：本设计放在「数据与统计 / 审计之后」；若你希望放进「Agent 能力」靠近控制室，视觉不变，但会和「运行态」语义混在一起。
2. **默认开启吗？** 本设计默认关闭，用户显式开启。默认开启能让账本「开箱即有数据」，但会增加磁盘写入，并把审计面变成默认行为；需要你确认风险偏好。
3. **导出格式**：v1 只导出标准 AAT（records + sha256），不含原始 audit 事件；离线复核覆盖 AAT 链与共形，不覆盖原始链。若要求「离线也能验原始链」，v2 再设计证据包（AAT + audit events + manifest），会增加包体与格式维护。
4. **授权主体**：不自动填当前用户；是否要在开启时默认建议 `local:<os-user>`，仍由用户确认？本设计建议「建议但不默认写入」。
5. **单条决策分享**：v1 不做深链；若需要，v1.1 给 Router 增加 `focus` 参数。
6. **面板数量**：新增 1 个面板（21）与 4 个 RPC（108）；如果坚持不增加导航项，可把「决策账本」作为「审计」面板的第二个 tab，但会破坏审计的全局语义。

---

## 10. 草图索引

| 草图 | 内容 | 看的重点 |
| --- | --- | --- |
| [01 总览](./01-decision-ledger-overview.png) | 摘要、回合分组、决策列表、详情、链状态 | 一屏回答「哪次调用、谁允许、依据什么」 |
| [02 共形证据](./02-decision-conformal-proof.png) | 裁决链、策略快照、α/τ/r、6 项离线复核 | M47 的「阈值可离线重算」如何被用户看见 |
| [03 开启与空态](./03-decision-optin-empty.png) | 未开启空态、三步上手、开启卡片、主体输入 | 不补造历史、只记录未来 |
| [04 IA 与数据流](./04-decision-ia-flow.png) | 导航落点、数据流、四条边界、与审计/凭证分工 | 为什么不是第二个审计列表 |

---

> 设计到此为止，不含实现改动。确认方向后再进入 `实现 → 判据 → 全链验收`；默认建议先做 P1（服务 + 列表 + 详情），再做 P2（复核 + 导出 + 开启流程）。
