# vendor/

本目录只放**应用消费的内核发行物**（`npm` 依赖 `file:vendor/*.tgz`），不放源码。

| 文件 | 说明 |
| ---- | ---- |
| `omniharness-kernel-0.1.0-alpha.6.tgz` | `@omniharness/kernel` 在 tag `v0.1.0-alpha.6` 的构建产物 + 应用 `native/omni_napi.node`（`NativeKernel` 从包根找它） |

## 重新生成

```powershell
# 缺省 tag = package.json 当前钉的版本（self-consistent，无手工漂移）
npm run kernel:vendor
npm ci
npm run kernel:surface   # 按业务实际 import 重新生成 17 个域文件
npm run typecheck        # 暴露真正不兼容的符号
npm run kernel:check     # 8 条判据（含生成物不漂移）
```

`kernel:vendor` 会同时更新根 `package.json` 的 `file:` 路径与 `package-lock.json` 的
`integrity`；不要手工改 tarball 或只改其中一处——`kernel:check` 会逐字节比对。
升其它版本时用 `OMNI_KERNEL_TAG=v0.1.0-alpha.7 npm run kernel:vendor` 显式覆盖。

## 版本史

- **alpha.6**（当前）：内核 M4/M5/M6 闭环——切片清理 + 编排收敛为内核单源（app `Runtime`
  成为内核 Runtime 的薄扩展）+ a2a 互操作退役。app 完成全量适配（commit `f3b36e1`）。
- ~~alpha.4~~：曾因内核切片删除 app 所需能力而钉定（「最后一个完整面」）；alpha.6 迁移时
  app 侧以 `src/host/kernel-compat/` 自有扩展层接住了被删能力，遂升级。
