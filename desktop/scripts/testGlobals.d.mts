/**
 * 桌面测试的全局替身状态声明（2026-11-21 脚本 .mts 化随迁）。
 *
 * `fakeElectron.cjs`（esbuild alias 的 electron 测试替身）把调用记录挂到 `globalThis`，
 * tray.cjs 包内与 test.mts 判据两侧共享同一份状态；此前 test.mjs 不进 tsc 视野（历史）、
 * 这里无须声明——纳入类型门后补齐（形状与 fakeElectron.cjs 的初始化保持一致）。
 */
declare global {
  // 双下划线命名 = 测试替身专用约定，产品代码不得读写。
  var __electronMockState:
    | {
        /** Tray 构造次数。 */
        created: number;
        /** Tray destroy 次数。 */
        destroyed: number;
        /** setBusy 换图记录。 */
        images: { path: string; resized: { width: number; height: number } }[];
        /** setTooltip 调用记录。 */
        tooltips: string[];
        /** Menu 构建次数。 */
        menus: number;
        /** 最近一次 Tray 实例快照。 */
        lastTray: { image: { path: string; resized: { width: number; height: number } } } | null;
      }
    | undefined;
}

export {};
