# src/host/kernel-compat —— app 自有扩展层（归属契约）

## 这是什么

内核 `@omniharness/kernel` 在 0.1.0-alpha.5/6 做了「应用形态切片清理」（M4/M5/M6），
删除了 plugin / asset / media / metaphor / eval 等应用侧能力。**本 app 仍然需要这些能力**，
于是把它们收留在本目录——它们不是内核的拷贝，而是 **app 自有、随 app 演进的一等扩展层**。

## 归属契约（三条，机检于 `scripts/checkKernelBoundary.mjs`）

1. **归属**：本目录的所有权在 app 仓。内核不承诺这里的任何模块存在或兼容；
   内核升级**不**需要同步本目录（除非 app 主动想让某个模块回归内核）。
2. **依赖方向**：本目录只允许依赖 `../kernel/<area>.ts`（内核对接面）与目录内相对路径。
   禁止直接 `import '@omniharness/kernel/...'`——那是 `src/host/kernel/` 的专属通道。
3. **不得反向要求内核**：某个模块若未来回归内核包，删除本目录对应文件、
   把消费点改指 `../kernel/<area>.ts` 即可；不存在「内核必须保留」的诉求。

## 结构

```
contracts/   app 形态的端口契约（内核已不再发布的形状：plugin/vault/media/…）
kernel/      上述契约的实现（pluginHost 体系、图存储、资产、适配器、Laya 决策引擎、…）
```

2026-11-06 起 `src/host/kernel/` 只保留**自动生成**的 17 个分域 re-export（无实现）；
原先混在 `kernel/adapters/{laya,enterprise,tool}`、`kernel/config/decisionEngineResolver` 的
app 自有实现已分别迁到本目录（Laya + 决策解析器）与 `src/apps/enterprise/`（OIDC 适配器）。

## 消费方式

业务代码经相对路径直接引用本目录（现有 ~40 个消费点），或经 `contracts/ports/index.ts`
聚合桶（`src/index.ts` 公共端口面的来源）。内核包符号一律走 `src/host/kernel/` 对接面。
