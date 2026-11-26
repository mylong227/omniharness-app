import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export class KernelNativeArtifacts {
  private constructor() {}
  public static prepare(worktree: string, legacyNative: string): void {
    if (existsSync(join(worktree, 'rust/Cargo.toml'))) KernelNativeArtifacts.build(worktree);
    else KernelNativeArtifacts.copyLegacy(worktree, legacyNative);
  }
  private static build(worktree: string): void {
    execFileSync(process.execPath, ['scripts/NativeBuild.ts'], { cwd: worktree, stdio: 'inherit' });
    const directory = join(worktree, 'native', process.platform + '-' + process.arch);
    const cli = process.platform === 'win32' ? 'omni-cli.exe' : 'omni-cli';
    if (!existsSync(join(directory, 'omni_napi.node')) || !existsSync(join(directory, cli))) {
      throw new Error('Rust build did not produce both platform native artifacts');
    }
  }
  private static copyLegacy(worktree: string, source: string): void {
    if (!existsSync(source)) throw new Error('Legacy kernel tag requires an existing native addon: ' + source);
    const directory = join(worktree, 'native');
    mkdirSync(directory, { recursive: true });
    copyFileSync(source, join(directory, 'omni_napi.node'));
  }
}
