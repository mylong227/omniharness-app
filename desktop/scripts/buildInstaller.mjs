/**
 * 只重打 NSIS 安装包：复用 `release/win-unpacked`，不重新 stage / 不重新压缩应用。
 *
 * 用途：改安装向导外观或文案（`installer/`、`electron-builder.yml` 的 nsis 段）后快速验证，
 * 不必走完整 `npm run dist`。前置是已有 `release/win-unpacked`（先跑过 `npm run pack`/`dist`）。
 *
 * 这条路与 `npm run dist` 的差别只有「应用载荷是现成的」；安装包本身仍由 electron-builder
 * 的 nsis 目标生成，所以 `installer/installer.nsh`、品牌 BMP、图标都与正式包同一套。
 *
 * 未做代码签名时加 `-c.win.signAndEditExecutable=false`：否则 electron-builder 会联网下载
 * winCodeSign 去改 exe 资源（本机没有该缓存）。要签名的正式包走 `npm run dist`。
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const prepackaged = join(root, 'release', 'win-unpacked');
if (!existsSync(prepackaged)) {
  throw new Error(`缺少 ${prepackaged}：先跑 npm run pack（或 npm run dist）产出应用目录`);
}

const cli = join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
if (!existsSync(cli)) {
  throw new Error(`找不到 electron-builder CLI：${cli}（先 npm install）`);
}

const result = spawnSync(
  process.execPath,
  [
    cli,
    '--win',
    'nsis',
    '--x64',
    '--prepackaged',
    'release/win-unpacked',
    '-c.win.signAndEditExecutable=false',
    '--config',
    'electron-builder.yml',
  ],
  { cwd: root, stdio: 'inherit' },
);
if (result.error !== undefined || result.status !== 0) {
  throw new Error(`electron-builder 失败：${result.error?.message ?? `exit ${String(result.status)}`}`);
}

// 取 release/ 下最新的安装包（文件名带版本，不写死版本号）。
const releaseDir = join(root, 'release');
const setup = readdirSync(releaseDir)
  .filter((name) => name.endsWith('.exe'))
  .map((name) => join(releaseDir, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (setup === undefined) {
  throw new Error('没有生成安装包：检查 electron-builder 输出');
}
const hash = createHash('sha256').update(readFileSync(setup)).digest('hex');
writeFileSync(`${setup}.sha256`, `${hash}  ${basename(setup)}\n`, 'utf8');
process.stdout.write(`✅ 安装包已生成：${setup}\n   SHA256: ${hash}\n`);
