/**
 * Harness 附着序列单一真源（2026-11-20 抽取，消除 bootstrap/switchWorkspace/restartHarness
 * 三处拷贝）：`start()` 成功后的固定四步——安全基线（setHarnessOrigin + installSessionSecurity）
 * → 主窗口装载 → 二级窗口重载。
 *
 * 为什么必须单源：任何一处漏掉 `installSessionSecurity` 或悬挂 handle 不清空，都会复现
 * 2026-11-06 审计 P2（托盘/菜单/新窗口拿死 handle 去 loadHarness → 连接拒答/401）。
 * 附着失败（start() 抛错）的 handle 清空由调用方负责——三处的失败呈现（对话框/日志文案）
 * 各不相同，不进本序列。
 */
import type { BrowserWindow, Session } from 'electron';
import type { HarnessHandle } from '../harnessSupervisor.ts';
import { installSessionSecurity, setHarnessOrigin } from '../security.ts';
import { loadHarness } from '../window.ts';
import type { DesktopSecurityConfig } from '../config/types.ts';
import type { SecondaryWindows } from './SecondaryWindows.ts';

/** 附着入参（主窗口可为 null：切换/重启时窗口可能尚未就绪）。 */
export interface HarnessAttachOptions {
  /** Electron 主 session（安全基线安装面）。 */
  readonly session: Session;
  /** 桌面安全配置（CSP/权限等，attach 时与 host/port 合成）。 */
  readonly security: DesktopSecurityConfig;
  /** 刚就绪的 Harness 句柄。 */
  readonly handle: HarnessHandle;
  /** 主窗口（null = 跳过主窗口装载）。 */
  readonly window: BrowserWindow | null;
  /** 二级工作台窗口集合（reloadAll）。 */
  readonly secondary: SecondaryWindows;
}

/**
 * 把刚就绪的 Harness 附着到安全基线与全部窗口。
 * @param options 附着入参
 * @returns 无返回值
 */
export function attachHarness(options: HarnessAttachOptions): void {
  const { handle } = options;
  setHarnessOrigin(handle.port, handle.host);
  installSessionSecurity(options.session, handle.port, {
    ...options.security,
    host: handle.host,
  });
  if (options.window !== null) loadHarness(options.window, handle);
  options.secondary.reloadAll(handle);
}
