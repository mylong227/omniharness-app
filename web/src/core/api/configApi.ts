// config 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type {
  Config,
} from '../../types/models.ts';
import type { ApiTransport } from './rpcTransport.ts';

/** config 域的 RPC 面。 */
export class ConfigApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public getConfig(): Promise<Config> {
    return this.rpc('config.get', {});
  }
  public updateConfig(patch: Record<string, unknown>): Promise<unknown> {
    return this.rpc('config.update', patch);
  }
  /** 厂商目录（#模型接入页）：服务端单一下发，含当前厂商与其可用模型 + 该厂商合法 reasoning_effort 档位。 */
  public modelCatalog(): Promise<{
    providers: import('../../types/models.ts').ProviderPreset[];
    active?: {
      id: string;
      label: string;
      defaultModel: string;
      model?: string;
      models: string[];
      /** 当前厂商合法 reasoning_effort 档位（#B6 扩展，2026-09-08）：undefined/[] 用 UI 兜底。 */
      reasoningEffort?: string[];
      /** 每模型推理档位（adaptive-reasoning）：模型级 `[]` = 确证不支持；缺字段回落 reasoningEffort。 */
      effortsByModel?: Record<string, string[]>;
    };
  }> {
    return this.rpc('model.catalog', {});
  }
  /** 单价表下发（#9）：服务端参考价单一真源；ModelPricing 服务端表优先、内置表兜底。 */
  public modelPricing(): Promise<import('../../types/models.ts').ModelPricingTable> {
    return this.rpc('model.pricing', {});
  }
  /** 适配器凭据面（P2 预检）：服务端 env 实测的 credentialReady；只回布尔与 env 名，不回凭据值。 */
  public modelAdapters(): Promise<{ adapters: import('../../types/models.ts').AdapterCredentialInfo[] }> {
    return this.rpc('model.adapters', {});
  }
  /** Token 消耗统计：按模型 / 按会话聚合调用次数与 token 用量。 */
  public probeModels(provider?: string): Promise<{ providers: import('../../types/models.ts').ProviderProbeResult[] }> {
    return this.rpc('model.probe', provider ? { provider } : {});
  }
  /** 工作区列表（当前 + 已添加项目）。 */
  public searchAll(
    query: string,
    limit?: number,
  ): Promise<{ files: import('../../types/models.ts').SearchHit[]; chats: import('../../types/models.ts').SearchHit[]; messages?: import('../../types/models.ts').SearchHit[] }> {
    return this.rpc('search.all', limit === undefined ? { query } : { query, limit });
  }

  // ---- 控制室（2026-11-10，v1 全部只读：编队 / 上下文 / 凭证） ----

  /** 编队快照：当前父会话的子代理车道（运行中 + 已回传；无派生为空数组）。 */
}
