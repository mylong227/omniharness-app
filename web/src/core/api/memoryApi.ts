// memory 域 API（W4 域拆分，2026-11-21）：方法自 ApiClient 原样迁移，宿主从 ApiClient 换成 transport 注入。
// this.rpc 字面量形态保留（apiClientParity 判据按字面量提取，提取源已同步改为 core/api/ 目录）。
import type {
  MemoryListResult,
  MemorySearchResult,
} from '../../types/models.ts';
import type { ApiTransport } from './rpcTransport.ts';

/** memory 域的 RPC 面。 */
export class MemoryApi {
  /** 共享传输（ApiClient 本体：统一 JSON-RPC 入口 + 错误分类 + 鉴权头）。 */
  private readonly rpc: ApiTransport;

  /** @param rpc 共享传输。 */
  public constructor(rpc: ApiTransport) {
    this.rpc = rpc;
  }

  public listMemory(): Promise<MemoryListResult> {
    return this.rpc('memory.list', {});
  }
  /** 事实时间图快照（Memory Atlas，只读）：supported=false = 运行时无图，UI 如实隐藏。 */
  public memoryFacts(): Promise<import('../../types/models.ts').MemoryFactsResult> {
    return this.rpc('memory.facts', {});
  }
  public searchMemory(query: string, limit = 20): Promise<MemorySearchResult> {
    return this.rpc('memory.search', { query, limit });
  }
  public addMemory(fact: { text: string; topic?: string; importance?: number }): Promise<unknown> {
    return this.rpc('memory.add', fact);
  }
  public updateMemory(fact: { id: string; text: string; topic?: string; importance?: number }): Promise<unknown> {
    return this.rpc('memory.update', fact);
  }
  public deleteMemory(id: string): Promise<unknown> {
    return this.rpc('memory.delete', { id });
  }

  // ---- 插件集 Profile + Bundle ----
}
