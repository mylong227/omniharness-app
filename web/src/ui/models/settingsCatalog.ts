// 设置面清单（**单一事实源**，2026-11-20 从 SettingsModel.ts 目录化拆出）：
// 哪些键可改、取值域是什么、归在哪一栏。三层语义严格区分：
//   ① 键（key）：`Config` 的字段名；② 字段（Field）：面板里的一行；③ 分栏（TAB）：归哪一屏。
//   一个键只出现在一个字段里；一个字段只属于一个分栏。断言钉在 web/test/settingsPane.test.ts。
// 本文件零逻辑零状态（纯声明 + 查表函数）；读写通道在 SettingsModel.ts。

import type { Config } from '../../types/models.ts';
import type { IconName } from './Icon.ts';

/** 设置分栏 key。 */
export type SettingsTabKey =
  | 'general'
  | 'model'
  | 'runtime'
  | 'permission'
  | 'desktop'
  | 'shortcuts';

/** 一个分栏。 */
export interface SettingsTabDef {
  /** 分栏 key（路由 `#settings=<key>` 与 `openSettings(tab)` 同值）。 */
  key: SettingsTabKey;
  /** 分栏标题。 */
  label: string;
  /** 一句话说明这一栏管什么（空态/引导用，避免用户靠猜）。 */
  hint: string;
  /** 控制台左导航用的线性图标（`models/Icon.ts` 的图标名）。 */
  icon: IconName;
}

/**
 * 分栏清单：顺序即设置类页面的默认顺序。
 *
 * 2026-10-26 控制台重构后，设置不再是独立模态的六个分栏，而是「工作台控制台」里的
 * 基础设置组；配置集（profiles）移出设置，回到它自己的完整管理面板（避免"设置里只能
 * 应用、面板里才能增删"的两套入口）。
 */
export const SETTINGS_TABS: readonly SettingsTabDef[] = [
  {
    key: 'general',
    label: '常规',
    hint: '界面语言、聊天模式、主题与两栏宽度、工作区与会话范围',
    icon: 'sliders',
  },
  {
    key: 'model',
    label: '模型与厂商',
    hint: '厂商接入、API Key、默认模型与自定义端点',
    icon: 'package',
  },
  {
    key: 'runtime',
    label: '运行时',
    hint: '适配器、沙箱、存储、步数与成本预算、模型熔断、上下文与检索、缓存与防火墙、长期记忆、专家能力',
    icon: 'command',
  },
  {
    key: 'permission',
    label: '权限',
    hint: '审批模式、升级策略与参数级规则',
    icon: 'shield',
  },
  { key: 'desktop', label: '桌面', hint: '托盘、开机启动、更新与诊断', icon: 'monitor' },
  { key: 'shortcuts', label: '键盘快捷键', hint: '全局快捷键与输入框按键', icon: 'keyboard' },
];

/** 字段类型。 */
export type SettingsFieldKind = 'select' | 'text' | 'switch' | 'number';

/** 一个设置字段（行）。 */
export interface SettingsField {
  /** `Config` 的字段名（结构化段时是段名，如 `retrievalContext`）。 */
  key: keyof Config;
  /**
   * 结构化段内的路径（如 `['degradeLadder','shapersAggressive']`）。
   *
   * 缺省 = 字段值就是顶层键本身；声明后 `key` 指向整个段，本字段只编辑段内一个叶子。
   * 同一段可有多行字段（共用 `key`、不同 `path`），唯一性由 {@link fieldId} 保证。
   */
  path?: readonly string[];
  /** 所属分栏。 */
  tab: SettingsTabKey;
  /** 行标签。 */
  label: string;
  /** 控件类型。 */
  kind: SettingsFieldKind;
  /** 下拉取值域（kind==='select'）。 */
  options?: readonly string[];
  /** 占位提示（kind==='text'）。 */
  placeholder?: string;
  /** 一行说明。 */
  hint?: string;
  /**
   * 改动需重启才生效（2026-11-17 i18n 修复）：行尾常驻「需重启」标记的**结构化真源**。
   * 此前 ConsoleUI 用 `hint.includes('重启')` 在 t() 翻译**后**的文案上做中文子串判断——
   * en 词条不含「重启」二字，标记静默失效。声明在字段上，渲染层不再猜文案。
   */
  needRestart?: boolean;
  /**
   * 同栏内的卡片分组（`fieldsOfGroup(tab, group)` 过滤；缺省进该栏的默认卡）。
   * 2026-11-14 设置页补全后运行时栏一张卡装不下（存储/成本熔断/长期记忆各自成卡）。
   */
  group?: string;
  /**
   * 路径选择入口（2026-11-14 用户口径：路径不要手输粘贴）：'dir' = 目录选择（FolderPicker），
   * 'file' = 文件选择（FilePicker）。声明后行内渲染「选择…」按钮弹起统一资源选择面板，
   * 手输通道保留。判据 pickerUniformity 钉住「路径字段必须有 browse」。
   */
  browse?: 'dir' | 'file';
  /**
   * 落盘时把值写成"清除"（服务端约定 `null` = 显式清除）而不是 no-op。
   * 目前只有 `baseUrl` 需要：留空＝回落厂商默认端点。
   */
  clearWhenEmpty?: boolean;
  /**
   * [只在服务端配置里出现、但本面板不编辑] 的键（如 providerKeys 由厂商卡片管）不在此声明。
   * 需要额外输入的字段（如 API Key）用 `custom` 承载，见 MODEL_KEY_FIELDS。
   */
}

/**
 * number 字段的前端取值范围（先挡明显非法值；内核 normalizeConfig 是最终裁决，
 * 范围口径见 docs/design/settings-completion §3.1）。导出供判据对齐（settingsPane）。
 */
export const NUMBER_RANGES: Readonly<Record<string, { desc: string; check: (n: number) => boolean }>> = {
  maxSteps: { desc: '≥ 0（0 为内核语义）', check: (n) => Number.isInteger(n) && n >= 0 },
  costBudgetUsd: { desc: '> 0（USD）', check: (n) => Number.isFinite(n) && n > 0 },
  costBudgetSoftRatio: { desc: '0 < r ≤ 1', check: (n) => Number.isFinite(n) && n > 0 && n <= 1 },
  modelCircuitBreakerThreshold: { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  modelCircuitBreakerOpenMs: { desc: '≥ 1000 的整数（毫秒）', check: (n) => Number.isInteger(n) && n >= 1000 },
  // 结构化段内的数字行：键 = fieldId（段名.路径），不是顶层 Config 键。
  'retrievalContext.maxSnippets': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'retrievalContext.maxTokens': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'contextPolicy.cacheGuard.hitRateFloor': { desc: '0 < r ≤ 1', check: (n) => Number.isFinite(n) && n > 0 && n <= 1 },
  // alpha.21：读缓存 LRU 上限（正整数）。
  'toolCache.maxEntries': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  // 2026-11-20 settings-completion v2 专家面（四结构段的数字叶子）。
  'evolutionRlvr.maxCandidates': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'evolutionRlvr.samplesPerPrompt': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'evolutionRlvr.minReward': { desc: '≥ 0', check: (n) => Number.isFinite(n) && n >= 0 },
  'evolutionRlvr.minGain': { desc: '≥ 0', check: (n) => Number.isFinite(n) && n >= 0 },
  'decisionEngine.timeoutMs': { desc: '≥ 1000 的整数（毫秒）', check: (n) => Number.isInteger(n) && n >= 1000 },
  'calibratedAutonomy.minCalibration': { desc: '≥ 1 的整数', check: (n) => Number.isInteger(n) && n >= 1 },
  'calibratedAutonomy.alpha.readOnly': { desc: '0 < r < 1', check: (n) => Number.isFinite(n) && n > 0 && n < 1 },
  'calibratedAutonomy.alpha.stateMutating': { desc: '0 < r < 1', check: (n) => Number.isFinite(n) && n > 0 && n < 1 },
  'calibratedAutonomy.alpha.privilegedActuate': { desc: '0 < r < 1', check: (n) => Number.isFinite(n) && n > 0 && n < 1 },
};

/**
 * 字段的唯一 id：顶层键为键名，结构段字段为「段名.路径」（如 `retrievalContext.mode`）。
 *
 * 为什么需要：同一段可拆成多行（共用 `key`），渲染 key 与测试断言都必须按 id 而不是
 * 按 key 去重——否则 React 会因重复 key 复用错行，判据也会互相覆盖。
 * @param field 字段定义
 * @returns 稳定唯一 id
 */
export function fieldId(field: SettingsField): string {
  return [String(field.key), ...(field.path ?? [])].join('.');
}

/**
 * 设置表单全部字段（**单一事实源**）。
 *
 * 顺序 = 分栏内渲染顺序。新增设置项时只改这里 + `SettingsModel` 的读写分支；
 * 不要在组件里另写一份 `<label>` 清单（那正是旧实现漂移的成因）。
 */
export const SETTINGS_FIELDS: readonly SettingsField[] = [
  {
    key: 'model',
    tab: 'model',
    label: '默认模型',
    kind: 'text',
    placeholder: '如 gpt-4o / deepseek-v4-flash',
    hint: '留空则用厂商默认模型',
  },
  {
    key: 'reasoning',
    tab: 'model',
    label: '默认推理强度',
    kind: 'select',
    options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
    hint: '新会话的默认档位；输入区「模型与推理强度」弹窗可按会话覆盖（按模型自适应档位）',
  },
  {
    key: 'baseUrl',
    tab: 'model',
    label: '自定义 Base URL',
    kind: 'text',
    placeholder: 'OpenAI 兼容端点（留空＝清除覆盖）',
    hint: '留空即回落厂商默认端点',
    clearWhenEmpty: true,
  },
  {
    key: 'modelAdapter',
    tab: 'runtime',
    label: '模型适配器',
    kind: 'select',
    // 内核 ENUM_VALUES.modelAdapter 共 6 值（2026-11-14 补全漂移：llamacpp/gemini 此前漏了）。
    options: ['mock', 'openai', 'anthropic', 'responses', 'llamacpp', 'gemini'],
    hint: '切换适配器会同时刷新可用模型清单',
    group: 'exec',
  },
  {
    key: 'sandbox',
    tab: 'runtime',
    label: '沙箱',
    kind: 'select',
    options: [
      'passthrough',
      'policy',
      'restricted',
      'windows-native',
      'wsl-bwrap',
      'unshare',
      'bwrap',
      'landlock',
      'seatbelt',
      'container',
    ],
    hint: 'policy/restricted 只做进程内策略；windows-native 在 Windows 提供原生写隔离（需 omni-cli）；读/网络真隔离用 wsl-bwrap 或 container（需 Docker/Podman）',
    group: 'exec',
  },
  {
    key: 'elevatedSandbox',
    tab: 'runtime',
    label: '越权动作沙箱',
    kind: 'select',
    options: ['passthrough', 'policy', 'restricted'],
    hint: '提权命令等越权动作被批准时的降级执行档；不得弱于基础沙箱（内核 fail-closed 拒绝更弱的组合）',
    group: 'exec',
  },
  {
    key: 'storageAdapter',
    tab: 'runtime',
    label: '会话存储',
    kind: 'select',
    options: ['memory', 'jsonl', 'sqlite'],
    hint: '会话与事件的落盘方式；切换在重启后生效',
    needRestart: true,
    group: 'storage',
  },
  {
    key: 'storageDir',
    tab: 'runtime',
    label: '存储目录',
    kind: 'text',
    placeholder: '留空 = 内核默认目录',
    hint: '会话存档根目录；切换在重启后生效',
    needRestart: true,
    browse: 'dir',
    // 留空必须发 null（显式删除键）而不是空串：内核消费侧 `??` 不回落空串，
    // storageDir:'' 会让 jsonl 存储往 `mkdir('')` 里撞（review P1-1，与 baseUrl 同机制）。
    clearWhenEmpty: true,
    group: 'storage',
  },
  {
    key: 'maxSteps',
    tab: 'runtime',
    label: '单回合最大步数',
    kind: 'number',
    placeholder: '留空 = 内核默认',
    hint: '一次任务内模型最多可连续执行的工具步数；0 为内核语义',
    group: 'budget',
  },
  {
    key: 'costBudgetUsd',
    tab: 'runtime',
    label: '成本预算（USD）',
    kind: 'number',
    placeholder: '留空 = 不设预算',
    hint: '单任务累计 token 成本的硬上限（美元）；越限行为见下一行',
    group: 'budget',
  },
  {
    key: 'costBudgetSoftRatio',
    tab: 'runtime',
    label: '软阈值比例',
    kind: 'number',
    placeholder: '0 < r ≤ 1，如 0.8',
    hint: '达到硬预算的该比例时提前提醒（如 0.8 = 用到 80% 提醒）',
    group: 'budget',
  },
  {
    key: 'costBudgetOnExceed',
    tab: 'runtime',
    label: '超预算行为',
    kind: 'select',
    options: ['fail', 'warn'],
    hint: 'fail=中止回合 / warn=仅提示并继续',
    group: 'budget',
  },
  {
    key: 'modelCircuitBreaker',
    tab: 'runtime',
    label: '模型熔断',
    kind: 'switch',
    hint: '连续失败达到阈值后暂停调用该模型一段时间，避免对故障端点反复撞墙',
    group: 'budget',
  },
  {
    key: 'modelCircuitBreakerThreshold',
    tab: 'runtime',
    label: '熔断阈值（连续失败次数）',
    kind: 'number',
    placeholder: '如 5',
    hint: '连续失败达到该次数即打开熔断',
    group: 'budget',
  },
  {
    key: 'modelCircuitBreakerOpenMs',
    tab: 'runtime',
    label: '熔断打开时长（ms）',
    kind: 'number',
    placeholder: '如 30000',
    hint: '熔断打开后等待多久再放行下一次请求',
    group: 'budget',
  },
  {
    key: 'longTermMemoryEncryption',
    tab: 'runtime',
    label: '长期记忆加密',
    kind: 'switch',
    hint: '长期记忆落盘前加密；未配密钥文件时使用派生默认密钥',
    group: 'memory',
  },
  {
    key: 'longTermMemoryGovernance',
    tab: 'runtime',
    label: '长期记忆治理',
    kind: 'switch',
    hint: '按保留/清理策略自动整理长期记忆（去重、过期淘汰）',
    group: 'memory',
  },
  {
    key: 'longTermMemoryKeyFile',
    tab: 'runtime',
    label: '记忆密钥文件',
    kind: 'text',
    placeholder: '留空 = 派生默认密钥',
    hint: '加密密钥文件路径（配合「长期记忆加密」使用）',
    browse: 'file',
    // 留空发 null（显式删除键）：keyFile:'' 会让加密器打开空路径（review P1-1）。
    clearWhenEmpty: true,
    group: 'memory',
  },
  // ── 运行时·上下文与检索（内核 alpha.19 三段：M60 检索供给 / M61 语义召回 / M63+M65 上下文策略）──
  // 三段都是结构化对象：同一段拆多行，落盘时由 SettingsModel 合并成完整段提交
  // （服务端对 SECTION_REPLACE_KEYS 按段替换；留空 = 删除嵌套键，删空即清除整段）。
  {
    key: 'retrievalContext',
    path: ['mode'],
    tab: 'runtime',
    label: '检索供给',
    kind: 'select',
    options: ['off', 'bm25'],
    hint: 'bm25=每步按预算把会话历史检索片段推入上下文；缺省 off（显式开启才生效）',
    group: 'context',
  },
  {
    key: 'retrievalContext',
    path: ['rewriter'],
    tab: 'runtime',
    label: '查询改写',
    kind: 'select',
    options: ['off', 'model'],
    hint: 'model=每步经模型把多轮查询改写为自足查询（补指代/省略）；缺省 off',
    group: 'context',
  },
  {
    key: 'retrievalContext',
    path: ['rerank'],
    tab: 'runtime',
    label: '检索精排',
    kind: 'select',
    options: ['off', 'model'],
    hint: 'model=候选片段经模型语义精排再进预算裁剪；预算降档时自动跳过；缺省 off',
    group: 'context',
  },
  {
    key: 'retrievalContext',
    path: ['maxSnippets'],
    tab: 'runtime',
    label: '单步注入条数',
    kind: 'number',
    placeholder: '留空 = 内核默认 4',
    hint: '每次上下文组装最多注入的片段数（正整数）',
    group: 'context',
  },
  {
    key: 'retrievalContext',
    path: ['maxTokens'],
    tab: 'runtime',
    label: '注入 token 上限',
    kind: 'number',
    placeholder: '留空 = 内核默认 600',
    hint: '单步注入片段的 token 预算上限（正整数）',
    group: 'context',
  },
  {
    key: 'semanticRecall',
    path: ['mode'],
    tab: 'runtime',
    label: '语义召回',
    kind: 'select',
    options: ['off', 'on'],
    hint: 'on=装配本地嵌入模型，检索走 BM25 ∪ 语义混合；嵌入不可用时降级为 BM25 并在诊断中如实标注',
    group: 'context',
  },
  {
    key: 'contextPolicy',
    path: ['degradeLadder', 'shapersAggressive'],
    tab: 'runtime',
    label: '降档激进裁剪',
    kind: 'switch',
    hint: '软预算越档时启用旧轮激进裁剪（缺省关 = 维持既有行为）',
    group: 'context',
  },
  {
    key: 'contextPolicy',
    path: ['degradeLadder', 'compactionForce'],
    tab: 'runtime',
    label: '降档强制压缩',
    kind: 'switch',
    hint: '软预算越档时强制压缩上下文（缺省关 = 维持既有行为）',
    group: 'context',
  },
  {
    key: 'contextPolicy',
    path: ['cacheGuard', 'hitRateFloor'],
    tab: 'runtime',
    label: '缓存命中率下限',
    kind: 'number',
    placeholder: '留空 = 不告警',
    hint: 'prompt cache 累计命中率低于该值时告警（0 < r ≤ 1；只告警不阻断）',
    group: 'context',
  },
  // ── 运行时·缓存与防火墙（alpha.21：内核文件面补齐后补 UI 入口）──
  {
    key: 'toolCache',
    path: ['enabled'],
    tab: 'runtime',
    label: '读缓存',
    kind: 'switch',
    hint: '白名单纯读工具按（工具 + 入参 + 工作区写代次）记忆命中；任何写提交全量失效；缺省关，切换在重启后生效',
    needRestart: true,
    group: 'guard',
  },
  {
    key: 'toolCache',
    path: ['maxEntries'],
    tab: 'runtime',
    label: '缓存条目上限',
    kind: 'number',
    placeholder: '留空 = 内核默认',
    hint: 'LRU 上限（正整数）；到达上限淘汰最旧条目',
    group: 'guard',
  },
  {
    key: 'capflow',
    path: ['mode'],
    tab: 'runtime',
    label: '能力防火墙',
    kind: 'select',
    options: ['off', 'shadow', 'enforce'],
    hint: 'off=不跑 / shadow=留证放行 / enforce=命中即拒绝（外部与注入内容 → 写类工具）',
    group: 'guard',
  },
  {
    key: 'capflow',
    path: ['policyPath'],
    tab: 'runtime',
    label: '防火墙策略文件',
    kind: 'text',
    placeholder: '留空 = 随包默认策略',
    hint: '自定义 JSON 策略文件；不合 Schema 时启动即拒绝（fail-closed）',
    browse: 'file',
    group: 'guard',
  },
  // —— 专家能力卡（2026-11-20 settings-completion v2）：进化闭环 / 决策引擎 /
  //    校准自主性 / 角色门禁。四段都是结构化对象（SECTION_REPLACE 按段替换）；
  //    运行时装配在 boot 期，改动**重启生效**（needRestart 常驻标记）。
  //    路径语义字段（ledgerDir/pythonPath/modelDir/repo）不进 UI——pickerUniformity
  //    要求 browse 化，v2 留给配置文件（hint 已注明）。
  {
    key: 'evolutionRlvr',
    path: ['enabled'],
    tab: 'runtime',
    label: '进化闭环（RLVR）',
    kind: 'switch',
    hint: '任务末沉淀候选补丁并用验证命令打分；缺省关闭（零破坏）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'evolutionRlvr',
    path: ['autoRun'],
    tab: 'runtime',
    label: '任务末自动运行',
    kind: 'switch',
    hint: '每任务结束自动跑一轮进化（需先启用闭环）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'evolutionRlvr',
    path: ['kernel'],
    tab: 'runtime',
    label: '七环编排内核',
    kind: 'switch',
    hint: '启用 EvolutionKernel 七环编排与晋升台账（ADR-0008）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'evolutionRlvr',
    path: ['maxCandidates'],
    tab: 'runtime',
    label: '发现预算上限',
    kind: 'number',
    placeholder: '默认 12',
    hint: '单轮候选补丁数上限',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'evolutionRlvr',
    path: ['samplesPerPrompt'],
    tab: 'runtime',
    label: '每题采样数',
    kind: 'number',
    placeholder: '默认 8',
    hint: '每 prompt 的采样数',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'evolutionRlvr',
    path: ['minReward'],
    tab: 'runtime',
    label: '最低保留分',
    kind: 'number',
    placeholder: '默认 0',
    hint: 'RLVR 最低保留阈值（默认 0：仅保留 reward>0 的绿样本）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'evolutionRlvr',
    path: ['minGain'],
    tab: 'runtime',
    label: '最小增益门禁',
    kind: 'number',
    placeholder: '默认 0.05',
    hint: '门禁须超过基线的最小增益',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'evolutionRlvr',
    path: ['verifyCommand'],
    tab: 'runtime',
    label: '验证命令',
    kind: 'text',
    placeholder: '含 %CODE_FILE% 占位符；留空 = 奖励恒 0（安全旁路）',
    hint: '候选代码验证命令；路径语义字段（ledgerDir/repo 等）经配置文件设置',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'evolutionRlvr',
    path: ['verifyCodeFileExtension'],
    tab: 'runtime',
    label: '验证文件扩展名',
    kind: 'text',
    placeholder: '默认 .ts',
    hint: '验证临时文件扩展名（验证 JS 代码须传 .js）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'decisionEngine',
    path: ['mode'],
    tab: 'runtime',
    label: '决策引擎模式',
    kind: 'select',
    options: ['off', 'shadow', 'enforce'],
    hint: '本地 System-1 高频判断点：off=不装配 / shadow=跑记不改行为 / enforce=生效（库缺省 off；CLI 生产入口缺省 shadow；全程 fail-open）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'decisionEngine',
    path: ['warm'],
    tab: 'runtime',
    label: '常驻热进程',
    kind: 'switch',
    hint: '复用常驻热进程；关掉则每次决策单起子进程（单次可达数十秒）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'decisionEngine',
    path: ['trace'],
    tab: 'runtime',
    label: '决策 trace 落盘',
    kind: 'switch',
    hint: 'append-only JSONL，供 RLCD 温度校准；仅 mode≠off 时生效',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'decisionEngine',
    path: ['timeoutMs'],
    tab: 'runtime',
    label: '单次决策上限',
    kind: 'number',
    placeholder: '默认 120000 毫秒',
    hint: '单发路径单次决策上限（毫秒）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'calibratedAutonomy',
    path: ['enabled'],
    tab: 'runtime',
    label: '校准自主性',
    kind: 'switch',
    hint: '校准充分且风险分低于阈值的审批升级直接放行（缺省关闭；分布无关保证见 ConformalRiskCalibrator）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'calibratedAutonomy',
    path: ['minCalibration'],
    tab: 'runtime',
    label: '最少校准单元',
    kind: 'number',
    placeholder: '默认 30',
    hint: '每类校准单元不足该数不放权',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'calibratedAutonomy',
    path: ['alpha', 'readOnly'],
    tab: 'runtime',
    label: '只读类风险预算 α',
    kind: 'number',
    placeholder: '默认 0.05',
    hint: '0<r<1，越小越保守',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'calibratedAutonomy',
    path: ['alpha', 'stateMutating'],
    tab: 'runtime',
    label: '状态变更类 α',
    kind: 'number',
    placeholder: '默认 0.02',
    hint: '0<r<1，越小越保守',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'calibratedAutonomy',
    path: ['alpha', 'privilegedActuate'],
    tab: 'runtime',
    label: '提权执行类 α',
    kind: 'number',
    placeholder: '默认 0.01',
    hint: '0<r<1，越小越保守',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'rbac',
    path: ['enabled'],
    tab: 'runtime',
    label: '角色门禁（RBAC）',
    kind: 'switch',
    hint: '按角色表限制工具面；缺省不启用（零行为变更）；角色定义表 roles 经配置文件设置',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'rbac',
    path: ['role'],
    tab: 'runtime',
    label: '会话角色',
    kind: 'text',
    placeholder: '留空 = 未指定',
    hint: '本次会话身份（运行时状态，与角色定义表分离）',
    needRestart: true,
    group: 'expert',
  },
  {
    key: 'approval',
    tab: 'permission',
    label: '审批模式',
    kind: 'select',
    // 内核 ENUM_VALUES.approval 共 6 值（2026-11-14 补全漂移：deny/guardian/plan 此前漏了）。
    options: ['auto', 'deny', 'rules', 'guardian', 'ask', 'plan'],
    hint: 'auto 全自动 / rules 按规则 / ask 每次询问 / plan 只读规划（写类一律拒绝）/ guardian 守护裁决 / deny 全拒',
  },
  {
    key: 'escalation',
    tab: 'permission',
    label: '升级审批',
    kind: 'select',
    options: ['deny', 'ask', 'auto'],
    hint: '越权请求（提权/写盘等）的处理方式',
  },
  {
    key: 'autoApprove',
    tab: 'permission',
    label: '自动审批（免人工确认）',
    kind: 'switch',
    hint: '开启后不再弹出审批确认；危险操作仍受沙箱与规则约束',
  },
];

/**
 * 下拉字段的显示名（机读值 → 人话）。键 = `fieldId`，值 = 选项映射。
 *
 * 为什么单独一张表：枚举机读值必须原样提交（内核校验），但中文界面直接显示
 * `openai / policy / max` 等于让用户读代码。渲染层只查这张表，提交值不变。
 */
export const OPTION_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  modelAdapter: {
    mock: 'Mock（测试）',
    openai: 'OpenAI 兼容',
    anthropic: 'Anthropic',
    responses: 'OpenAI Responses',
    llamacpp: 'llama.cpp',
    gemini: 'Google Gemini',
  },
  sandbox: {
    passthrough: '完全放行',
    policy: '策略拦截',
    restricted: '严格限制',
    'windows-native': 'Windows 原生隔离',
    landlock: 'Landlock',
    seatbelt: 'Seatbelt',
    bwrap: 'bwrap',
    unshare: 'unshare',
    'wsl-bwrap': 'WSL bwrap',
    container: '容器',
  },
  elevatedSandbox: { passthrough: '完全放行', policy: '策略拦截', restricted: '严格限制' },
  storageAdapter: { memory: '内存（重启丢）', jsonl: 'JSONL', sqlite: 'SQLite' },
  costBudgetOnExceed: { fail: '中止回合', warn: '仅提示' },
  approval: {
    auto: '全部放行',
    deny: '全部拒绝',
    rules: '按规则',
    guardian: '守护裁决',
    ask: '每次询问',
    plan: '只读规划',
  },
  escalation: { deny: '拒绝提权', ask: '询问', auto: '自动提权' },
  reasoning: { none: '无', minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '极高', max: '最高' },
  'retrievalContext.mode': { off: '关闭', bm25: 'BM25 检索' },
  'retrievalContext.rewriter': { off: '关闭', model: '模型' },
  'retrievalContext.rerank': { off: '关闭', model: '模型' },
  'semanticRecall.mode': { off: '关闭', on: '开启' },
  'capflow.mode': { off: '关闭', shadow: '只留证（放行）', enforce: '生效（拒绝）' },
  'decisionEngine.mode': { off: '关闭', shadow: '影子模式（跑记不改行为）', enforce: '生效' },
};

/**
 * 未设置时**实际生效**的内核出厂值（仅展示；提交空值仍表示「用默认」）。
 *
 * 与 `CliDefaults` / 内核出厂值同步：只收 UI 可解释的少数键，不猜测未知默认。
 */
export const DEFAULT_LABELS: Readonly<Record<string, string>> = {
  storageAdapter: 'JSONL',
  sandbox: '策略拦截',
  elevatedSandbox: '策略拦截',
  approval: '按规则',
  escalation: '拒绝提权',
  costBudgetOnExceed: '中止回合',
  'retrievalContext.mode': '关闭',
  'retrievalContext.rewriter': '关闭',
  'retrievalContext.rerank': '关闭',
  'semanticRecall.mode': '关闭',
  'capflow.mode': '关闭',
};

/**
 * 取某个下拉值的显示名（未登记时回退机读值，保证不出现空白）。
 * @param field 字段
 * @param value 机读值
 * @returns 显示名（中文原文，渲染时再过 `t()`）
 */
export function optionLabelOf(field: SettingsField, value: string): string {
  return OPTION_LABELS[fieldId(field)]?.[value] ?? value;
}

/**
 * 取字段未设置时的生效值显示名（未登记返回 undefined，占位回退「未设置」）。
 * @param field 字段
 * @returns 生效值文案或 undefined
 */
export function defaultLabelOf(field: SettingsField): string | undefined {
  return DEFAULT_LABELS[fieldId(field)];
}

/**
 * 改动后需要刷新厂商目录（`model.catalog`）的键：
 * 模型下拉与厂商标题随之刷新，否则 UI 与生效配置会漂移一屏。
 */
export const CATALOG_KEYS: readonly string[] = ['model', 'modelAdapter'];

/** 已保存提示的自动消隐时长（ms）。 */
export const SAVED_HINT_MS = 1500;
