// 应用层 en 词条分片（cli）：CLI 用法、输出与错误文案。
// 键 = 中文原文（与 AppText.t 的调用点逐字一致）；值 = English。
export const CLI: Readonly<Record<string, string>> = {
  '未开启（--probe-model 可探测模型连通性）': 'Not enabled (use --probe-model to test model connectivity)',
  '未找到配置文件（先运行 omniharness init）': 'No config file found (run omniharness init first)',
  'mock 适配器（脚本化应答，无需联网）': 'mock adapter (scripted responses, no network needed)',
  '缺省': 'default',
  '；Windows 受限令牌只削减特权与资源（restricting-SID 计数为 0），**无**文件/网络拒绝语义':
    '; on Windows the restricted token only trims privileges and resources (restricting-SID count is 0) and provides **no** file/network denial semantics',
  '生效档 {profile}；执行包装={execution}；内核强制={kernel}；后端真机可达={real}{note}':
    'effective profile {profile}; execution wrapper={execution}; kernel enforcement={kernel}; backend reachable={real}{note}',
  '已接': 'wired',
  '未接': 'not wired',
  '是': 'yes',
  '否': 'no',
  '未检测到可用沙箱后端（bwrap / sandbox-exec / Windows RestrictedToken 均不可用）':
    'No usable sandbox backend detected (bwrap / sandbox-exec / Windows RestrictedToken are all unavailable)',
  'OmniHarness 诊断报告': 'OmniHarness diagnostics report',
  '  Node 版本         : {version}': '  Node version      : {version}',
  '  内核版本          : @omniharness/kernel {version}':
    '  Kernel version    : @omniharness/kernel {version}',
  '  配置文件          : {state} / {valid}{error}':
    '  Config file       : {state} / {valid}{error}',
  '存在': 'present',
  '缺失': 'missing',
  '合法': 'valid',
  '非法': 'invalid',
  '  沙箱后端          : bwrap={bwrap} sandbox-exec={se} restrictedToken={rt}':
    '  Sandbox backends  : bwrap={bwrap} sandbox-exec={se} restrictedToken={rt}',
  '  插件目录可读      : {value}': '  Plugins dir read  : {value}',
  '  权限清单可读      : {value}': '  Permissions read  : {value}',
  '  后端构建          : {value}': '  Backend build     : {value}',
  '未构建（源码直跑）': 'not built (running from source)',
  '  工作台构建        : {value}（{dir}）{hint}': '  Workbench build   : {value} ({dir}){hint}',
  ' —— serve 能起但浏览器白页；先跑 npm run build:web':
    ' — serve starts but the browser shows a blank page; run npm run build:web first',
  '  缺省 serve 端口   : {port}（回环口径）{state}':
    '  Default serve port: {port} (loopback){state}',
  ' 空闲': ' free',
  ' 被占用（可能已有 serve 在跑；--port N 换端口）':
    ' in use (another serve may be running; use --port N to change)',
  '  模型连通性        : {detail}': '  Model connectivity: {detail}',
  '未探测': 'not probed',
  '  Worker 指标       : {value}': '  Worker metrics    : {value}',
  '无活动 Worker': 'no active workers',
  '{count} 个': '{count}',
  '    {name}: 激活 {activations} / 调用 {calls} / 失败 {failures} / 崩溃 {crashes}':
    '    {name}: activations {activations} / calls {calls} / failures {failures} / crashes {crashes}',
  '  隔离强度          : {level}（{basis}）': '  Isolation         : {level} ({basis})',
  '  网络守卫覆盖      : {surfaces}；shell 出网被拦={guarded}':
    '  Network guard     : {surfaces}; shell egress blocked={guarded}',
  '、': ', ',
  '  注入护栏          : {mode}（弱证据阈值 {thresholds}）':
    '  Injection guard   : {mode} (weak-evidence thresholds {thresholds})',
  '  注入护栏自检      : 不可用（见问题清单）':
    '  Injection self-test: unavailable (see issue list)',
  '  注入护栏自检      : recall={recall}% / FP={fp}% / precision={precision}%（{cases} 例，{basis}）':
    '  Injection self-test: recall={recall}% / FP={fp}% / precision={precision}% ({cases} cases, {basis})',
  '[OK] 未发现健康问题': '[OK] No health issues found',
  '[WARN] 发现 {count} 项问题:': '[WARN] {count} issue(s) found:',
  'resume/fork 模式需要 --prompt': 'resume/fork mode requires --prompt',
  '[omniharness] --format 只支持 html / md / json\n':
    '[omniharness] --format only supports html / md / json\n',
  '[omniharness] --source-format 只支持 omni / claude-code / codex / acp\n':
    '[omniharness] --source-format only supports omni / claude-code / codex / acp\n',
  '[omniharness] --redact 只支持 off / paths / secrets / all\n':
    '[omniharness] --redact only supports off / paths / secrets / all\n',
  '未知原因': 'Unknown reason',
  '可安装': 'Installable',
  '不可安装': 'Not installable',
  '包内无 index.js 入口，无法在沙箱中执行（H1 要求可运行验证）':
    'The bundle has no index.js entry and cannot run in the sandbox (H1 requires runnable verification)',
  '说明: 该能力属 Team 档；未持授权时请改用本地目录直接安装（核心功能不受影响）。\n':
    'Note: this capability is Team-tier; without a license, install from a local directory instead (core features are unaffected).\n',
  '严格': 'Strict',
  '宽松': 'Lenient',
  '未说明': 'Unspecified',
  '用法: omniharness bundle pack <profileName> [--key-file K] [--out-dir D] [--dir P]\n':
    'Usage: omniharness bundle pack <profileName> [--key-file K] [--out-dir D] [--dir P]\n',
  '，已签名': ', signed',
  '用法: omniharness bundle unpack <path.ohb> [--key-file K] [--dir P]\n':
    'Usage: omniharness bundle unpack <path.ohb> [--key-file K] [--dir P]\n',
  'capability install 未接线（缺少安装器装配，或 capability 未启用）。\n':
    'capability install is not wired (installer is missing or capability is disabled).\n',
  '未给原因': 'No reason given',
  '  注意：本包未签名（--allow-unsigned），资产记 external 档。\n':
    '  Note: this bundle is unsigned (--allow-unsigned); assets are recorded as external tier.\n',
  'capability 未启用（配置 `capability.enabled` 未开或未生效）。\n':
    'Capability is not enabled (`capability.enabled` is off or not effective).\n',
  '用法: omniharness model probe [--model-adapter X] [--base-url U] [--api-key K] [--model M] [--json]\n':
    'Usage: omniharness model probe [--model-adapter X] [--base-url U] [--api-key K] [--model M] [--json]\n',
  '用法: omniharness goal "<目标描述>" [--model-adapter ...] [--goal-max-iterations N]\n':
    'Usage: omniharness goal "<goal>" [--model-adapter ...] [--goal-max-iterations N]\n',
  'goal 子命令没有交互审批通道：`--approval ask` 会退化为全放行，已拒绝。':
    'The goal subcommand has no interactive approval channel: `--approval ask` would degrade to allow-all, so it was rejected.',
  '请改用 --approval rules|guardian|plan|deny，或使用 omniharness serve 的 Web 审批。\n':
    'Use --approval rules|guardian|plan|deny, or the Web approval flow in omniharness serve.\n',
  '用法: omniharness workflow --file workflow.json [--resume-run <runId>] [--model-adapter ...]\n':
    'Usage: omniharness workflow --file workflow.json [--resume-run <runId>] [--model-adapter ...]\n',
  'workflow 子命令没有交互审批通道：`--approval ask` 会退化为全放行，已拒绝。':
    'The workflow subcommand has no interactive approval channel: `--approval ask` would degrade to allow-all, so it was rejected.',
  '（无定时任务）\n': '(no scheduled tasks)\n',
  '用法: routines remove <name>\n': 'Usage: routines remove <name>\n',
  '用法: routines add --name N --prompt P [--every Nm | --cron "*/5 * * * *"] [--model-adapter mock]\n':
    'Usage: routines add --name N --prompt P [--every Nm | --cron "*/5 * * * *"] [--model-adapter mock]\n',
  '--every 需为正整数分钟（如 30m）\n': '--every must be a positive integer number of minutes (e.g. 30m)\n',
  '需指定 --every Nm 或 --cron "expr"\n': 'Specify --every Nm or --cron "expr"\n',
  '无到期任务\n': 'No due tasks\n',
  '用法: routines <add|list|remove|run>\n': 'Usage: routines <add|list|remove|run>\n',
  '[omniharness] 未找到 omniharness.json，使用内置默认配置（mock 模型）。\n':
    '[omniharness] omniharness.json was not found; using built-in defaults (mock model).\n',
  '              可运行 omniharness init 一键生成（或复制 omniharness.json.example 手改）。\n':
    '              Run omniharness init to generate one (or copy omniharness.json.example and edit it).\n',
  'TUI 需要交互式终端（TTY）。非 TTY 环境下请用 omniharness goal / 直接 `omniharness 任务描述` 等方式。\n':
    'TUI requires an interactive terminal (TTY). In non-TTY environments use omniharness goal or `omniharness <task>` instead.\n',
  '提示：当前模型适配器为 mock（脚本化响应）。真实对话请用 --model-adapter / --api-key 或 omniharness.json。\n':
    'Note: the current model adapter is mock (scripted responses). For real conversations use --model-adapter / --api-key or omniharness.json.\n',
  '用法: omniharness auth login --issuer URL --client-id ID [--client-secret S] [--redirect-uri URI] [--scope S]\n':
    'Usage: omniharness auth login --issuer URL --client-id ID [--client-secret S] [--redirect-uri URI] [--scope S]\n',
  'auth login 需 --issuer 与 --client-id\n': 'auth login requires --issuer and --client-id\n',
  'auth callback 需 --code\n': 'auth callback requires --code\n',
  'auth callback 需 --state（auth login 输出里已给出；防 CSRF 必带）\n':
    'auth callback requires --state (printed by auth login; required for CSRF protection)\n',
  'state 不匹配，拒绝处理（防 CSRF）\n': 'State mismatch; request rejected (CSRF protection)\n',
  '已获取': 'obtained',
  '未返回': 'not returned',
  '⚠️ --native 已请求但原生内核不可用（原生内核随包预编译；本仓无 native:build 脚本），已回退 TS 路径\n':
    '⚠️ --native was requested but the native kernel is unavailable (it ships prebuilt; this repo has no native:build script); falling back to the TS path\n',
  'MCP 桥接需 RegistryToolPort 型工具端口，已跳过\n':
    'MCP bridging requires a RegistryToolPort-style tool port; skipped\n',
  '模型适配器注册表缺少 mock 适配器': 'The model adapter registry is missing the mock adapter',
  '命令不会真正进入 bwrap/landlock/seatbelt/unshare。请改用 policy/restricted，':
    'Commands will not actually enter bwrap/landlock/seatbelt/unshare. Use policy/restricted instead,',
  '或等待执行包装接线后再启用。': 'or wait until the execution wrapper is wired before enabling this.',
  '用法: omniharness compare --prompt "任务" --adapter-a mock --adapter-b openai [--base-url-b URL --api-key-b KEY --model-b M]\n':
    'Usage: omniharness compare --prompt "task" --adapter-a mock --adapter-b openai [--base-url-b URL --api-key-b KEY --model-b M]\n',
  '=== A/B 对比 ===\n': '=== A/B comparison ===\n',
  'ℹ️ 凭据保险库已按 OMNIHARNESS_VAULT=0 关闭（Web 端会如实显示未接线，且不会创建密钥文件）\n':
    'ℹ️ The credential vault is disabled by OMNIHARNESS_VAULT=0 (the Web UI will report it as not wired, and no key file will be created)\n',
  'ℹ️ --vault-hydrate 已按 OMNIHARNESS_VAULT=0 跳过（该开关关闭了整个凭据保险库）\n':
    'ℹ️ --vault-hydrate was skipped because OMNIHARNESS_VAULT=0 disables the entire credential vault\n',
  'defaults/cliHelp.json 的 quickStart 应为字符串数组':
    'defaults/cliHelp.json quickStart must be an array of strings',
  '用法: omniharness identity <generate|show|sign|verify> [--private-key PKCS8_B64] [--runtime-id ID] [--payload STR] [--signature B64]\n':
    'Usage: omniharness identity <generate|show|sign|verify> [--private-key PKCS8_B64] [--runtime-id ID] [--payload STR] [--signature B64]\n',
  'identity 未配置：用 --private-key PKCS8_B64 指定密钥，或在配置中声明 agentIdentity\n':
    'Identity is not configured: pass --private-key PKCS8_B64 or declare agentIdentity in the config\n',
  'daemon 已停止\n': 'daemon stopped\n',
  'daemon 未运行\n': 'daemon is not running\n',
  '如已丢失，先 `omniharness daemon stop` 再 start（或启动前预设 OMNI_SERVE_TOKEN 固定令牌）。\n':
    'If it was lost, run `omniharness daemon stop` then start again (or preset OMNI_SERVE_TOKEN to pin the token).\n',
  '（令牌已固定为本次生成的值；停止后再启动会生成新令牌，旧 URL 失效）\n':
    '(The token is pinned to the value generated this time; restarting after stop generates a new token and invalidates old URLs)\n',
  '用法: omniharness mcp serve [--mcp-http-port N] | mcp list --server NAME=CMD | mcp call --server NAME=CMD --tool NAME [--args JSON] | ':
    'Usage: omniharness mcp serve [--mcp-http-port N] | mcp list --server NAME=CMD | mcp call --server NAME=CMD --tool NAME [--args JSON] | ',
  '用法: omniharness mcp auth --authorize-url URL --token-url URL --client-id ID --resource RESOURCE [--scope a,b] [--port N]\n':
    'Usage: omniharness mcp auth --authorize-url URL --token-url URL --client-id ID --resource RESOURCE [--scope a,b] [--port N]\n',
  '--port 必须是 0..65535 的整数\n': '--port must be an integer in 0..65535\n',
  '--limit 必须是 1..100 的整数\n': '--limit must be an integer in 1..100\n',
  '（没有匹配的 MCP server）\n': '(no matching MCP server)\n',
  '--mcp-http-port 必须是 0..65535 的整数\n': '--mcp-http-port must be an integer in 0..65535\n',
  '--mcp-http-path 必须以 / 开头\n': '--mcp-http-path must start with /\n',
  '用法: omniharness mcp list --server NAME=COMMAND | NAME=URL\n':
    'Usage: omniharness mcp list --server NAME=COMMAND | NAME=URL\n',
  '用法: omniharness mcp call --server NAME=COMMAND | NAME=URL --tool NAME [--args JSON]\n':
    'Usage: omniharness mcp call --server NAME=COMMAND | NAME=URL --tool NAME [--args JSON]\n',
  'native approval 需要 --name NAME [--args JSON]': 'native approval requires --name NAME [--args JSON]',
  'native tool-call 需要 --name NAME [--args JSON] [--call-id ID]':
    'native tool-call requires --name NAME [--args JSON] [--call-id ID]',
  '用法: omniharness native info|ping|tools|approval --name N [--args JSON] | session-submit --submission JSON | context | tool-call --name N [--args JSON] [--call-id ID] | bench [--iterations N]\n':
    'Usage: omniharness native info|ping|tools|approval --name N [--args JSON] | session-submit --submission JSON | context | tool-call --name N [--args JSON] [--call-id ID] | bench [--iterations N]\n',
  '原生内核不可用，无法基准（原生内核随包预编译；本仓无 native:build 脚本）':
    'The native kernel is unavailable, so benchmarking is not possible (it ships prebuilt; this repo has no native:build script)',
  '对琐碎纯逻辑裁决，JS V8 快于 N-API 边界往返——FFI 价值在系统 API 能力与重操作，勿对微调用使用':
    'For trivial pure logic, JS V8 is faster than an N-API boundary round trip—FFI pays off for system APIs and heavy operations, not micro-calls',
  '用法: omniharness lsp <definition|references|hover|status> --file PATH --line N --col N [--lsp "server cmd"]\n':
    'Usage: omniharness lsp <definition|references|hover|status> --file PATH --line N --col N [--lsp "server cmd"]\n',
  'LSP 未配置：用 --lsp "server cmd" 指定语言服务器（如 --lsp "typescript-language-server --stdio"）\n':
    'LSP is not configured: use --lsp "server cmd" to specify a language server (e.g. --lsp "typescript-language-server --stdio")\n',
  '用法: omniharness lsp <definition|references|hover> --file PATH --line N --col N [--lsp "server cmd"]\n':
    'Usage: omniharness lsp <definition|references|hover> --file PATH --line N --col N [--lsp "server cmd"]\n',
  '未找到 omni-cli 二进制（target/release|debug/omni-cli.exe），无法做子进程基准':
    'omni-cli binary not found (target/release|debug/omni-cli.exe); cannot run the subprocess benchmark',
  '[auth] --auth-required 需同时提供 --oidc-issuer / --oidc-client-id / --oidc-jwks-uri（真实 IdP 的 jwks_uri 端点）\n':
    '[auth] --auth-required requires --oidc-issuer / --oidc-client-id / --oidc-jwks-uri (the real IdP jwks_uri endpoint)\n',
  '将只用用户级（~/.omniharness/omniharness.json）与内置默认。\n':
    'Only user-level (~/.omniharness/omniharness.json) and built-in defaults will be used.\n',
  '              需要项目级差异化配置时，复制 omniharness.json.example 到本目录改名即可。\n':
    '              For project-level overrides, copy omniharness.json.example into this directory and rename it.\n',
  '可信': 'Trusted',
  '**不可信**': '**Untrusted**',
  '未签名（哈希链部分仍可独立复核）': 'Unsigned (the hash-chain part can still be checked independently)',
  '合格': 'Qualified',
  '**不合格**': '**Not qualified**',
  '已验签': 'Signature verified',
  '未检查（未给 --trust）': 'Not checked (no --trust)',
  '未签名': 'Unsigned',
  '通过': 'Passed',
  '未通过': 'Failed',
  '（无）': '(none)',
  'evolution cycle 会改动状态（台账写入 + 技能表晋升），必须显式加 --yes。\n':
    'evolution cycle mutates state (ledger write + skill promotion); --yes is required.\n',
  'evolution cycle 未接线（缺少运行时装配钩子）。\n':
    'evolution cycle is not wired (runtime assembly hook missing).\n',
  '台账链不完整（断链/被篡改）：fail-closed 拒绝回滚。\n':
    'The ledger chain is incomplete (broken or tampered): rollback rejected (fail-closed).\n',
  '  用 `omniharness --skills ': '  Reattach it to the next session with `omniharness --skills ',
  ' …` 把它接回下一次会话。\n': ' …`.\n',
  '单跑（exec）路径没有交互审批通道：`--approval ask` 在本路径上无对应实现，':
    'The one-shot (exec) path has no interactive approval channel: `--approval ask` has no implementation here,',
  '缺省分支会**静默降级为全放行**，故此处 fail-closed。':
    'and the default branch would **silently degrade to allow-all**, so this fails closed.',
  '请改用 `--approval rules|guardian|plan|deny`；需要"每次问人"请用 `omniharness serve`（由 Web UI 提供审批通道）。':
    'Use `--approval rules|guardian|plan|deny`; for "ask every time", use `omniharness serve` (the Web UI provides the approval channel).',
  '`--plugin-profile` 只在 `omniharness serve` 生效（插件集收敛点 applyPluginProfile 属 AppServer）；':
    '`--plugin-profile` only takes effect in `omniharness serve` (the applyPluginProfile convergence point belongs to AppServer);',
  '单跑路径上它零消费者，传了等于没传，故此处 fail-closed。':
    'it has no consumer on the one-shot path, so passing it is a no-op; this fails closed.',
  '会被接受但**不产生任何审计条目**（实测：带它跑一次再 `audit export` 得到空数组），故此处 fail-closed。':
    'it would be accepted but **produce no audit entries** (verified: one run with it then `audit export` returns an empty array), so this fails closed.',
  '需要审计链请用 `omniharness serve --audit-dir …`，再用 `audit export` 读取。':
    'For an audit chain, use `omniharness serve --audit-dir …` and read it with `audit export`.',
  '已自动提交变更（--auto-commit）\n': 'Changes auto-committed (--auto-commit)\n',
  'evolution 未启用（配置 evolutionRlvr.enabled / --evolution-rlvr 未开），无可跑的闭环。\n':
    'Evolution is not enabled (evolutionRlvr.enabled / --evolution-rlvr is off); there is no loop to run.\n',
  '（dry-run：未实际删除）': '(dry-run: nothing was actually deleted)',
  '未输入 Key，已放弃（配置未改动）\n': 'No key entered; aborted (configuration unchanged)\n',
  '\n下一步：\n  omniharness serve        起工作台\n  omniharness "任务描述"    跑一次任务\n':
    '\nNext steps:\n  omniharness serve        start the workbench\n  omniharness "task"       run one task\n',
  '选择模型厂商（输入编号或 ID，回车=1）：\n': 'Choose a model provider (enter a number or ID, Enter=1):\n',
  '提示：这是**降级**不是停摆——续期后即可恢复原档位。\n':
    'Note: this is a **downgrade**, not a shutdown—the original tier returns after renewal.\n',
  '用法: omniharness plugin load --file PATH [--allow PERM ...] [--allow-all]\n':
    'Usage: omniharness plugin load --file PATH [--allow PERM ...] [--allow-all]\n',
  '（无已安装插件；用 plugin search 发现，plugin install <name> 安装）\n':
    '(no installed plugins; discover with plugin search, install with plugin install <name>)\n',
  '（无匹配插件）\n': '(no matching plugins)\n',
  '用法: omniharness plugin install <name> [--dir DIR]\n':
    'Usage: omniharness plugin install <name> [--dir DIR]\n',
  '用法: omniharness plugin remove <name> [--dir DIR]\n':
    'Usage: omniharness plugin remove <name> [--dir DIR]\n',
  '（无插件集 profile；用 profile create <name> --plugin P1 --plugin P2 创建）\n':
    '(no plugin-set profiles; create one with profile create <name> --plugin P1 --plugin P2)\n',
  '用法: omniharness profile create <name> [--desc D] [--plugin P ...]\n':
    'Usage: omniharness profile create <name> [--desc D] [--plugin P ...]\n',
  '用法: omniharness profile delete <name>\n': 'Usage: omniharness profile delete <name>\n',
  '用法: omniharness profile use <name>\n': 'Usage: omniharness profile use <name>\n',
  'sdk call 需要 --method': 'sdk call requires --method',
  '--params 必须是 JSON 对象': '--params must be a JSON object',
  '用法:\n': 'Usage:\n',
  '（无会话文件）\n': '(no session files)\n',
  '用法: omniharness session export <sessionId> [--out FILE] [--format omni|claude-code]\n':
    'Usage: omniharness session export <sessionId> [--out FILE] [--format omni|claude-code]\n',
  '✗ 会话没有可导出的文本事件（空会话或全为工具事件）\n':
    '✗ The session has no text events to export (empty session or only tool events)\n',
  '用法: omniharness session import <FILE> [--storage-dir DIR]\n':
    'Usage: omniharness session import <FILE> [--storage-dir DIR]\n',
  '导入文件为空': 'The import file is empty',
  'omni 信封缺 events 数组（文件损坏或被截断）':
    'The omni envelope is missing its events array (file corrupted or truncated)',
  '——支持：omniharness.session.v1 信封 / Claude Code 会话 JSONL':
    '——supports: omniharness.session.v1 envelope / Claude Code session JSONL',
  'kv get 需要 --key KEY': 'kv get requires --key KEY',
  'kv set 需要 --key KEY --value VALUE': 'kv set requires --key KEY --value VALUE',
  'kv del 需要 --key KEY': 'kv del requires --key KEY',
  '(空)\n': '(empty)\n',
  'vault get 需要 --name NAME': 'vault get requires --name NAME',
  'vault set 需要 --name NAME --value VALUE': 'vault set requires --name NAME --value VALUE',
  'vault del 需要 --name NAME': 'vault del requires --name NAME',
};
