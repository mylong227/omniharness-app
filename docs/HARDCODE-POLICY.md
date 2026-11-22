# 硬编码与配置策略（HARDCODE-POLICY）

> 2026-11-22 定。目标：**用户可见文本零裸字面量、可调参数单一配置源**；协议/安全常量显式豁免。
> 本文件是「零硬编码」的判定口径——评审与门禁都按这里分类，不按字面观感。

## 三类，只有前两类算「必须消除」

| 类 | 定义 | 归属 | 例子 |
|---|---|---|---|
| **A 用户可见文本** | 任何会出现在 UI / CLI 输出 / 报告 / 错误提示 / 导出文件里的文案 | Web：`web/src/ui/i18n` 的 `t()`（中文原文即键 + en 分片）<br>服务端/CLI/审计：`AppText.t()`（`src/apps/i18n`，zh/en 分片）<br>桌面：`DESKTOP_MESSAGES`<br>内核：`kernel-texts.json` | 按钮名、校验错误、CLI usage、审计报告标题 |
| **B 可调参数** | 会随环境 / 部署 / 运营 / 性能调优变化的值 | `src/config/app.json` + `RuntimeConfig` / `UI_TUNABLES`（启动校验） | 轮询间隔、去抖、分页大小、等待超时、渲染上限 |
| **C 命名常量（豁免）** | 协议规定的固定值、数学/物理常量、类型枚举、**安全上限** | 就近 `const`/类静态只读，必须命名并带注释 | 协议字段名、状态码、`PATCH_MAX_BYTES`、proof bundle 上限、脱敏熵阈值 |

C 类豁免的理由：把安全上限做成可配置等于允许部署方无意削弱 fail-closed 边界；协议/数学常量
可配置只会制造漂移。C 类改值走代码评审，不走配置。

## 门禁（防回潮）

| 门禁 | 覆盖 |
|---|---|
| `web/test/i18nCoverage.test.ts` | Web `t('…')` 字面量键 + `.label/.hint/.name/.group` 表值都有 en 词条 |
| `web/test/webTableI18n.test.ts` | Web 数据表 `label/hint/desc/title/text/message/…` 的 CJK 值都有 en 词条 |
| `web/test/webHardcodedText.test.ts` | Web 的 `new Error` / toast·confirm·prompt / JSX `title`·`aria-label`·`placeholder` 不得裸 CJK |
| `tests/appTextCoverage.test.ts` | 服务端/CLI/审计的 `AppText.t` 键有 en 词条、分片无重复、用户可见上下文无裸 CJK |
| `tests/runtimeConfig.test.ts` | `src/config/app.json` 形状/正数校验，且被 web 与服务端共用 |
| `tests/magicValues.test.ts` | `TIMEOUT/TTL/POLL/LIMIT/CACHE/…` 数字常量必须来自 `RuntimeConfig/UI_TUNABLES`（C 类显式豁免） |

## C 类显式豁免清单（不在门禁里报错）

| 位置 | 理由 |
|---|---|
| `src/host/.../schema/protocolSchema.ts`、`contracts/schema/codeGenerator.ts` | 协议 schema 描述与 SDK 代码生成模板：开发者文档源，不是运行期 UI 文案 |
| `src/apps/tui/tuiAgentBridge.ts` 的 `TEXT_LIMIT/ARGS_LIMIT` | 纯展示截断，不随部署调节 |
| `desktop/src/main/SmokeHarness.ts`、`scripts/**` | CI/开发工具输出，不进产品 UI；桌面产品文案走 `DESKTOP_MESSAGES` |
| `rpcErrorCodes` 的 `'RPC 超时'`、`fleetLaneParser` 的 `'…（共'` | 协议/日志解析匹配标记，翻译会破坏匹配 |

## 迁移状态（2026-11-22）

- ✅ Web：全部 CJK 字面量在 AST 口径下都有 en 词条（0 missing）；数据表经 `t()` 消费；
  三条 Web 门禁在守。
- ✅ 服务端 / CLI / 审计 / 企业 / TUI / host 适配层：用户可见错误、提示、usage、报告、诊断、
  角色与模式指令全部走 `AppText.t()`；en 分片 server/cli/audit/common 全量，缺词会由门禁拦截。
- ✅ 可调参数：`src/config/app.json` 单一来源，首批 + 第二批 + 收尾（页面/缓存/markdown/部分 JSON/
  OIDC 超时）全部接入 `RuntimeConfig`/`UI_TUNABLES`，启动 fail-fast；`magicValues` 门禁防回潮。
- ✅ 剩余可调参数位于 `src/host` 内核适配层（laya/croner），按内核配置/env 体系管理，不在本仓 app 配置范围。

## 评审自检

1. 新文案进的是词条目录，还是裸字符串？（A 类）
2. 新数值会随环境/运营变化吗？会 → `app.json`；不会且属协议/安全/纯展示 → 命名常量并注释。（B/C 类）
3. 改 `app.json` 是否同步了 `RuntimeConfig` / `UI_TUNABLES` 的接口与校验？
4. 有没有在业务代码里直读 env / 文件再各自解析？配置只在启动层解析一次。
5. 新增 C 类豁免是否写进上表并说明理由？否则门禁会拒绝。
