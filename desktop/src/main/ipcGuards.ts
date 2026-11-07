/**
 * IPC 安全守卫的**纯逻辑**部分（2026-11-08 从 ipc.ts 抽出）：不 import electron 运行时
 * （仅 type-only），因此 `desktop/scripts/test.mjs` 可以用 esbuild 打包后在 Node 里直接判据
 * ——审计指出 `assertTrusted` / `assertNotifyInput` 是桌面最关键的两个安全函数却零判据覆盖。
 * ipc.ts 保留薄包装（抛错语义与 IPC 接线），本模块只做可判据的判定。
 */
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { IpcMainInvokeEvent, WebContents, WebFrameMain } from 'electron';
import type { DesktopIpcConfig } from './config.ts';

/** notify 入参（notifications.ts 的形状子集；此处独立声明以免引入 electron 依赖链）。 */
export interface NotifyInputLike {
  readonly title: string;
  readonly body: string;
  readonly sessionId?: string;
}

/** 校验通知参数（渲染层不可信）。 */
export function assertNotifyInput(value: unknown, limits: DesktopIpcConfig): NotifyInputLike {
  if (value === null || typeof value !== 'object') throw new Error('invalid notify');
  const raw = value as Record<string, unknown>;
  const title = raw['title'];
  const body = raw['body'];
  const sessionId = raw['sessionId'];
  if (typeof title !== 'string' || title.trim() === '' || title.length > limits.notifyTitleMax) {
    throw new Error('invalid notify.title');
  }
  if (typeof body !== 'string' || body.length > limits.notifyBodyMax) {
    throw new Error('invalid notify.body');
  }
  if (
    sessionId !== undefined &&
    (typeof sessionId !== 'string' || sessionId.length > limits.notifySessionIdMax)
  ) {
    throw new Error('invalid notify.sessionId');
  }
  return {
    title,
    body,
    ...(sessionId !== undefined ? { sessionId } : {}),
  };
}

/** sender 校验所需的依赖子集（ipc.ts 的 IpcDeps 结构兼容）。 */
export interface TrustedDeps {
  /** 当前主窗口 webContents（sender 校验）。 */
  mainContents(): WebContents | undefined;
  /** 额外窗口 sender 校验（多窗口；缺省只看主窗口）。 */
  isTrustedContents?(contents: WebContents): boolean;
}

/**
 * IPC 来源判定的**纯谓词**：返回拒绝原因，null = 可信。
 * @param event IPC 事件。
 * @param deps sender 依赖（主窗口 / 多窗口白名单）。
 * @param origin 当前 harness origin（空串 = 尚未就绪，一律拒绝）。
 * @returns null 或 'sender' / 'frame' / 'origin'。
 */
export function trustRejection(
  event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>,
  deps: TrustedDeps,
  origin: string,
): 'sender' | 'frame' | 'origin' | null {
  const main = deps.mainContents();
  const trusted =
    (main !== undefined && event.sender === main) || deps.isTrustedContents?.(event.sender) === true;
  if (!trusted) return 'sender';
  const frame: WebFrameMain | null = event.senderFrame;
  if (frame === null || frame.parent !== null) return 'frame';
  if (origin === '' || new URL(frame.url).origin !== origin) return 'origin';
  return null;
}

/**
 * 校验路径存在且是目录（自 ipc.ts 原样迁入）。
 * @param path 路径。
 * @returns 绝对路径。
 */
export function assertDirectory(path: string): string {
  if (!existsSync(path)) throw new Error(`工作区不存在：${path}`);
  if (!statSync(path).isDirectory()) throw new Error(`不是目录：${path}`);
  return path;
}

/**
 * revealPath 白名单（2026-11-08 审计中危）：渲染层传来的路径必须落在白名单根的子树内——
 * 此前仅校验 string 即 `shell.openPath`，被攻陷的渲染层可让资源管理器打开任意目录并借
 * 成功/失败侧探目录存在性。白名单根 = 当前工作区（日志目录走语义化的 `omni:openLogs`，
 * 不经本通道）。
 * @param path 渲染层传入的路径（相对/绝对均可）。
 * @param roots 允许的根目录清单（至少一个；全部不允许时抛错）。
 * @returns 绝对路径（已断言存在且是目录）。
 */
export function assertRevealPathInside(path: string, roots: readonly string[]): string {
  const absolute = resolve(path);
  const inside = roots.some((root) => {
    const rel = relative(resolve(root), absolute);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  });
  if (!inside) throw new Error(`路径不在允许的目录子树内（仅限当前工作区）：${path}`);
  return assertDirectory(absolute);
}
