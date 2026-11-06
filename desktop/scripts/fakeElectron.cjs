// 桌面端单测用的 Electron 替身：只实现 `TrayService` 触到的表面（Tray / Menu / nativeImage）。
//
// 为什么要有它：`tray.ts` 是纯逻辑（去重、回退、复位），但顶层 import 了 electron ⇒ 在 node 里
// 直接 require 会拉起真 Electron。测试用 esbuild `--alias:electron=./scripts/fakeElectron.cjs`
// 注入本文件（见 scripts/test.mjs），于是不必为了可测性把依赖注入进生产 API。
//
// 状态挂在 globalThis：测试侧的模块副本与 tray 包内的副本必须看到**同一份**记录。

const state = (globalThis.__electronMockState = globalThis.__electronMockState ?? {
  created: 0,
  destroyed: 0,
  images: [],
  tooltips: [],
  menus: 0,
  lastTray: null,
});

/** 假图像：记录来源路径、是否为空、请求的缩放尺寸。 */
class FakeImage {
  constructor(path) {
    this.path = path;
    this.empty = path.includes('empty');
    this.resized = null;
  }

  isEmpty() {
    return this.empty;
  }

  resize(size) {
    this.resized = size;
    return this;
  }
}

/** 假托盘：记录 setImage / destroy 调用。 */
class FakeTray {
  constructor(image) {
    this.image = image;
    state.created += 1;
    state.lastTray = this;
  }

  setToolTip(text) {
    state.tooltips.push(text);
  }

  setContextMenu() {
    state.menus += 1;
  }

  on() {
    // 事件绑定与 busy 态无关。
  }

  setImage(image) {
    state.images.push(image);
    this.image = image;
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    state.destroyed += 1;
  }
}

module.exports = {
  Tray: FakeTray,
  Menu: { buildFromTemplate: (template) => ({ template }) },
  nativeImage: { createFromPath: (path) => new FakeImage(path) },
};
