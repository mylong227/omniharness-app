# 更新日志（Changelog）

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 惯例；
版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)（0.x 阶段 minor 即可含破坏性变更，以 `!` 标注）。

## [0.6.0-alpha.2] - 2026-11-05

### Added（新增）
- **自描述 RPC**：新增 `rpc.list` 内省方法（`introspect` 域模块）——一次调用返回全部方法 → 归属模块/插件，与分发顺序（内置 → 插件）同构。
- **协议面双向护栏**：`tests/serverModulesParity.test.ts`（后端 92 方法快照）+ `tests/apiClientParity.test.ts`（Web 客户端每个 `this.rpc()` 字面量必须在后端存在）。
- **嵌入 API**：`createOmniHarness()` / `defineModule()`（`src/index.ts` 导出）——3 行把完整服务端嵌进任意 Node 进程；可运行样例 `examples/embed-demo.mjs`（`npm run example:embed`）。
- **一键初始化**：`omniharness init`（TTY 交互式 / 旗标直达）——选厂商、填 Key（落盘自动系统级加密）、合并写用户级 `~/.omniharness/omniharness.json`。
- **doctor 增强**：构建产物检查、缺省 serve 端口占用、插件目录自动创建、`--probe-model` 模型连通性探测（复用 UI 同源探针）、内核版本自述。
- **标品门面**：本 CHANGELOG、[CONTRIBUTING](CONTRIBUTING.md)、GitHub Actions 验证流水线、示例配置合法性判据。

### Changed（变更）
- **内核对接单点化**：637 处散布的 `@omniharness/kernel` 深路径导入收敛为 `src/host/kernel/`（17 个域文件、323 条再导出）；门禁第 7 条强制「唯一导入点」。升级内核 = 换 tgz + 适配一个目录。
- **后端模块化**：7 层 AppServer 继承链（91 个手工 `handlers.set` 散布 6 文件）改为 `ServerServices`（装配）+ 15 个域模块（声明式注册）+ 薄 AppServer（组装/分发/生命周期）。加一个能力 = 1 个模块文件 + index 登记 1 行。
- **组合根统一**：stdio 与 serve 两条路径共用 `composedServerCore()` 不变量核心，消除「改一处漏一处」缺陷类（历史上真实发生过：serve 漏接 doctor）。
- **kernel-compat 收编**：`src/host/kernel-compat/`（122 文件）确立为 app 自有扩展层（内核切片清理掉的能力），归属契约见[其 README](src/host/kernel-compat/README.md)。

### Fixed（修复）
- `exec.ts` 帮助快路径吞掉子命令用法页：`omniharness <子命令> --help` 现在到达子命令自己的 USAGE（裸 `--help` 仍走零加载快速路径）。
- `scripts/startAll.mjs` 的 tmpSweep 导入指向已删除路径（预启动清扫静默失效）。
- 补齐 `examples/catalog/registry.json` 离线市场占位；订正 `native:build`、不存在的 `chat` 子命令等悬空提示。

## [0.6.0-alpha.1] - 2026-11-04

- 从上游 OmniHarness@0.4.0 切出独立应用仓（后端宿主 + React 工作台 + Electron 桌面端）。
- 完成内核包迁移（M2）：消费 vendored `@omniharness/kernel@0.1.0-alpha.4`，删除 1163 个内嵌内核文件。
