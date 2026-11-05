# 第三方资产清单（Third-Party Assets）

本仓 Apache-2.0 之外的第三方 materials 与它们的去向。再分发前请核对本表。

| 资产 | 来源 | 用途 | 许可去向 |
| ---- | ---- | ---- | -------- |
| ComfyBench 研究基准的 source-image 与 workflow 元数据 | ComfyBench（上游研究基准） | 产品数据底料 | 遵循其上游条款；本仓派生使用，不随 Apache-2.0 再分发 |
| `@omniharness/kernel`（vendored tarball，`vendor/*.tgz`） | [omniharness-kernel](../omniharness-kernel) 仓 tag 构建 | 运行时内核依赖 | Apache-2.0（内核仓声明） |
| npm 依赖树（`antd`、`react`、`electron`、`vite`、`@modelcontextprotocol/sdk`、`jose`、`croner` 等） | npm registry | 前端 / 桌面 / 后端依赖 | 各自许可（MIT/Apache-2.0 为主），以 `node_modules/**/LICENSE` 为准 |
| Electron 二进制与随包 `node.exe` | Electron / Node.js 官方发行物 | 桌面壳与侧车运行时 | MIT |

> 本文件取代上游仓的同类清单；上游 `THIRD_PARTY_ASSETS.md` 未随本仓切出。
> 变更依赖或引入新数据源时**必须**同步本表（`NOTICE` 指向这里）。
