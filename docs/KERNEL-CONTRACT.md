# 本仓与内核（`@omniharness/kernel`）的契约

> 实测日期 2026-11-06。**结论**：应用消费 vendored `@omniharness/kernel@0.1.0-alpha.6`，
> 全部内核导入收敛于 **`src/host/kernel/` 分域对接面**（17 个**自动生成**的域文件，
> `npm run kernel:check` 第 7 条强制单点、第 8 条拒绝生成物漂移）；内核切片清理掉的应用能力
> 收留于 **`src/host/kernel-compat/`**（app 自有扩展层，122 个文件，归属契约见
> [其 README](../src/host/kernel-compat/README.md)）。
> 后端 RPC 面由 **16 个域模块声明式注册**（93 方法，parity 快照钉住）。

## 1. 现在的依赖方向

```text
web/ + desktop/ ──HTTP/SSE──▶ src/apps（宿主：CLI / RPC 域模块 / 会话 / 审批 / 插件宿主 / 嵌入 API）
                                   │
                                   ├─▶ src/host/kernel/            ★ 唯一内核导入点（17 域）
                                   │      core / config / util / adapters-* / contracts / …
                                   │
                                   ├─▶ src/host/kernel-compat/      app 自有扩展层
                                   │      plugin 体系 / 图存储 / 资产 / 媒体 / 审计演化 / app 契约
                                   │
                                   └─▶ @omniharness/kernel@0.1.0-alpha.6（vendored tarball）
                                          ├─ dist/kernel/**        主循环 / 编排单源 / 工具 / 门禁 / 存储
                                          ├─ dist/contracts/**     端口 / 类型 / schema
                                          ├─ dist/protocols/**     ACP / MCP
                                          └─ native/omni_napi.node 原生内核（随包）
```

- `src/**` 只有 `src/host/kernel/<域>.ts` 允许 `import '@omniharness/kernel…'`；
  业务代码一律经对接面消费（内核内部路径不承诺兼容，升级只适配这一个目录）。
- `kernel-compat/` 只依赖 `../kernel/<域>.ts` 与目录内相对路径，同样不得绕过对接面。
- 内核 `kernel/composition/{runtime,serviceKeys}.ts` 就是编排单源：app 的
  `src/apps/composition/runtime.ts` 只是 `Runtime` 的薄扩展 + `ServiceKeys` 再导出（app 侧拷贝已删除）。

## 2. alpha.6 升级做了什么（2026-11-05，commit `f3b36e1` / `a56d4e5`）

1. **编排单源**：内核 alpha.6 把原 543 行 app 侧组合根收编为 `Runtime.createRuntime`；
   app `Runtime` 改为继承，A2A 互操作随内核 M4 决策退役（v0.3 线格式一并删除）。
2. **能力收编**：内核切片删除的 plugin / 资产 / 媒体 / 审计演化等能力以
   `src/host/kernel-compat/` 自有（122 文件，closure-complete，导入已改写为对接面路径）。
3. **对接面收敛**：637 处散布深路径导入 → 321 处包导入收敛于 17 个**自动生成**的域文件；
   `ServiceKeys` 单源自内核；纯再导出 shim 全部清除。
4. **后端模块化**：7 层继承链 → `ServerServices`（装配）+ 16 个域模块（注册）+
   `AppServer`（组装/分发/生命周期）；93 个 RPC 方法有唯一注册出处。
5. **组合根统一**：stdio / serve 两条路径共用 `composedServerCore()` 不变量核心
   （历史「serve 漏接 doctor」缺陷类被结构性消灭）。
6. **能力开放**：插件可 `registerRpc`（`rpc.register` 危险权限、缺省拒绝、冲突 fail-closed）；
   嵌入方 `createOmniHarness()` 3 行起服务、`defineModule` 与内置 93 方法同权注册。

## 3. 为什么可以升 alpha.6（对照旧版「为什么钉 alpha.4」）

alpha.5 起的「应用形状清零」删除了 plugin / asset / media / A2A / enterprise / Laya 等能力。
alpha.4 时代的方案是**钉住旧版本等归位**；本仓已把等的那一步做完：

- 应用确实自己拥有的能力 → `kernel-compat/`（app 自有，不要求内核兼容）；
- 随内核 M4 退役的能力（A2A v0.3 线格式）→ 删除，等 v1.0 重基后按新契约另行接入；
- 编排 → 内核单源（继承 `Runtime`）。

因此升级不再被「少功能」阻止，且**以后每次升级只适配 `src/host/kernel/` 一个目录**：
换 tgz → `npm run kernel:surface` 重新生成对接面 → `npm run typecheck` 指出真正不兼容的符号。

## 4. 门禁：`npm run kernel:check`（8 条判据）

1. `package.json` 的 `@omniharness/kernel` 必须是 `file:vendor/*.tgz`；
2. 仓库根不得存在 `src/{kernel,contracts,protocols}`；
3. `src/**` 不得有解析到这三个目录的相对导入；
4. `src/host/kernel/` 必须存在包导入（防止「只改配置、代码没用上」）；
5. `vendor/*.tgz` 的 SHA-512 必须等于 `package-lock.json` 的 integrity；
6. `NativeKernel.available() === true` 且 `ping()` 成功；
7. **对接面单点**：`src/**` 里只有 `src/host/kernel/<域>.ts` 允许导入内核包；
8. **对接面不漂移**：17 个域文件必须与「业务代码实际 import + 内核包 `.d.ts`」一致
   （由 `scripts/kernelSurface.mjs` 生成；只改业务 import 不跑 `npm run kernel:surface` 即红）。

生成器只保留业务实际使用的符号：新增内核符号的姿势是**在业务代码里正常 import**，再跑
`npm run kernel:surface`（无需手写 re-export）；已无使用的符号会被裁掉。`kernel:check`
第 8 条是这条工作流的唯一裁决点。

重建发行物：`npm run kernel:vendor`（tag 缺省从 package.json 钉定版本解析——
「再 vendor 一次当前版本」永远可复现，不存在脚本缺省 tag 与钉版本漂移）。

## 5. 已知边界与风险

- **分域而非单文件桶**：实测根入口整包加载 ~780ms vs 单深路径 ~60ms（Node 22）——
  单文件桶会给每个 CLI 冷启动平添 ~700ms；升级内核时按域增删符号即可。
- **kernel-compat 是 app 自有层**：内核升级**不**需要同步它；某模块若回归内核，
  删除 app 侧文件并把消费点改指对接面即可。
- **vendored tarball 是二进制发行物**：不是 `npm publish` 的产物。用 `kernel:vendor`
  重建，`kernel:check` 钉 integrity；不要手工改 tarball。
- **桌面打包**：`stageHarness.mjs` 会把 `vendor/` 一起带进 `.desktop-stage`，否则 stage 内
  `npm ci` 无法解析 `file:` 依赖。
- **原生内核**：随 tarball 分发；内核升级必须用 `kernel:vendor` 重新注入与应用 ABI 匹配的
  `native/omni_napi.node`，否则门禁第 6 条会红。

## 6. 证据（2026-11-06）

| 检查 | 结果 |
| ---- | ---- |
| `npm run typecheck`（后端 / 前端 / 桌面） | ✅ 0 error |
| `npm run kernel:check` | ✅ 350 源文件 / 321 处包导入（全部收敛对接面）/ 内嵌副本 0 / integrity 一致 / native ping / 生成物一致 |
| `npm run build` + `npm run smoke` | ✅ 7/7（banner token、healthz、readyz、HTML、config.get、sessions.list、原生内核实载） |
| `npm run web:test` | ✅ 151 文件 / 731 用例（含 parity/守卫/家具） |
| `npm run desktop:build` + `desktop:test` | ✅ 30/30 |
| 嵌入 API 实测 | ✅ `createOmniHarness` 1.8s 启动 / healthz 200 / RPC 往返 / 优雅关闭 |
