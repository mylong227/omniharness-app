/**
 * 打包载荷一致性校验（构建门禁）。
 *
 * ## 为什么需要（2026-11-14 用户报障：安装版「本地 Harness 未能启动」）
 *
 * `desktop/release/win-unpacked` 是 `electron-builder --dir`（`npm run pack`）的产物，
 * 而只重打安装包的 `npm run installer` 会**原样复用**它。当天源码一侧已经修好
 * 「从 PowerShell 7 终端启动时 DPAPI 凭据解密失败」（见
 * `src/apps/cli/windowsPowerShellModulePath.ts`），但 `release/win-unpacked` 还是 6 天前的
 * 旧 stage：侧车入口里没有那处修复、`vendored kernel` 还是 alpha.15。结果安装包「看起来
 * 是新的」（NSIS 外观改了、图标改了），实际载荷是旧的 ⇒ 安装版启动即失败。
 *
 * 这里的判据只做一件事：**把「将要发布/已经打包的载荷」与「当前工作树刚构建的产物」
 * 逐字节对齐**。任何一处不一致都让构建失败，而不是等到用户装完才发现。
 *
 * ## 载荷清单
 *
 *   · `package.json` / `dist/src/apps/cli/exec.js`：后端根（`OMNI_BACKEND_ROOT`，缺省=应用根）；
 *   · `web/dist/index.html`：应用根的前端产物；
 *   · `dist/main.cjs` + `dist/icon.*`：`app.asar` 内的桌面壳产物。
 *
 * `stageHarness.mjs` 把清单哈希写进 `BUILD_INFO.json`；`verifyPackage.mjs` 与
 * `buildInstaller.mjs` 用同一份清单复核。纯静态类，无实例状态。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/** 载荷内需要与工作树逐字节一致的文件（源路径 → 载荷内路径）。 */
const PAYLOAD_FILES = Object.freeze([
  Object.freeze({ source: 'backend', sourcePath: 'package.json', payloadPath: 'package.json' }),
  Object.freeze({
    source: 'backend',
    sourcePath: 'dist/src/apps/cli/exec.js',
    payloadPath: 'dist/src/apps/cli/exec.js',
  }),
  // stage 把应用根的 `web/dist` 拷成载荷里的 `web/`（同级布局是 NativeKernel 等路径解析的前提），
  // 所以源路径与载荷路径不同名——校验必须按这两条路径分别取。
  Object.freeze({
    source: 'web',
    sourcePath: 'web/dist/index.html',
    payloadPath: 'web/index.html',
  }),
]);

/** 桌面壳 `app.asar` 里必须存在、且与 `desktop/dist` 一致的文件（相对 desktop/dist）。 */
const DESKTOP_FILES = Object.freeze(['main.cjs']);

/** 桌面壳 `app.asar` 里必须存在的图标资源（任务栏/窗口/托盘）。 */
const DESKTOP_ASSETS = Object.freeze(['dist/icon.ico', 'dist/icon.png', 'dist/icon-busy.png']);

/**
 * 载荷来源（校验时由调用方给出绝对路径）。
 * @typedef {{ readonly backendRoot: string, readonly webRoot: string }} PayloadSources
 */

/**
 * 构建信息（写进 `BUILD_INFO.json`，随安装包一起发布，排障时能直接看出载荷版本）。
 * @typedef {{
 *   product: string,
 *   version: string,
 *   kernel: string | null,
 *   builtAt: string,
 *   git: { commit: string | null, ref: string | null },
 *   files: Record<string, string>,
 * }} BuildInfo
 */

/**
 * 校验结果：问题列表 + 读到的构建信息（缺文件时为 null）。
 * @typedef {{ problems: string[], info: BuildInfo | null }} PayloadReport
 */

/** 打包载荷一致性校验器。 */
export class PackagedPayloadCheck {
  /** 静态工具类：禁止实例化。 */
  constructor() {
    throw new Error('PackagedPayloadCheck 只提供静态方法');
  }

  /**
   * 计算文件的 SHA-256。
   * @param {string} file 绝对路径。
   * @returns {string | null} 十六进制摘要；文件不存在/不可读时为 null。
   */
  static hashFile(file) {
    if (!existsSync(file)) return null;
    try {
      return createHash('sha256').update(readFileSync(file)).digest('hex');
    } catch {
      return null;
    }
  }

  /**
   * 读取 git HEAD（不 spawn git：受限环境/无 git 也能跑）。
   * @param {string} repoRoot 仓库根。
   * @returns {{ commit: string | null, ref: string | null }} 提交与引用；读不到均为 null。
   */
  static readGitHead(repoRoot) {
    const dotGit = join(repoRoot, '.git');
    try {
      const head = readFileSync(join(dotGit, 'HEAD'), 'utf8').trim();
      if (!head.startsWith('ref: ')) return { commit: head, ref: null };
      const ref = head.slice(5);
      const refFile = join(dotGit, ref);
      const commit = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : null;
      return { commit, ref };
    } catch {
      return { commit: null, ref: null };
    }
  }

  /**
   * 生成当前工作树的构建信息（供 stage 写入 `BUILD_INFO.json`）。
   * @param {PayloadSources} sources 载荷来源根。
   * @param {Date} now 构建时间（测试可注入固定时钟）。
   * @returns {BuildInfo} 构建信息。
   */
  static buildInfo(sources, now = new Date()) {
    const pkg = PackagedPayloadCheck.readJson(join(sources.backendRoot, 'package.json'));
    /** @type {Record<string, string>} */
    const files = {};
    for (const entry of PAYLOAD_FILES) {
      const hash = PackagedPayloadCheck.hashFile(
        join(PackagedPayloadCheck.sourceRoot(sources, entry.source), entry.sourcePath),
      );
      if (hash === null) {
        throw new Error(
          `缺少载荷文件：${entry.sourcePath}（先运行 npm run build / npm run build:web）`,
        );
      }
      files[entry.payloadPath] = hash;
    }
    const dependencies = PackagedPayloadCheck.dependenciesOf(pkg);
    return {
      product: 'OmniHarness',
      version: typeof pkg['version'] === 'string' ? pkg['version'] : 'unknown',
      kernel:
        typeof dependencies['@omniharness/kernel'] === 'string'
          ? dependencies['@omniharness/kernel']
          : null,
      builtAt: now.toISOString(),
      git: PackagedPayloadCheck.readGitHead(
        PackagedPayloadCheck.sourceRoot(sources, 'backend'),
      ),
      files,
    };
  }

  /**
   * 校验已打包（或已 stage）的 harness 是否仍是当前工作树的产物。
   * @param {string} payloadDir 载荷内的 harness 目录。
   * @param {PayloadSources} sources 当前工作树的载荷来源根。
   * @returns {PayloadReport} 校验结果。
   */
  static inspectHarness(payloadDir, sources) {
    /** @type {string[]} */
    const problems = [];
    const infoFile = join(payloadDir, 'BUILD_INFO.json');
    /** @type {BuildInfo | null} */
    let info = null;
    if (!existsSync(infoFile)) {
      problems.push(
        'harness 缺少 BUILD_INFO.json（不是当前 stage 生成的载荷）——先运行 npm run stage 并重新打包',
      );
    } else {
      try {
        info = PackagedPayloadCheck.normalizeBuildInfo(
          PackagedPayloadCheck.readJson(infoFile),
        );
      } catch (error) {
        problems.push(`harness 的 BUILD_INFO.json 不可解析：${String(error)}`);
      }
    }
    for (const entry of PAYLOAD_FILES) {
      const expected = PackagedPayloadCheck.hashFile(
        join(PackagedPayloadCheck.sourceRoot(sources, entry.source), entry.sourcePath),
      );
      if (expected === null) {
        problems.push(
          `当前工作树缺少 ${entry.sourcePath}（先运行 npm run build / npm run build:web）`,
        );
        continue;
      }
      const actual = PackagedPayloadCheck.hashFile(join(payloadDir, entry.payloadPath));
      if (actual === null) {
        problems.push(`载荷缺少 ${entry.payloadPath}`);
      } else if (actual !== expected) {
        problems.push(
          `载荷与当前构建不一致：${entry.payloadPath}（旧包？先运行 npm run stage 再重新打包）`,
        );
      } else if (info !== null && info.files[entry.payloadPath] !== expected) {
        problems.push(`BUILD_INFO.json 记录的 ${entry.payloadPath} 哈希与载荷不符`);
      }
    }
    return { problems, info };
  }

  /**
   * 校验 `app.asar` 里的桌面壳产物是否与 `desktop/dist` 一致，并确认图标资源已入包。
   * @param {string} asarFile `resources/app.asar` 绝对路径。
   * @param {string} desktopDist `desktop/dist` 目录。
   * @returns {PayloadReport} 校验结果（桌面壳无 BUILD_INFO，info 恒为 null）。
   */
  static inspectDesktop(asarFile, desktopDist) {
    /** @type {string[]} */
    const problems = [];
    if (!existsSync(asarFile)) {
      return { problems: ['缺少 resources/app.asar'], info: null };
    }
    /** @type {{ extractFile: (archive: string, name: string) => Buffer, listPackage: (archive: string) => string[] }} */
    let asar;
    try {
      asar = require('@electron/asar');
    } catch (error) {
      return { problems: [`缺少 @electron/asar（先 npm install）：${String(error)}`], info: null };
    }
    for (const relative of DESKTOP_FILES) {
      const expected = PackagedPayloadCheck.hashFile(join(desktopDist, relative));
      if (expected === null) {
        problems.push(`desktop/dist 缺少 ${relative}（先运行 npm run build）`);
        continue;
      }
      try {
        const packed = asar.extractFile(asarFile, `dist/${relative}`);
        const actual = createHash('sha256').update(packed).digest('hex');
        if (actual !== expected) {
          problems.push(`app.asar 内的 dist/${relative} 不是当前构建（先运行 npm run pack）`);
        }
      } catch {
        problems.push(`app.asar 内缺少 dist/${relative}`);
      }
    }
    /** @type {string[]} */
    let listed = [];
    try {
      listed = asar.listPackage(asarFile);
    } catch (error) {
      problems.push(`app.asar 不可读：${String(error)}`);
    }
    const entries = new Set(
      listed.map((item) => item.replace(/\\/gu, '/').replace(/^\/+/u, '')),
    );
    for (const asset of DESKTOP_ASSETS) {
      if (entries.size > 0 && !entries.has(asset)) {
        problems.push(`app.asar 内缺少图标资源 ${asset}`);
      }
    }
    return { problems, info: null };
  }

  /**
   * 解析载荷来源对应的根目录。
   * @param {PayloadSources} sources 来源根。
   * @param {'backend' | 'web'} source 来源标识。
   * @returns {string} 绝对路径。
   */
  static sourceRoot(sources, source) {
    return source === 'web' ? sources.webRoot : sources.backendRoot;
  }

  /**
   * 读一份 JSON；坏文件抛错由调用方转成问题项。
   * @param {string} file 绝对路径。
   * @returns {Record<string, unknown>} 解析结果。
   */
  static readJson(file) {
    return JSON.parse(readFileSync(file, 'utf8'));
  }

  /**
   * 从 package.json 取依赖表（dependencies 优先，退 optionalDependencies）。
   * @param {Record<string, unknown>} pkg package.json 内容。
   * @returns {Record<string, unknown>} 依赖表。
   */
  static dependenciesOf(pkg) {
    const dependencies = pkg['dependencies'];
    if (dependencies !== null && typeof dependencies === 'object') {
      return /** @type {Record<string, unknown>} */ (dependencies);
    }
    const optional = pkg['optionalDependencies'];
    if (optional !== null && typeof optional === 'object') {
      return /** @type {Record<string, unknown>} */ (optional);
    }
    return {};
  }

  /**
   * 把未知 JSON 收窄成 BuildInfo（字段缺失按 null/空表处理，避免读坏文件时崩）。
   * @param {Record<string, unknown>} raw 原始 JSON。
   * @returns {BuildInfo} 构建信息。
   */
  static normalizeBuildInfo(raw) {
    const git = raw['git'];
    const files = raw['files'];
    const gitRecord = git !== null && typeof git === 'object' ? git : {};
    return {
      product: typeof raw['product'] === 'string' ? raw['product'] : 'OmniHarness',
      version: typeof raw['version'] === 'string' ? raw['version'] : 'unknown',
      kernel: typeof raw['kernel'] === 'string' ? raw['kernel'] : null,
      builtAt: typeof raw['builtAt'] === 'string' ? raw['builtAt'] : '',
      git: {
        commit: typeof gitRecord['commit'] === 'string' ? gitRecord['commit'] : null,
        ref: typeof gitRecord['ref'] === 'string' ? gitRecord['ref'] : null,
      },
      files:
        files !== null && typeof files === 'object'
          ? /** @type {Record<string, string>} */ ({ ...files })
          : {},
    };
  }
}
