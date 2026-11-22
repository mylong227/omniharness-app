// 应用层 en 词条分片（server）：RPC / 服务层用户可见文案。
// 键 = 中文原文（与 AppText.t 的调用点逐字一致）；值 = English。
export const SERVER: Readonly<Record<string, string>> = {
  '未找到运行: ': 'Run not found: ',
  '自动化未接线': 'Automations are not wired',
  '自动化不存在': 'Automation not found',
  '手动压缩会改写历史游标；必须显式确认。':
    'Manual compaction rewrites the history cursor; explicit confirmation is required.',
  '导出 AAT 会生成本地证据文件；必须显式确认。':
    'Exporting the AAT creates a local evidence file; explicit confirmation is required.',
  '变更决策审计设置需要显式确认。': 'Changing decision audit settings requires explicit confirmation.',
  'graph.get 需要 id': 'graph.get requires an id',
  '未找到图: ': 'Graph not found: ',
  'graph.save 需要 def（含 name 与 steps）': 'graph.save requires a def with name and steps',
  'graph.delete 需要 id': 'graph.delete requires an id',
  'graph.resume 需要 runId（来自上次 graph.run 的返回值）':
    'graph.resume requires a runId (from the previous graph.run result)',
  'graph.status 需要 runId': 'graph.status requires a runId',
  'graph.run 需要 id（已存图）或 def（内联定义）':
    'graph.run requires an id (stored graph) or a def (inline definition)',
  'graph.run 拒绝空计划：steps 至少需要一步': 'graph.run rejected an empty plan: steps requires at least one step',
  '未找到记忆: ': 'Memory not found: ',
  'memory.search 需要非空 query': 'memory.search requires a non-empty query',
  'memory.add 需要非空 text': 'memory.add requires non-empty text',
  'doctor 未接线（serve 组合根未注入 doctorReport）':
    'Doctor is not wired (serve composition root did not inject doctorReport)',
  'audit 未接线（serve 组合根未注入 audit sink）':
    'Audit is not wired (serve composition root did not inject an audit sink)',
  'profile.save 需要 profile.name': 'profile.save requires profile.name',
  'profile.delete 需要 id': 'profile.delete requires an id',
  '插件系统未初始化（serve 需注入 registry/pluginsDir）':
    'Plugin system is not initialized (serve must inject registry/pluginsDir)',
  'profile.apply 需要有效的 id 或内联 profile':
    'profile.apply requires a valid id or an inline profile',
  'bundle.pack 需要有效的 id 或内联 profile':
    'bundle.pack requires a valid id or an inline profile',
  'bundle.unpack 需要 zipPath': 'bundle.unpack requires zipPath',
  '插件系统未初始化（serve 需注入 pluginsDir）':
    'Plugin system is not initialized (serve must inject pluginsDir)',
  'plugins.install 需要 name': 'plugins.install requires a name',
  'plugins.remove 需要 name': 'plugins.remove requires a name',
  '插件目录未配置': 'Plugin directory is not configured',
  '会话正在运行，暂不能修改归属（结束后再试）':
    'The session is running; workspace ownership cannot change until it finishes (try again later)',
  'skills.get 需要 name': 'skills.get requires a name',
  'skills.delete 需要 name': 'skills.delete requires a name',
  'skills.apply 需要 name': 'skills.apply requires a name',
  'skills.apply 需要 instructions': 'skills.apply requires instructions',
  'skills.apply 需要 description': 'skills.apply requires a description',
  'modes.set 需要 threadId': 'modes.set requires threadId',
  'vault 未接线（serve 组合根未注入 vault）':
    'Vault is not wired (serve composition root did not inject vault)',
  'vault.set 需要非空 name': 'vault.set requires a non-empty name',
  'vault.set 需要非空 secret（要删除请用 vault.delete）':
    'vault.set requires a non-empty secret (use vault.delete to remove one)',
  'vault.delete 需要非空 name': 'vault.delete requires a non-empty name',
  '旧格式日志：未启用哈希链，无法校验完整性（非篡改）':
    'Legacy log format: hash chain is disabled, so integrity cannot be verified (not a tamper finding)',
  'changes.comments.add 需要非空 path 与 text':
    'changes.comments.add requires a non-empty path and text',
  'changes.comments.add 需要非负整数 line': 'changes.comments.add requires a non-negative integer line',
  'changes.comments.delete 需要 id': 'changes.comments.delete requires an id',
  '未找到评论: ': 'Comment not found: ',
  '当前工作区不是 git 仓库，无法执行 stage/revert':
    'The current workspace is not a git repository; stage/revert is unavailable',
  'changes.stageFile 需要 path': 'changes.stageFile requires a path',
  'git add 失败：': 'git add failed: ',
  'changes.revertFile 需要 path': 'changes.revertFile requires a path',
  '未跟踪文件不做服务端丢弃（防误删），请手动删除或先 stage':
    'Untracked files cannot be discarded server-side (to prevent accidental deletion); delete them manually or stage first',
  'git checkout 失败：': 'git checkout failed: ',
  'changes.stageHunk 需要 path': 'changes.stageHunk requires a path',
  'changes.stageHunk 需要 hunk 文本': 'changes.stageHunk requires hunk text',
  'git add -N 失败：': 'git add -N failed: ',
  'git apply --cached 失败：': 'git apply --cached failed: ',
  'changes.revertHunk 需要 path': 'changes.revertHunk requires a path',
  'changes.revertHunk 需要 hunk 文本': 'changes.revertHunk requires hunk text',
  'git apply -R 失败：': 'git apply -R failed: ',
  'hunk 文本缺少 @@ 头': 'Hunk text is missing an @@ header',
  'hunk 文本只能包含一个 @@ 头（拒绝多段补丁）':
    'Hunk text may contain only one @@ header (multi-part patches are rejected)',
  'hunk 文本含补丁头（拒绝多文件补丁注入）':
    'Hunk text contains a patch header (multi-file patch injection is rejected)',
  '这个子代理已不在运行列表里；可能已经结束。':
    'This subagent is no longer in the running list; it may have finished.',
  '请先进入一个目录再新建文件夹': 'Open a directory before creating a folder',
  '文件夹名称不能为空': 'Folder name cannot be empty',
  '非法的文件夹名称：': 'Invalid folder name: ',
  '父目录不存在：': 'Parent directory does not exist: ',
  '该文件夹已存在：': 'That folder already exists: ',
  'paths 必须是非空数组': 'paths must be a non-empty array',
  '按回合签名回执由 proof.* 提供，本进程无内核全局回执链':
    'Per-turn signed receipts are provided by proof.*; this process has no kernel-global receipt chain',
  '未装配内核遥测链（RuntimeTelemetry）': 'Kernel telemetry (RuntimeTelemetry) is not wired',
  '运行时尚未装配（首个回合后可见）': 'Runtime is not assembled yet (visible after the first turn)',
  '日预算必须是正数（tokens/天）': 'Daily budget must be positive (tokens/day)',
  '日预算必需为正数': 'Daily budget must be positive',
  'path 不能为空': 'path cannot be empty',
  '路径含控制字符': 'Path contains control characters',
  '仅接受仓库内相对路径': 'Only relative paths inside the repository are accepted',
  '路径越出仓库范围：': 'Path escapes the repository: ',
  '自动化名称必须为 1–80 字符': 'Automation name must be 1–80 characters',
  '自动化提示词必须为 1–8000 字符': 'Automation prompt must be 1–8000 characters',
  '自动化间隔必须为 5–1440 分钟': 'Automation interval must be 5–1440 minutes',
  '路径不能为空': 'Path cannot be empty',
  '目录不存在或不是文件夹: ': 'Directory does not exist or is not a folder: ',
  'checkpoint.list 需要 sessionId': 'checkpoint.list requires sessionId',
  'checkpoint.create 需要 sessionId': 'checkpoint.create requires sessionId',
  'checkpoint.create 需要 label': 'checkpoint.create requires a label',
  'checkpoint.rollback 需要 sessionId': 'checkpoint.rollback requires sessionId',
  '路径越界工作区': 'Path escapes the workspace',
  'src/config/app.json 缺少 web/server 段': 'src/config/app.json is missing the web/server sections',
  'daemon 启动失败：未能获取子进程 PID': 'Daemon failed to start: could not obtain the child process PID',
  '未持授权（core 档）': 'No license (core tier)',
  '；当前未持有效授权': '; no valid license currently',
  'license 验签未通过（正文被篡改或签名不匹配）':
    'License signature verification failed (payload tampered with or signature mismatch)',
  'license 签发时刻晚于当前时刻（超出容差），拒绝采信':
    'License issue time is later than the current time (beyond tolerance); refusing to trust it',
  'license 已过期：退回核心档（核心功能照常可用，请续期）':
    'License expired: falling back to the core tier (core features still work; please renew)',
  'license 格式非法：需要「头 / 正文 / 签名」三段':
    'Invalid license format: expected three segments (header / payload / signature)',
  'license 正文不是合法 JSON（base64 段损坏）':
    'License payload is not valid JSON (corrupted base64 segment)',
  'license 正文必须是对象': 'License payload must be an object',
  'license 缺 licenseId': 'License is missing licenseId',
  'license 缺 machineFingerprint': 'License is missing machineFingerprint',
  'license 缺签发/到期时刻': 'License is missing issued/expiry timestamps',
  'license 到期时刻必须晚于签发时刻': 'License expiry must be later than its issue time',
  '客户端全部断开（页面关闭 / 连接断开）':
    'All clients disconnected (page closed / connection lost)',
  '文件不存在或不可访问：': 'File does not exist or is inaccessible: ',
  '不支持的文件类型：': 'Unsupported file type: ',
  '读取失败：': 'Read failed: ',
  '未配置 API Key': 'API key is not configured',
  '读取失败: ': 'Read failed: ',
  'trace.read 需要非空 sessionId': 'trace.read requires a non-empty sessionId',
  '【本会话目标】': '[Session goal]',
  '【计划模式】先产出可执行的步骤方案（含涉及文件与验证方式）并停下来等确认；':
    '[Plan mode] First produce an executable step plan (including files and verification) and stop for confirmation;',
  '【绘图模式】动手前先用 Mermaid（结构/流程/时序）画清方案草图，再调用 sketch_write 保存草图，':
    '[Diagram mode] Before changing anything, sketch the plan in Mermaid (structure/flow/sequence), save it with sketch_write,',
  '预览服务绑定后拿不到监听端口（address=null）——拒绝以 port 0 假装成功':
    'Preview server has no listening port after bind (address=null); refusing to fake success with port 0',
  'answers 必须是数组': 'answers must be an array',
  'answers 的每一项必须是对象': 'each answers item must be an object',
  'answers 的每一项必须有非空 id': 'each answers item must have a non-empty id',
  'threadId 与 text（或附件）都必填': 'threadId and text (or an attachment) are required',
  'threadId 与 prompt（或附件）都必填': 'threadId and prompt (or an attachment) are required',
  '（用户补充了附件，请结合附件继续）':
    '(the user added attachments; continue with them in context)',
  '先选择一个会话，再执行压缩。': 'Select a session before compacting.',
  '会话正在运行，不能手动压缩；等本轮结束后再试。':
    'The session is running and cannot be compacted manually; try again after this turn finishes.',
  '会话没有可压缩的事件。': 'The session has no events to compact.',
  '压缩摘要降级，未写入游标；请稍后重试。':
    'The compaction summary was degraded and no cursor was written; try again later.',
  '内核没有产生可写入的压缩游标（可能没有可折叠历史）。':
    'The kernel produced no writable compaction cursor (there may be no foldable history).',
  '缺少决策记录 id。': 'Missing decision record id.',
  '这个会话还没有决策记录。': 'This session has no decision records yet.',
  '这条决策已不在当前事件流里；刷新后再试。':
    'This decision is no longer in the current event stream; refresh and try again.',
  '这个会话还没有决策记录；没有可导出的 AAT。':
    'This session has no decision records yet; there is no AAT to export.',
  '结构复核未通过；先处理断链/字段问题，再导出。':
    'Structural verification failed; resolve chain/field issues before exporting.',
  '共形复核未通过；先处理证据问题，再导出。':
    'Conformal verification failed; resolve the evidence issues before exporting.',
  '先选择一个会话，再打开决策账本。': 'Select a session before opening the decision ledger.',
  '原始审计链复核失败。': 'Raw audit-chain verification failed.',
  'AAT 链复核失败。': 'AAT chain verification failed.',
  'AAT 序号有缺口。': 'The AAT sequence has gaps.',
  '序号连续。': 'Sequence is contiguous.',
  'AAT 记录跨会话。': 'AAT records span multiple sessions.',
  '记录属于同一会话。': 'Records belong to the same session.',
  '单次授权被复用。': 'A single-use grant was reused.',
  '未发现授权复用。': 'No grant reuse found.',
  '所有决策都有授权主体。': 'Every decision has an authorization principal.',
  '校准单元可还原（full / delta）。': 'Calibration units are recoverable (full / delta).',
  '类摘要 / 全类摘要可按包内单元重算。':
    'Class summaries / full-class summaries can be recomputed from the bundled units.',
  '阈值 τ 可由 calibration units 重算。': 'The threshold τ can be recomputed from calibration units.',
  '风险分可由 risk features 重算。': 'Risk scores can be recomputed from risk features.',
  '风险权重模型摘要一致。': 'Risk-weight model digests match.',
  '每条放行都满足 riskScore < threshold。': 'Every allow satisfies riskScore < threshold.',
  '改动不可取回': 'Changes are unrecoverable',
  '写类工具已被禁用': 'Write-type tools were disabled',
  'patch 已截断': 'Patch was truncated',
  '以**未验证**状态收尾': 'finished in an **unverified** state',
  '未完成：达步数上限': 'Incomplete: step limit reached',
  '未完成：被失控熔断': 'Incomplete: circuit breaker tripped',
  '改动文件：': 'Changed files: ',
  '应用补丁会改写主工作区；必须显式确认。':
    'Applying the patch rewrites the main workspace; explicit confirmation is required.',
  '补丁超过 512 KB 且预览被截断，不能安全应用；请从补丁文件直接处理。':
    'The patch exceeds 512 KB and its preview was truncated, so it cannot be applied safely; process it from the patch file directly.',
  '工作区未定位，无法应用补丁。': 'Workspace is not resolved; cannot apply the patch.',
  '未知 git 错误': 'Unknown git error',
  '补丁路径必须是工作区内的相对路径。':
    'The patch path must be a relative path inside the workspace.',
  '工作区未定位，无法读取补丁。': 'Workspace is not resolved; cannot read the patch.',
  '补丁真实路径越过了工作区补丁目录。': 'The patch real path escapes the workspace patch directory.',
  '补丁路径不是普通文件。': 'The patch path is not a regular file.',
  '补丁包含 NUL 字节，无法作为文本预览。': 'The patch contains NUL bytes and cannot be previewed as text.',
  '路径无效': 'Invalid path',
  '不是文件': 'Not a file',
  '先选择一个会话，再打开凭证。': 'Select a session before opening credentials.',
  '这个回合没有可复核的事件。': 'This turn has no verifiable events.',
  'Merkle 根不一致：事件流可能被增删或改序。':
    'Merkle root mismatch: the event stream may have been added to, removed from, or reordered.',
  '未配置签名器：结构自洽（未签名），复核方无法确认签发方身份。':
    'No signer configured: structurally consistent (unsigned); a verifier cannot confirm the issuer identity.',
  '证书未绑定工具面摘要。': 'The certificate is not bound to the tool-surface digest.',
  '一致': 'consistent',
  '不一致': 'inconsistent',
  '本地审计链未启用（serve 组合根未注入 audit sink）。':
    'The local audit chain is not enabled (serve composition root did not inject an audit sink).',
  '本地审计链没有该会话的记录。': 'The local audit chain has no records for this session.',
  '证据包不是可序列化的 JSON 对象。': 'The evidence bundle is not a serializable JSON object.',
  '证据包缺少 version / sessions 结构。': 'The evidence bundle is missing its version / sessions structure.',
  '专业': 'Pro',
  '升级': 'Plus',
  '免费': 'Free',
  '名字里带轻量词（mini/nano/flash/lite/small/turbo…）⇒ 单次调用成本最低的那一档':
    'Name contains a lightweight marker (mini/nano/flash/lite/small/turbo…): the lowest per-call cost tier',
  '本地/自托管模型，不产生厂商账单 ⇒ 不受本地日预算倍率约束':
    'Local/self-hosted model with no vendor bill: not subject to the local daily-budget multiplier',
  'OpenAI o 系列（推理模型）按最高档计——它们的单次 token 消耗显著高于同代 chat 模型':
    'OpenAI o-series (reasoning models) count as the top tier—their per-call token use is markedly higher than same-generation chat models',
  '旗舰命名（opus / sonnet-4 / claude-4 / gpt-5）': 'Flagship naming (opus / sonnet-4 / claude-4 / gpt-5)',
  'GPT-4o / GPT-4.1 这一代旗舰 chat 模型': 'Flagship chat models of the GPT-4o / GPT-4.1 generation',
  '名字里带 pro/max/ultra/premium ⇒ 厂商自己标注的顶配档':
    'Name contains pro/max/ultra/premium: the vendor-labeled top tier',
  '推理型主力模型（deepseek-reasoner / R1 / v<N>-pro）':
    'Reasoning-oriented flagship models (deepseek-reasoner / R1 / v<N>-pro)',
  '通用主力命名（chat / standard / base / v<N>）——既非轻量也非旗舰，按中间档':
    'General-purpose naming (chat / standard / base / v<N>): neither lightweight nor flagship, so the middle tier',
  '工作区未配置': 'Workspace is not configured',
  '缺少 path': 'Missing path',
  '读取失败: 不是普通文件（目录或特殊文件）': 'Read failed: not a regular file (directory or special file)',
  '文件过大（超过 64 MiB，拒绝整文件读入内存）':
    'File too large (over 64 MiB; refusing to read it entirely into memory)',
  '非数组形状': 'Not an array',
  '解析失败': 'Parse failed',
  '缺少 sessionId': 'Missing sessionId',
  '缺少 keepEventId': 'Missing keepEventId',
  '该会话有回合正在运行：请先中止再回退':
    'A turn is running in this session: stop it before rewinding',
  'skills.apply 需要合法 name（非空、无空白与路径分隔符、≤64 字符）':
    'skills.apply requires a valid name (non-empty, no whitespace or path separators, ≤64 chars)',
  'skills.apply 需要 description（一句话说明技能何时用）':
    'skills.apply requires a description (one sentence on when to use the skill)',
  'skills.apply 需要 instructions（技能正文，不能为空）':
    'skills.apply requires instructions (the skill body, which cannot be empty)',
  '（本轮未附文字说明，请按下方模式要求推进）':
    '(no text explanation was attached this turn; proceed per the mode requirements below)',
  '\n该目标在后续每轮都会重申；每轮结束时给出「已完成 / 未完成 / 阻塞点」，不要提前宣告达成。':
    '\nThis goal is restated every turn; at the end of each turn report "done / not done / blocker" and do not declare completion early.',
  '本轮不要修改任何文件、不要执行有副作用的命令——写类操作会被审批层直接拒绝。':
    'Do not modify any files or run side-effecting commands this turn—write operations are rejected by the approval layer.',
  '然后基于草图实现；实现完成后回头核对草图与实际是否一致，不一致要说明差异原因。':
    'Then implement from the sketch; once done, check the sketch against the implementation and explain any differences.',
  '无效请求': 'Invalid request',
  '未认证或令牌无效（需 Authorization: Bearer <token>）':
    'Unauthenticated or invalid token (requires Authorization: Bearer <token>)',
  '缺少 path 查询参数': 'Missing path query parameter',
  'path 解码失败': 'Failed to decode path',
  '读取失败': 'Read failed',
  '预览服务内部错误': 'Internal preview-server error',
  '预览路径无法解析': 'Preview path cannot be resolved',
  '文件过大，拒绝整文件读入内存': 'File too large; refusing to read it entirely into memory',
};
