/**
 * windowsPowerShellModulePath.ts —— 让 Windows PowerShell 5.1 子进程能找到自带模块。
 *
 * ## 为什么需要（2026-11-08 实测）
 *
 * 配置里的 `apiKeyDpapi` / `providerKeysDpapi` 由内核经 `powershell.exe`（5.1）解密。
 * 当本进程从 **PowerShell 7** 终端启动时，`PSModulePath` 里排在前面的全是 PS7 的模块目录
 * （`...\PowerShell\7\Modules`），5.1 会先在那里找到**不兼容的**
 * `Microsoft.PowerShell.Security` 清单，报「module could not be loaded」而拒绝加载
 * `ConvertTo-SecureString` ⇒ 配置读取直接以「凭据解密失败」告终，应用连启动都过不去。
 *
 * 处置：把 5.1 自己的模块目录（`%SystemRoot%\System32\WindowsPowerShell\v1.0\Modules`）
 * **提到 `PSModulePath` 最前面**。5.1 先命中兼容模块，PS7 子进程仍能看到其余目录。
 * 纯环境变量归一化，不碰文件、不改配置、不吞任何解密错误。
 */

/** Windows PowerShell 5.1 内置模块目录（`PSModulePath` 的最后兜底项）。 */
export class WindowsPowerShellModulePath {
  private constructor() {}

  /**
   * 把 Windows PowerShell 5.1 模块目录提到 `PSModulePath` 首位（幂等）。
   *
   * 非 Windows 平台直接返回；路径重复时只调整顺序，不增加重复项。
   * @param env 目标环境（缺省 `process.env`；测试可注入）。
   * @returns 无返回值（就地修改 `env`）。
   */
  public static ensure(env: NodeJS.ProcessEnv = process.env): void {
    if (process.platform !== 'win32') {
      return;
    }
    const systemRoot = env['SystemRoot'] ?? env['windir'] ?? 'C:\\Windows';
    const winPsModules = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\Modules`;
    const normalized = WindowsPowerShellModulePath.withFirst(env['PSModulePath'] ?? '', winPsModules);
    env['PSModulePath'] = normalized;
  }

  /**
   * 纯函数：把目标目录放到路径列表首位（大小写不敏感去重）。
   * @param current 现有 `PSModulePath`（`;` 分隔，可能为空）。
   * @param first 需要排第一的目录。
   * @returns 归一化后的路径列表。
   */
  public static withFirst(current: string, first: string): string {
    const target = first.toLowerCase();
    const parts = current
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part !== '' && part.toLowerCase() !== target);
    return [first, ...parts].join(';');
  }
}
