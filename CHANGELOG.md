# 更新日志（Changelog）

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 惯例；
版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)（0.x 阶段 minor 即可含破坏性变更，以 `!` 标注）。

## [0.6.0-alpha.2] - 2026-11-05

### Added（新增）
- **自描述 RPC**：新增 `rpc.list` 内省方法（`introspect` 域模块）——一次调用返回全部方法 → 归属模块/插件，与分发顺序（内置 → 插件）同构。
- **协议面双向护栏**：`tests/serverModulesParity.test.ts`（后端 92 方法快照）+ `tests/apiClientParity.test.ts`（Web 客户端每个 `this.rpc()` 字面量必须在后端存在）。
- **嵌入 API**：`createOmniHarness()` / `defineModule()`（`src/index.ts` 导出）——3 行把完整服务端嵌进任意 Node 进程；可运行样例 `examples/embed-demo.mjs`（`npm run example:embed`）。
- **一键初始化**：`omniharness init`（TTY 交互式 / 旗标直达）——选厂商、填 Key（Windows 落盘自动 DPAPI 加密；其余平台明文+0600）、合并写用户级 `~/.omniharness/omniharness.json`。
- **doctor 增强**：构建产物检查、缺省 serve 端口占用、插件目录自动创建、`--probe-model` 模型连通性探测（复用 UI 同源探针）、内核版本自述。
- **标品门面**：本 CHANGELOG、[CONTRIBUTING](CONTRIBUTING.md)、GitHub Actions 验证流水线、示例配置合法性判据。

### Changed（变更）
- **内核对接单点化**：637 处散布的 `@omniharness/kernel` 深路径导入收敛为 `src/host/kernel/`（17 个域文件、323 条再导出）；门禁第 7 条强制「唯一导入点」。升级内核 = 换 tgz + 适配一个目录。
- **后端模块化**：7 层 AppServer 继承链（91 个手工 `handlers.set` 散布 6 文件）改为 `ServerServices`（装配）+ 16 个域模块（声明式注册）+ 薄 AppServer（组装/分发/生命周期）。加一个能力 = 1 个模块文件 + index 登记 1 行。
- **组合根统一**：stdio 与 serve 两条路径共用 `composedServerCore()` 不变量核心，消除「改一处漏一处」缺陷类（历史上真实发生过：serve 漏接 doctor）。
- **kernel-compat 收编**：`src/host/kernel-compat/`（122 文件）确立为 app 自有扩展层（内核切片清理掉的能力），归属契约见[其 README](src/host/kernel-compat/README.md)。

### Fixed（修复）

### Security & Correctness（2026-11-06 全项目审计修复，7 个 P1）
- **嵌入 API 缺省不许本机配置覆盖模型**：createOmniHarness 原缺省漏 `modelOverrideEnabled:false`，开发机的用户级配置会拿真实凭据静默替换 MockModel；现缺省关、显式 `allowModelOverride` 才开。
- **桌面 CSP frame-src 放行 localhost 与远程**：工作区文件预览（故意走 localhost）与远程浏览面板在壳内全白屏的根因。
- **桌面 smoke 报告打码 token**：loadedUrl 带 token 进 smoke-result.json/issue 文案。
- **`model probe / goal / workflow --help` 不再执行真动作**（原 `?? CliDefaults` 兜底让求助直接发起真实网络请求/目标循环/工作流）。
- **`daemon start` 打印带 token 的 UI 地址**：CLI 生成令牌经环境变量固定给子进程（原令牌随 stdio:ignore 丢弃，打印的地址必然 401）。
- **打包 stage 补齐 examples/**：离线插件市场 catalog 在打包应用里永远空表的根因（fail-closed 断言 + vendor 同改）。
- **vendorKernel 原子替换**：pack 成功后才删旧 tgz（原实现 build 失败即把仓打到 npm ci 全红）。

### Fixed（同轮审计，P2/P3 精选）
- Web：URL token 挂载即抹除 + localStorage 持久化；401 全局「需要授权」横幅；重连后恢复**全部**挂起审批/提问（原只恢复第一条，收卡后自动接续下一条）；打开运行中会话采纳真实 running 态（不再丢流）；QuestionCard 倒计时跨请求重置；previewPort 失败不再永久缓存。
- CLI：doctor 现在能看到用户级配置（init 写的那份）；init 成功行如实显示生效适配器（沿用 mock 时当场点破）+ 分平台加密文案 + 未知旗标 fail-closed；doctor 补帮助条目与端口解析（OMNI_BACKEND_PORT 生效）。
- 脚本：smoke 启动超时路径不再泄漏子进程与临时目录；内核门禁扫描面扩展到 .cts/.js/.mjs/.cjs；CI 补 timeout/concurrency/permissions/桌面判据。
- 文档/数据：全仓计数对齐（92 方法/16 模块/350 文件/726 用例）；45 处 `tests/unit/*` 上游判据引用如实标注；harness-core 技能与 injection-snapshot 路径改指本仓现实；defaults/README 如实化（真实数据流：内核包内 defaults 才是活数据）；THIRD_PARTY_ASSETS.md 建立（NOTICE 悬空引用修复）；package.json 补 exports/files（打包形态可用）；桌面版本对齐 0.6.0-alpha.2。
- 死代码清理：TurnOrchestration.isWorkflowDefLike、ModuleRpcMap、AppServer.moduleOwners、desktop 4 个零消费 IPC 桥、file:///loading.html 导航白名单、will-quit 不可达钩子。
- `exec.ts` 帮助快路径吞掉子命令用法页：`omniharness <子命令> --help` 现在到达子命令自己的 USAGE（裸 `--help` 仍走零加载快速路径）。
- `scripts/startAll.mjs` 的 tmpSweep 导入指向已删除路径（预启动清扫静默失效）。
- 补齐 `examples/catalog/registry.json` 离线市场占位；订正 `native:build`、不存在的 `chat` 子命令等悬空提示。

## [0.6.0-alpha.1] - 2026-11-04

- 从上游 OmniHarness@0.4.0 切出独立应用仓（后端宿主 + React 工作台 + Electron 桌面端）。
- 完成内核包迁移（M2）：消费 vendored `@omniharness/kernel@0.1.0-alpha.4`，删除 1163 个内嵌内核文件。
