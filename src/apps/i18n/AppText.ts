// 应用层（服务端 / CLI / 审计报告）文案目录入口。
//
// 与 web 的 `ui/i18n` 同口径：**中文原文即键**，en 词条缺省回落到中文；
// 不同之处是这层文案不经过 React，由服务端按 `config.locale` 与 CLI 解析出的 locale
// 统一选择语言。词条集中在 `en/` 分片里，禁止在调用点写裸中文。
//
// 纪律（由 `tests/appTextCoverage.test.ts` 机检）：
//   1. `AppText.t('…')` 的中文字面量键必须在 en 分片有同键条目；
//   2. 分片之间不得重复键（合并后后者覆盖前者会静默丢翻译）；
//   3. 新增用户可见文案只允许走本类，不允许散落字面量。

import { EN } from './en/index.ts';

/** 支持的语言（与服务端 `config.locale` 同集合）。 */
export type AppLocale = 'zh' | 'en';

/** 当前语言（进程级；服务端随 config 更新、CLI 启动时解析一次）。 */
let current: AppLocale = 'zh';

/** 插值参数：`{name}` 占位替换。 */
export type AppTextParams = Readonly<Record<string, string | number>>;

/**
 * 应用层文案目录（中文键 → 当前语言文案）。
 *
 * 纯静态类：无实例状态；locale 由进程级 `setLocale` 维护。
 */
export class AppText {
  private constructor() {}

  /** 当前语言。 */
  public static get locale(): AppLocale {
    return current;
  }

  /**
   * 设置当前语言（服务端组合根与服务端配置更新处调用；CLI 在配置构建后调用一次）。
   * @param locale 目标语言
   */
  public static setLocale(locale: AppLocale): void {
    current = locale;
  }

  /**
   * 取词条：zh 恒回原文；en 查表缺词回落原文。插值用 `{name}` 占位。
   * @param key 中文原文键
   * @param params 插值参数
   * @returns 当前语言文案
   */
  public static t(key: string, params?: AppTextParams): string {
    let text = current === 'en' ? (EN[key] ?? key) : key;
    if (params !== undefined) {
      for (const name of Object.keys(params)) {
        text = text.split('{' + name + '}').join(String(params[name]));
      }
    }
    return text;
  }
}
