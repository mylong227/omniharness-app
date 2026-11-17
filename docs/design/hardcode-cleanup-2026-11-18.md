# 硬编码清理与体验收口批次（2026-11-18）

> 范围与方法：三路普查（web 未走 t() 的用户可见 CJK / 桌面壳绕过 i18n 的字面量 /
> 错误链路的文案耦合），全部结论经逐文件核实后按「用户可见度 × 风险」分三批还原，
> 每批带可证伪判据。本文是本轮的账本：改了什么、为什么、还剩什么。

## 普查结论

| 面 | 结论 |
| --- | --- |
| web 前端 | **文案层干净**：JSX 文本节点 / title / aria-label / placeholder / toast 调用全部经 t()（普查 0 直写）；政策常量全部已命名收口（`CAP_WARN_PERCENT=80`、`TRACE_RENDER_LIMIT=300`、`MessageQuote.MAX_CHARS=4000`、`ComposerDraftStore.MAX_ENTRIES=32`、`STREAM_DISCONNECT_GRACE_MS=4000` 均单一事实源），无跨文件重复 |
| 错误链路 | `ComposerController.failureHint` 用**中英混合正则匹配翻译后文案**（`/RPC 超时/` 匹配的是后端中文错误串）：en 词条一变提示即静默失效；网络不可达（fetch TypeError）落到误导性的「检查 API Key」 |
| 桌面壳 | 两处**真实绕过 i18n**：目录选择框标题 `'选择工作区'`（ipc.ts 直写）；启动页兜底文案 `'正在启动本地 Harness…'`（window.ts 复写字面量）；另发现 `assertDirectory` 的中文错误**直接弹进对话框**（switchWorkspace → invalidWorkspace），en 用户看到中文句子 |

## 批次 A · 桌面壳硬编码文字收口

| # | 项 | 落地 |
| --- | --- | --- |
| A1 | 目录选择框标题 | `pickDirectory(defaultPath, title)` 标题参数化，调用方经 `i18n.t('dialog.pickWorkspace')` 传入（新键，双语）；`pickWorkspace(i18n)` / `resolveWorkspace(…, i18n)` 贯通 |
| A2 | 启动页兜底文案 | `window.ts` 的 `?? '正在启动本地 Harness…'` 复写副本删除，兜底引用 `DESKTOP_MESSAGES['zh-CN']['window.starting']` 单一真源 |
| A3 | 工作区守卫错误 | `ipcGuards.assertDirectory` 抛 `WorkspaceGuardError`（稳定 `code: 'not-exists' \| 'not-directory'` + `path`，中文细节保留给日志）；`DesktopDialogs.invalidWorkspaceGuarded(code, path)` 按 `dialog.workspaceNotFound` / `dialog.workspaceNotDirectory` 本地化模板呈现（`{path}` 占位）；`switchWorkspace` 按错误类型分发 |

## 批次 B · 错误链路结构化（体验修复核心）

| # | 项 | 落地 |
| --- | --- | --- |
| B1 | `RpcError`（ApiClient） | 稳定 `kind`：`rpc-error` / `auth` / `http-status` / `bad-json` / `network`；携带 `status`（HTTP）与 `code`（JSON-RPC 协议码）；fetch 拒答首次可分类（此前落进误导性通用提示） |
| B2 | `failureHint` 分类驱动 | kind/code/status 驱动 + 非结构化文案兜底：桥接等待超时（`SERVER_WAIT_TIMEOUT_CODE = -32002`，后端 `httpBridgeTransport.errorCodeFor` 的协议面）与 HTTP ≥500 → 「回合可能仍在后台」；network → **新提示**（确认服务运行 / 检查网络代理）；auth → 指向 token 横幅；中止 → 无提示；其余 → 通用建议 |
| B3 | en 修复 | 判定不再依赖翻译后文案：en 用户超时/网络提示恢复；`/RPC 超时/` 中文字面量匹配从源码移除 |

## 批次 C · 防线沉淀

| # | 项 | 落地 |
| --- | --- | --- |
| C1 | i18nCoverage 判据四 | web/src 的 JSX 文本节点（.tsx，排除字符串内 `>…<` 形态）与展示属性（title=/aria-label=/placeholder=/alt= 裸引号值）**零 CJK 直写**——普查为 0，钉住防回归 |
| C2 | 桌面壳零裸字面量判据 | `ipc.ts` / `window.ts` 剥离注释后零 CJK（已收口的壳面钉住；新增文案必须进 messages.ts，双语表由 TS `Record` 类型强制补全） |
| C3 | 键集一致性 | 桌面 `DesktopI18n` 键集一致性判据扩新键（pickWorkspace / workspaceNotFound / workspaceNotDirectory）；`assertDirectory` 判据（码位 + 路径 + 合法目录原样返回） |

## 判据

- `web/test/rpcFailureMessage.test.ts`：③ 升级为结构化契约（kind/code/status 驱动 + en 兼容匹配）、③b 文案兜底契约（中止 / HTTP 5xx / 未知）、②c fetch 拒答 ⇒ kind=network；①② 既有归因契约保持。
- `web/test/i18nCoverage.test.ts`：新增判据四（4 用例全绿）。
- `desktop/scripts/test.mjs`：`assertDirectory` WorkspaceGuardError 码位判据 + 语言包键集扩新键 + 壳面零裸字面量判据（43/43 全绿）。

## 不做（本轮决策，登记理由）

- **后端 / CLI 中文文案**：产品语言（OmniHarness 是中文优先产品），错误信息含中文不是缺陷；
  前端展示层已通过 `t()` 组织，结构化分类（B1/B2）解决的是**判定**依赖文案的问题。
- **ipcGuards 的 `assertRevealPathInside` / `trustRejection` 错误**：进日志与渲染层 invoke 拒绝，
  用户可见度低；`assertDirectory` 因直弹对话框已单独收口（A3）。
- **harnessSupervisor / ready / SmokeHarness / DesktopConfigLoader 的中文**：日志、诊断面板与
  无人值守冒烟输出（产品语言 / 开发者诊断面）。
- **`ConsoleRegistry` 不变量 throw**：开发者诊断（触发即代码缺陷），非 UI 文案。
- **`web/index.html` 标题「OmniHarness 工作台」**：品牌名 + 产品名词，桌面壳自绘标题栏下基本不可见。

## 遗留（下一批候选）

1. 后端错误全量码位化（`httpBridgeTransport.errorCodeFor` 只区分 -32002/-32000；更细的
   结构化分类需后端先行，前端通道已就绪——RpcError.code）。
2. `fetchMetrics` / SSE 路径的 RpcError 化（当前只覆盖 `rpc()` 主路径；metrics/SSE 的错误
   用户可见度低，收益有限）。
3. 桌面 `DesktopConfigLoader` 警告本地化（现仅写日志，若将来要在设置页呈现再收）。
