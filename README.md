# OmniHarness App

> **独立应用仓：完整后端宿主 + React 工作台 + Electron 桌面端。**
> 内核是 [`@omniharness/kernel`](../omniharness-kernel) 的**固定发行物**（vendored tarball，当前 `0.1.0-alpha.16`），
> 应用经 `src/host/kernel/` **分域对接面**消费内核（全仓唯一的包导入点，门禁强制），
> app 自有能力收留在 `src/host/extensions/`（原 `kernel-compat/`，M27 兼容层清零后更名）。
> 2026-11-04 从 [OmniHarness](https://github.com/mylong227/OmniHarness) 切出并完成内核包迁移（M2），
> M21–M30 已把内核切片期的影子副本退役；2026-11-08 起门禁第 9 条再把「内核**已承诺**能力的
> 同名副本」钉死（`CryptoVault`/`EnvVault` 即由此迁回对接面，M32 又把 5 件按 curated 子路径
> 承诺的维护/隔离/MCP 实现迁回，门前扫描同时补上「再导出桶穿透」）；本仓不依赖上游任何文件。

## 1. 三个部分

| 目录 | 内容 | 规模 |
| ---- | ---- | ---- |
| `src/` | **后端宿主**：HTTP/SSE、JSON-RPC（104 方法，17 个域模块声明式注册）、会话存储、审批/沙箱、插件宿主、CLI、MCP/ACP/AG-UI | `src/apps` + `src/host/kernel/`（19 域对接面）+ `src/host/extensions/`（app 自有扩展层） |
| `web/` | **前端**：React 19 工作台（会话/工具/计划/变更/设置/审计/插件…） | 268 个源文件 + 158 个判据文件 / 772 用例（后端 22 文件 56 用例另计，合计 180 文件 / 828 用例） |
| `desktop/` | **桌面端**：Electron 主进程 + preload（窗口/托盘/菜单/更新/侧车监督） | 31 个源文件，35 条纯逻辑判据 |

运行形态：

```text
Electron main（受信） ──spawn──▶ node dist/src/apps/cli/exec.js serve --port 0
        │                              │  HTTP+SSE 127.0.0.1:<port>（Bearer + HttpOnly Cookie）
        └── BrowserWindow ──load──▶ http://127.0.0.1:<port>/?token=…
                                       ├─ GET  /            → web/dist（Vite 产物）
                                       ├─ POST /rpc         → JSON-RPC 2.0（104 个方法）
                                       ├─ GET  /events      → SSE 事件流
                                       ├─ GET  /files       → 工作区文件
                                       └─ GET  /healthz     → 运行时自述（含 previewPort）
```

后端的「内核」不再由本仓源码提供：全部内核符号经 `src/host/kernel/<域>.ts` 对接面导入
（288 处包导入、19 个**自动生成**的域文件；门禁第 7 条强制单点、第 8 条拒绝生成物漂移、
第 9 条拒绝「已承诺能力的同名副本」）；
桌面的「后端根目录」缺省就是本仓根；`OMNI_BACKEND_ROOT` / `OMNI_HARNESS_ENTRY` 仍可指向
另一份后端工作树。

## 2. 快速开始

```powershell
npm ci                 # 安装依赖（含 vendor/ 内核 tarball；Node >= 22.14）
npm start              # 构建 dist + web/dist，然后起 serve（默认 127.0.0.1:8787）
npm run dev            # 开发回路：后端 serve + Vite dev server（HMR，5173）
```

`npm start` 打印的 `OmniHarness UI: http://127.0.0.1:<port>/?token=…` 是唯一可用入口
（回环 serve 默认带一次性令牌，裸地址会 401）。

### 一键启动 / 一键打包（Windows 双击）

不想记命令时，仓库根有两个双击即可的入口（缺依赖会自动 `npm ci`，失败会停在窗口里显示错误）：

| 文件 | 作用 |
| ---- | ---- |
| `start.cmd` | 构建后端 + 前端，起 serve 并自动打开带 token 的工作台；`start.cmd mock` 用零凭据 mock 模型，`start.cmd desktop` 启动 Electron 桌面应用 |
| `package-desktop.cmd` | 构建后端 + 前端 → stage → electron-builder，产出 `desktop/release/` 下的 NSIS 安装包 |

两者是 `npm start` / `npm run desktop:dist` 的薄包装，参数语义与对应命令一致。

接真模型（缺省 mock 适配器，零凭据可跑）：

```powershell
omniharness init                  # TTY 交互式：选厂商 → 填 Key → 写 ~/.omniharness/omniharness.json
omniharness init --provider deepseek --api-key sk-xxx   # 脚本/CI 直达
omniharness doctor --probe-model  # 环境诊断 + 模型连通性探测
```

桌面端：

```powershell
cd desktop
npm install            # Electron（首次约 100 MB）
npm start              # 构建主进程并启动窗口；后端由侧车自动拉起
```

嵌入到别的 Node 应用（3 行；本包当前 `private`——仓内先 `npm run build` 后经相对路径导入，
发布形态决策见 CONTRIBUTING）:

```ts
// 完整可运行版见 examples/embed-demo.mjs（npm run example:embed，需先 npm run build）
import { createOmniHarness, defineModule } from './dist/src/index.js';
const harness = await createOmniHarness({ transport: { http: { port: 0 } } });
console.log(harness.url);            // http://127.0.0.1:<port>/?token=…
```

## 3. 脚本

| 命令 | 作用 |
| ---- | ---- |
| `npm run build` | 后端：`tsc` → `dist`（原子换入）+ 伴生资源/原生库镜像 |
| `npm run build:web` / `web:dev` | 前端 Vite 构建 / 开发服务器 |
| `npm run web:test` | 判据（前端 158 文件 + 后端 22 文件 / 共 828 用例，文件级串行） |
| `npm run typecheck` | 后端 + 前端 + 桌面三份 strict 类型检查 |
| `npm run kernel:check` | **内核边界门禁（9 条）**：vendored 钉定 / 无内嵌副本 / 对接面单点 / tarball 与锁文件一致 / 原生内核实载 / **对接面生成物不漂移** / **已承诺能力无同名副本** |
| `npm run kernel:surface` | 从「业务代码实际 import + 内核包 .d.ts」生成 19 个域文件（新增符号无需手写 re-export） |
| `npm run kernel:vendor` | 从内核仓重新构建并固定 `vendor/*.tgz`（tag 自 package.json 钉定版本解析） |
| `npm run smoke` | **端到端**：真起 serve，验启动令牌、`/healthz` `/readyz` `/`、`/rpc config.get` |
| `npm run serve` | 只起 backend serve（需先 `npm run build` + `build:web`） |
| `npm run example:embed` | 跑可运行嵌入样例（需先 `npm run build`；见 examples/embed-demo.mjs） |
| `npm run desktop:build` / `desktop:test` | 打包主进程 / 35 条纯逻辑判据 |
| `npm run desktop:smoke` | **真实桌面 GUI 验收**：窗口 / 侧车 / UI origin / DOM 挂载，退出码即结论 |
| `npm run desktop:stage` / `desktop:dist` | 打包资源（含 vendor）/ NSIS 安装包 |
| `npm run verify` | kernel:check → typecheck → 判据 → 后端构建 → 前端构建 → 冒烟 → 桌面构建与判据 |

## 4. 环境变量

| 变量 | 消费方 | 含义 |
| ---- | ------ | ---- |
| `OMNI_BACKEND_PORT` | serve / vite 代理 | 后端端口（默认 8787；`--port` 旗标更高优先） |
| `OMNI_UI_PORT` / `OMNI_DEV_HOST` | vite 代理 | 开发服务器端口 / 回环主机 |
| `OMNI_BACKEND_ORIGIN` | vite 代理 | 整条后端 origin（指向别的后端时用） |
| `OMNI_BACKEND_ROOT` | 桌面主进程 / stage | 后端工作树根（缺省本仓根） |
| `OMNI_HARNESS_ENTRY` | 桌面主进程 | 侧车入口脚本（优先于 backendRoot 推导） |
| `OMNI_NODE_BIN` | 桌面主进程 / stage | 侧车 Node 可执行文件 |
| `OMNI_SERVE_TOKEN` | serve | 固定访问令牌（缺省每次启动随机生成；daemon start 由 CLI 生成并注入子进程） |
| `OMNI_SERVE_HOST` | serve | 绑定主机（缺省 127.0.0.1；非回环必须配 `OMNI_SERVE_TOKEN`，否则拒启） |
| `OMNI_KERNEL_ROOT` / `OMNI_KERNEL_TAG` | `kernel:vendor` | 内核仓位置（缺省 `../omniharness-kernel`）/ 发行 tag（**缺省 = package.json 钉定的版本**，可覆盖） |

## 5. 内核依赖：唯一真源、单点对接

`package.json`：

```json
"dependencies": {
  "@omniharness/kernel": "file:vendor/omniharness-kernel-0.1.0-alpha.16.tgz"
}
```

对接全景——谁在哪里、怎么连、哪条门禁在把守：

```text
package.json 钉定 vendor/omniharness-kernel-0.1.0-alpha.16.tgz
      │  npm ci（lockfile integrity 钉死 tarball —— kernel:check 第 1/5 条）
      ▼
@omniharness/kernel —— vendored 固定发行物（dist/** + native/omni_napi.node 随包）
      │  全仓唯一导入点（kernel:check 第 7 条强制）
      ▼
src/host/kernel/<域>.ts —— 19 个自动生成的分域 re-export，无实现
      │  （kernel:surface 生成，第 8 条拒绝漂移、第 9 条拒绝已承诺能力的同名副本；
      │   分域而非单文件桶，避免 CLI 冷启动 ~700ms 税）
      ├─▶ src/apps/**             宿主：17 个 RPC 域模块（104 方法）+ CLI + 嵌入 API
      └─▶ src/host/extensions/**  app 自有扩展层：Laya 决策引擎 / CLI worker / doctor /
                                 图存储 / web 广播…（同样禁止直接 import 内核包名）
```

- **对接只有一条路**：业务代码一律 `import { X } from '<相对路径>/host/kernel/<域>.js'`，
  全仓不出现 `@omniharness/kernel` 包名（实测 274 源文件 / 288 处包导入全部命中对接面）。
  新增内核符号的姿势：在业务代码里正常 import 包名 → 跑一次 `npm run kernel:surface`
  生成/扩充对应域文件 → 提交生成物（忘了跑，`kernel:check` 第 8 条与
  `tests/kernelSurface.test.ts` 都会红）。
- **`src/host/extensions/`（app 自有扩展层，原 `kernel-compat/`）**：M22–M27 迁移后，
  内核形状的影子副本已全部退役（plugin 域 44 件、终批 41 件删除；36 件收编回归内核），
  目录只剩真应用形状的实现；2026-11-08 M31 `CryptoVault` / `EnvVault`、M32 维护/隔离/MCP
  共 5 件迁回对接面后，内核**已承诺**能力的同名副本为 **0**（门禁第 9 条把守）。
  归属契约见[其 README](src/host/extensions/README.md)：
  app 自有、随 app 演进、不得反向要求内核兼容。
- **104 个 RPC 方法**由 `src/apps/server/modules/` 的 17 个域模块声明式注册
  （parity 快照 `tests/serverModulesParity.test.ts` 钉住全表）；stdio 与 serve 两条组合根
  共用 `composedServerCore()` 不变量核心（历史「serve 漏接 doctor」缺陷类已结构性消灭）。
- **原生内核随包**：内核 tarball 包含 `native/omni_napi.node`（`kernel:vendor` 注入），
  `NativeKernel.available() === true`，`kernel:check` 会实载并 ping。
- **升级回路（四步，常态业务代码零改动）**：
  ① 改 package.json 钉新 tgz（或 `npm run kernel:vendor` 从内核仓构建钉定，tag 缺省自
  package.json 解析）→ ② `npm run kernel:surface` 重新生成对接面 → ③ `npm run typecheck`
  指出真正不兼容的符号（只适配对接面与个别消费点）→ ④ `npm run verify` 全链验收。
  细节见 [docs/KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。

## 6. 扩展指南（三种方式，按介入深度递增）

| 方式 | 适合 | 最少改动 |
| ---- | ---- | ---- |
| **插件**（`omni.plugin.json` + `~/.omniharness/plugins`） | 第三方能力包：加工具/服务，**可注册新 RPC 方法**（需声明危险权限 `rpc.register`，缺省拒绝） | 一个 JS 文件 + manifest；`plugin load --file …` 安装 |
| **技能**（`omniharness.json` 的 `skills` 数组 / `--skills` / `SKILL.md`） | 只改提示词与流程，不写代码 | 一段 JSON 或一个 markdown |
| **模块**（`src/apps/server/modules/` 或嵌入方 `defineModule`） | 一等能力：新 RPC 域、新服务 | 新建 1 个模块文件 + `modules/index.ts` 登记 1 行；嵌入方 0 行（`createOmniHarness({ modules })`） |

加一个新 RPC 能力的完整清单：`modules/<域>.ts` 写 `ctx.rpc('x.y', handler)` →
（可选）在 `tests/serverModulesParity.test.ts` 快照补方法名 →（可选）`web/src/core/ApiClient.ts` 加客户端方法。
冲突（两处注册同名）在启动期即抛错。

## 7. 今日实测（2026-11-08，本机 Node 22.20 / Windows；2026-11-08 审计修复后全链复跑）

| 检查 | 结果 |
| ---- | ---- |
| 三份 typecheck（后端 / 前端 / 桌面） | ✅ 0 error |
| `npm run kernel:check` | ✅ 274 源文件 / 288 处包导入（19 域对接面，全部收敛）/ 内嵌副本 0 / tarball integrity 一致 / 原生内核实载 / 生成物一致 / extensions 无已承诺影子 |
| 后端构建 `npm run build` | ✅ dist 原子换入；原生内核可加载 |
| 前端构建 `npm run build:web` | ✅ 单入口 + vendor/panel-antd 分块 |
| 判据 `npm run web:test` | ✅ 180 文件 / 828 用例（含 parity/守卫/家具/嵌入 API/JCS golden/审计修复/影子扫描判据） |
| 端到端 `npm run smoke` | ✅ 7/7（banner token、`/healthz`、`/readyz`、`/` HTML、`/rpc config.get`、`sessions.list`、原生内核实载） |
| 桌面 `desktop:build` + `desktop:test` | ✅ 35/35（含 ipcGuards 三组 + CSP 哈希门禁） |
| 嵌入 API 实测 | ✅ `createOmniHarness` 启动 / healthz 200 / RPC 往返 / 优雅关闭（另有自动判据 tests/embedApi.test.ts） |
| `rpc.list` 自描述 | ✅ 一次调用返回 92~104 个方法 → 归属模块/插件（打包/嵌入形态少 5 个市场方法属正常） |

## 8. 与上游 / 内核仓的关系

- 应用代码来自上游 `OmniHarness@main`（0.4.0）；本仓的仓库级解耦、内核包迁移（M2）、
  模块化重构与 M21–M30 影子清零迁移用 `git log` 可审。
- 内核来自 `../omniharness-kernel` 的 `v0.1.0-alpha.16` tag；`vendor/*.tgz` 是它的发行物，
  **不是**第二份源码。重建用 `npm run kernel:vendor`（tag 缺省自 package.json 解析）。
- 上游的 `tests/`、`crates/`、`third-party/`、看板与审计脚本没有切过来：本仓的判据是
  828 用例（web 772 + 后端 56）+ 桌面 36 条 + 冒烟 8 条 + 内核边界 9 条。

## License

Apache-2.0。见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
