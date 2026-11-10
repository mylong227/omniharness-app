import { describe, expect, it } from 'vitest';
import { WindowsPowerShellModulePath } from '../src/apps/cli/windowsPowerShellModulePath.ts';

/**
 * DPAPI 解密依赖 `powershell.exe`（5.1）能加载自带的 `Microsoft.PowerShell.Security`。
 * 从 PowerShell 7 终端启动时 `PSModulePath` 被 PS7 目录占据，5.1 会加载到不兼容清单而失败
 * ——本判据钉住「5.1 目录必须在首位且不重复」这条纯逻辑（真机解密由桌面冒烟覆盖）。
 */
describe('WindowsPowerShellModulePath.withFirst', () => {
  it('把 5.1 模块目录提到首位，并大小写不敏感去重', () => {
    const result = WindowsPowerShellModulePath.withFirst(
      'C:\\Program Files\\PowerShell\\7\\Modules;' +
        'c:\\windows\\system32\\windowspowershell\\v1.0\\modules;' +
        'C:\\Program Files\\WindowsPowerShell\\Modules',
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules',
    );
    expect(result.split(';')).toEqual([
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules',
      'C:\\Program Files\\PowerShell\\7\\Modules',
      'C:\\Program Files\\WindowsPowerShell\\Modules',
    ]);
  });

  it('空路径 / 多余分隔符也归一出非空列表', () => {
    expect(WindowsPowerShellModulePath.withFirst(';;', 'C:\\ps')).toBe('C:\\ps');
  });
});
