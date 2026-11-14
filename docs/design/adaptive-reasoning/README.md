# 推理强度按模型自适应（adaptive-reasoning）需求设计

> 2026-11-14 立项。状态：v1 实现中。
> 现状缺口：「推理强度」进度条按**厂商**下发档位渲染（deepseek 7 档、openai 5 档…），
> 但同一厂商里**不同模型**实际接受的档位范围并不相同——`deepseek-chat` 根本不接收
> `reasoning_effort`，`o3` 只接受 low–high，`gpt-5` 才有 minimal–xhigh。厂商级清单把
> 这些差异全部掩盖成同一条 7 段进度条；选中不支持档位的值会原样发给上游，由上游报错兜底。
> 用户口径：**进度条要按当前模型实际支持的最大/最小档自动变**。

## 1. 目标与非目标

**目标**：
- 「模型与推理强度」弹窗的档位进度条（`ModelPicker` ladder）按**当前模型**实际支持的
  档位集合渲染——切模型即变，min→max 由该模型决定；
- 切换模型时，已保存的强度值若不属于新模型的档位集合，**自动钳制**到最近的支持档
  （按标准强度序数距离），并把钳制结果写回配置（用户不必手动再点一次）；
- 档位数据单一真源在服务端目录（`model.catalog`），前端零硬编码厂商知识。

**非目标（v1 明确不做）**：
- 不做实时能力探测（OpenAI `/models` 等端点不返回 effort 支持矩阵，无可探测字段）——
  数据来自**内置每模型档位表**（见 §3），厂商档兜底；
- 不做 Anthropic thinking budget 的细粒度滑杆（内核 `ModelReasoningEfforts` 已把档位
  换算为预算，UI 维持 7 档词表不变）；
- 不改内核 vendored 代码——每模型表是 app 层知识，内核仍只下发厂商级 `reasoningEffort`；
- 不动设置页「默认模型与端点」以外的字段渲染。

## 2. 现状链路（调研结论）

```
kernel providerPresets（厂商级 reasoningEffort，唯一来源）
  └→ ModelCatalogService.catalog() → active.reasoningEffort
       └→ AppController.refreshModelCatalog → state.reasoningOptions
            └→ Composer → ModelPicker → ComposerOptions.ladder()
                 └→ 分段进度条（已知档位按强度序排列、未知档位排后、
                     当前值不在集合 → 末尾追加 + unsupported 标记「· 该模型不支持」）
```

- 档位词表（内核 config 枚举）：`none | minimal | low | medium | high | xhigh | max`；
- 厂商级下发（kernel presets 实测）：deepseek 7 档 / openai 5 档（minimal–xhigh）/
  moonshot·zhipu·gemini 3 档（low–high）/ dashscope·anthropic·ollama 空（UI 兜底 5 档）；
- 消费点只有两处：`ModelPicker`（弹窗进度条）与 `ModelTrigger`（按钮上的强度副文案）；
- **缺口 1**：档位集合是厂商粒度，模型差异不可见；
- **缺口 2**：`ComposerController.changeModel` 只 patch `model`，不钳制 `reasoning`
  ——越界值持久留在配置里，每次请求都带着（上游报错才暴露）。

## 3. 服务端：每模型档位表（`ModelEffortTable`）

新增 `src/apps/server/services/modelEffortTable.ts`（纯静态、零 IO、node 直测）：

```ts
/** 每模型档位条目：按 model id 的前缀/精确匹配。 */
interface EffortRule { readonly match: string; readonly exact?: boolean;
  readonly efforts: readonly string[]; }
```

- **解析顺序**：精确命中 > 最长前缀命中 > 厂商预设兜底（kernel `reasoningEffort`）；
- **空数组语义（模型级与厂商级不同）**：模型级 `[]` 表示**确证不支持任何 effort 档**
  （如 `deepseek-chat`、`gpt-4o`），UI 据此隐藏进度条与强度副文案；
  厂商级 `[]` 仍维持旧语义（回落 UI 内置兜底 5 档）——两者不相通，由「下发字段不同 +
  mapFor 只写命中规则的条目」保证：厂商兜底（含厂商级 `[]`）**不进** `effortsByModel`，
  未命中模型以**缺字段**表达"回落厂商档"（review P0-1）；
- **保守原则**：表只收窄**已确证**的差异，匹配不到的模型一律回落厂商档。宁可多显示
  （选中后上游报错可读），不可瞎收窄（把真支持的档藏掉）。

v1 内置表（2026-11 公开 API 口径，条目随内核词表，未知档位由前端排序兜底）：

| 厂商 | 匹配 | 档位 |
| --- | --- | --- |
| openai | `gpt-5*` | minimal / low / medium / high / xhigh |
| openai | `o1*` `o3*` `o4-mini*` | low / medium / high |
| openai | `gpt-4o*` `gpt-4.1*` `chatgpt-*` | []（不接收 reasoning_effort） |
| deepseek | `deepseek-chat` | []（非推理模型） |
| deepseek | `deepseek-reasoner` | 沿用厂商档（none–max） |
| 其它 / 未命中 | — | 厂商预设 `reasoningEffort` |

## 4. 目录契约增量（`model.catalog`）

`active` 返回体**纯增量**一个字段（既有字段与旧客户端行为不变）：

```jsonc
{
  "providers": [/* 既有 */],
  "active": {
    "id": "openai",
    "models": ["gpt-4o", "gpt-5", "o3"],
    "reasoningEffort": ["minimal","low","medium","high","xhigh"],  // 既有：厂商级
    "effortsByModel": {                       // 新增：模型级（仅对下发清单内的模型）
      "gpt-4o": [],
      "gpt-5": ["minimal","low","medium","high","xhigh"],
      "o3": ["low","medium","high"]
    }
  }
}
```

- 合成时机：`catalog()` 内对 `active.models`（实测清单 ∪ 当前值）逐个查表；
- `effortsByModel` 缺省 = 旧服务端（前端回落厂商档，行为=现状）；
- `browserHarness` stub 同步补该字段（判据读真契约）。

## 5. 前端：按模型渲染 + 切换钳制

**数据面**（`ComposerOptions` 新增两个纯函数，node 直测）：
- `effortsFor(model, effortsByModel?, providerEffort?)`：
  1. `effortsByModel[model]` 存在（含空数组）→ **原样返回**（模型级真值，空数组=无档位）；
  2. 未下发 `effortsByModel`（旧服务端）→ 返回厂商档（undefined 则 UI 内置兜底）；
- `closestLevel(levels, current)`：当前值不在 `levels` 时按内置强度序
  （`none<minimal<low<medium<high<xhigh<max`）取**序数距离最近**的档；距离相同取更强。
  **守卫**：`levels` 为空或当前值本就是 `''`（未设置）→ 返回 `''`——「未设置」不是
  「越界」，钳到最强档等于替用户悄悄开启推理。

**状态面**（`AppController.refreshModelCatalog`）：patch 新增
`effortsByModel`（localStorage 缓存 `omni-efforts-by-model`，与 models/label 同口径）。

**渲染面**（`ModelPicker`）：入参新增 `effortsByModel`；`ladder()` 的档位源从
`reasoningOptions`（厂商级）换成 `effortsFor(model, …)` 结果。空数组 → 整段进度条与
强度副文案不渲染（触发按钮只剩模型名）——「该模型不接收强度」本身就是读数。
unsupported 标记逻辑保留，作为旧缓存态的兜底展示。

**交互面**（`ComposerController.changeModel`）：切模型后取新模型档位集，当前
`reasoning` 不在其中且**非空** → `closestLevel` 钳制，**同一次 patch 合并** `{ model, reasoning }`
发 `config.update`（失败仍单条 toast，不重复打扰）。模型级确证不支持（命中 `[]`）时
**不写 `reasoning` 字段**：空串不是合法配置值（内核枚举 fail-closed），且保留原值意味着
切回支持模型时用户之前选的档位原样恢复——不支持只是"当前模型不显示强度"，不是"删掉偏好"
（review P0-2）。

## 6. 判据

| 层 | 判据 |
| --- | --- |
| server | `tests/modelEffortTable.test.ts`：精确/前缀/兜底解析、空数组语义、未知厂商回落、`catalog()` 的 `effortsByModel` 合成（假 deps 实例化） |
| web 纯逻辑 | `web/test/composerOptionsLadder.test.ts` 增：`effortsFor` 三分支（模型真值含空数组/旧服务端回落/未命中）、`closestLevel` 两端与中间钳制、空集清空 |
| web 交互 | `web/test/composer.test.ts` 增（若无则新建）：切模型 → 越界值钳制 + `{model, reasoning}` 合并写回；进度条段数随模型变化 |
| 契约 | `web/test/browserHarness.ts` stub + `tests/apiClientParity.test.ts`（若覆盖 catalog 形状）同步 |
| 全量 | server + web + desktop 类型检查与全部判据套件 |

## 7. 风险与兜底

- **表过期**（厂商新增模型/调整档位）：未命中一律回落厂商档（超集），加上前端
  unsupported 标记双保险——显示可能偏宽，但**不会**把真支持的档藏掉；
- **新旧版本交叉**：旧 web 忽略新字段；新 web 对旧 server 回落厂商档（= 现状）；
- **localStorage 陈旧**：`refreshModelCatalog` 每次连接成功后覆盖；
- **钳制写回与并发**：钳制并入切换模型的同一次 `config.update`，无额外请求窗口。
