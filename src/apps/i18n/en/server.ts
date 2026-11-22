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
  '预览服务绑定后拿不到监听端口（address=null）——拒绝以 port 0 假装成功':
    'Preview server has no listening port after bind (address=null); refusing to fake success with port 0',
};
