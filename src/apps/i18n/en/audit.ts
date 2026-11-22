// 应用层 en 词条分片（audit）：审计出证 / 复核的 CLI 与报告文案。
// 键 = 中文原文（与 AppText.t 的调用点逐字一致）；值 = English。
export const AUDIT: Readonly<Record<string, string>> = {
  '> {name} {version} · 生成于 {date} · schema `{schema}`':
    '> {name} {version} · generated at {date} · schema `{schema}`',
  '## 来源': '## Source',
  '- 文件：`{path}`': '- File: `{path}`',
  '- 格式：`{format}` · 会话：`{session}`': '- Format: `{format}` · Session: `{session}`',
  '- 工作区：`{workspace}` · 模型：`{model}`': '- Workspace: `{workspace}` · Model: `{model}`',
  '- 输入 SHA-256：`{sha}`': '- Input SHA-256: `{sha}`',
  '- 时间范围：{start} → {end}（{duration}）': '- Time range: {start} → {end} ({duration})',
  '## 摘要': '## Summary',
  '| 项目 | 值 |': '| Item | Value |',
  '| 记录 | {count} |': '| Records | {count} |',
  '| 未识别 | {count} |': '| Unrecognized | {count} |',
  '| 脱敏 | {mode} |': '| Redaction | {mode} |',
  '| 工具调用 | {count} |': '| Tool calls | {count} |',
  '| 工具失败 | {count} |': '| Tool failures | {count} |',
  '| 涉及文件 | {count} |': '| Files touched | {count} |',
  '| 审批 | {count} |': '| Approvals | {count} |',
  '## 完整性': '## Integrity',
  '- 算法：`sha256` · 链头：`{head}`': '- Algorithm: `sha256` · Chain head: `{head}`',
  '- 记录数：{count} · 创世：`{genesis}`': '- Records: {count} · Genesis: `{genesis}`',
  '- 复核：`omniharness audit verify <本文件>`（或与报告内嵌载荷逐字节对照）':
    '- Verify: `omniharness audit verify <this file>` (or compare byte-for-byte with the embedded payload)',
  '## 完整载荷': '## Full payload',
  '<details><summary>展开 JSON（哈希链覆盖其中每条记录）</summary>':
    '<details><summary>Expand JSON (the hash chain covers every record)</summary>',
  '哈希链证明“报告自生成后未被改动”，不证明会话本身真实、也不证明生成者身份。':
    'The hash chain proves this report has not changed since generation; it does not prove the session is authentic or identify the generator.',
  '| 输入 token | {count} |': '| Input tokens | {count} |',
  '| 输出 token | {count} |': '| Output tokens | {count} |',
  '| 缓存读 token | {count} |': '| Cached-read tokens | {count} |',
  '| 总 token | {count} |': '| Total tokens | {count} |',
  '## 文件变更': '## File changes',
  '源里没有可识别的写类工具调用或 diff。':
    'No recognizable write-type tool calls or diffs were found in the source.',
  '| 路径 | 触及 | 新增 | 删除 |': '| Path | Touches | Added | Deleted |',
  '## 时间线': '## Timeline',
  '> 仅展示前 {shown} 条（共 {total} 条）；完整数据见文末载荷。':
    '> Showing the first {shown} of {total} records; see the payload at the end for the full data.',
  '| # | 时间 | 类别 | 事件 | 详情 |': '| # | Time | Kind | Event | Detail |',
  '未知': 'unknown',
  '为防误读非会话文件已拒绝；请先切分出单次会话再出证。':
    'Rejected to avoid misreading a non-session file; split it into a single session before exporting evidence.',
  '审计出证只面向单次会话文件。': 'Audit evidence export only accepts single-session files.',
  '若确认格式可用 `--source-format omni|claude-code|codex|acp` 显式指定。':
    'If the format is confirmed, specify it explicitly with `--source-format omni|claude-code|codex|acp`.',
  '多个输入文件时 --out 必须是目录（不能是单份报告的路径）':
    'With multiple input files, --out must be a directory (not a single report path)',
  '——--strict 判为失败\n': '——--strict treats this as a failure\n',
  '没有可处理的输入文件': 'No input files to process',
  '没有可复核的报告文件（支持 .html / .md / .json，或它们的目录）':
    'No report files to verify (supports .html / .md / .json, or directories containing them)',
};
