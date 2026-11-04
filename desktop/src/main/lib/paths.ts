/**
 * 运行路径解析。
 *
 * 开发态 = 本仓库根（后端源码与产物都在本仓库）；打包态 = `resources/harness`
 * （由 `scripts/stageHarness.mjs` 铺好）。
 *
 * ## 为什么后端根目录仍可外部覆盖（2026-11-04 应用整合）
 *
 * 本仓库自带完整后端（`src/` + `dist/`），UI 的 `/rpc`、`/events`、`/files`、`/healthz` 与
 * 桌面侧车都由它提供。但「后端在哪」保留成外部输入，用于两种真实场景：
 *
 *   · 联调/回滚：指向另一份后端工作树（如上游 `omniharness`）验证兼容性；
 *   · 未来切到内核宿主：用 `OMNI_HARNESS_ENTRY` 指向新的宿主入口，桌面壳不用改。
 *
 *   · `OMNI_BACKEND_ROOT`：后端工作树根（含 `dist/src/apps/cli/exec.js`、`defaults/`、`native/`）；
 *     缺省 = 本仓库根（`desktop/` 的上一级）；
 *   · `OMNI_HARNESS_ENTRY`：直接指定侧车入口（优先级最高）。
 */
import { app } from 'electron';
import { join, resolve } from 'node:path';

/** 环境变量优先取非空值。 */
const envValue = (name: string): string => (process.env[name] ?? '').trim();

/**
 * 后端工作树根目录（承载 CLI 侧车与静态资源）。
 *
 * 优先级：`OMNI_BACKEND_ROOT` → 打包态 `resources/harness` → 开发态本仓库根。
 * @returns 绝对路径。
 */
export function backendRoot(): string {
  const configured = envValue('OMNI_BACKEND_ROOT');
  if (configured !== '') return resolve(configured);
  return app.isPackaged
    ? resolve(process.resourcesPath, 'harness')
    : // 本仓库根 = `desktop/` 的上一级（`app.getAppPath()` 在开发态就是 desktop/）。
      resolve(app.getAppPath(), '..');
}

/**
 * Harness 根目录（与 `backendRoot()` 同义；保留旧名，调用方不必改）。
 * @returns 后端根绝对路径。
 */
export function harnessRoot(): string {
  return backendRoot();
}

/**
 * Harness CLI 入口。
 *
 * 优先级：`OMNI_HARNESS_ENTRY` → `<backendRoot>/dist/src/apps/cli/exec.js`。
 * @returns 入口脚本绝对路径。
 */
export function harnessEntry(): string {
  const configured = envValue('OMNI_HARNESS_ENTRY');
  if (configured !== '') return resolve(configured);
  return join(backendRoot(), 'dist', 'src', 'apps', 'cli', 'exec.js');
}

/**
 * Node 解释器。
 *
 * 开发态优先 `OMNI_NODE_BIN`，否则使用 PATH 里的 `node`；打包态固定 `<backendRoot>/node.exe`。
 * @returns 可执行文件路径/命令。
 */
export function nodeBinary(): string {
  if (app.isPackaged) {
    return join(backendRoot(), process.platform === 'win32' ? 'node.exe' : 'node');
  }
  const configured = envValue('OMNI_NODE_BIN');
  return configured !== '' ? configured : 'node';
}

/**
 * 桌面日志目录（用户级）。
 * @param userDataDir Electron userData。
 * @param dirName 目录名（桌面配置）。
 * @returns 绝对路径。
 */
export function logDir(userDataDir: string, dirName: string): string {
  return join(userDataDir, dirName);
}

/**
 * 桌面临时运行目录（就绪文件等）。
 * @param userDataDir Electron userData。
 * @param dirName 目录名（桌面配置）。
 * @returns 绝对路径。
 */
export function runDir(userDataDir: string, dirName: string): string {
  return join(userDataDir, dirName);
}

/**
 * 模型缓存目录（必须可写，不能落在 Program Files）。
 * @param userDataDir Electron userData。
 * @param dirName 目录名（桌面配置）。
 * @returns 绝对路径。
 */
export function modelDir(userDataDir: string, dirName: string): string {
  return join(userDataDir, dirName);
}

/**
 * 向量缓存目录。
 * @param userDataDir Electron userData。
 * @param dirName 目录名（桌面配置）。
 * @returns 绝对路径。
 */
export function vectorDir(userDataDir: string, dirName: string): string {
  return join(userDataDir, dirName);
}
