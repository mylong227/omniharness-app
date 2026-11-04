# OmniHarness App

> **独立应用仓：完整后端宿主 + React 工作台 + Electron 桌面端。**
> 内核是 [`@omniharness/kernel`](../omniharness-kernel) 的**固定发行物**（vendored tarball），
> 应用仓不再内嵌 `src/{kernel,contracts,protocols}` 副本。
> 2026-11-04 从 [OmniHarness](https://github.com/mylong227/OmniHarness) 切出，并完成内核包迁移；
> 本仓不依赖上游任何文件。

## 1. 三个部分

| 目录 | 内容 | 规模 |
| ---- | ---- | ---- |
| `src/` | **后端宿主**：HTTP/SSE、JSON-RPC（87 方法）、会话存储、审批/沙箱、插件宿主、CLI、MCP/ACP/AG-UI。内核核心从 `@omniharness/kernel` 导入 | 167 个 `src/apps` 文件 + 30 个 `src/host` 应用形状模块 |
| `web/` | **前端**：React 19 工作台（会话/工具/计划/变更/设置/审计/插件…） | 252 个源文件 + 145 个判据文件 / 717 用例 |
| `desktop/` | **桌面端**：Electron 主进程 + preload（窗口/托盘/菜单/更新/侧车监督） | 30 个源文件，25 条纯逻辑判据 |

运行形态：

```text
Electron main（受信） ──spawn──▶ node dist/src/apps/cli/exec.js serve --port 0
        │                              │  HTTP+SSE 127.0.0.1:<port>（Bearer + HttpOnly Cookie）
        └── BrowserWindow ──load──▶ http://127.0.0.1:<port>/?token=…
                                       ├─ GET  /            → web/dist（Vite 产物）
                                       ├─ POST /rpc         → JSON-RPC 2.0（87 个方法）
                                       ├─ GET  /events      → SSE 事件流
                                       ├─ GET  /files       → 工作区文件
                                       └─ GET  /healthz     → 运行时自述（含 previewPort）
```

后端的「内核」不再由本仓源码提供：`src/apps` 与 `src/host` 都从
`node_modules/@omniharness/kernel` 的内核模块导入。桌面的「后端根目录」缺省就是本仓根；
`OMNI_BACKEND_ROOT` / `OMNI_HARNESS_ENTRY` 仍可指向另一份后端工作树。

## 2. 快速开始

```powershell
npm ci                 # 安装依赖（含 vendor/ 内核 tarball；Node >= 22.14）
npm start              # 构建 dist + web/dist，然后起 serve（默认 127.0.0.1:8787）
npm run dev            # 开发回路：后端 serve + Vite dev server（HMR，5173）
```

`npm start` 打印的 `OmniHarness UI: http://127.0.0.1:<port>/?token=…` 是唯一可用入口
（回环 serve 默认带一次性令牌，裸地址会 401）。

桌面端：

```powershell
cd desktop
npm install            # Electron（首次约 100 MB）
npm start              # 构建主进程并启动窗口；后端由侧车自动拉起
```

## 3. 脚本

| 命令 | 作用 |
| ---- | ---- |
| `npm run build` | 后端：`tsc` → `dist`（原子换入）+ 伴生资源/原生库镜像 |
| `npm run build:web` / `web:dev` | 前端 Vite 构建 / 开发服务器 |
| `npm run web:test` | 前端判据（145 文件 / 717 用例，文件级串行） |
| `npm run typecheck` | 后端 + 前端 + 桌面三份 strict 类型检查 |
| `npm run kernel:check` | **内核边界门禁**：无内嵌副本 / 包导入非空 / tarball 与锁文件一致 / 原生内核实载 |
| `npm run kernel:vendor` | 从内核仓 tag 重新构建并固定 `vendor/*.tgz`（同时更新 lock integrity） |
| `npm run smoke` | **端到端**：真起 serve，验启动令牌、`/healthz` `/readyz` `/`、`/rpc config.get` |
| `npm run serve` | 只起 backend serve（需先 `npm run build` + `build:web`） |
| `npm run desktop:build` / `desktop:test` | 打包主进程 / 25 条纯逻辑判据 |
| `npm run desktop:smoke` | **真实桌面 GUI 验收**：窗口 / 侧车 / UI origin / DOM 挂载，退出码即结论 |
| `npm run desktop:stage` / `desktop:dist` | 打包资源（含 vendor）/ NSIS 安装包 |
| `npm run verify` | typecheck → kernel:check → 前端判据 → 后端构建 → 前端构建 → 冒烟 → 桌面构建与判据 |

## 4. 环境变量

| 变量 | 消费方 | 含义 |
| ---- | ------ | ---- |
| `OMNI_BACKEND_PORT` | serve / vite 代理 | 后端端口（默认 8787；`--port` 旗标更高优先） |
| `OMNI_UI_PORT` / `OMNI_DEV_HOST` | vite 代理 | 开发服务器端口 / 回环主机 |
| `OMNI_BACKEND_ORIGIN` | vite 代理 | 整条后端 origin（指向别的后端时用） |
| `OMNI_BACKEND_ROOT` | 桌面主进程 / stage | 后端工作树根（缺省本仓根） |
| `OMNI_HARNESS_ENTRY` | 桌面主进程 | 侧车入口脚本（优先于 backendRoot 推导） |
| `OMNI_NODE_BIN` | 桌面主进程 / stage | 侧车 Node 可执行文件 |
| `OMNI_SERVE_TOKEN` | serve | 固定访问令牌（缺省每次启动随机生成） |
| `OMNI_KERNEL_ROOT` / `OMNI_KERNEL_TAG` | `kernel:vendor` | 内核仓位置（缺省 `../omniharness-kernel`）/ 发行 tag（缺省 `v0.1.0-alpha.4`） |

## 5. 内核依赖：唯一真源与固定版本

`package.json`：

```json
"dependencies": {
  "@omniharness/kernel": "file:vendor/omniharness-kernel-0.1.0-alpha.4.tgz"
}
```

- **为什么是 alpha.4**：这是内核仓最后一个仍包含本应用所需完整面的发行物
  （插件宿主、媒体/资产、A2A、belief、laya 注入缝等）。alpha.5 起内核按「应用形状清零」
  删除了这些能力；应用要么自己拥有它们，要么等内核重新收编。本次选择前者。
- **30 个 `src/host` 文件**是应用形状的残留（OIDC/企业、license/tui 契约、
  schema codegen、SDK client、Laya 决策引擎、toolHandler、A2A 协议补充、决策引擎注入解析）。
  它们**不是**内嵌内核副本：内核 alpha.4 已明确不发布这些模块，应用必须自己拥有。
- **649 处包导入 / 1163 个内嵌文件删除**：`src/{kernel,contracts,protocols}` 已从工作树移除
  （历史仍在 git 里，可审计）。
- **原生内核随包**：内核 tarball 包含 `native/omni_napi.node`（`kernel:vendor` 注入），
  `NativeKernel.available() === true`，`kernel:check` 会实载并 ping。
- **升级路径**：把 `src/host` 的模块按方向归位（内核能力回内核、应用能力留应用），
  改 `OMNI_KERNEL_TAG` 跑 `npm run kernel:vendor`，再跑 `npm run verify`。
  细节与逐项迁移依据见 [docs/KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。

## 6. 今日实测（2026-11-04，本机 Node 22.20 / Windows）

| 检查 | 结果 |
| ---- | ---- |
| 三份 typecheck（后端 / 前端 / 桌面） | ✅ 0 error |
| `npm run kernel:check` | ✅ 200 源文件 / 649 包导入 / 内嵌副本 0 / tarball integrity 一致 / 原生内核实载 |
| 后端构建 `npm run build` | ✅ dist 原子换入；原生内核可加载 |
| 前端构建 `npm run build:web` | ✅ 单入口 + vendor/panel-antd 分块 |
| 前端判据 `npm run web:test` | ✅ 145 文件 / 717 用例 |
| 端到端 `npm run smoke` | ✅ 7/7（banner token、`/healthz`、`/readyz`、`/` HTML、`/rpc config.get`、`sessions.list`、原生内核实载） |
| 桌面 `desktop:build` + `desktop:test` | ✅ 25/25 |
| 桌面 GUI `desktop:smoke` | ✅ 8/8：真实窗口 / 侧车 / UI origin / DOM 挂载（见 [DESKTOP-SMOKE.md](docs/DESKTOP-SMOKE.md)） |
| 桌面打包 `desktop:stage` | ✅ 251 个生产依赖；staged harness 内 `NativeKernel` 可加载，`/healthz` `/readyz` `/rpc` 全 200 |

## 7. 与上游 / 内核仓的关系

- 应用代码来自上游 `OmniHarness@main`（0.4.0）；本仓的仓库级解耦与内核迁移用 `git log` 可审。
- 内核来自 `../omniharness-kernel` 的 `v0.1.0-alpha.4` tag；`vendor/*.tgz` 是它的发行物，
  **不是**第二份源码。重建用 `npm run kernel:vendor`。
- 上游的 `tests/`、`crates/`、`third-party/`、看板与审计脚本没有切过来：本仓的判据是
  前端 717 用例 + 桌面 25 条 + 冒烟 7 条 + 内核边界 6 条。

## License

Apache-2.0。见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
