// 前端哈希路由（F8）：把「当前右栏面板 + 当前会话」编码进 location.hash，
// 支持深链（刷新 / 分享链接直达）与浏览器前进 / 后退。纯函数 + 轻量订阅，不依赖 React。
// 浏览器不可用（单测）时回落到注入的全局 location / window，避免硬崩溃。
//
// 位置（2026-11-21 W3）：core/ → ui/models/——路由白名单消费 PanelRegistry（同层纯数据），
// 留在 core 会构成 core→ui 反向依赖（批次二清零的违规面）；哈希路由本质是 UI 关注点。

import { PANELS } from './PanelRegistry.ts';

/** 一条路由：右侧激活面板标识 + 当前打开的会话 id（null 表示无）。 */
export interface AppRoute {
  /** 右栏面板标识（tools/changes/file/...；设置不在其中，见 VALID_PANES 注释）。 */
  pane: string;
  /** 当前打开的会话 id；null 表示未打开具体会话。 */
  threadId: string | null;
  /**
   * 面板内部视图（可选，2026-11-10 控制室引入）：仅 `pane=control` 有意义——
   * `fleet` / `context` / `proof` 三模式 tab。其它面板忽略该字段。
   */
  view?: string;
}

/**
 * 合法面板标识（W3 单源化，2026-11-21）：**派生自 `PanelRegistry.PANELS`**——
 * 此前是 21 个手抄字面量（注释自称"与 PanelRegistry 保持一致"，实为第三份真相）；
 * 现在新增面板只改注册表，路由白名单自动跟随。
 *
 * 'settings' 已移除（2026-10-17）：设置不再是右栏面板，而是左栏页脚按钮 + 居中模态。
 * 保留它在合法集合里会让 `#pane=settings` 被解析成"合法但不存在的面板"⇒ 右栏渲染空白；
 * 旧书签现在安全落回默认面板（tools）——PANELS 里没有它，派生集合天然不含。
 */
const VALID_PANES: ReadonlySet<string> = new Set(PANELS.map((panel) => panel.key));

/** 控制室三模式的合法 view 值（深链白名单；未知值落回 fleet，见 parseHash）。 */
const CONTROL_VIEWS: ReadonlySet<string> = new Set(['fleet', 'context', 'proof']);

/** 控制室默认 view（设计 CR-03：未知 view 落回编队）。 */
const DEFAULT_CONTROL_VIEW = 'fleet';

/** 默认路由（首屏 / 无 hash 时）。 */
const DEFAULT_ROUTE: Readonly<AppRoute> = { pane: 'tools', threadId: null };

/**
 * 读取当前 location.hash（浏览器不可用时回落空串）。
 * @returns 原始 hash 串（含前导 #）
 */
function currentHash(): string {
  try {
    return typeof location !== 'undefined' && typeof location.hash === 'string' ? location.hash : '';
  } catch {
    return '';
  }
}

/**
 * 把原始 hash 解析为路由；非法面板标识回落默认。
 * @returns 解析后的路由
 */
export function parseHash(): AppRoute {
  const h = currentHash().replace(/^#/, '');
  if (h === '') return { pane: DEFAULT_ROUTE.pane, threadId: null };
  const params = new URLSearchParams(h);
  const paneRaw = params.get('pane');
  const pane = paneRaw !== null && VALID_PANES.has(paneRaw) ? paneRaw : DEFAULT_ROUTE.pane;
  const threadRaw = params.get('thread');
  // 控制室的内部视图：只在 pane=control 时解析；未知值落回 fleet（不把脏值写进状态）。
  const viewRaw = params.get('view');
  const view =
    pane === 'control' && viewRaw !== null && CONTROL_VIEWS.has(viewRaw) ? viewRaw : undefined;
  return {
    pane,
    threadId: threadRaw === null || threadRaw === '' ? null : threadRaw,
    ...(view !== undefined ? { view } : {}),
  };
}

/**
 * 把路由序列化为 hash 串（含前导 #）。
 * @param route 路由
 * @returns hash 串
 */
export function toHash(route: AppRoute): string {
  const params = new URLSearchParams();
  params.set('pane', route.pane);
  if (route.threadId !== null && route.threadId !== '') params.set('thread', route.threadId);
  if (route.pane === 'control') {
    params.set('view', route.view !== undefined && CONTROL_VIEWS.has(route.view) ? route.view : DEFAULT_CONTROL_VIEW);
  }
  return '#' + params.toString();
}

/**
 * 导航到指定路由：写入 location.hash（触发 hashchange，由订阅者统一收口状态）。
 * 写入相同 hash 时浏览器不触发 hashchange，天然幂等、不会死循环。
 * @param route 目标路由
 * @returns 无
 */
export function navigate(route: AppRoute): void {
  try {
    if (typeof location !== 'undefined') location.hash = toHash(route);
  } catch {
    /* 忽略：非浏览器环境无 location */
  }
}

/**
 * 订阅 hashchange；回调收到解析后的路由。返回取消订阅函数。
 * @param cb 路由变化回调
 * @returns 取消订阅函数（无 window 时为空操作）
 */
export function onRouteChange(cb: (route: AppRoute) => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const handler = (): void => {
    cb(parseHash());
  };
  window.addEventListener('hashchange', handler);
  return () => {
    if (typeof window.removeEventListener === 'function') window.removeEventListener('hashchange', handler);
  };
}

/**
 * 判断面板标识是否合法（供调用方校验，避免把脏值写进 hash）。
 * @param pane 面板标识
 * @returns 是否合法
 */
export function isValidPane(pane: string): boolean {
  return VALID_PANES.has(pane);
}
