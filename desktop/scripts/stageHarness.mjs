#!/usr/bin/env node
/**
 * Stage 打包用的 Harness：dist + web/dist + defaults + native + 生产依赖。
 *
 * 打包态 electron-builder 把 `.desktop-stage/harness`
 * 复制到 `resources/harness`，布局必须保持 `dist`/`web`/`native`/`defaults` 同级
 * （这是 NativeKernel、runHttpServe、ConfigFactory 三处路径解析的共同前提）。
 *
 * ## 两个根目录
 *
 *   · `appRoot`   = 本仓库根：提供 `web/dist`（前端产物）、`dist` / `defaults` / `native`
 *     与 `.desktop-stage`（后端源码与产物都在本仓库，2026-11-04 整合后）；
 *   · `backendRoot` = 后端工作树根，**缺省即 appRoot**；用 `OMNI_BACKEND_ROOT` 指向另一份
 *     后端（上游 `omniharness` 或内核宿主）时，`dist`/`defaults`/`native`/`package.json`
 *     从那边取，`web/dist` 仍取本仓库。
 *
 * 依赖安装用后端的 package-lock，剔除前端库与重型可选包；`node_modules` 体积大时
 * 可先只做 `SKIP_DEPS=1` 的产物复制用于本地验证。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = resolve(desktopRoot, '..');
/** 后端工作树根（缺省 = 本仓库；可用 OMNI_BACKEND_ROOT 指向另一份后端）。 */
const backendRoot = (process.env.OMNI_BACKEND_ROOT ?? '').trim()
  ? resolve((process.env.OMNI_BACKEND_ROOT ?? '').trim())
  : appRoot;
const stage = join(appRoot, '.desktop-stage', 'harness');
const skipDeps = process.env.SKIP_DEPS === '1';

/** 断言输入存在。 */
function need(path, label) {
  if (!existsSync(path))
    throw new Error(`缺少 ${label}：${path}（先运行根目录 npm run web:build / 后端 npm run build）`);
}

need(join(backendRoot, 'dist', 'src', 'apps', 'cli', 'exec.js'), 'dist/src/apps/cli/exec.js');
need(join(appRoot, 'web', 'dist', 'index.html'), 'web/dist/index.html');
need(join(backendRoot, 'native', 'omni_napi.node'), 'native/omni_napi.node');

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const name of ['dist', 'defaults', 'native']) {
  cpSync(join(backendRoot, name), join(stage, name), { recursive: true });
}
cpSync(join(appRoot, 'web', 'dist'), join(stage, 'web'), { recursive: true });
cpSync(join(backendRoot, 'omniharness.json.example'), join(stage, 'omniharness.json.example'));
cpSync(join(backendRoot, 'package.json'), join(stage, 'package.json'));
cpSync(join(backendRoot, 'package-lock.json'), join(stage, 'package-lock.json'));
// 内核包是 vendored tarball（`file:vendor/...`）：stage 里的 `npm ci` 必须能解析同一路径，
// 否则打包态会在安装依赖这一步失败（2026-11-04 切到 kernel 包后的新增前提）。
if (existsSync(join(backendRoot, 'vendor'))) {
  cpSync(join(backendRoot, 'vendor'), join(stage, 'vendor'), { recursive: true });
}

// 侧车 Node 运行时：优先显式指定，否则用当前 node；必须是真的 node 可执行文件。
const nodeSource = (process.env.OMNI_NODE_BIN ?? '').trim() || process.execPath;
if (!/^node(?:\.exe)?$/iu.test(basename(nodeSource))) {
  throw new Error(`OMNI_NODE_BIN 不是 Node 可执行文件：${nodeSource}`);
}
const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
cpSync(nodeSource, join(stage, nodeName));

if (!skipDeps) {
  // 只装生产依赖；随后删除前端库（它们已经打进 web/dist）与 ONNX 缓存/重型可选包。
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(
    npm,
    ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
    {
      cwd: stage,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if (result.status !== 0) throw new Error(`npm ci 失败（${String(result.status)}）`);
  for (const name of [
    'react',
    'react-dom',
    'markdown-it',
    'katex',
    'highlight.js',
    '@huggingface',
    'onnxruntime-node',
    'onnxruntime-common',
    // 2026-10-25：`@huggingface` 删掉后它的传递依赖 onnxruntime-web（128.2 MB）仍会被
    // npm ci 装上；不删就是「删了模型、留着 128 MB 推理运行时」的死重量。
    'onnxruntime-web',
    // 纯类型包不应出现在运行时；实测 stage 里 2.3 MB。
    '@types',
  ]) {
    rmSync(join(stage, 'node_modules', name), { recursive: true, force: true });
  }
  const hfCache = join(stage, 'node_modules', '@huggingface', 'transformers', '.cache');
  rmSync(hfCache, { recursive: true, force: true });
}
// 旧版原生内核产物（`.old.node`，5.4 MB）只用于回滚，不应进安装包。
const nativeDir = join(stage, 'native');
if (existsSync(nativeDir)) {
  for (const name of readdirSync(nativeDir)) {
    if (name.endsWith('.old.node')) rmSync(join(nativeDir, name), { force: true });
  }
}
console.log(`[desktop] staged harness -> ${stage}`);
