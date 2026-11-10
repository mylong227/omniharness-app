import { closeSync, openSync, readSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** patch 预览上限（只读前 512 KB；完整大小仍回报）。 */
const PATCH_MAX_BYTES = 512 * 1024;

/** 内核约定的 patch 目录（工作区相对路径）。 */
const PATCH_DIR = '.omniharness/subagent-patches';

/** patch 读取成功视图。 */
export interface FleetPatchView {
  readonly ok: true;
  /** 工作区相对路径（已规范化）。 */
  readonly path: string;
  /** 预览文本（最多 512 KB）。 */
  readonly content: string;
  /** 文件完整字节数（不是预览字节数）。 */
  readonly bytes: number;
  /** 是否因超过上限而截断。 */
  readonly truncated: boolean;
}

/** patch 读取失败。 */
export interface FleetPatchFailure {
  readonly ok: false;
  readonly code: 'patch_forbidden' | 'patch_unavailable' | 'patch_not_text';
  readonly message: string;
}

/** patch 读取结果。 */
export type FleetPatchResult = FleetPatchView | FleetPatchFailure;

/** 编队补丁读取依赖。 */
export interface FleetPatchReaderDeps {
  /** 当前生效工作区根（支持运行时切换）。 */
  readonly workspaceRoot: () => string;
}

/**
 * 编队补丁读取器（`fleet.patch` RPC 后端）：只读、限目录、限大小。
 *
 * 安全边界：
 * - 只接受 `<workspace>/.omniharness/subagent-patches/` 下的相对路径；
 * - 拒绝绝对路径、`..`、目录；`realpath` 后再次确认仍在 patch 目录内（防符号链接逃逸）；
 * - 只读普通文件，最多读 512 KB；NUL / 非法 UTF-8 不冒充 diff。
 *
 * 该读取器不写工作区、不调用模型、不依赖编队运行态。
 */
export class FleetPatchReader {
  /** 依赖。 */
  private readonly deps: FleetPatchReaderDeps;

  /**
   * @param deps 工作区根取值器
   */
  public constructor(deps: FleetPatchReaderDeps) {
    this.deps = deps;
  }

  /**
   * 读取一条 patch 的预览。
   * @param rawPath 工作区相对路径（通常来自 `fleet.list` 的 `patchPath`）。
   * @returns 预览或判别失败；不抛异常。
   */
  public read(rawPath: string): FleetPatchResult {
    const path = rawPath.replaceAll('\\', '/');
    if (path === '' || isAbsolute(path)) {
      return FleetPatchReader.fail('patch_forbidden', '补丁路径必须是工作区内的相对路径。');
    }
    if (!path.startsWith(`${PATCH_DIR}/`) || path.split('/').includes('..')) {
      return FleetPatchReader.fail(
        'patch_forbidden',
        `只允许读取 ${PATCH_DIR}/ 下的补丁；收到：${path}。`,
      );
    }
    const root = this.deps.workspaceRoot();
    if (root === '') {
      return FleetPatchReader.fail('patch_unavailable', '工作区未定位，无法读取补丁。');
    }
    try {
      const realRoot = realpathSync(root);
      const target = resolve(root, path);
      const realTarget = realpathSync(target);
      const rel = relative(realRoot, realTarget).replaceAll('\\', '/');
      if (rel === '' || rel.startsWith('../') || rel === '..' || !rel.startsWith(`${PATCH_DIR}/`)) {
        return FleetPatchReader.fail('patch_forbidden', '补丁真实路径越过了工作区补丁目录。');
      }
      const stat = statSync(realTarget);
      if (!stat.isFile()) {
        return FleetPatchReader.fail('patch_forbidden', '补丁路径不是普通文件。');
      }
      const bytes = stat.size;
      const readBytes = Math.min(bytes, PATCH_MAX_BYTES);
      const buf = Buffer.alloc(readBytes);
      const fd = openSync(realTarget, 'r');
      let offset = 0;
      try {
        while (offset < readBytes) {
          const n = readSync(fd, buf, offset, readBytes - offset, offset);
          if (n <= 0) break;
          offset += n;
        }
      } finally {
        closeSync(fd);
      }
      const content = buf.subarray(0, offset).toString('utf8');
      if (content.includes('\u0000')) {
        return FleetPatchReader.fail('patch_not_text', '补丁包含 NUL 字节，无法作为文本预览。');
      }
      return {
        ok: true,
        path,
        content,
        bytes,
        truncated: bytes > PATCH_MAX_BYTES,
      };
    } catch (error) {
      return FleetPatchReader.fail(
        'patch_unavailable',
        `补丁不可读：${error instanceof Error ? error.message : String(error)}。`,
      );
    }
  }

  /**
   * 构造失败结果。
   * @param code 错误码。
   * @param message 可读原因。
   * @returns 失败。
   */
  private static fail(code: FleetPatchFailure['code'], message: string): FleetPatchFailure {
    return { ok: false, code, message };
  }
}

/** 供测试/文档使用的上限（不是运行期可变配置）。 */
export const FLEET_PATCH_MAX_BYTES = PATCH_MAX_BYTES;

/** 供测试/文档使用的目录常量。 */
export const FLEET_PATCH_DIR = PATCH_DIR;
