# 桌面 GUI 验收（`desktop:smoke`）

> 2026-11-04，Windows 11 / 本机真实桌面会话（Session 3）。**结论：8/8 检查通过，退出码 0。**

## 怎么跑

```powershell
# 1) 先有后端 dist 与前端 web/dist
npm run build
npm run build:web

# 2) 真实桌面会话里跑（会打开窗口、拉起侧车、探 DOM，然后自动退出）
cd desktop
npm run smoke -- --workspace D:\path\to\workspace
```

判据由主进程 `SmokeHarness.judge` 给出，结论经退出码回传：

| 退出码 | 含义 |
| ------ | ---- |
| 0 | 全部致命断言通过 |
| 1 | 有致命断言失败（stdout 会逐条列出 ✗） |
| 2 | 90s 超时（侧车没起来 / UI 没加载） |

明细 JSON 默认写到 `app.getPath('userData')/smoke-result.json`，也可用 `OMNI_SMOKE_OUT` 指定。

## 本机实测

命令：

```powershell
$env:OMNI_SMOKE_OUT='D:\deepseek\omniharness-app\.tmp\desktop-smoke.json'
node scripts/smoke.mjs --workspace D:\deepseek\omniharness-app\.tmp\smoke-workspace
```

输出：

```text
[omni-smoke] smoke PASS (8 checks) -> D:\deepseek\omniharness-app\.tmp\desktop-smoke.json
exit=0
```

明细：

| 检查 | 结果 | 事实 |
| ---- | ---- | ---- |
| `window.created` | ✅ | 主窗口存在 |
| `window.visible` | ✅ | 窗口可见 = true |
| `harness.ready` | ✅ | 侧车 ready @ `127.0.0.1:41323` |
| `ui.origin` | ✅ | `loadedUrl` 以 `http://127.0.0.1:41323/` 开头（带一次性 token） |
| `ui.mounted` | ✅ | `#root` 存在，`window.omni.apiVersion === 3` |
| `tray` | ✅（观测） | 托盘已创建 |
| `notifications` | ✅（观测） | 系统通知可用 |
| `protocol` | ✅（观测） | 深链协议未注册（开发态/权限不足，不判死） |

## 一个真实的环境坑

自动化/受限会话会注入 `ELECTRON_RUN_AS_NODE=1`。这会让 `electron.exe` 退化成纯 Node：
进程能启动，但不会创建 GUI 窗口，`require('electron')` 也拿不到 `app`。此前「受限会话起不来
Electron」就是它，不是 Electron 或代码的问题。

`desktop/scripts/smoke.mjs` 现在会**显式从子进程环境里删掉**这个变量（普通桌面会话本来就没有），
所以 `npm run smoke` 在两种会话里都验的是真实窗口。若手工启动 Electron，先 `Remove-Item Env:ELECTRON_RUN_AS_NODE`。

## 与打包态的关系

本次验的是**开发态**桌面壳（`desktop/` 直接从本仓根取后端与 `web/dist`）。打包态的布局由
`desktop/scripts/stageHarness.mjs` 铺到 `resources/harness`；迁移内核包后它额外复制 `vendor/`
（否则 stage 内 `npm ci` 无法解析 `file:` 依赖）。

打包态已做的验证（2026-11-04）：

| 检查 | 结果 |
| ---- | ---- |
| `npm run desktop:stage` | ✅ `npm ci` 安装 251 个生产依赖；`vendor/*.tgz` 随 stage 落地 |
| stage 内 `@omniharness/kernel/native/omni_napi.node` | ✅ 存在 |
| stage 内 `node dist/src/apps/cli/exec.js --version` | ✅ 退出码 0 |
| stage 内真起 serve（`--port 0`） | ✅ `/healthz` 200、`/readyz` 200、`/rpc config.get` 200 |

**未做**：用 electron-builder 打出的 NSIS 安装包在干净机器上安装后复跑 GUI 冒烟。
`desktop:dist` 的这一步仍需在真实安装环境验收；开发态 GUI 与 staged 后端的闭环已通过。
