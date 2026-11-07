# 本仓与内核（`@omniharness/kernel`）的契约

> 实测日期 2026-11-07。**结论**：应用消费 vendored `@omniharness/kernel@0.1.0-alpha.13`，
> 全部内核导入收敛于 **`src/host/kernel/` 分域对接面**（17 个**自动生成**的域文件，
> `npm run kernel:check` 第 7 条强制单点、第 8 条拒绝生成物漂移）；内核切片清掉、
> app 仍需要的能力收留于 **`src/host/extensions/`**（app 自有扩展层，原 `kernel-compat/`，
> M27 兼容层清零后更名；归属契约见[其 README](../src/host/extensions/README.md)）。
> 后端 RPC 面由 **16 个域模块声明式注册**（93 方法，parity 快照钉住）。

## 1. 现在的依赖方向

```text
web/ + desktop/ ──HTTP/SSE──▶ src/apps（宿主：CLI / RPC 域模块 / 会话 / 审批 / 插件宿主 / 嵌入 API）
                                   │
                                   ├─▶ src/host/kernel/            ★ 唯一内核导入点（17 域）
                                   │      core / config / util / adapters-* / plugin / …
                                   │
                                   ├─▶ src/host/extensions/        app 自有扩展层
                                   │      Laya 决策引擎 / CLI worker / doctor / 图存储 / web 广播 / …
                                   │
                                   └─▶ @omniharness/kernel@0.1.0-alpha.13（vendored tarball）
                                          ├─ dist/kernel/**        主循环 / 编排单源 / 工具 / 门禁 / 存储 / Jcs
                                          ├─ dist/contracts/**     端口 / 类型 / schema
                                          ├─ dist/protocols/**     ACP / MCP
                                          └─ native/omni_napi.node 原生内核（随包）
```

- `src/**` 只有 `src/host/kernel/<域>.ts` 允许 `import '@omniharness/kernel…'`；
  业务代码（含 `src/host/extensions/`）一律经对接面消费——全仓不出现内核包名
  （实测 265 源文件 / 316 处包导入全部命中，`kernel:check` 实载验证）。
- `src/host/kernel/` 只放**自动生成**的 17 个分域 re-export，**不放实现**
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

对接面规模随迁移演化：alpha.6 时代 349 源文件 / 316 处导入 / 17 域 → M30 收官 267/361/18 →
2026-11-08 清偿死桶 `src/indexBeta.ts`（从未接线的 beta 发布面，消费 45 处内核符号却零被消费）后
**265 源文件 / 316 处导入 / 17 域**。影子副本清零后，业务对内核的全部需求涌向单点对接面，无第二份实现可逃逸。

## 3. 为什么升级内核是「四步例行公事」

内核自 alpha.5 起执行「应用形状清零」：plugin / asset / media / A2A / enterprise / Laya 等
能力陆续从内核切片删除。这个曾经阻止升级的问题，已被 M21–M30 的迁移结构性解决：

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

M22–M30 的每一轮内核升级都走的这条回路，常态业务代码零改动。

## 4. 门禁：`npm run kernel:check`（8 条判据）

1. `package.json` 的 `@omniharness/kernel` 必须是 `file:vendor/*.tgz`；
2. 仓库根不得存在 `src/{kernel,contracts,protocols}`；
3. `src/**` 不得有解析到这三个目录的相对导入；
4. `src/host/kernel/` 必须存在包导入（防止「只改配置、代码没用上」）；
5. `vendor/*.tgz` 的 SHA-512 必须等于 `package-lock.json` 的 integrity；
6. `NativeKernel.available() === true` 且 `ping()` 成功；
7. **对接面单点**：`src/**` 里只有 `src/host/kernel/<域>.ts` 允许导入内核包；
8. **对接面不漂移且纯净**：17 个域文件必须与「业务代码实际 import + 内核包 `.d.ts`」一致，
   且 `src/host/kernel/` 内只允许这些生成物（实现/子目录一律不收）；只改业务 import 不跑
   `npm run kernel:surface` 即红。

生成器只保留业务实际使用的符号：新增内核符号的姿势是**在业务代码里正常 import**，再跑
`npm run kernel:surface`（无需手写 re-export）；已无使用的符号会被裁掉。`kernel:check`
第 8 条是这条工作流的唯一裁决点（`tests/kernelSurface.test.ts` 把「生成物一致 + 目录纯净」
纳入常规 `web:test`，忘了跑生成命令本地测试也直接红）。

重建发行物：`npm run kernel:vendor`（tag 缺省从 package.json 钉定版本解析——
「再 vendor 一次当前版本」永远可复现，不存在脚本缺省 tag 与钉版本漂移）。

## 5. 已知边界与风险

- **分域而非单文件桶**：实测根入口整包加载 ~780ms vs 单深路径 ~60ms（Node 22）——
  单文件桶会给每个 CLI 冷启动平添 ~700ms；升级内核时按域增删符号即可。
- **extensions 是 app 自有层**：内核升级**不**需要同步它；某模块若回归内核，
  删除 app 侧文件并把消费点改指对接面即可（M22–M27 的 85 件影子就是按这条退役的）。
- **vendored tarball 是二进制发行物**：不是 `npm publish` 的产物。用 `kernel:vendor`
  重建，`kernel:check` 钉 integrity；不要手工改 tarball。
- **桌面打包**：`stageHarness.mjs` 会把 `vendor/` 一起带进 `.desktop-stage`，否则 stage 内
  `npm ci` 无法解析 `file:` 依赖。
- **原生内核**：随 tarball 分发；内核升级必须用 `kernel:vendor` 重新注入与应用 ABI 匹配的
  `native/omni_napi.node`，否则门禁第 6 条会红。

## 6. 证据（2026-11-07）

| 检查 | 结果 |
| ---- | ---- |
| `npm run typecheck`（后端 / 前端 / 桌面） | ✅ 0 error |
| `npm run kernel:check` | ✅ 265 源文件 / 316 处包导入（17 域，全部收敛对接面）/ 内嵌副本 0 / integrity 一致 / native ping / 生成物一致 |
| `npm run build` + `npm run smoke` | ✅ 7/7（banner token、healthz、readyz、HTML、config.get、sessions.list、原生内核实载） |
| `npm run web:test` | ✅ 158 文件 / 755 用例（web 149 + 后端 9；含 parity/守卫/家具/golden） |
| `npm run desktop:build` + `desktop:test` | ✅ 30/30 |
| 嵌入 API 实测 | ✅ `createOmniHarness` 启动 / healthz 200 / RPC 往返 / 优雅关闭（tests/embedApi.test.ts 常规跑） |
