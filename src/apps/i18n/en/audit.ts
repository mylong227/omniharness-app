// 应用层 en 词条分片（audit）：审计出证 / 复核的 CLI 与报告文案。
// 键 = 中文原文（与 AppText.t 的调用点逐字一致）；值 = English。
export const AUDIT: Readonly<Record<string, string>> = {
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
