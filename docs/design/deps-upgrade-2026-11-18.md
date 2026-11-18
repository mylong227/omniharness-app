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
| esbuild 0.28 | ~~登记不升~~ → **已随 Vite 8 升至 ^0.28.2** | Vite 8 的 peerOptional 要求 esbuild ^0.27/^0.28；桌面 test.mjs 按平台二进制路径解析（@esbuild/win32-x64/esbuild.exe），0.28 二进制同型，desktop:build + 43 判据复验通过 |

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

1. ~~Vite 8 / Rolldown 迁移~~ → **已落地**（见下节）；
2. ~~Electron 46~~ → **修正**：46 尚未发布（预计 2027-01，Electron 官方时间线）——前版账本
   「46 已 stable」是把 tentative 计划当成已发布，已更正；45.3.4 即受支持最新稳定线；
3. TypeScript 7 生态跟进评估。

## 追加批次：收尾批（2026-11-19）

| 项 | 落地 | 门禁 |
| --- | --- | --- |
| vitest | 5.1.0→**5.1.1**（patch） | 全量套件 |
| jsdom | 25.0.1→**29.1.1**（major：CSS 引擎重写、computed-style 行为变化、canvas 可选后端换 @napi-rs/canvas——本仓未用 canvas；Node ≥22.13 满足） | 全量套件（jsdom 组件判据为风险面） |
| desktop esbuild | 0.25.12→**0.28.2**（对齐根版本；桌面 build.mjs/test.mjs 用平台二进制） | desktop:build + 43 判据（✓ 全绿） |
| fetchMetrics RpcError 化 | `metrics 请求失败` 从裸 Error 改 **RpcError**（HTTP 失败 → kind=http-status + status；fetch 拒答 → kind=network）——metrics 面板消费方据此分类，与 rpc() 主路径同口径。**SSE 维持原样**：EventSource 原生重连、无错误对象可分类（onerror 只触发重连状态机），RpcError 化无收益 | rpcFailureMessage ②d（HTTP 503 → http-status + status=503；拒答 → network） |

## 追加批次：Vite 8 / Rolldown 迁移（2026-11-19）

> 原登记「独立批次」当日落地。**关键调研发现**：Vite 8 下 `manualChunks` 函数形式的返回值
> 被**静默丢弃**（不报错、分包无声失效）——不迁移等于分包语义已坏，故必须换
> `rolldownOptions.output.advancedChunks` 分组。

| 项 | 落地 |
| --- | --- |
| 依赖 | vite ^6.4.5→**^8.3.8**（Rolldown + Oxc）；@vitejs/plugin-react ^4.7.0→**^6.3.0**；esbuild ^0.25.12→**^0.28.2**（vite 8 peerOptional 强制） |
| vite.config 换面 | ① `rollupOptions`→`rolldownOptions`；② `manualChunks` 函数→`advancedChunks.groups`（原函数两规则殊途同归——antd 细分规则与兜底规则同落 `vendor-antd`——收敛为两条分组：vendor-react / node_modules 除 katex\|markdown-it\|highlight\.js 外全入 vendor-antd）；③ `minify:'esbuild'`+`esbuild.keepNames` → oxc 缺省 + `rolldownOptions.output.keepNames`（错误边界组件栈依赖，不能丢）；④ `optimizeDeps.include` / `target` / `sourcemap:'hidden'` / `base:'./'` 原样受支持 |
| 判据修复（合法压缩产物形态变化，两处都是**测试健壮性**而非产品缺陷） | ① `highlightColors`：Rolldown CSS 压缩把 6 位 hex 缩成 3 位（`#0000ff`→`#00f`，语义等价），探针 `hexToRgbStr` 只认 6 位 → 误报「缺变量」；放宽为 3/6 位通用归一。② `renderErrorBoundary`：keepNames 锚点形态变化——esbuild 产 `__name(fn,"SessionPanel")` 包装、Rolldown 保留**具名函数表达式**本体 `memo(function SessionPanel(e){`；夹具放宽为双形态兼容（错误边界注入语义不变） |
| 门禁 | web:build（分包语义完整：vendor-react 278KB / vendor-antd 1039KB / katex 异步 278KB / md-it+hljs 随 entry）+ 全量 verify **EXIT=0**（218 文件 / 1004 用例 + smoke 9 条 + desktop 43 条，CSP 哈希门禁在新产物上复验）+ 压测五场景全绿（S1 2853ms / S3 254ms / S5 12069ms，均在预算内） |
| 构建耗时 | 单入口 16.66s（vite 6 时代 ~17s 持平——社区 7× 提速在大体量工程，本仓单页构建规模下收益不显；开发态 HMR 冷启动为 Rolldown 主收益面） |
