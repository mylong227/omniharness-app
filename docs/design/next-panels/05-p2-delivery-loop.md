# P2 交付闭环 · 编队补丁预览 + 证据离线复核

> 状态：**已实现并通过判据**（2026-11-11）  
> 上游：`README.md`（控制室 v1）、`01-control-room-fleet.png`、`03-control-room-proof.png`  
> 范围：只读交付能力；不改子代理生命周期、不写主工作区、不自动信任外部包

## 1. 为什么是这两个功能

控制室 v1 已经能回答「谁在跑 / 记得什么 / 这一轮能不能复核」，但两处仍然只有“结论”，没有“可操作的最后一步”：

1. **编队详情只显示 patch 路径和字节数**，用户无法在界面里确认补丁内容是否符合预期；只能离开应用去磁盘找文件。
2. **凭证只能导出，不能复核别人交来的包**；设计 PR-09 明确要求“本地选择 JSON → 逐层校验 → 结果列表”。

这两个功能都不依赖 signer / trust store / 子代理实例，属于 v1 之后风险最低、闭环收益最高的 P2 能力。

## 2. 非目标

- 不提供“应用补丁”“取消子代理”“重新派发”；
- 不构建/导入选择性披露包（`DisclosurePacks` 留到 P3）；
- 不验签（无 trust store 时如实标 `UNPROVEN_ORIGIN` / `signatureChecked:false`）；
- 不把导入的包写入当前会话、不自动合并、不上传网络。

## 3. 功能需求

### 3.1 编队补丁预览（Fleet Patch Preview）

| ID | 优先级 | 需求 | 验收 |
| --- | --- | --- | --- |
| FP-01 | P0 | 详情里仅当 `patchPath` 存在且未禁写/未标记不可取回时显示「查看补丁」 | 禁写/不可取回时按钮不存在，文案解释原因 |
| FP-02 | P0 | 点击后内联展开补丁预览：路径、字节数、unified diff 文本；不自动应用 | 预览与磁盘文件一致；无“应用”按钮 |
| FP-03 | P0 | 超过 512 KB 只读前 512 KB 并标 `已截断`；不超过时完整显示 | 大文件不冻结页面，明确标注截断 |
| FP-04 | P0 | 只允许读 `<workspace>/.omniharness/subagent-patches/` 下的普通文件；拒绝绝对路径、`..`、目录、符号链接逃逸 | 构造恶意路径返回 `patch_forbidden`，不泄露其它文件 |
| FP-05 | P1 | 文件不存在 / 不可读 / 非 UTF-8 文本分别给原因与重试 | 不显示空 `pre` 或 `undefined` |
| FP-06 | P1 | 预览可关闭；切换车道时旧预览清空，不串车道 | 选中另一条车道后不显示上一条 patch |

接口：`fleet.patch({ path })` → `{ ok:true,path,content,bytes,truncated }` 或 `{ ok:false,code,message }`。

错误码：`patch_forbidden` / `patch_unavailable` / `patch_not_text`。

### 3.2 证据包离线复核（Proof Import Verify）

| ID | 优先级 | 需求 | 验收 |
| --- | --- | --- | --- |
| PV-01 | P0 | 「导入复核」支持本地选择 `.json`，限制 2 MB；不读取任意路径、不上传 | 超过限制显示 `bundle_too_large`，无网络请求 |
| PV-02 | P0 | JSON 解析失败 / 非 AuditBundle 形状 → `bundle_invalid`，不抛整页错误 | 面板保留，可重新选择文件 |
| PV-03 | P0 | 调用 `AuditBundles.verify` 跑结构复核；结果按「事件证书 / 回执链 / 执行图 / 整包签名」展示 | 篡改一条事件后 `ok:false` 且问题码可见 |
| PV-04 | P0 | 无签名 / 无带外承诺时只写「结构自洽（未签名）」；`signatureChecked:false` 不得显示绿色盾牌 | 未签名包显示中性色 + 明确说明 |
| PV-05 | P0 | 展示包元信息：`exportedAt`、会话数、事件数、每会话证书根；问题码逐条列出 | 不折叠成一句“验证失败” |
| PV-06 | P1 | 可关闭结果并重新导入；不自动信任、不把结果写回当前会话 | 关闭后无残留；重新导入覆盖旧结果 |
| PV-07 | P1 | 导入包与当前会话不匹配时不自动“纠正”，只如实报告 | 显示 `SESSION_MISMATCH` 或包内会话清单 |

接口：`proof.verify({ bundle })` → `{ ok:true,verdict,summary }` 或 `{ ok:false,code,message }`。

错误码：`bundle_invalid` / `bundle_too_large`。

## 4. 数据模型

```ts
interface FleetPatchView {
  readonly path: string;
  readonly content: string;
  readonly bytes: number;
  readonly truncated: boolean;
}

interface ProofVerifyView {
  readonly verdict: {
    readonly ok: boolean;
    readonly problems: readonly { readonly code: string; readonly detail: string }[];
    readonly signatureChecked: boolean;
    readonly commitmentChecked: boolean;
  };
  readonly summary: {
    readonly exportedAt: string;
    readonly sessions: readonly {
      readonly sessionId: string;
      readonly eventCount: number;
      readonly eventRoot: string;
    }[];
    readonly eventCount: number;
  };
}
```

## 5. 安全与诚实边界

- **路径**：只允许 patch 目录内的普通文件；`realpath` 再校验一次，防符号链接逃逸；不跟随目录。
- **大小**：patch 512 KB、证据包 2 MB；服务端与前端双重限制。
- **文本**：补丁按 UTF-8 解码；遇到 NUL / 非法序列给 `patch_not_text`，不展示乱码当 diff。
- **证据**：`AuditBundles.verify` 的 `ok:true` 只表示结构自洽；`COMMITMENT_UNVERIFIED` 与 `UNPROVEN_ORIGIN` 原样展示。
- **不变式**：两个功能都只读，不写工作区、不写会话、不触发模型调用。

## 6. 验收

- 伪造 `../` / 绝对路径 / 符号链接均被拒绝，且 RPC 不抛未捕获错误。
- 512 KB patch 截断预览可读；超过 2 MB 的包被拒绝。
- 篡改导出的 JSON 中一条事件后复核返回 `ok:false`，问题码可见。
- 未签名包显示「结构自洽（未签名）」而不是「已验证」。
- `npm run typecheck` / `npm run web:test` / `npm run kernel:check` / 桌面冒烟通过。
