# 本仓与内核（`@omniharness/kernel`）的契约

> 实测日期 2026-11-04。**结论**：迁移已完成——应用不再有 `src/{kernel,contracts,protocols}`
> 内嵌副本，后端核心从 `vendor/omniharness-kernel-0.1.0-alpha.4.tgz` 导入；应用只保留
> **30 个内核明确不发布的应用形状模块**（`src/host/`）。`npm run kernel:check` 是这条边界的机检。

## 1. 现在的依赖方向

```text
web/ + desktop/ ──HTTP/SSE──▶ src/apps（宿主：CLI / RPC / 会话 / 审批 / 插件宿主）
                                   │
                                   ├─▶ src/host（30 个应用形状模块：OIDC / license / tui /
                                   │              codegen / SDK / Laya / toolHandler / A2A 补充）
                                   │
                                   └─▶ @omniharness/kernel@0.1.0-alpha.4（vendored tarball）
                                          ├─ dist/kernel/**        主循环 / 工具 / 门禁 / 存储 / 审计
                                          ├─ dist/contracts/**     端口 / 类型 / schema
                                          ├─ dist/protocols/**     ACP / MCP / AG-UI / A2A
                                          └─ native/omni_napi.node 原生内核（随包）
```

- 应用**不**再通过相对路径穿透内核；`src/**` 的 649 处导入都指向包路径。
- `src/host/**` 内部允许相对导入——它们指向 `src/host/contracts/**` 等同层文件，不是内嵌副本。
- 内核包内的 `kernel/composition/{runtime,serviceKeys,a2aBridge}.ts`、`kernel/rpc/jsonRpc.ts`、
  `kernel/transport/**` 是内核仓自带的宿主装配件；本应用使用自己的
  `src/apps/composition` 与 `src/apps/server/transport`，不依赖这些重复实现。

## 2. 迁移规模（可复核）

| 指标 | 数值 | 复核方式 |
| ---- | ---- | -------- |
| 原 `src/apps` 对内核的相对导入 | 421 处 / 104 文件 | 迁移前 `Select-String`（旧文档基线） |
| 迁移后 `src/**` 包导入 | **649 处 / 200 个源文件** | `npm run kernel:check` |
| 删除的内嵌文件 | **1163 个**（`src/{kernel,contracts,protocols}` 全量文件，含非 TS） | `git diff --name-only HEAD -- src/kernel src/contracts src/protocols` |
| 删除行数 | 144,585 行 | `git diff --stat HEAD` |
| `src/host` 应用形状模块 | **30 个文件**（29 `.ts` + `laya_infer.py`） | `Get-ChildItem src/host -Recurse -File` |
| vendored 内核包 | `omniharness-kernel-0.1.0-alpha.4.tgz`（含原生内核） | `src/../vendor/` |

## 3. 为什么钉 alpha.4，而不是当前 alpha.6

内核 alpha.5 的「应用形状清零」删除了本应用仍在使用的整棵能力：

- `kernel/plugin/**`（插件宿主 / 打包 / 签名 / 权限）
- `kernel/asset/**`（资产包 / WASM 技能包）
- `kernel/media/**` 与 `protocols/a2a` 的部分实现
- `kernel/adapters/laya`、`kernel/adapters/enterprise`、`kernel/sdk`
- `contracts/ports/{license,tui,daemon,enterprise,server/audit*}` 等应用契约

alpha.4 是**最后一个完整面**，也是内核仓为「第一个消费者迁移」发布的 subpath bridge
（`package.json#exports` 的 `./*` / `./*.js` 就是为此加的）。在应用侧完成这些模块的归位之前，
升到 alpha.5/6 会把「能跑」换成「少功能」，所以本次选择 alpha.4 并把差异固定在锁定文件里。

**升级触发条件**（满足任一再做）：

1. 内核把插件/资产/A2A/企业能力重新收编并进入公开面或稳定子路径；
2. 应用把 `src/host` 的对应模块迁到应用自己的服务层（不再依赖内核内部路径）；
3. 本应用不再提供这些功能（明确砍需求），此时可删 host 模块并升 alpha.6。

## 4. `src/host` 清单（30 个文件，按归位方向分组）

| 组 | 文件 | 为什么在本仓 |
| -- | ---- | ------------ |
| 企业 OIDC | `contracts/ports/enterprise/*`（5）、`kernel/adapters/enterprise/{joseIdTokenVerifier,openIdClientFlow}.ts` | alpha.3 起被内核判为应用形状；CLI/企业登录仍在用 |
| License | `contracts/ports/license/{entitlement,licenseTier}.ts` | 商业授权属于应用域 |
| TUI | `contracts/ports/tui/{tuiEvent,tuiEventKind,tuiTaskRunner}.ts` | TUI 是应用外壳，不是内核 |
| 服务端审计 | `contracts/ports/server/{auditFormat,auditQuery}.ts` | Web 审计查询面属于宿主 |
| 代码生成 | `contracts/schema/codeGenerator.ts` | 生成 CLI/协议代码，依赖应用的 schema 清单 |
| SDK | `contracts/sdk/{sdkClient,webSocketSdkSocket}.ts` | 面向本应用 RPC 的客户端 |
| Laya 决策引擎 | `kernel/adapters/laya/*`（10 个 `.ts` + `laya_infer.py`）、`kernel/config/decisionEngineResolver.ts` | 第三方 venv/权重绑定，内核 alpha.2 起移出；由应用在装配期注入 `decisionEnginePort` |
| 工具类型 | `kernel/adapters/tool/toolHandler.ts` | 仅做类型转出口，内核已把契约移到 `contracts/ports/tool/toolHandler.ts` |
| A2A 补充 | `protocols/a2a/{a2aProtocol,a2aTaskHandler}.ts` | 应用侧对 A2A v0.3 的兼容类型/处理器 |

> 这些文件不是「复制内核」：它们在内核 alpha.4 的源码树里**不存在**。
> `src/host` 的导入若指向内核已有模块，一律走包路径（如 `@omniharness/kernel/kernel/util/logger.js`）。

## 5. 迁移时做的三件非机械改动

1. **决策引擎注入**：alpha.2 起 `ConfigFactory` 不再内置 Laya；生产入口默认 `shadow`，
   不注入会 fail-closed。`src/apps/cli/cliConfigSections.ts#decisionEnginePort()` 把
   `DecisionEngineResolver` 构造的实例注入 `ConfigFactory.build`。
2. **A2A 生产默认**：alpha.4 的 `A2aTaskExecutor` 要求 `buildSubagent / runTask / filterTools`
   三项注入。组合根改用内核 `kernel/composition/a2aBridge.js` 的
   `a2aBuildSubagent / a2aRunTask / a2aFilterTools`，不再依赖已删除的默认实现。
3. **默认数据锚点**：`cliHelp.json` 是应用资产（alpha.3 从内核删除）。`cliHelp.ts` 改用
   应用仓根的 `BuiltinDefaults.locatePackageRoot(...)`；其余 `defaults/*.json` 与内核包内容
   逐字节一致（`git diff` 仅差 `cliHelp.json`）。

## 6. 门禁：`npm run kernel:check`

六条判据（任一失败退出码 1，`verify` 的第二道）：

1. `package.json` 的 `@omniharness/kernel` 必须是 `file:vendor/*.tgz`；
2. 仓库根不得存在 `src/{kernel,contracts,protocols}`；
3. `src/**` 不得有解析到这三个目录的相对导入；
4. `src/**` 必须存在包导入（防止「只改配置、代码没用上」）；
5. `vendor/*.tgz` 的 SHA-512 必须等于 `package-lock.json` 的 integrity；
6. `NativeKernel.available() === true` 且 `ping()` 成功。

重建发行物：`npm run kernel:vendor`（默认从 `../omniharness-kernel` 的 `v0.1.0-alpha.4`
建 worktree、build、注入 `native/omni_napi.node`、补 `files`、pack、更新 lock）。

## 7. 已知边界与风险

- **alpha.4 与 alpha.6 的 API 差异**：alpha.4 的 `AgentPort` 已带 `sessionId` /
  `cancelCurrentRun`，`A2aTaskExecutor` 改为注入式；本仓已按 alpha.4 适配。若升 alpha.6，
  需重跑 `npm run typecheck` 并复核 `agentPort` / `a2a` / 插件面。
- **vendored tarball 是二进制发行物**：不是 `npm publish` 的 alpha.4。用 `kernel:vendor`
  重建，`kernel:check` 钉 integrity；不要手工改 tarball。
- **桌面打包**：`stageHarness.mjs` 会把 `vendor/` 一起带进 `.desktop-stage`，否则 stage 内
  `npm ci` 无法解析 `file:` 依赖；这是迁移后新增的打包前提。
- **原生内核**：随 tarball 分发；若内核升级，必须用 `kernel:vendor` 重新注入与应用 ABI 匹配的
  `native/omni_napi.node`，否则 `kernel:check` 第 6 条会红。

## 8. 证据

| 检查 | 结果 |
| ---- | ---- |
| `npm run typecheck`（后端 / 前端 / 桌面） | ✅ 0 error |
| `npm run kernel:check` | ✅ 200 源文件 / 649 包导入 / 内嵌副本 0 / integrity 一致 / native ping |
| `npm run build` + `npm run smoke` | ✅ 7/7（banner token、healthz、readyz、HTML、config.get、sessions.list、原生内核实载） |
| `npm run web:test` | ✅ 145 文件 / 717 用例 |
| `npm run desktop:build` + `desktop:test` | ✅ 25/25 |
| `npm run desktop:smoke` | ✅ 8/8：真实桌面窗口 / 侧车 / UI origin / DOM 挂载（见 [DESKTOP-SMOKE.md](DESKTOP-SMOKE.md)） |
| `npm run desktop:stage` + staged serve | ✅ 251 个生产依赖；staged `NativeKernel` 可加载，`/healthz` `/readyz` `/rpc` 全 200 |
