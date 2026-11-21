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
 * `stageHarness.mts` 把清单哈希写进 `BUILD_INFO.json`；`verifyPackage.mts` 与
 * `buildInstaller.mts` 用同一份清单复核。纯静态类，无实例状态。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/** 载荷内需要与工作树逐字节一致的文件（源路径 → 载荷内路径）。 */
const PAYLOAD_FILES: readonly { source: 'backend' | 'web'; sourcePath: string; payloadPath: string }[] =
  Object.freeze([
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
const DESKTOP_FILES: readonly string[] = Object.freeze(['main.cjs']);

/** 桌面壳 `app.asar` 里必须存在的图标资源（任务栏/窗口/托盘）。 */
const DESKTOP_ASSETS: readonly string[] = Object.freeze([
  'dist/icon.ico',
  'dist/icon.png',
  'dist/icon-busy.png',
]);

/** 载荷来源（校验时由调用方给出绝对路径）。 */
export interface PayloadSources {
  /** 后端工作树根。 */
  readonly backendRoot: string;
  /** 前端产物根。 */
  readonly webRoot: string;
}

/**
 * 构建信息（写进 `BUILD_INFO.json`，随安装包一起发布，排障时能直接看出载荷版本）。
 */
export interface BuildInfo {
  /** 产品名。 */
  product: string;
  /** 版本号。 */
  version: string;
  /** 内核依赖钉定形态（读不到为 null）。 */
  kernel: string | null;
  /** 构建时刻（ISO）。 */
  builtAt: string;
  /** git HEAD。 */
  git: { commit: string | null; ref: string | null };
  /** 载荷文件哈希表（载荷内路径 → sha256）。 */
  files: Record<string, string>;
}

/** 校验结果：问题列表 + 读到的构建信息（缺文件时为 null）。 */
export interface PayloadReport {
  /** 问题列表（空即通过）。 */
  problems: string[];
  /** 读到的构建信息（缺文件/不可解析时为 null）。 */
  info: BuildInfo | null;
}

/** `@electron/asar` 的软依赖契约（lazy require，缺失时 fail-closed 上报）。 */
interface AsarLib {
  extractFile: (archive: string, name: string) => Buffer;
  listPackage: (archive: string) => string[];
}

/** 打包载荷一致性校验器。 */
export class PackagedPayloadCheck {
  /** 静态工具类：禁止实例化。 */
  private constructor() {
    throw new Error('PackagedPayloadCheck 只提供静态方法');
  }

  /**
   * 计算文件的 SHA-256。
   * @param file 绝对路径。
   * @returns 十六进制摘要；文件不存在/不可读时为 null。
   */
  public static hashFile(file: string): string | null {
    if (!existsSync(file)) return null;
    try {
      return createHash('sha256').update(readFileSync(file)).digest('hex');
    } catch {
      return null;
    }
  }

  /**
   * 读取 git HEAD（不 spawn git：受限环境/无 git 也能跑）。
   * @param repoRoot 仓库根。
   * @returns 提交与引用；读不到均为 null。
   */
  public static readGitHead(repoRoot: string): { commit: string | null; ref: string | null } {
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
   * @param sources 载荷来源根。
   * @param now 构建时间（测试可注入固定时钟）。
   * @returns 构建信息。
   */
  public static buildInfo(sources: PayloadSources, now: Date = new Date()): BuildInfo {
    const pkg = PackagedPayloadCheck.readJson(join(sources.backendRoot, 'package.json'));
    const files: Record<string, string> = {};
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
   * @param payloadDir 载荷内的 harness 目录。
   * @param sources 当前工作树的载荷来源根。
   * @returns 校验结果。
   */
  public static inspectHarness(payloadDir: string, sources: PayloadSources): PayloadReport {
    const problems: string[] = [];
    const infoFile = join(payloadDir, 'BUILD_INFO.json');
    let info: BuildInfo | null = null;
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
   * @param asarFile `resources/app.asar` 绝对路径。
   * @param desktopDist `desktop/dist` 目录。
   * @returns 校验结果（桌面壳无 BUILD_INFO，info 恒为 null）。
   */
  public static inspectDesktop(asarFile: string, desktopDist: string): PayloadReport {
    const problems: string[] = [];
    if (!existsSync(asarFile)) {
      return { problems: ['缺少 resources/app.asar'], info: null };
    }
    let asar: AsarLib;
    try {
      asar = require('@electron/asar') as AsarLib;
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
    let listed: string[] = [];
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
   * @param sources 来源根。
   * @param source 来源标识。
   * @returns 绝对路径。
   */
  public static sourceRoot(sources: PayloadSources, source: 'backend' | 'web'): string {
    return source === 'web' ? sources.webRoot : sources.backendRoot;
  }

  /**
   * 读一份 JSON；坏文件抛错由调用方转成问题项。
   * @param file 绝对路径。
   * @returns 解析结果。
   */
  public static readJson(file: string): Record<string, unknown> {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  }

  /**
   * 从 package.json 取依赖表（dependencies 优先，退 optionalDependencies）。
   * @param pkg package.json 内容。
   * @returns 依赖表。
   */
  public static dependenciesOf(pkg: Record<string, unknown>): Record<string, unknown> {
    const dependencies = pkg['dependencies'];
    if (dependencies !== null && typeof dependencies === 'object') {
      return dependencies as Record<string, unknown>;
    }
    const optional = pkg['optionalDependencies'];
    if (optional !== null && typeof optional === 'object') {
      return optional as Record<string, unknown>;
    }
    return {};
  }

  /**
   * 把未知 JSON 收窄成 BuildInfo（字段缺失按 null/空表处理，避免读坏文件时崩）。
   * @param raw 原始 JSON。
   * @returns 构建信息。
   */
  public static normalizeBuildInfo(raw: Record<string, unknown>): BuildInfo {
    const git = raw['git'];
    const files = raw['files'];
    const gitRecord = (git !== null && typeof git === 'object' ? git : {}) as Record<string, unknown>;
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
          ? ({ ...files } as Record<string, string>)
          : {},
    };
  }
}
