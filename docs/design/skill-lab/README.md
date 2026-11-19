# 技能实验室 / Skill Lab（需求设计）

> 2026-11-20 立项。状态：**v1 已实现**（本轮）。
> 用户口径（next-panels §13）：「把这次经验沉淀成技能，怎么安全地改？」——需要
> diff / 回滚 / 差异测试三件套，是编辑面，不适合只读面板。

## 1. 勘察结论（决定架构的三件事）

1. **CRISPR 端口是纯 SPI 契约**：内核 2026-11-04 拆线删除了全部编辑器实现
   （`skillStackAssembler` 注释：实现存档 git 历史 attic/2026-11-03），`ResolvedConfig.crispr`
   是留给组合根的注入位。`CrisprEditSpec` / `CRISPRSkillEditorPort` 是已承诺深路径
   （可 import），`CrisprEditReport` **不在** exports 承诺清单（import 会 kernel:check
   红灯）→ 本仓用本地同构类型。
2. **前置 bug**：`skills.list` 读 `AppServerOptions.skills`，但三条组合根（stdio/serve/embed）
   均未注入 → 生产态回空数组；而会话注入走内核 fallback 是好的（`agent.js:90`）。
   即「会话里有技能、面板列表为空」。v1 必须先修数据源。
3. **信任闸决定了存储面**：工作区技能（`.omniharness/skills/<name>/SKILL.md`）在 serve
   默认关闭、须 `--trust-workspace`（桌面侧车不带此旗标）——文件面写的技能在桌面 APP
   根本不会被装配。**config 内联 `skills[]` 无信任闸、三条组合根通用**（FileConfig
   `skills?: readonly SkillEntry[]`，内核显式配置同名优先 = 天然的覆盖编辑语义）。

## 2. v1 范围（本轮落地）

- **存储 = config.skills[] 内联数组**（用户级 omniharness.json 单一写路径，与设置页同通道；
  `PERSISTABLE_KEYS` + `SECTION_REPLACE_KEYS` 收编 `skills`，UI 整段提交）。工作区文件面
  留 v2（牵 OmniHome/信任闸约定）。
- **数据源修复 + 新 skills 域模块**（第 19 个域模块，收编全部 skills.*）：
  - `skills.list`（修复）：`skillRegistry.list()`（boot 装配真值）∪ `fileConfig().skills`
    （编辑面最新态）按 name 归并，config 侧标 `editable:true`；
  - `skills.get`：单条完整 instructions（diff/编辑需要）；
  - `skills.diff`：改写预览——行级 LCS diff + 结构差异测试（fail-closed，见判据）；
  - `skills.apply`：差异测试通过 → `configStore.update({skills: 整段})` + `skills.changed`
    通知；**生效 = 下一会话**（registry 是 boot 装配，与设置页其余段同语义）；
  - `skills.delete`：仅 config 侧可删；registry-only（bundled/workspace）拒绝并说明。
- **app 侧 CRISPR 编辑器（SPI 语义落地）**：`SkillEditorService` 实现定点编辑 + 差异测试 +
  fail-closed 回滚（不写盘即无副作用）。`CrisprEditSpec` / `CRISPRSkillEditorPort` 类型
  import（surface 再生成）；Report 用本地同构类型。边界：UI 编辑永远精确点名
  （语义寻址/共振阈值不接，`addressThreshold` 不消费）。
- **UI**：SkillsTab 扩编辑态（选中 → 编辑 instructions/description/tags → diff 预览 →
  应用/放弃）+ 新建表单；diff 用纯模型 `SkillDiff`（LCS 行级，node 直测）。

## 3. 判据

- `tests/skillEditor.test.ts`：diff 预览不落盘 / apply 成功整段提交 / 结构差异测试三态
  （回读成功通过、空字段拒绝、config 内重名拒绝）/ registry-only 删除拒绝 / delete 成功。
- `web/test/skillDiff.test.ts`：LCS 行 diff 正确性 + 空 diff。
- parity 112→116（+4 方法，快照与归属断言同步）；apiClientParity 自动覆盖。
- settingsPersistKeys：`skills` 进 NEW_KEYS + 内核登记名单。

## 4. 边界（明确不做，v2+ 复活条件）

| 不做 | 为什么 | 复活条件 |
| --- | --- | --- |
| 内核侧补 CRISPR 实现 | SPI 设计意图 + alpha.33 已拆线归档 | 内核 R 轮重新落地编辑器 |
| 语义寻址 / 共振阈值 | UI 编辑永远精确点名 | 有「改一类技能」的批量诉求时 |
| 签名技能包编辑面 | `OMNI_SKILL_TRUSTED_KEY` 是分发信任锚，本地编辑不走签名通道 | 引入技能包分发工作流时 |
| 用户级 `~/.omniharness/skills/` 目录 | 新存储面牵 OmniHome 约定 | 跨工作区共享技能诉求时 |
| evolution 晋升台账 / RLVR 接线 | 自动进化闭环，非手工编辑面 | evolutionRlvr UI 化时 |
| 删除 bundled 技能 | bundled 只随包只读 | 内核提供卸载语义时 |
| 技能差异测试接 RLVR 基准 | v1 用确定性结构判据（见判据） | 有可执行基准（如 moireEnergy）的实跑环境时 |
