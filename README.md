# OmniHarness App

> **独立应用仓：完整后端 + React 工作台 + Electron 桌面端，一套可独立构建、启动、回归的完整产品。**
> 2026-11-04 从 [OmniHarness](https://github.com/mylong227/OmniHarness) 切出，与内核仓
> [`omniharness-kernel`](../omniharness-kernel) 平级；本仓不依赖上游任何文件。

## 1. 三个部分（都在这一个仓里）

| 目录 | 内容 | 实测规模 |
| ---- | ---- | -------- |
| `src/` | **后端**：HTTP/SSE 宿主、JSON-RPC 分发、会话存储、审批/沙箱、工具、CLI、协议（MCP/ACP/AG-UI）、内嵌内核源码 | 1334 个文件（1331 `.ts`），其中 `src/apps` 167 |
| `web/` | **前端**：React 19 工作台（会话/工具/计划/变更/设置/审计/插件…） | 252 个源文件 + 159 个判据文件 |
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

桌面的「后端根目录」缺省就是本仓根；可用 `OMNI_BACKEND_ROOT` 指向另一份后端工作树做联调/回滚。

## 2. 快速开始

```powershell
npm ci                 # 安装前后端依赖（Node >= 22.14）
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
| `npm run build` | 后端：`tsc` → `dist`（原子换入）+ 伴生资源/原生内核镜像 |
| `npm run build:web` / `web:dev` | 前端 Vite 构建 / 开发服务器 |
| `npm run web:test` | 前端判据（145 文件 / 717 用例，文件级串行；含真 Chrome 判据） |
| `npm run typecheck` | 后端 + 前端 + 桌面三份 strict 类型检查 |
| `npm run smoke` | **端到端**：真起 serve，验 `/healthz` `/readyz` `/`（HTML）`/rpc config.get` |
| `npm run serve` | 只起 backend serve（需先 `npm run build` + `build:web`） |
| `npm run desktop:build` / `desktop:test` | 打包主进程 / 25 条纯逻辑判据 |
| `npm run desktop:stage` / `desktop:dist` | 打包资源 / NSIS 安装包 |
| `npm run verify` | typecheck → 前端判据 → 后端构建 → 前端构建 → 冒烟 → 桌面构建与判据 |

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

## 5. 今日实测（2026-11-04，本机 Node 22.20 / Windows）

| 检查 | 结果 |
| ---- | ---- |
| 三份 typecheck（后端 1331 / 前端 / 桌面） | ✅ 全绿（0 error） |
| 后端构建 `npm run build` | ✅ dist 原子换入；`native/omni_napi.node` 已镜像到 `dist/native`（`NativeKernel.available() === true`） |
| 前端构建 `npm run build:web` | ✅ 单入口 + vendor/panel-antd 分块（entry 584.8 KB） |
| 前端判据 `npm run web:test` | ✅ 145 文件 / 717 用例（1 个仓库形状判据已按本仓布局改写，见 `web/test/vendorAndTypeSource.test.ts`） |
| 端到端 `npm run smoke` | ✅ 5/5（banner token、`/healthz`、`/readyz`、`/` HTML、`/rpc config.get`） |
| 桌面 `desktop:build` + `desktop:test` | ✅ 25/25 |
| 桌面 GUI | ⚠️ 未验证：受限会话里 Electron 起不来（上游同款限制）；`desktop:smoke` 需真实桌面 |

## 6. 与内核（omniharness-kernel）的关系

本仓后端 = **应用宿主**（87 个 RPC + SSE + 静态托管），内核是**可嵌入库**（`Runtime`/`Agent` +
workbench 4 端点）。两者当前的关系是：

- 本仓 `src/{kernel,contracts,protocols}` 是上游 0.4.0 的**内嵌副本**（与上游一致，不是 npm 依赖）；
- 因此本仓可完全独立运行，但**尚未**钉 `@omniharness/kernel` 版本；
- 切到内核包的路径、缺口与验收判据见 [docs/KERNEL-CONTRACT.md](docs/KERNEL-CONTRACT.md)。

## 7. 与上游的关系

- `web/`、`desktop/`、`src/` 与上游 `OmniHarness@main`（0.4.0）一致；本仓做的改动用 `git log` 可审：
  仓库级解耦（独立 `package.json`/Vite/Vitest）+ 三处适配（`OMNI_BACKEND_ORIGIN`、桌面后端根、
  `copyAssets` 镜像原生内核）。
- 上游的 `tests/`、`crates/`、`third-party/`、看板与审计脚本**没有**切过来：本仓的判据是
  前端 159 文件 + 桌面 25 条 + 冒烟 5 条；需要上游那套门禁时从上游取，不复制副本。

## License

Apache-2.0。见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。
