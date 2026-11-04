# vendor/

本目录只放**应用消费的内核发行物**（`npm` 依赖 `file:vendor/*.tgz`），不放源码。

| 文件 | 说明 |
| ---- | ---- |
| `omniharness-kernel-0.1.0-alpha.4.tgz` | `@omniharness/kernel` 在 tag `v0.1.0-alpha.4` 的构建产物 + 应用 `native/omni_napi.node`（`NativeKernel` 从包根找它） |

## 重新生成

```powershell
# 默认从 ../omniharness-kernel 的 v0.1.0-alpha.4 建 worktree、build、注入 native、pack
npm run kernel:vendor
npm ci
npm run kernel:check
```

`kernel:vendor` 会同时更新根 `package.json` 的 `file:` 路径与 `package-lock.json` 的
`integrity`；不要手工改 tarball 或只改其中一处——`kernel:check` 会逐字节比对。

## 为什么钉 alpha.4

内核 alpha.5 起删除了本应用仍在用的插件 / 资产 / A2A / 企业 / Laya 等能力；
alpha.4 是最后一个完整面。归位方案与升级触发条件见 [../docs/KERNEL-CONTRACT.md](../docs/KERNEL-CONTRACT.md)。
