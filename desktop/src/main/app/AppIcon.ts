/** 应用图标文件选择：Windows 用多尺寸 ICO，其它平台用 512 PNG。 */
import { join } from 'node:path';

/**
 * 选出窗口/任务栏要用的图标文件。
 *
 * 为什么 Windows 必须用 `.ico` 而不是 `.png`：任务栏按钮图标由系统按当前 DPI
 * 从小图标（16/20/24/32/48…）里挑一帧；只给一张 512 PNG 时只能整张缩放，
 * 16–24px 下细描边和 Ω 一起糊成一团。`.ico` 里 16–256 每档都是按目标像素
 * 单独渲染的帧（见 static/icon.ico），任务栏直接取帧，不受缩放损失。
 *
 * @param dir 图标目录（开发态是 `desktop/dist`，打包后是 app.asar 内的 `dist`）。
 * @param platform 目标平台；注入以便判据在任意系统上覆盖两种分支。
 * @returns 图标文件绝对路径。
 */
export function resolveAppIconPath(dir: string, platform: NodeJS.Platform): string {
  return join(dir, platform === 'win32' ? 'icon.ico' : 'icon.png');
}
