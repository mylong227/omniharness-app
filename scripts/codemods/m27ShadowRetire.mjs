#!/usr/bin/env node
/**
 * 一次性迁移工具（M27-D2）：把 `src/**` 对 kernel-compat 影子件与 server 侧 rpc/transport
 * 副本的导入，改写到 `src/host/kernel/<area>.ts` 对接面（内核 alpha.12 已收编全部同名符号）。
 *
 * 处理范围（M26 终盘收编 + M27 SDK/打码终批对应的 40+ 件影子）：
 *  - kernel-compat/kernel/adapters/{approval,escalation,event,kv,telemetry}/*
 *  - kernel-compat/kernel/{config/{credentialResolver,configRebase},core/steering/interjectionClassifier,
 *    observability/*,skill/skillManifestSigner,asset/*,util/{concurrency/retry,jsonObjectFile,localDay,
 *    mimeType,portablePath,quantileSketch}}
 *  - kernel-compat/contracts/ports/{memory/vault,intelligence/traceIntrospection*}
 *  - kernel-compat/contracts/{ports/sdk/sdkSocket,sdk/webSocketSdkSocket}
 *  - apps/server/core/jsonRpc.ts、apps/server/transport/{lineTransport,wsFrameCodec,wsConnection}.ts
 *  - host/contracts/sdk/sdkClient.ts、apps/cli/dumpRedactor.ts
 *
 * 规则：
 *  - 只改写 import/export-from 的**模块说明符**（解析为影子文件者 → 指向 `src/host/kernel/<area>.ts`
 *    的相对路径）；导入子句（符号名单）原样保留——符号名与内核 alpha.12 完全同名；
 *  - 生成物 `src/host/kernel/<area>.ts` 本身跳过；后续由 `npm run kernel:surface` 再生；
 *  - 不删除影子文件（由 git rm 显式执行，本脚本只做导入改写）；
 *  - 收尾打印残留引用（应只有影子文件互相引用——它们随后整体删除）。
 *
 * 用法：`node scripts/codemods/m27ShadowRetire.mjs`（幂等：改写后再次运行零变化）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');

/** 影子文件路径后缀（POSIX 化）→ 目标域（`src/host/kernel/<area>.ts`）。 */
const SHADOW_TO_AREA = [
  // 审批族 → adapters-approval
  ['kernel-compat/kernel/adapters/approval/', 'adapters-approval'],
  // 升级 / 事件 / KV / 遥测读取 / 缓存观测 / skill 签名 → adapters-misc
  ['kernel-compat/kernel/adapters/escalation/', 'adapters-misc'],
  ['kernel-compat/kernel/adapters/event/', 'adapters-misc'],
  ['kernel-compat/kernel/adapters/kv/', 'adapters-misc'],
  ['kernel-compat/kernel/adapters/telemetry/', 'adapters-misc'],
  ['kernel-compat/kernel/observability/', 'adapters-misc'],
  ['kernel-compat/kernel/skill/skillManifestSigner', 'adapters-misc'],
  // 配置域补全 → config
  ['kernel-compat/kernel/config/credentialResolver', 'config'],
  ['kernel-compat/kernel/config/configRebase', 'config'],
  // 插话分流 → core
  ['kernel-compat/kernel/core/steering/interjectionClassifier', 'core'],
  // asset 编解码/安装器 → plugin（与 kernel/plugin/zip 同域消费）
  ['kernel-compat/kernel/asset/', 'plugin'],
  // util 补全族 → util
  ['kernel-compat/kernel/util/concurrency/retry', 'util'],
  ['kernel-compat/kernel/util/jsonObjectFile', 'util'],
  ['kernel-compat/kernel/util/localDay', 'util'],
  ['kernel-compat/kernel/util/mimeType', 'util'],
  ['kernel-compat/kernel/util/portablePath', 'util'],
  ['kernel-compat/kernel/util/quantileSketch', 'util'],
  // 打码单一真源 → util
  ['apps/cli/dumpRedactor', 'util'],
  // 契约归内核 → contracts
  ['kernel-compat/contracts/ports/memory/vault', 'contracts'],
  ['kernel-compat/contracts/ports/intelligence/traceIntrospection', 'contracts'],
  ['kernel-compat/contracts/ports/sdk/sdkSocket', 'contracts'],
  // rpc / transport / SDK 客户端族 → runtime
  ['apps/server/core/jsonRpc', 'runtime'],
  ['apps/server/transport/lineTransport', 'runtime'],
  ['apps/server/transport/wsFrameCodec', 'runtime'],
  ['apps/server/transport/wsConnection', 'runtime'],
  ['host/contracts/sdk/sdkClient', 'runtime'],
  ['kernel-compat/contracts/sdk/webSocketSdkSocket', 'runtime'],
];

/** 把绝对路径 POSIX 化并取相对 src 的形态（用于后缀匹配）。 */
function normalizeKey(absolute) {
  return relative(ROOT, absolute).split(sep).join('/');
}

/** 递归列出 src/** 下的 .ts/.tsx。 */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (/\.tsx?$/u.test(entry.name)) out.push(abs);
  }
  return out;
}

/** 说明符是否解析到某个影子文件；命中返回 { area }。 */
function shadowAreaOf(fromFile, spec) {
  if (!spec.startsWith('.')) return undefined;
  const resolved = resolve(dirname(fromFile), spec);
  const key = normalizeKey(resolved).replace(/\.ts$/u, '');
  for (const [suffix, area] of SHADOW_TO_AREA) {
    // 路径包含匹配：目录型后缀（带尾 /）匹配目录下任意文件，文件型后缀精确到文件。
    if (key.includes(`/${suffix}`)) return area;
  }
  return undefined;
}

/** 相对导入说明符（保证 `.ts` 结尾，与本仓风格一致）。 */
function relSpec(fromFile, targetAbs) {
  let rel = relative(dirname(fromFile), targetAbs).split(sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

const files = walk(SRC).filter((file) => {
  // 生成物目录跳过（对接面文件不允许被本脚本触碰）。
  return !(normalizeKey(file).startsWith('src/host/kernel/'));
});

let changed = 0;
const residual = [];
const importRe = /((?:import|export)(?:\s+type)?(?:\s+[\w*{},\s]+?)?\s+from\s+['"])([^'"]+)(['"])/g;
const dynamicRe = /(\bimport\s*\(\s*['"])([^'"]+)(['"])/g;

const rewriteSpecs = (text, file) => {
  const rewrite = (whole, head, spec, tail) => {
    const area = shadowAreaOf(file, spec);
    if (area === undefined) return whole;
    return `${head}${relSpec(file, join(SRC, 'host', 'kernel', `${area}.ts`))}${tail}`;
  };
  return text.replace(importRe, rewrite).replace(dynamicRe, rewrite);
};

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const next = rewriteSpecs(text, file);
  if (next !== text) {
    writeFileSync(file, next);
    changed += 1;
  }
}

// 收尾：全量复扫，打印仍指向影子路径的导入（应只剩影子文件之间的互相引用——随后整体 git rm）。
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const re = /(?:from\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (shadowAreaOf(file, match[1]) !== undefined) residual.push(`${normalizeKey(file)} <= ${match[1]}`);
  }
}

console.log(`[m27-shadow-retire] 改写文件 ${String(changed)} 个；残留影子引用 ${String(residual.length)} 处`);
for (const line of residual) console.log(`  残留: ${line}`);
