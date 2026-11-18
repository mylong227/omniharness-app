# 依赖安全升级批次（2026-11-18）

> 范围与方法：npm outdated / npm audit 全量盘点 → 外部调研（Vitest 5 官方迁移指南、
> Vite 8/Rolldown 迁移路径、KaTeX/markdown-it/croner 各自的 CHANGELOG 破坏面、Electron 45
> 发布说明、本仓 preload/配置使用面核对）→ 按「运行时安全 > 工具链安全 > 版本跟进」
> 分批升级，每批以全量判据为门禁。本文是本轮账本。

## 盘点与调研结论

| 项 | 状态 | 依据 |
| --- | --- | --- |
| npm audit（升级前） | 10 漏洞（2 critical / 4 high / 3 moderate / 1 low） | tinypool RCE ×2（vitest 2 内嵌）、@vitest/mocker 路径穿越/代码注入、picomatch ReDoS 链（fdir/tinyglobby/vite≥6.3）、esbuild≤0.24.2（vite-node 内嵌老副本）、**katex 0.11–0.18.1 原型污染绕过信任限制（运行时依赖，用户可见面）** |
| Vitest 5 破坏面 | 本仓零交集 | 官方迁移指南：workspace→projects（本仓单项目）、coverage 重构（未用）、bench 重写（未用）、`test.sequential` 删除（未用）、clearMocks 缺省 true（本仓判据用裸 assert + 全局 fetch 桩，无 vi.mock 跨用例状态）、hoisting 抛错（未用） |
| Vite 8 | **登记不升** | Rolldown 化（esbuild→oxc、rollupOptions→rolldownOptions、manualChunks 对象式移除、minify 配置换面）；本仓 vite.config 用 rollupOptions+manualChunks 函数+minify:esbuild，官方建议 6→7（或 rolldown-vite）→8 分步——独立批次另行迁移 |
| KaTeX 0.19 | 破坏面=strict 告警口径 | 本仓调用 `{ displayMode, throwOnError: false }`；新增 `symbolNotInFont` strict 报告只影响告警通道，渲染输出稳定 |
| markdown-it 15 | CommonMark 一致性修复可能改渲染 HTML | 全量渲染/文本契约判据做门禁；v15 自带 TS 类型 → 删 `@types/markdown-it` |
| croner 11 | OCPS 1.4（`?` 通配）、DST 对齐 Vixie、`startAt` 含端、区间解析收紧 | 本仓仅 cronerSchedule.ts 一处消费；serverAutomations 判据做门禁 |
| Electron 45 | 沙箱 preload 失去 Buffer/events/timers/url 全局 | 本仓 preload 只 import electron 三件（contextBridge/ipcRenderer/webUtils），**零交集**；desktop 43 判据 + smoke 门禁 |
| TypeScript 7 | **登记不升** | Go 原生化首批（7.0.2），构建链生态（vite/esbuild 判据、types 校验）尚未整体跟上；等 7.1+ 再评估 |
| @types/node 26 | **登记不升** | engines 钉 node ≥22.14，类型版本须对齐运行时大版本（22.x） |
| esbuild 0.28 | **登记不升** | 顶层 0.25.12 无漏洞告警；桌面 test.mjs 按平台二进制路径解析 esbuild，跨 0.x 升级与打包链耦合 |

## 落地批次

| 批次 | 内容 | 门禁 |
| --- | --- | --- |
| 1（P0 安全） | katex ^0.16.47→**^0.19.1**（运行时漏洞修复）；vitest ^2.1.9→**^5.1.0**（RCE critical ×2 / mocker / ReDoS 链清除；vite-node 内嵌 esbuild≤0.24.2 老副本随升消失） | 全量 web 套件 1003/1004（唯一失败 streamScrollCoverage① 为全量并发下 60s 内部预算时敏抖动，单测复绿 24s）+ typecheck×3 |
| 2（版本跟进） | markdown-it ^14.3.3→**^15.0.3**（删 @types/markdown-it）；croner ^10.0.1→**^11.0.1**；antd 6.6.8→**6.7.1**；jose 6.2.12→**6.2.17**；openid-client ^6.8.8→**^6.9.0**；playwright-core ^1.64.1→**^1.65.1**；axe-core 4.14.0→**4.14.1**；@testing-library/user-event 14.6.8→**14.6.12** | typecheck×3 + 全量 web 套件 + desktop 43 判据 |
| 3（桌面平台） | electron 44.7.0→**45.3.3**（Chromium 156 / Node 24.22；受支持最新稳定线，44 将于支持窗口末期退出） | desktop:build + desktop:test 43 判据 + smoke |

## 升级后残余

- **picomatch ReDoS 链（5 high）**：`picomatch *` 全版本尚无修复版（上游待发），链路在
  vite≥6.3 的开发期文件扫描（tinyglobby/fdir）——**纯开发/测试面**，不进运行时产物；
  上游发版后 `npm audit fix` 即清。登记观察。
- vitest 5 运行器下最重真 Chrome 判据（streamScrollCoverage）在全量并发时偶触 60s 内部
  预算上限——fileParallelism:false 依旧保留（慢但可信 > 快但不可信），单测复现稳定绿。

## 遗留（下一批候选）

1. **Vite 8 / Rolldown 迁移**（独立批次）：6→7→8 分步走，oxc/rolldownOptions/advancedChunks
   换面；构建速度收益大（社区实测 46s→6s 量级），但牵动 CSP 哈希门禁与产物字节契约。
2. **Electron 46**（46.0.0 已 stable，Node 24.22.1/Chromium 156 同代）——45.3.3 先行稳住，
   46 在下一窗口跟进。
3. TypeScript 7 生态跟进评估。
