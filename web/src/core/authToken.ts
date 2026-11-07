/**
 * 前端 Bearer 令牌解析：把服务端的 OMNI_SERVE_TOKEN 暴露给浏览器侧 RPC / SSE。
 *
 * OmniHarness Web 是零打包器、由服务端静态托管的原生 ESM，没有构建期注入令牌的通道，
 * 故令牌只能「运行时」取得：显式 set() 覆盖 > sessionStorage['omni.serveToken'] > URL ?token=。
 * 当服务端未启用令牌（回环默认）时 resolve() 返回空串，调用方据此跳过 Authorization。
 *
 * 为什么是 sessionStorage 而不是 localStorage（2026-11-08 审计纵深）：令牌是**会话级**凭据，
 * 服务端重启即轮换——localStorage 的跨会话持久只会保留一份注定失效的旧令牌，还把可外泄面
 * 从「当前标签页」扩大到「关闭浏览器之前的所有标签页/会话」。sessionStorage 刷新仍在
 * （URL 抹除后不丢）、关浏览器即清，与会话语义严格对齐。
 */

/** 只读存储的最小接口（避免依赖具体 DOM 类型，便于在非浏览器环境注入）。 */
interface KeyValueStore {
  getItem(key: string): string | null;
}

/** 浏览器全局的最小接口（仅在真实浏览器环境存在）。 */
interface BrowserGlobals {
  readonly sessionStorage?: KeyValueStore & { setItem?: (k: string, v: string) => void };
  readonly location?: { readonly search: string };
}

/** 前端鉴权令牌来源：解析应随请求发送的 Bearer 令牌。 */
export class AuthToken {
  /** 显式覆盖（运行时设置 / 测试注入）；null 表示未设置，回退到持久化来源。 */
  private override: string | null = null;

  /**
   * 显式设置令牌（覆盖所有其他来源）。
   * @param token 令牌原文；空串表示清除覆盖，回退到 localStorage / URL。
   * @returns 无返回值。
   */
  public set(token: string): void {
    this.override = token === '' ? null : token;
  }

  /**
   * 启动期令牌安置（2026-11-06 审计 P2）：URL `?token=` 存在时——写入覆盖 + 持久化到
   * sessionStorage，然后 `history.replaceState` **把 token 从地址栏抹掉**。
   *
   * 为什么必须做：令牌留在 URL 里会进浏览器历史、屏幕共享与复制粘贴的链接
   * （服务端的 `Referrer-Policy: no-referrer` 管不到这些通道）；此前持久化层是
   * 死代码（没人写），本方法就是那个「写的人」。页面刷新后从 sessionStorage 恢复
   * （2026-11-08 起不再是 localStorage——会话级凭据不跨浏览器会话持久）。
   * @returns 无返回值。
   */
  public adoptFromUrl(): void {
    const urlToken = this.readUrlToken();
    if (urlToken === '') return;
    this.set(urlToken);
    const store = (globalThis as unknown as BrowserGlobals).sessionStorage;
    try {
      store?.setItem?.('omni.serveToken', urlToken);
    } catch {
      // 隐私模式等存储不可用：仅本次会话内有效（覆盖层仍在），不阻断启动。
    }
    const history = (globalThis as unknown as { history?: { replaceState?: (s: unknown, t: string, u: string) => void } }).history;
    const location = (globalThis as unknown as { location?: { pathname?: string; search?: string } }).location;
    try {
      if (history?.replaceState !== undefined && location?.pathname !== undefined) {
        const params = new URLSearchParams(location.search ?? '');
        params.delete('token');
        const qs = params.toString();
        history.replaceState(null, '', `${location.pathname}${qs === '' ? '' : `?${qs}`}`);
      }
    } catch {
      // replaceState 失败（如 file: 协议）不影响令牌已在覆盖层生效。
    }
  }

  /**
   * 解析当前应随请求发送的 Bearer 令牌。
   * @returns 令牌原文；无配置时返回空串（调用方跳过 Authorization 头）。
   */
  public resolve(): string {
    if (this.override !== null) {
      return this.override;
    }
    const persisted = this.readPersisted();
    if (persisted !== null) {
      return persisted;
    }
    return this.readUrlToken();
  }

  /**
   * 从 sessionStorage 读持久化令牌。
   * @returns 令牌原文；不可用或缺失时返回 null。
   */
  private readPersisted(): string | null {
    const store = (globalThis as unknown as BrowserGlobals).sessionStorage;
    if (store === undefined || typeof store.getItem !== 'function') {
      return null;
    }
    try {
      return store.getItem('omni.serveToken');
    } catch {
      return null;
    }
  }

  /**
   * 从 URL 查询参数 ?token= 读令牌（用户启动服务时把 OMNI_SERVE_TOKEN 一并带入页面）。
   * @returns 令牌原文；不可用或缺失时返回空串。
   */
  private readUrlToken(): string {
    const loc = (globalThis as unknown as BrowserGlobals).location;
    if (loc === undefined || typeof loc.search !== 'string') {
      return '';
    }
    try {
      return new URLSearchParams(loc.search).get('token') ?? '';
    } catch {
      return '';
    }
  }
}

/** 组合根单例：Web 全站共用同一令牌来源。 */
export const authToken = new AuthToken();
