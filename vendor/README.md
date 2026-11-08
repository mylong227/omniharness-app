# vendor/

本目录只放**应用消费的内核发行物**（`npm` 依赖 `file:vendor/*.tgz`），不放源码。

| 文件 | 说明 |
| ---- | ---- |
| `omniharness-kernel-0.1.0-alpha.14.tgz` | `@omniharness/kernel` 在 tag `v0.1.0-alpha.14` 的构建产物 + 应用 `native/omni_napi.node`（`NativeKernel` 从包根找它） |

## 重新生成

```powershell
# 缺省 tag = package.json 当前钉的版本（self-consistent，无手工漂移）
npm run kernel:vendor
npm ci
npm run kernel:surface   # 按业务实际 import 重新生成 19 个域文件
npm run typecheck        # 暴露真正不兼容的符号
npm run kernel:check     # 9 条判据（含生成物不漂移 / 已承诺能力无同名副本）
```

`kernel:vendor` 会同时更新根 `package.json` 的 `file:` 路径与 `package-lock.json` 的
`integrity`；不要手工改 tarball 或只改其中一处——`kernel:check` 会逐字节比对。
升其它版本时用 `OMNI_KERNEL_TAG=v0.1.0-alpha.X npm run kernel:vendor` 显式覆盖。

## 版本史

- **alpha.14**（当前）：内核审计整改同步（25 个提交：P0 15 / P1 57 / P2/P3 分批），
  安全域 `TrustTier` 更名 `ContentTrustTier`、`AesGcmSealer` 单一密码学实现（scrypt + 旧密文回退）；
  app 侧 M31 对接收口：`CryptoVault` / `EnvVault` 迁回对接面、compat 再导出桶删除、
  `kernel:check` 增第 9 条「已承诺能力无同名副本」；M32 影子清零终盘：第 9 条修复两处漏检
  （curated 键拼接成目录 / 再导出桶未解析）后删除 `SessionGc` / `TmpSweep` /
  `SessionStorageLocation` / `IsolationLadderFactory` / `SdkPreferredMcpConnector`，
  改经 `@omniharness/kernel/maintenance` / `/sandbox` / `/mcp` 子路径消费
  （tarball 版本不变——alpha.14 本就承诺这些 curated 子路径）。
- **alpha.13**：内核 M29——审计 canonical 收敛 `kernel/receipts/jcs.js` 单一真源
  （app 侧 `auditCanonical.ts` 退役，golden 四例钉死）。
- **alpha.12**：M26 终盘收编 36 件 + M27 SDK 客户端族/凭据打码单一真源 + M28 词表配置化；
  app 侧 M27 兼容层清零（`kernel-compat/` 更名 `extensions/`，41 件影子删除）。
- **alpha.11**：M22–M24——plugin / 评测域退役至内核包（44 件影子删除）。
- **alpha.9**：M21 Phase 2——exports 通配删除 → 251 条显式承诺闭包。
- **alpha.7**：M9——内核删除能力的自有化（11 模块随迁 `kernel-compat/`）。
- **alpha.6**：内核 M4/M5/M6 闭环——切片清理 + 编排收敛为内核单源（app `Runtime`
  成为内核 Runtime 的薄扩展）+ a2a 互操作退役。
- ~~alpha.4~~：曾因内核切片删除 app 所需能力而钉定（「最后一个完整面」）；alpha.6 迁移时
  app 侧以自有扩展层接住了被删能力，遂升级。完整迁移总账见
  [docs/KERNEL-CONTRACT.md](../docs/KERNEL-CONTRACT.md)。
