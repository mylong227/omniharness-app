# src/host/extensions —— app 自有扩展层（归属契约）

## 这是什么

**app 自有、随 app 演进的一等扩展层**——历史上叫 `kernel-compat/`（M4 切片期的收容所），
M27 兼容层清零后更名 `extensions/`：内核形状的部分已全部回归内核包
（M22 plugin/eval/media、M25 RPC、M26 终盘收编 36 件、M27 SDK/打码终批，共 40+ 件影子退役），
本目录只剩**真应用形状**的实现（Laya 决策引擎、CLI worker、doctor 诊断面、web 广播、
daemon/routine 契约、图存储等产品件）——它们不是「兼容」，是产品。

## 归属契约（三条，机检于 `scripts/checkKernelBoundary.mjs`）

1. **归属**：本目录的所有权在 app 仓。内核不承诺这里的任何模块存在或兼容；
   内核升级**不**需要同步本目录（除非 app 主动想让某个模块回归内核）。
2. **依赖方向**：本目录只允许依赖 `../kernel/<area>.ts`（内核对接面）与目录内相对路径。
   禁止直接 `import '@omniharness/kernel/...'`——那是 `src/host/kernel/` 的专属通道。
3. **不得反向要求内核**：某个模块若未来回归内核包，删除本目录对应文件、
   把消费点改指 `../kernel/<area>.ts` 即可（M26/M27 的 40+ 件影子就是按这条退役的）；
   不存在「内核必须保留」的诉求。

## 结构

```
contracts/   app 形态的端口契约（daemon/routine、doctor 报告、图摘要、spec 端口等）
kernel/      上述契约的实现（Laya 决策引擎、CLI worker、doctor/注入自检、图存储、
             资产 wasm 技能包、维护 runner、web 广播、模型能力探针、…）
protocols/   MCP 客户端活代码（mcpRegistryClient / mcpServerCommand，src/index.ts 与 CLI 消费）
```

2026-11-06 起 `src/host/kernel/` 只保留**自动生成**的分域 re-export（无实现）；
2026-11-07（M27）起本目录不再含任何与内核包同名/同体的影子副本——
`kernel:check` 的「导入 ⊆ 内核承诺清单」+ 全仓扫描把守，回归即红。

## 消费方式

业务代码经相对路径直接引用本目录，或经 `contracts/ports/index.ts`
聚合桶（`src/index.ts` 公共端口面的来源）。内核包符号一律走 `src/host/kernel/` 对接面。
