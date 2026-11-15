/**
 * 只重打 NSIS 安装包：复用 `release/win-unpacked`，不重新 stage / 不重新压缩应用。
 *
 * 用途：改安装向导外观或文案（`installer/`、`electron-builder.yml` 的 nsis 段）后快速验证，
 * 不必走完整 `npm run dist`。前置是已有 `release/win-unpacked`（先跑过 `npm run pack`/`dist`）。
 *
 * 这条路与 `npm run dist` 的差别只有「应用载荷是现成的」；安装包本身仍由 electron-builder
 * 的 nsis 目标生成，所以 `installer/installer.nsh`、品牌 BMP、图标都与正式包同一套。
 *
 * 未做代码签名时加 `--config.win.signExecutable=false`：跳过签名（避免联网下载 winCodeSign），
 * 但保留 electron-builder 的图标/版本资源编辑（`signAndEditExecutable=false` 会把后者也一起关掉，
 * 旧写法 `-c.win.signAndEditExecutable=false` 还会被 CLI 当成配置文件路径而失败）。
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PackagedPayloadCheck } from './lib/payloadCheck.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const prepackaged = join(root, 'release', 'win-unpacked');
if (!existsSync(prepackaged)) {
  throw new Error(`缺少 ${prepackaged}：先跑 npm run pack（或 npm run dist）产出应用目录`);
}

// 2026-11-14 用户报障：这条「只重打 NSIS」的快捷路径曾复用 6 天前的 release/win-unpacked，
// 把「外观已更新、侧车仍是旧 dist」的安装包发出去，安装版启动即失败。这里先做载荷一致性
// 校验：与当前工作树不一致就拒绝打包，并明确告诉操作者该先跑哪条命令。
const appRoot = resolve(root, '..');
const backendRoot = (process.env['OMNI_BACKEND_ROOT'] ?? '').trim()
  ? resolve((process.env['OMNI_BACKEND_ROOT'] ?? '').trim())
  : appRoot;
const payloadProblems = [
  ...PackagedPayloadCheck.inspectHarness(join(prepackaged, 'resources', 'harness'), {
    backendRoot,
    webRoot: appRoot,
  }).problems,
  ...PackagedPayloadCheck.inspectDesktop(
    join(prepackaged, 'resources', 'app.asar'),
    join(root, 'dist'),
  ).problems,
];
if (payloadProblems.length > 0) {
  process.stderr.write('✗ release/win-unpacked 与当前源码不一致，拒绝重打安装包：\n');
  for (const problem of payloadProblems) process.stderr.write(`  - ${problem}\n`);
  throw new Error('先运行 npm run pack（或 npm run dist）刷新应用目录，再运行 npm run installer');
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
    '--config.win.signExecutable=false',
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
