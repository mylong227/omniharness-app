# P3 动作与信任 · 取消 / 应用补丁 / 便签 / 压缩 / 本机签名

> 状态：**已实现并通过判据**（2026-11-11）  
> 上游：`README.md`（控制室）、`01-control-room-fleet.png`、`02-control-room-context.png`、`03-control-room-proof.png`  
> 范围：把 v1/P2 的“看见”推进到“可执行”，并为每个写操作加确认、审计与诚实边界

## 1. 五个能力与实现接缝

| 能力 | 内核接缝 | 实现要点 |
| --- | --- | --- |
| 取消单条子代理 | 内核 `SubagentTool` 只读 `ToolContext.signal`，app 拿不到内部 `SubagentOrchestrator` | 在 app 组合根包一层 `FleetToolPort`：`subagent` 调用创建独立 `AbortController`，与父信号联动；`fleet.cancel(callId)` abort 该控制器 |
| 应用补丁 | `git apply` + `FleetPatchReader` 路径/大小校验 | 先 `git apply --check` 再 `git apply`；必须 `confirm:true`；不自动提交/回滚 |
| 写交接便签 | `ResolvedConfig.scratchpad`（`FileScratchpad`） | `context.handoff.add` 写工作区 `.omniharness/scratchpad.json`；`ContextCompactor` 折叠时读取 `latest()` 并入摘要 |
| 强制压缩 | `ContextAssembler` + `ContextCompactor.compact(..., force=true)` | 仅空闲会话；确定性摘要零模型调用；游标以 `OMNI_COMPACTION_V1` system 事件写回存档 |
| 本机签名/信任根 | `JoseReceiptSigner` + `ExecutionCertificates.sign` + `AuditBundles.sign` | Ed25519 私钥落 `OmniHome/receipt-signing-key.pem`（首次 0600）；本机 trust store 验自签；未知 kid 仍 `UNPROVEN_ORIGIN` |

## 2. 需求与验收

### 2.1 取消子代理

| ID | 需求 | 验收 |
| --- | --- | --- |
| FC-01 | 运行中车道显示“取消子代理”，仅当有 `callId` | 完成/无 callId 时不显示 |
| FC-02 | 确认后只中止该调用；父会话继续 | 取消后父回合仍可继续；子代理状态转 `aborted`/失败 |
| FC-03 | 父会话取消仍传播到所有子代理 | 父 signal abort 时子 signal 同步 abort |
| FC-04 | 已结束/未知 callId 返回可读失败 | `call_not_found`，UI 不乐观改状态 |
| FC-05 | 取消不删除已产生的 patch | 之后仍可预览已有 patch |

实现：`FleetControlRegistry` + `FleetToolPort`（`fleetToolPort` 在 `AgentRuntimeHost` 的 agent/graph 运行时装配）；RPC `fleet.cancel`。

### 2.2 应用补丁

| ID | 需求 | 验收 |
| --- | --- | --- |
| FA-01 | 仅在 patch 预览成功且未截断时显示“应用补丁” | 截断 patch 按钮禁用并说明 |
| FA-02 | 二次确认，文案明确“改主工作区、不自动提交/回滚” | 取消不写盘 |
| FA-03 | 先 `git apply --check` 预检，冲突原样展示 stderr | 冲突不写入 |
| FA-04 | 只允许 patch 目录内普通文本文件 | 路径穿越/二进制拒绝 |
| FA-05 | 应用成功后刷新编队/变更面板 | 文件真实存在 |

RPC `fleet.applyPatch`；实现 `FleetPatchApplier`。

### 2.3 交接便签

| ID | 需求 | 验收 |
| --- | --- | --- |
| FH-01 | 上下文页可写工作区级便签（≤2000 字） | 写入后列表出现、落盘 |
| FH-02 | 便签被下次压缩摘要自动带上 | 压缩摘要含最新便签文本 |
| FH-03 | 便签未接线时显示原因，不伪造 | `handoffAvailable:false` |
| FH-04 | 空正文拒绝；写入失败有可读错误 | 不出现空便签 |

RPC `context.handoff.add` / `context.handoff.clear`；复用 `FileScratchpad`。

### 2.4 强制压缩

| ID | 需求 | 验收 |
| --- | --- | --- |
| FCM-01 | 仅空闲会话可执行 | 运行中返回 `session_running` |
| FCM-02 | 必须二次确认 | 未确认返回 `confirm_required` |
| FCM-03 | 使用内核确定性压缩（非模型摘要），写回 `OMNI_COMPACTION_V1` | 事件流新增 system 游标，可解码 |
| FCM-04 | 保存失败不留下半条事件 | `compaction_persist_failed` |
| FCM-05 | 无可折叠历史如实返回 noop | 不写游标 |

RPC `context.compact`；实现 `ContextCompactionService`。

### 2.5 本机签名/信任根

| ID | 需求 | 验收 |
| --- | --- | --- |
| FS-01 | 首次使用生成 Ed25519 密钥，落在用户级 `OmniHome` | 文件存在；不在工作区 |
| FS-02 | 每轮证书用本机密钥签名，SIGNATURE 真正验签通过 | `state=signed`；kid/alg 可见 |
| FS-03 | 导出证据包整包签名；本机导入可验签 | `signatureChecked:true` |
| FS-04 | 未知 kid / 无 trust store 仍如实未证明 | `UNPROVEN_ORIGIN`，不显示“可信” |
| FS-05 | 私钥损坏时降级未签名，不阻断凭证面板 | `structural` + SIGNATURE warn |

RPC 复用 `proof.build` / `proof.export` / `proof.verify`；新增 `ProofSignerService`。

## 3. 安全与诚实边界

- **取消**不是“删除子代理记录”：只 abort 在飞调用；已产生事件/patch 保留。
- **应用补丁**只写主工作区，不提交、不自动回滚；冲突必须让用户看见 stderr。
- **便签**是工作区级（不是会话级）；同一工作区所有会话共享。
- **强制压缩**会改写压缩游标；只在空闲会话执行，避免与 write-behind 竞争。
- **签名**是本机自签：`已签名（本机信任根）` ≠ `可信/已验证`；外部包未知 kid 仍不信任。
- 所有不可逆动作都必须二次确认；UI 不乐观更新状态。

## 4. 判据

- `tests/controlFleetControl.test.ts`：取消令牌/父信号联动/工具端口包装。
- `tests/controlDelivery.test.ts`：patch 路径、截断、`git apply` 真实应用。
- `tests/controlContext.test.ts`：便签读写/快照。
- `tests/controlCompaction.test.ts`：强制压缩写回可解码游标 / 运行中拒绝。
- `tests/controlSigning.test.ts`：本机签名、验签、签名导出包。
- 全量 `npm run web:test`；桌面冒烟；axe 控制室。
