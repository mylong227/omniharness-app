#!/usr/bin/env node
/**
 * 内核边界门禁：证明本应用**真的**在消费 `@omniharness/kernel`，而不是又长回一份内嵌副本。
 *
 * 七条判据（任一失败退出码 1）：
 * 1. `package.json` 的 `@omniharness/kernel` 必须是 `file:vendor/*.tgz`（单一真源 + 可复现）；
 * 2. 仓库根不得再存在 `src/{kernel,contracts,protocols}`；
 * 3. `src/**` 不得出现解析到这三个目录的相对导入（宿主的相对路径必须落在 `src/host` 内）；
 * 4. `src/host/kernel/` 必须存在指向包路径的导入（证明不是只改配置、代码没用上）；
 * 5. `vendor/*.tgz` 的 SHA-512 必须与 `package-lock.json` 里记录的 integrity 逐字节一致；
 * 6. 包内原生内核必须可加载（`NativeKernel.available() === true` 且 ping 成功）；
 * 7. **对接面单点**：`src/**` 里只有 `src/host/kernel/<area>.ts` 允许导入 `@omniharness/kernel`——
 *    业务代码一律经 `src/host/kernel/` 分域对接面消费内核，内核升级只适配这一个目录
 *    （分域而非单文件桶的原因见该目录文件头注释：整包加载 ~780ms vs 单域 ~60ms）。
 * 8. **对接面不漂移**：17 个域文件必须与「业务代码实际 import + 内核包 .d.ts」一致——
 *    只改业务导入不跑 `npm run kernel:surface` 会在这里被判红（生成器见 `scripts/kernelSurface.mjs`）。
 *
 * 边界说明（2026-11-06 审计）：范围是 `src/**`（web/ 与 desktop/ 不消费内核包——它们的
 * 通道是 HTTP/SSE 与侧车 spawn；scripts/ 里的门禁自身是合法消费者）。导入正则连注释里
 * 的 `from '@omniharness/kernel…'` 一起算——宁可误报让人删注释，不可漏报放行真导入。
 *
 * 为什么需要它：迁移最容易出现的假绿是「删了目录、代码还靠 tsconfig paths / 缓存里的旧副本」。
 * 本门禁以文件系统 + 锁文件 + 真实 require 三个角度钉住。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSurface } from './kernelSurface.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const fail = (message) => failures.push(message);

// 1. 依赖钉的是 vendored tarball
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const dep = pkg.dependencies?.['@omniharness/kernel'];
if (typeof dep !== 'string' || !/^file:vendor\/.+\.tgz$/.test(dep)) {
  fail(`package.json 的 @omniharness/kernel 必须是 file:vendor/*.tgz（当前 ${String(dep)}）`);
}

// 2. 内嵌副本目录必须消失
for (const dir of ['kernel', 'contracts', 'protocols']) {
  if (existsSync(join(ROOT, 'src', dir))) fail(`src/${dir} 仍存在：内嵌副本未删干净`);
}

// 3/4/7. 全源码扫描
const importRe = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    // 2026-11-06 审计 P2：扫描面此前只有 .ts/.tsx/.mts——.cts/.js/.mjs/.cjs 落在 src/ 时
    // 会完全绕过判据 3/7（门禁是执法点，不该有盲区类型）。
    else if (/\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(entry.name)) out.push(abs);
  }
  return out;
};
const srcFiles = walk(join(ROOT, 'src'));
const surfaceDir = join(ROOT, 'src', 'host', 'kernel');
let packageImports = 0;
const leaks = [];
const offSurfaceImports = [];
for (const file of srcFiles) {
  const text = readFileSync(file, 'utf8');
  let match;
  while ((match = importRe.exec(text)) !== null) {
    const spec = match[1];
    if (spec.startsWith('@omniharness/kernel/') || spec === '@omniharness/kernel') {
      packageImports += 1;
      // 判据 7：包导入只允许出现在对接面目录
      const dir = resolve(dirname(file));
      if (dir !== surfaceDir && !dir.startsWith(surfaceDir + sep)) {
        offSurfaceImports.push(`${relative(ROOT, file)}`);
      }
      continue;
    }
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec);
    const rel = relative(join(ROOT, 'src'), target).replaceAll(sep, '/');
    if (/^(kernel|contracts|protocols)\//.test(rel)) {
      leaks.push(`${relative(ROOT, file)} -> ${spec}`);
    }
  }
}
if (leaks.length > 0) {
  fail(`仍有相对导入穿透内嵌目录（${String(leaks.length)} 处）：\n    ${leaks.slice(0, 10).join('\n    ')}`);
}
if (packageImports === 0) fail('src/host/kernel/ 没有任何 @omniharness/kernel 导入：代码没有真正切到包');
if (offSurfaceImports.length > 0) {
  fail(
    `对接面单点被绕过：${String(offSurfaceImports.length)} 个文件直接导入 @omniharness/kernel ` +
      `（只允许 src/host/kernel/<area>.ts）：\n    ` +
      [...new Set(offSurfaceImports)].slice(0, 10).join('\n    '),
  );
}

// 5. tarball 与锁文件 integrity 一致
if (typeof dep === 'string' && dep.startsWith('file:')) {
  const tarball = resolve(ROOT, dep.slice('file:'.length));
  if (!existsSync(tarball)) {
    fail(`vendored tarball 不存在：${tarball}`);
  } else {
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
    const locked = lock.packages?.['node_modules/@omniharness/kernel'];
    const actual = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;
    if (locked?.integrity !== actual) {
      fail(
        `vendored tarball 与 package-lock integrity 不一致（lock=${String(locked?.integrity)}，actual=${actual}）`,
      );
    }
  }
}

// 6. 原生内核真实可加载
try {
  const { NativeKernel } = await import('@omniharness/kernel/kernel/native/nativeKernel.js');
  const native = new NativeKernel();
  if (!native.available()) {
    fail(`原生内核不可用（pluginPath=${native.modulePath()}）`);
  } else {
    const pong = native.ping();
    if (pong.ok !== true || pong.native !== true) fail(`原生内核 ping 失败：${JSON.stringify(pong)}`);
  }
} catch (error) {
  fail(`原生内核加载抛错：${error instanceof Error ? error.message : String(error)}`);
}

// 8. 对接面生成物不漂移（生成器唯一真源：业务 import + 内核包 .d.ts）
if (runSurface({ check: true }) !== 0) {
  fail('对接面生成物漂移：运行 npm run kernel:surface 后重跑门禁');
}

if (failures.length > 0) {
  process.stderr.write(`kernel:check 失败 —— ${String(failures.length)} 项：\n`);
  for (const message of failures) process.stderr.write(`  - ${message}\n`);
  process.exit(1);
}
process.stdout.write(
  `kernel:check OK —— ${String(srcFiles.length)} 个源文件 / ${String(packageImports)} 处包导入（全部收敛于 src/host/kernel/ 对接面）/ ` +
    `内嵌副本 0 / vendored tarball integrity 一致 / 原生内核实载 / 对接面生成物一致\n`,
);
