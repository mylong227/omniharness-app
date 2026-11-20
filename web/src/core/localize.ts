// core 层的文案本地化接缝（2026-11-20 批次二 A1-2）：core 不 import ui/i18n（分层方向
// 恢复单向），由 ui 在装配期注入翻译器——依赖倒置，行为不变。
//
// 未注入时回退键原文（键即中文原文，等价 zh 界面），保证「任何 RPC 都晚于 mount 注入」
// 的前提下无可见差异；core 单测在 node 里跑时拿到的也是稳定键原文。

/** 翻译器形态（与 ui/i18n 的 t 同签名；params 用宽松记录类型避免 core 依赖 i18n 类型）。 */
export type Localizer = (key: string, params?: Record<string, string | number>) => string;

let localize: Localizer = (key) => key;

/**
 * 装配期注入翻译器（AppController.mount 最先调用；重复注入以最后一次为准）。
 * @param fn 翻译器
 * @returns 无返回值
 */
export function setLocalizer(fn: Localizer): void {
  localize = fn;
}

/**
 * core 层文案本地化（ApiClient/DialogService 的用户可见串经此出口）。
 * @param key 中文原文键
 * @param params 占位参数
 * @returns 本地化文案；未注入时返回键原文
 */
export function L(key: string, params?: Record<string, string | number>): string {
  return localize(key, params);
}
