// 面向对象的服务层：封装 GET /events 的 SSE 长连接。以回调（而非全局事件）对外暴露，
// 由 App 统一路由到对应的状态更新，避免 vanilla 版散落的隐式耦合。

import type { SseEnvelope } from '../types/models.ts';
import { authToken } from './authToken.ts';

export class EventStream {
  private es: EventSource | null = null;
  public onMessage: ((msg: SseEnvelope) => void) | null = null;
  public onOpen: (() => void) | null = null;
  public onClose: (() => void) | null = null;

  public connect(): void {
    if (this.es) return;
    // EventSource 不支持自定义请求头，故启用令牌门禁时把 Bearer 令牌经 ?token= 查询参数带上
    // （服务端 ServerAuthGuard 对该路径额外接受查询参数令牌，#A10 修复）。
    const token = authToken.resolve();
    const url = token !== '' ? `/events?token=${encodeURIComponent(token)}` : '/events';
    const es = new EventSource(url);
    es.onopen = () => this.onOpen?.();
    es.onerror = () => this.onClose?.();
    es.onmessage = (e: MessageEvent) => {
      let msg: SseEnvelope;
      try {
        msg = JSON.parse(e.data as string) as SseEnvelope;
      } catch {
        return;
      }
      this.onMessage?.(msg);
    };
    this.es = es;
  }

  /** EventSource.OPEN === 1；用于判断 SSE 是否连通以决定 graph 运行是否回退轮询。 */
  public get isOpen(): boolean {
    return this.es ? this.es.readyState === 1 : false;
  }

  /**
   * 用**当前**令牌重建连接（断连宽限期满 / 令牌更新后的自愈路径）。
   *
   * 为什么必须有它：EventSource 的自动重连永远复用**构造时**的 URL——服务端重启换令牌后
   * 它会拿旧 `?token=` 无限重试，且 `connect()` 的幂等闸门（`if (this.es) return`）会拦住
   * 一切「复用已存在连接」的重试入口。令牌变化只能由调用方显式 close 后带新令牌重建。
   * @returns 无返回值。
   */
  public reconnect(): void {
    this.close();
    this.connect();
  }

  public close(): void {
    if (this.es) this.es.close();
    this.es = null;
  }
}
