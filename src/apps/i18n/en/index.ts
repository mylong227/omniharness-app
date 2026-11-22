// 应用层 en 词条索引：分片合并为一张表（重复键由 tests/appTextCoverage 机检拒绝）。
import { AUDIT } from './audit.ts';
import { CLI } from './cli.ts';
import { COMMON } from './common.ts';
import { SERVER } from './server.ts';

export const EN: Readonly<Record<string, string>> = { ...COMMON, ...SERVER, ...CLI, ...AUDIT };

