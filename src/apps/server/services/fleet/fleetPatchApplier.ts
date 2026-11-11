import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { FleetPatchReader } from './fleetPatchReader.ts';

const execFileAsync = promisify(execFile);

/** 应用补丁结果。 */
export type FleetPatchApplyResult =
  | { readonly ok: true; readonly path: string }
  | {
      readonly ok: false;
      readonly code:
        | 'confirm_required'
        | 'patch_forbidden'
        | 'patch_unavailable'
        | 'patch_not_text'
        | 'patch_truncated'
        | 'patch_conflict'
        | 'git_unavailable';
      readonly message: string;
    };

/** 应用补丁依赖。 */
export interface FleetPatchApplierDeps {
  /** 当前生效工作区根。 */
  readonly workspaceRoot: () => string;
  /** 只读补丁读取器（复用路径/大小/文本校验）。 */
  readonly reader: FleetPatchReader;
}

/**
 * 编队补丁应用器（`fleet.applyPatch` RPC 后端）。
 *
 * 只应用 `.omniharness/subagent-patches/` 内的**完整文本补丁**，且必须 `confirm:true`。
 * 先 `git apply --check` 做冲突预检，再 `git apply` 真正写入主工作区；不自动提交、不自动回滚。
 * 任何失败都把 stderr 原文带回，绝不静默。
 */
export class FleetPatchApplier {
  /** 依赖。 */
  private readonly deps: FleetPatchApplierDeps;

  /**
   * @param deps 工作区根与补丁读取器
   */
  public constructor(deps: FleetPatchApplierDeps) {
    this.deps = deps;
  }

  /**
   * 应用一条补丁。
   * @param path 工作区相对补丁路径。
   * @param confirmed 是否已由用户显式确认。
   * @returns 成功或判别失败；不抛异常。
   */
  public async apply(path: string, confirmed: boolean): Promise<FleetPatchApplyResult> {
    if (!confirmed) {
      return FleetPatchApplier.fail(
        'confirm_required',
        '应用补丁会改写主工作区；必须显式确认。',
      );
    }
    const preview = this.deps.reader.read(path);
    if (!preview.ok) {
      return FleetPatchApplier.fail(preview.code, preview.message);
    }
    if (preview.truncated) {
      return FleetPatchApplier.fail(
        'patch_truncated',
        '补丁超过 512 KB 且预览被截断，不能安全应用；请从补丁文件直接处理。',
      );
    }
    const root = this.deps.workspaceRoot();
    if (root === '') {
      return FleetPatchApplier.fail('patch_unavailable', '工作区未定位，无法应用补丁。');
    }
    const absolute = resolve(root, path);
    try {
      await execFileAsync('git', ['apply', '--whitespace=nowarn', '--check', absolute], {
        cwd: root,
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024,
      });
    } catch (error) {
      return FleetPatchApplier.fromGitError(error, 'patch_conflict');
    }
    try {
      await execFileAsync('git', ['apply', '--whitespace=nowarn', absolute], {
        cwd: root,
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024,
      });
    } catch (error) {
      return FleetPatchApplier.fromGitError(error, 'git_unavailable');
    }
    return { ok: true, path };
  }

  /**
   * 把 git 错误收敛为可读失败（优先 stderr）。
   * @param error 任意错误
   * @param fallback 没有 stderr 时的码
   * @returns 失败
   */
  private static fromGitError(error: unknown, fallback: 'patch_conflict' | 'git_unavailable'): FleetPatchApplyResult {
    const record = error as { stderr?: unknown; message?: unknown; code?: unknown };
    const stderr = typeof record.stderr === 'string' ? record.stderr.trim() : '';
    const message = stderr !== '' ? stderr : record.message;
    const code = record.code === 'ENOENT' ? 'git_unavailable' : fallback;
    return FleetPatchApplier.fail(
      code,
      `补丁应用失败：${typeof message === 'string' && message !== '' ? message : '未知 git 错误'}。`,
    );
  }

  /**
   * @param code 错误码
   * @param message 可读原因
   * @returns 失败
   */
  private static fail(
    code: Extract<FleetPatchApplyResult, { ok: false }>['code'],
    message: string,
  ): FleetPatchApplyResult {
    return { ok: false, code, message };
  }
}
