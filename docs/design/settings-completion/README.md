# 设置页内核能力补全（settings-completion）需求设计

> 2026-11-14 立项。状态：v1 实现中。
> 用户口径：对接内核能力，把**可以设置的开关 / 配置项 / 自定义选项**全部补到设置页，
> 让用户在设置分类里有自行设置的入口，不遗漏；完成后全面开关功能测试 → review
> 查缺补漏 → 清理死代码 / 死文件。

## 1. 差集盘点（内核 FileConfig 可配键 vs 设置页现状）

内核单一真源：`FileConfig`（contracts/ports/config/fileConfig.ts）+ 字段规格
（configFieldSpecs：ENUM_VALUES / NUMBER_FIELDS / BOOLEAN_FIELDS / STRING_FIELDS）。
服务端可写边界：`PERSISTABLE_KEYS`（appServerState.ts，config.update 只落这些键）。

### 1.1 已有入口的键（无缺口）

| 键 | 入口 |
| --- | --- |
| model / baseUrl / modelAdapter / sandbox | 设置页字段行 |
| approval / escalation / autoApprove | 权限栏 |
| permission（rules/defaultDecision） | PermissionTab 规则编辑器 |
| locale / chatMode / 主题 / 栏宽 / workspaces | 常规栏 + 添加项目 |
| apiKey / providerKeys | 厂商卡片 |
| profiles（extends）/ pluginProfile | 配置集面板 |
| workspace | 只读 InfoRow（启动参数决定，明确不 UI 化） |
| mcpServers / skills | MCP 与技能面板 |

### 1.2 服务端已可落盘、但设置页**没有入口**的键（本次补）

| 键 | 类型 | 归属 |
| --- | --- | --- |
| reasoning | enum 7 档 | 模型栏（与 Composer 切档同通道） |
| elevatedSandbox | enum passthrough/policy/restricted | 运行时·执行环境 |
| storageAdapter | enum memory/jsonl/sqlite | 运行时·存储 |
| storageDir | string | 运行时·存储 |
| maxSteps | number（0 有语义：不限？按内核 ZERO_ALLOWED） | 运行时·步数与成本 |

### 1.3 内核支持、但服务端 `PERSISTABLE_KEYS` 还没纳管的键（本次扩 + 补 UI）

| 键 | 类型/约束 | 归属 |
| --- | --- | --- |
| costBudgetUsd | number（USD 硬预算） | 运行时·步数与成本 |
| costBudgetSoftRatio | number 0<r≤1（软阈值比例） | 运行时·步数与成本 |
| costBudgetOnExceed | enum fail/warn | 运行时·步数与成本 |
| modelCircuitBreaker | bool | 运行时·步数与成本（模型熔断） |
| modelCircuitBreakerThreshold | number（连续失败次数） | 运行时·步数与成本 |
| modelCircuitBreakerOpenMs | number（熔断打开时长 ms） | 运行时·步数与成本 |
| longTermMemoryEncryption | bool | 运行时·长期记忆 |
| longTermMemoryGovernance | bool | 运行时·长期记忆 |
| longTermMemoryKeyFile | string（路径） | 运行时·长期记忆 |

### 1.4 枚举**漂移修正**（内核枚举已扩、前端 options 没跟上）

- `modelAdapter`：前端缺 `llamacpp`、`gemini`（内核 ENUM_VALUES 共 6 值）；
- `approval`：前端缺 `deny`、`guardian`、`plan`（内核共 6 值；`plan` 为只读规划模式）。

### 1.5 明确**不 UI 化**的键（与理由，防"看起来遗漏"）

- `ssrfPolicy`：三个 CIDR/主机清单列表（metadataHosts/internalSuffixes/ipv4Blocks）——
  表单化反而不可用，保持配置文件路径（权限栏描述里给指引）；
- `limits` / `interjection` / `calibratedAutonomy` / `evolutionRlvr` / `modelRouter` /
  `media` / `plugin` / `capability` / `rbac` / `decisionEngine`：结构化子对象，
  出厂值在 defaults/*.json（"改数据不改代码"），属运维级 / 有专门面板，不做简单表单；
- `providerPresets`：结构化数组（自建厂商定义），启用/Key/检测由厂商卡片消费侧承载，
  新增预设的编辑保持配置文件路径（review P2-7 补记）；
- `apiKeyDpapi` / `providerKeysDpapi`：DPAPI 自动加解密产物，绝不手填；
- `extends`：profile 机制内部键（配置集面板管）；
- `pluginProfile`：面板只承载**运行时应用**（plugins.ts），落盘默认档仍走 CLI
  `profile use`——UI 只读展示生效值，不提供落盘入口（review P2-7 补记）。

## 2. 服务端增量（`PERSISTABLE_KEYS` 扩 9 键）

`appServerState.ts` 的清单追加 §1.3 的 9 个键。校验零新增——内核
`ConfigError.mergeConfigs → normalizeConfig` 已带完整类型/枚举/范围校验
（BOOLEAN_FIELDS / NUMBER_FIELDS / ENUM_VALUES + ZERO_ALLOWED），服务端只是把
"允许 UI 覆盖"的白名单打开；写非法值会被 `persist()` fail-closed 拒绝并回传错误。

## 3. 前端设计

### 3.1 字段模型（SettingsModel.ts 单一事实源）

- `SettingsFieldKind` 扩 `'number'`（text 的变体：提交时 trim → 空串发 `null`
  **显式清除覆盖**，非空数字非法/越界 → 本地拒绝并提示，不发请求）；
- `SettingsField` 加可选 `group?: string`：同栏内按组渲染成多张卡
  （`fieldsOf(tab)` → pane 用 `fieldsOfGroup(tab, group)` 过滤；无 group 的字段进默认卡）；
- number 的范围校验表（前端侧）：`maxSteps ≥ 0`（0 有语义）；`costBudgetUsd > 0`；
  `costBudgetSoftRatio ∈ (0,1]`；`modelCircuitBreakerThreshold ≥ 1`；
  `modelCircuitBreakerOpenMs ≥ 1000`。

### 3.2 分栏与卡片

**模型栏**（「默认模型与端点」卡追加一行）：
- `reasoning`：7 档 select（none…max），hint 说明与输入区强度弹窗同源。

**运行时栏**（重排为四张卡）：
1. 「适配器与执行环境」（group `exec`）：modelAdapter（options 补全）/ sandbox /
   elevatedSandbox——hint：越权动作（提权命令）的降级沙箱档；
2. 「存储」（group `storage`）：storageAdapter / storageDir（切换/清空在重启后生效）；
3. 「步数与成本」（group `budget`）：maxSteps / costBudgetUsd / costBudgetSoftRatio /
   costBudgetOnExceed / modelCircuitBreaker / modelCircuitBreakerThreshold /
   modelCircuitBreakerOpenMs——熔断三件套在开关关闭时**仍渲染但弱化**（不隐藏，
   保持"能配就能看到"）；hint 给清零/清除语义；
4. 「长期记忆」（group `memory`）：longTermMemoryEncryption / longTermMemoryGovernance /
   longTermMemoryKeyFile——加密开启但未配 keyFile 时 hint 提示将用派生默认密钥（内核口径）。

**权限栏**：approval options 补全 6 值；卡片描述补 `plan`（只读规划）/`guardian` 说明。

### 3.3 i18n / 无障碍

- 新 label / hint 全部走 `t()`，en 分片补 `settings.ts`；`i18nCoverage` 钉住；
- 每行保持既有 aria 口径（ConsoleSelect/ConsoleSwitch/ConsoleInput 自带）。

## 4. 判据

| 层 | 判据 |
| --- | --- |
| 契约钉死 | `web/test/settingsPane.test.ts` 增：SETTINGS_FIELDS 的键集 === 本文档 §1.2+§1.3 清单（防未来漂移）；枚举 options 与内核 ENUM_VALUES 一致（llamacpp/gemini/deny/guardian/plan） |
| 读写闭环 | `web/test/configWiring.test.ts` 增：每个新字段 saveField → updateConfig patch 形状（number 翻译、空串=null 清除、非法数字拒绝不落盘） |
| 服务端 | `tests/serverConfigStore` 类判据增：9 个新键经 config.update 落盘 + 非法值被拒 |
| 真机 | CDP：设置页四卡渲染齐全、新开关逐个切换 → config.update 调用记录；明暗截图存档 |
| 全量 | 三端 typecheck + 全部套件 |

## 5. 死代码清理（用户要求，review 后执行）

- 以 review 代理的查缺补漏为准绳：删除无人引用的组件/模型/样式块（孤儿 CSS、
  一次性探针文件）；`vite build` 零警告 + 全量判据绿为准出条件。
- 已执行（2026-11-14 review）：删除 `SettingsModel.ts` 的零引用 `ThemeMode` 类型
  （与 ThemePreference.ts 的同名类型重复）；import 图扫描确认 web/src 无其余孤儿
  组件/样式（contrast.ts 有文档声明保留，`.tmp/` 为 gitignored 本地草稿区不进仓）。

## 6. 上游内核缺口（记录，不在本改动修）

- `longTermMemoryKeyFile` 只在内核 KNOWN_KEYS、不在 STRING_FIELDS 类型白名单——
  手改 omniharness.json 传数字也能过 normalizeConfig；UI 只发字符串不触发，
  建议上游补类型白名单（review P2-11）。
