// en 词条分片：设置页（SettingsSurface、ProviderCard、SettingsModel；旧的 SettingsModal 已于 2026-10-28 删除）。键 = 中文原文（与 t() 的键逐字一致，含 {name} 占位符）。
export const EN_SETTINGS: Record<string, string> = {
  // 「常规」页的界面偏好（2026-10-29 起外观页并入常规：语言 + 主题 + 两栏宽度同屏）
  主题: 'Theme',
  深色: 'Dark',
  浅色: 'Light',
  跟随系统: 'Follow system',
  '界面跟随系统的浅色 / 深色设置，系统切换时自动跟随。当前：':
    'Follows the system light/dark setting and updates live. Now: ',
  '已锁定为': 'Locked to ',
  '；选「跟随系统」可重新交给系统决定。':
    '. Choose “Follow system” to hand the decision back to the system.',
  '两套主题共用同一组 token（黑/白/灰），只交换明度方向；切换后立即生效并记住选择。':
    'Both themes share one token set (black/white/gray) with inverted lightness direction; changes apply instantly and are remembered.',
  语言: 'Language',
  中文: '中文',
  English: 'English',
  '界面文案即时切换并记住选择。': 'UI text switches instantly and your choice is remembered.',

  // 顶部与导航
  设置: 'Settings',
  '关闭设置': 'Close settings',
  '关闭（Esc）': 'Close (Esc)',
  设置分栏: 'Settings sections',
  模型: 'Model',
  '厂商接入、API Key、默认模型与自定义端点': 'Providers, API keys, default model and custom endpoint',
  运行时: 'Runtime',
  '适配器、沙箱、存储、步数与成本预算、模型熔断、长期记忆': 'Adapter, sandbox, storage, per-turn steps & cost budget, model circuit breaker, long-term memory',
  权限: 'Permissions',
  '审批模式、升级策略与免确认开关': 'Approval mode, escalation policy and confirmation toggle',
  外观: 'Appearance',
  '主题与界面密度': 'Theme and UI density',
  配置集: 'Profiles',
  '切换配置集、查看当前生效插件': 'Switch profiles and view active plugins',

  // 「模型」栏
  厂商接入: 'Providers',
  '{done}/{total} 已配置 Key': '{done}/{total} keys configured',
  '保存 Key → 检测（真实请求厂商端点）→ 启用。凭据由服务端打码存储，界面不回显原文。':
    'Save key → probe (a real request to the provider endpoint) → enable. Credentials are stored masked on the server and never shown in the UI.',
  '读取厂商目录…': 'Loading provider catalog…',
  '读取厂商目录失败：{msg}': 'Failed to load provider catalog: {msg}',
  '厂商目录为空：defaults/providers.json 可能缺失或不可读。':
    'Provider catalog is empty: defaults/providers.json may be missing or unreadable.',
  '读取配置失败：{msg}': 'Failed to load settings: {msg}',
  已配置: 'Configured',
  当前: 'Active',
  '默认模型与端点': 'Default model & endpoint',
  '默认模型': 'Default model',
  '如 gpt-4o / deepseek-v4-flash': 'e.g. gpt-4o / deepseek-v4-flash',
  '留空则用厂商默认模型': 'Leave empty to use the provider default model',
  '自定义 Base URL': 'Custom base URL',
  'OpenAI 兼容端点（留空＝清除覆盖）': 'OpenAI-compatible endpoint (leave empty to clear the override)',
  '留空即回落厂商默认端点': 'Leave empty to fall back to the provider default endpoint',
  '模型适配器': 'Model adapter',
  '切换适配器会同时刷新可用模型清单': 'Switching the adapter also refreshes the available model list',
  沙箱: 'Sandbox',
  '命令执行环境的隔离方式': 'Isolation mode for command execution',
  'policy/restricted 只做进程内策略；windows-native 在 Windows 提供原生写隔离（需 omni-cli）；读/网络真隔离用 wsl-bwrap 或 container（需 Docker/Podman）':
    'policy/restricted are in-process only; windows-native provides native Windows write isolation (requires omni-cli); use wsl-bwrap or container (requires Docker/Podman) for real read/network isolation',

  // 「运行时」栏
  '适配器与执行环境': 'Adapter & execution environment',
  工作区: 'Workspace',
  当前工作区: 'Current workspace',
  '工作区由启动参数或用户级配置决定（`--workspace` / `~/.omniharness/omniharness.json`），界面内不提供切换——改它等于换一整个项目上下文。':
    'The workspace is set by launch args or user-level config (`--workspace` / `~/.omniharness/omniharness.json`); it cannot be switched here — changing it means a whole new project context.',

  // 「权限」栏
  审批: 'Approval',
  '审批模式': 'Approval mode',
  'auto 全自动 / rules 按规则 / ask 每次询问': 'auto = fully automatic / rules = by rules / ask = confirm each time',
  '升级审批': 'Escalation approval',
  '越权请求（提权/写盘等）的处理方式': 'How unauthorized requests (privilege escalation, disk writes, etc.) are handled',
  '自动审批（免人工确认）': 'Auto-approve (no manual confirmation)',
  '开启后不再弹出审批确认；危险操作仍受沙箱与规则约束':
    'No more approval prompts when on; dangerous operations are still constrained by the sandbox and rules',
  '参数级规则': 'Per-command rules',
  '上面三档是**全局默认**；要按命令/参数逐个放行或拦截（例如只允许 `git status`），在「权限」面板里编辑规则表。':
    'The three options above are **global defaults**; to allow or block specific commands/args (e.g. only `git status`), edit the rule table in the "Permissions" panel.',
  '打开权限规则面板': 'Open permission rules panel',

  // 「配置集」栏
  '配置集（Profile）': 'Profiles',
  应用配置集: 'Apply profile',
  '选择并应用…': 'Select and apply…',
  '应用后立即生效，当前生效插件见下': 'Takes effect immediately; active plugins shown below',
  当前生效插件: 'Active plugins',
  '（默认）': '(default)',
  '新建 / 删除 / 打包配置集在「配置集」面板里完成。': 'Create / delete / export profiles in the "Profiles" panel.',
  '打开配置集面板': 'Open profiles panel',
  '已应用配置集': 'Profile applied',
  '应用配置集失败：{msg}': 'Failed to apply profile: {msg}',
  '、': ', ',

  // 厂商卡片（ProviderCard）
  '● 当前使用': '● In use',
  '已保存 {key}，输入新值覆盖': 'Saved {key}; enter a new value to replace it',
  '输入 API Key': 'Enter API key',
  '保存 Key': 'Save key',
  检测: 'Probe',
  '{name} 可用模型': '{name} available models',
  启用此厂商: 'Enable this provider',
  '检测未通过：{msg}（保存有效 Key 后重试）': 'Probe failed: {msg} (save a valid key and retry)',
  '已保存 Key，点「检测」拉取真实可用模型清单': 'Key saved — click "Probe" to fetch the real available model list',
  '未配置 Key：保存 → 检测 → 启用后才会显示可用模型': 'No key configured: save → probe → enable to see available models',
  未知原因: 'unknown reason',

  // 保存与提示（SettingsModel / SettingsSurface）
  已保存: 'Saved',
  '请输入 API Key': 'Please enter an API key',
  '{name} Key 未修改（输入新值才会覆盖）': '{name} key unchanged (enter a new value to overwrite)',
  '{name} Key 已保存（服务端打码存储）': '{name} key saved (stored masked on the server)',
  '保存失败：{msg}': 'Save failed: {msg}',
  '{name} 连通（{count} 个模型，来源 {source}）': '{name} connected ({count} models, from {source})',
  '{name} 不可用：{msg}': '{name} unavailable: {msg}',
  '检测失败：{msg}': 'Probe failed: {msg}',
  '没有可用模型，请先检测': 'No available models — run a probe first',
  '{name} 已启用（模型 {model}），下一条消息即生效': '{name} enabled (model {model}); takes effect on the next message',
  '启用失败：{msg}': 'Enable failed: {msg}',

  // 「桌面」栏（DesktopSettingsSection）
  桌面: 'Desktop',
  '托盘、开机启动、更新与诊断': 'Tray, startup, updates and diagnostics',
  '当前是浏览器模式；托盘、开机启动与自动更新只在安装版中可用。':
    'Browser mode: tray, launch-at-login and auto-update are only available in the installed desktop app.',
  版本: 'Version',
  平台: 'Platform',
  窗口与启动: 'Window & startup',
  关闭时最小化到托盘: 'Minimize to tray on close',
  已开启: 'On',
  已关闭: 'Off',
  '长任务在后台继续运行；托盘菜单可随时恢复窗口。':
    'Long tasks keep running in the background; restore the window from the tray menu at any time.',
  开机启动: 'Launch at login',
  '登录系统后以托盘方式启动（Windows/macOS）。':
    'Start in the tray after signing in (Windows/macOS).',
  更新: 'Updates',
  '读取中…': 'Loading…',
  当前已是最新版本: 'You are up to date',
  '正在检查更新…': 'Checking for updates…',
  '发现新版本 {version}': 'Version {version} is available',
  '正在下载… {percent}%': 'Downloading… {percent}%',
  '新版本 {version} 已下载，可安装': 'Version {version} downloaded — ready to install',
  '更新失败：{message}': 'Update failed: {message}',
  当前构建未启用自动更新: 'Auto-update is disabled in this build',
  检查更新: 'Check for updates',
  下载更新: 'Download update',
  安装并重启: 'Install and restart',
  诊断: 'Diagnostics',
  打开日志目录: 'Open log directory',
  '查看诊断信息': 'Show diagnostics',
  '重启 Harness': 'Restart Harness',
  未设置: 'Not set',

  // 设置页内核能力补全（2026-11-14，docs/design/settings-completion §3）
  '默认推理强度': 'Default reasoning effort',
  '新会话的默认档位；输入区「模型与推理强度」弹窗可按会话覆盖（按模型自适应档位）':
    'Default level for new sessions; the "Model & reasoning" popover overrides per session (adaptive per model)',
  '越权动作沙箱': 'Elevated-action sandbox',
  '提权命令等越权动作被批准时的降级执行档；不得弱于基础沙箱（内核 fail-closed 拒绝更弱的组合）':
    'Fallback sandbox for approved elevated actions; must not be weaker than the base sandbox (the kernel rejects weaker combos)',
  存储: 'Storage',
  '会话与事件的落盘方式与位置；改动在重启后生效。':
    'How and where sessions and events are persisted; changes apply after restart.',
  '会话存储': 'Session storage',
  '会话与事件的落盘方式；切换在重启后生效': 'How sessions and events are persisted; applies after restart',
  '存储目录': 'Storage directory',
  '留空 = 内核默认目录': 'Leave empty for the kernel default directory',
  '会话存档根目录；切换在重启后生效': 'Root directory for session archives; applies after restart',
  '步数与成本': 'Steps & budget',
  '限制单回合的执行步数与 token 成本；熔断在模型连续失败时暂停调用。':
    'Limits per-turn steps and token cost; the circuit breaker pauses a failing model.',
  '单回合最大步数': 'Max steps per turn',
  '留空 = 内核默认': 'Leave empty for kernel default',
  '一次任务内模型最多可连续执行的工具步数；0 为内核语义':
    'Tool steps a model may take consecutively within one task; 0 has kernel-level meaning',
  '成本预算（USD）': 'Cost budget (USD)',
  '留空 = 不设预算': 'Leave empty for no budget',
  '单任务累计 token 成本的硬上限（美元）；越限行为见下一行':
    'Hard cap on accumulated token cost per task (USD); behavior on exceed below',
  '软阈值比例': 'Soft threshold ratio',
  '0 < r ≤ 1，如 0.8': '0 < r ≤ 1, e.g. 0.8',
  '达到硬预算的该比例时提前提醒（如 0.8 = 用到 80% 提醒）':
    'Warn early when the budget reaches this ratio (0.8 = warn at 80%)',
  '超预算行为': 'On budget exceeded',
  'fail=中止回合 / warn=仅提示并继续': 'fail = abort the turn / warn = notify and continue',
  '模型熔断': 'Model circuit breaker',
  '连续失败达到阈值后暂停调用该模型一段时间，避免对故障端点反复撞墙':
    'Pause a model after consecutive failures to stop hammering a broken endpoint',
  '熔断阈值（连续失败次数）': 'Circuit breaker threshold (consecutive failures)',
  '如 5': 'e.g. 5',
  '连续失败达到该次数即打开熔断': 'Open the breaker after this many consecutive failures',
  '熔断打开时长（ms）': 'Circuit breaker open duration (ms)',
  '如 30000': 'e.g. 30000',
  '熔断打开后等待多久再放行下一次请求': 'How long to wait before letting the next request through',
  '长期记忆': 'Long-term memory',
  '跨会话记忆的加密与治理；未配密钥文件时加密使用派生默认密钥。':
    'Encryption and governance for cross-session memory; encryption falls back to a derived key without a key file.',
  '长期记忆加密': 'Memory encryption',
  '长期记忆落盘前加密；未配密钥文件时使用派生默认密钥':
    'Encrypt memory before persisting; uses a derived default key without a key file',
  '长期记忆治理': 'Memory governance',
  '按保留/清理策略自动整理长期记忆（去重、过期淘汰）':
    'Maintain long-term memory automatically (dedupe, expiry)',
  '记忆密钥文件': 'Memory key file',
  '留空 = 派生默认密钥': 'Leave empty for the derived default key',
  '加密密钥文件路径（配合「长期记忆加密」使用）': 'Key file path for memory encryption',
  '「{name}」{reason}': '"{name}" {reason}',
  需为数字: 'must be a number',
  '取值范围：{range}': 'allowed range: {range}',
  '≥ 0（0 为内核语义）': '≥ 0 (0 has kernel-level meaning)',
  '> 0（USD）': '> 0 (USD)',
  '0 < r ≤ 1': '0 < r ≤ 1',
  '≥ 1 的整数': 'integer ≥ 1',
  '≥ 1000 的整数（毫秒）': 'integer ≥ 1000 (ms)',
  'auto 全自动 / rules 按规则 / ask 每次询问 / plan 只读规划（写类一律拒绝）/ guardian 守护裁决 / deny 全拒':
    'auto = fully automatic / rules = by rules / ask = confirm each time / plan = read-only planning (writes denied) / guardian = guardian verdict / deny = reject all',
};
