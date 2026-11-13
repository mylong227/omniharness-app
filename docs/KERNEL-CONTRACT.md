# 本仓与内核（`@omniharness/kernel`）的契约

> 实测日期 2026-11-11（alpha.17 对齐批次）。**结论**：应用消费 vendored `@omniharness/kernel@0.1.0-alpha.17`，
> 全部内核导入收敛于 **`src/host/kernel/` 分域对接面**（19 个**自动生成**的域文件，
> `npm run kernel:check` 第 7 条强制单点、第 8 条拒绝生成物漂移、第 9 条拒绝「已承诺能力的同名副本」）；
> 内核切片清掉、app 仍需要的能力收留于 **`src/host/extensions/`**（app 自有扩展层，原 `kernel-compat/`，
> M27 兼容层清零后更名；归属契约见[其 README](../src/host/extensions/README.md)）。
> 后端 RPC 面由 **18 个域模块声明式注册**（108 方法，parity 快照钉住）。
>
> **2026-11-11 内核同步（alpha.17）**：内核仓把 27 条复核闭环（P0 3 / P1 6 / P2 16 / P3 2，
> 详见内核 `docs/AUDIT-2026-11-11-R2.md`）打成 `v0.1.0-alpha.17` 并 tag；本仓 vendor 重建自该 tag，
> 依赖钉 `vendor/omniharness-kernel-0.1.0-alpha.17.tgz`（tarball integrity 也在 lock 里钉定）。
> 端口签名有变化（`ToolGatePort.setApprovalObserver` 按会话、`TurnDiffTrackerPort` 全方法带
> `sessionId`、`RbacPolicyOptions.toolCatalog` 支持提供器），本仓未直接使用这些 API，
> `kernel:surface` 19 域零变化，`kernel:check` / 三份 typecheck / build 全绿。

## 1. 现在的依赖方向

```text
web/ + desktop/ ──HTTP/SSE──▶ src/apps（宿主：CLI / RPC 域模块 / 会话 / 审批 / 插件宿主 / 嵌入 API）
                                   │
                                   ├─▶ src/host/kernel/            ★ 唯一内核导入点（19 域）
                                   │      core / config / util / adapters-* / plugin / …
                                   │
                                   ├─▶ src/host/extensions/        app 自有扩展层
                                   │      Laya 决策引擎 / CLI worker / doctor / 图存储 / web 广播 / …
                                   │
                                   └─▶ @omniharness/kernel@0.1.0-alpha.17（vendored tarball）
                                          ├─ dist/kernel/**        主循环 / 编排单源 / 工具 / 门禁 / 存储 / Jcs
                                          ├─ dist/contracts/**     端口 / 类型 / schema
                                          ├─ dist/protocols/**     ACP / MCP
                                          └─ native/omni_napi.node 原生内核（随包）
```

- `src/**` 只有 `src/host/kernel/<域>.ts` 允许 `import '@omniharness/kernel…'`；
  业务代码（含 `src/host/extensions/`）一律经对接面消费——全仓不出现内核包名
  （实测 274 源文件 / 288 处包导入全部命中，`kernel:check` 实载验证）。
- `src/host/kernel/` 只放**自动生成**的 19 个分域 re-export，**不放实现**
  （Laya 与解析器在 `extensions/kernel/`，企业 OIDC 适配器在 `src/apps/enterprise/`）。
- `extensions/` 只依赖 `../kernel/<域>.ts` 与目录内相对路径，同样不得绕过对接面。
- 内核 `kernel/composition/{runtime,serviceKeys}.ts` 就是编排单源：app 的
  `src/apps/composition/runtime.ts` 只是 `Runtime` 的薄扩展 + `ServiceKeys` 再导出（app 侧拷贝已删除）。

## 2. 迁移总账（M2 → M30，影子清零之路）

| 里程碑 | 内核钉版 | 做了什么 |
| ------ | -------- | -------- |
| M2（2026-11-04） | alpha.4 | 从上游 OmniHarness 切出独立仓；内核改为 vendored tarball + 对接面起步 |
| M4/M5/M6 | alpha.6 | 编排单源 `Runtime.createRuntime`；A2A 随内核 M4 退役；切片期收容所 `kernel-compat/`（122 文件）成形 |
| M9 | alpha.7 | 内核删除能力的自有化：11 模块随迁 `kernel-compat/` |
| M21 | alpha.9 | 内核 exports 通配删除 → 251 条显式承诺闭包；域生成器解析源对齐承诺清单（exports 第一优先 + dist 回退黄标） |
| M22–M24 | alpha.11 | plugin / 评测域退役至内核包：44 件影子删除，25 深路径闭包对接 |
| M26–M28 | alpha.12 | 终盘收编 36 件 + SDK 客户端族/凭据打码单一真源 + 词表配置化；**M27 兼容层清零**：`kernel-compat/` 更名 `extensions/`，41 件影子删除、47 消费文件改写对接面、死代码 3 处清偿 |
| M29 | alpha.13 | 审计 canonical 收敛内核 `Jcs.serialize` 单一真源（`kernel/receipts/jcs.js`），app 侧第二实现退役 + golden 四例 |
| M30 | alpha.13 | server 自动化收敛 `RoutineScheduler` 调度核心（与 CLI daemon 共享 routines.json），AutomationStore / AutomationScheduler 退役；`automations.*` RPC 形状不变 |
| M31（2026-11-08） | alpha.14 | 对接收口：`CryptoVault` / `EnvVault` 从 extensions 迁回对接面（内核已承诺，app 旧版缺 scrypt/legacy 修复）；删除 `extensions/kernel/adapters/index.ts` 纯再导出桶（70 条 → 仅 3 条有消费者）；`governance.rollbackTargets` 冗余 RPC 删除；门禁新增第 9 条「已承诺能力无同名副本」 |
| M32（2026-11-08 傍晚） | alpha.14 | 影子清零终盘：修复第 9 条的两处漏检（curated 键拼成目录、再导出桶未解析）后，`IsolationLadderFactory` / `SdkPreferredMcpConnector` / `SessionGc` / `SessionStorageLocation` / `TmpSweep` + 6 类型共 11 个名字判红；删除 5 件影子（约 760 行），消费点改经 `maintenance` / `adapters-sandbox` / `adapters-misc` 对接面，生成器支持 curated 子路径落点；登记表清零，新增桶再导出回归判据 |
| M33（2026-11-08 夜） | alpha.15 | 内核 P1 信任边界收敛 + 16 件 L0 清零 + MCP 反向请求 + 覆盖率收紧 + 跨仓消费契约层；app 重新 vendor 到 alpha.15（对接面/域文件/符号数零变化，`kernel:check` 九条复绿） |

对接面规模随迁移演化：alpha.6 时代 349 源文件 / 316 处导入 / 17 域 → M30 收官 267/361/18 →
2026-11-08 上午清死桶 `src/indexBeta.ts`（从未接线的 beta 发布面，消费 45 处内核符号却零被消费）
并把模型探针/注入度量收编进 `eval` 域后 263/318/18 → 同日下午 M31 收口（迁走 2 件影子、
删 1 个 compat 桶与 2 个旧实现文件）后 260/287/18 → 傍晚 M32 收口（删 5 件影子、加 1 个
`maintenance` 域）后 **274 源文件 / 288 处导入 / 19 域**（对接面 408 符号 / 241 条模块落点：
238 条深路径 + 3 个 curated 子路径）。内核**已承诺**能力的影子由此**真正**清零：
M31 的账把 5 件「内核未承诺」自留件登记在案，M32 复核发现它们早就在 `./sandbox` / `./mcp` /
`./maintenance` 的**再导出桶**里被承诺——旧扫描只认 `.d.ts` 直接声明才漏检。现在业务对内核的
全部需求都涌向单点对接面，无第二份实现可逃逸。

## 3. 为什么升级内核是「四步例行公事」

内核自 alpha.5 起执行「应用形状清零」：plugin / asset / media / A2A / enterprise / Laya 等
能力陆续从内核切片删除。这个曾经阻止升级的问题，已被 M21–M31 的迁移结构性解决：

- 内核确实承诺的能力 → 直接用（经对接面）；
- 内核切片删除、app 仍需要的能力 → `src/host/extensions/` 自有（不要求内核兼容）；
- 随内核退役的能力（如 A2A v0.3 线格式）→ 删除，等 v1.0 重基后按新契约另行接入。

因此升级不再被「少功能」阻止，且**每次升级只适配 `src/host/kernel/` 一个目录**：

```text
① 改 package.json 钉新 tgz（或 npm run kernel:vendor 重建钉定）
② npm run kernel:surface   重新生成对接面
③ npm run typecheck        指出真正不兼容的符号（只适配对接面与个别消费点）
④ npm run verify           全链验收
```

M22–M31 的每一轮内核升级都走的这条回路，常态业务代码零改动。

## 4. 门禁：`npm run kernel:check`（9 条判据）

1. `package.json` 的 `@omniharness/kernel` 必须是 `file:vendor/*.tgz`；
2. 仓库根不得存在 `src/{kernel,contracts,protocols}`；
3. `src/**` 不得有解析到这三个目录的相对导入；
4. `src/host/kernel/` 必须存在包导入（防止「只改配置、代码没用上」）；
5. `vendor/*.tgz` 的 SHA-512 必须等于 `package-lock.json` 的 integrity；
6. `NativeKernel.available() === true` 且 `ping()` 成功；
7. **对接面单点**：`src/**` 里只有 `src/host/kernel/<域>.ts` 允许导入内核包；
8. **对接面不漂移且纯净**：19 个域文件必须与「业务代码实际 import + 内核包 `.d.ts`」一致，
   且 `src/host/kernel/` 内只允许这些生成物（实现/子目录一律不收）；只改业务 import 不跑
   `npm run kernel:surface` 即红。
9. **已承诺能力无同名副本**：`src/host/extensions/**` 声明的符号名不得与内核 `exports` 承诺
   模块的 `.d.ts` 导出名重合——内核已经承诺的能力必须经对接面消费，自留一份即影子回归
   （2026-11-08 由 `CryptoVault` / `EnvVault` 滞留问题催生）。承诺面解析**必须穿透 curated
   子路径的再导出桶**（`./sandbox` / `./mcp` / `./maintenance` 的 `.d.ts` 形如
   `export { X } from './…'`）——只扫 `export class …` 直接声明会让桶里承诺的能力整类漏检，
   M31 登记的 5 件「内核未承诺」自留件就是由此暴露的（M32 已清零）。生成器解析同一份桶
   （符号落 curated 子路径），所以对接面里可以同时出现深路径与 3 个 curated 入口。

生成器只保留业务实际使用的符号：新增内核符号的姿势是**在业务代码里正常 import**，再跑
`npm run kernel:surface`（无需手写 re-export）；已无使用的符号会被裁掉。`kernel:check`
第 8 条是这条工作流的唯一裁决点（`tests/kernelSurface.test.ts` 把「生成物一致 + 目录纯净」
纳入常规 `web:test`，忘了跑生成命令本地测试也直接红）；第 9 条不依赖生成器，直接比对
内核承诺面与 extensions 声明名——实现在 `scripts/kernelShadowScan.mjs`，`tests/kernelShadowScan.test.ts`
以子进程跑同一份实现（并断言两侧计数，防「扫描器扫空也算绿」），所以 `web:test` 同样会红。

重建发行物：`npm run kernel:vendor`（tag 缺省从 package.json 钉定版本解析——
「再 vendor 一次当前版本」永远可复现，不存在脚本缺省 tag 与钉版本漂移）。

## 5. 已知边界与风险

- **分域而非单文件桶**：实测根入口整包加载 ~780ms vs 单深路径 ~60ms（Node 22）——
  单文件桶会给每个 CLI 冷启动平添 ~700ms；升级内核时按域增删符号即可。
- **extensions 是 app 自有层**：内核升级**不**需要同步它；某模块若回归内核，
  删除 app 侧文件并把消费点改指对接面即可（M22–M27 的 85 件影子就是按这条退役的，
  M31 的 `CryptoVault`/`EnvVault`、M32 的维护/隔离/MCP 5 件是同一动作的最新几例）。
  内核**已承诺**能力若在这里再出现同名实现，门禁第 9 条直接红——注意承诺面包括
  `./sandbox` / `./mcp` / `./maintenance` 子路径的**再导出桶**，扫描必须穿透桶，
  否则会出现「门禁全绿、影子照留」的假绿（M31 的登记表就是这么来的）。
- **curated 子路径不做深路径承诺**：`IsolationLadderFactory` / `SdkPreferredMcpConnector` /
  `SessionGc` 等由桶承诺，对接面生成器把它们落到 `@omniharness/kernel/<桶>`，不新增深路径
  条目——深路径是「应用消费闭包」的生成产物，不该被单个消费者倒逼膨胀。
- **vendored tarball 是二进制发行物**：不是 `npm publish` 的产物。用 `kernel:vendor`
  重建，`kernel:check` 钉 integrity；不要手工改 tarball。
- **桌面打包**：`stageHarness.mjs` 会把 `vendor/` 一起带进 `.desktop-stage`，否则 stage 内
  `npm ci` 无法解析 `file:` 依赖。
- **原生内核**：随 tarball 分发；内核升级必须用 `kernel:vendor` 重新注入与应用 ABI 匹配的
  `native/omni_napi.node`，否则门禁第 6 条会红。

## 6. 证据（2026-11-08，M31 收口后全链复跑）

| 检查 | 结果 |
| ---- | ---- |
| `npm run typecheck`（后端 / 前端 / 桌面） | ✅ 0 error |
| `npm run kernel:check` | ✅ 274 源文件 / 288 处包导入（19 域，全部收敛对接面）/ 内嵌副本 0 / integrity 一致 / native ping / 生成物一致 / extensions 无已承诺影子 |
| `npm run build` + `npm run smoke` | ✅ 8/8（banner token、healthz、readyz、HTML、config.get、sessions.list、原生内核实载） |
| `npm run web:test` | ✅ 180 文件 / 828 用例（web 772 + 后端 56；含 parity/守卫/家具/golden/影子扫描） |
| `npm run desktop:build` + `desktop:test` | ✅ 36/36 |
| 嵌入 API 实测 | ✅ `createOmniHarness` 启动 / healthz 200 / RPC 往返 / 优雅关闭（tests/embedApi.test.ts 常规跑） |
