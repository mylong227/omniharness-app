import type { LongTermMemoryPort, MemoryFact, MemoryFactPatch } from '../../../host/kernel/contracts.ts';
import { Id } from '../../../host/kernel/util.ts';
import type { ServerModule } from '../core/serverModule.ts';

/**
 * 事实卡视图（内核 TemporalFactCard 的只读子集；text/trust/expiresAt 内核侧可缺省）。
 * `validTo === undefined` = 仍有效；同 subject+predicate 的新事实会把旧卡 validTo 置为新
 * 事实的 validFrom（取代语义），`validTo <= now` 的卡不再参与召回。
 */
interface FactCardView {
  factId: string;
  subject: string;
  predicate: string;
  object: string;
  text?: string;
  validFrom: number;
  validTo?: number;
  trust?: string;
  expiresAt?: number;
}

/** 事实图最小探测面（FileLongTermMemory 的端口外能力——图是实现细节不进端口契约）。 */
interface FactGraphProbe {
  cards(): readonly FactCardView[];
  size(): number;
  activeSize(nowMs: number): number;
}

/** `memory.facts` 快照：supported=false = 该运行时没有事实图（如实降级，UI 隐藏时间图）。 */
export interface MemoryFactsSnapshot {
  supported: boolean;
  cards: readonly FactCardView[];
  total: number;
  active: number;
}

/**
 * 事实图快照（纯函数，node 直测）：窄转型探测 `factGraph` → 全量卡 + 计数。
 * @param longTermMemory 长期记忆端口实例（运行时默认 FileLongTermMemory 持图）
 * @param nowMs 当前时刻（activeSize 裁决口径，内核 `<=` 到点即失效）
 * @returns 快照；无图时 supported=false 且计数为 0
 */
export function factsSnapshot(longTermMemory: unknown, nowMs: number): MemoryFactsSnapshot {
  const graph = (longTermMemory as { factGraph?: FactGraphProbe | undefined } | undefined)
    ?.factGraph;
  if (graph === undefined) {
    return { supported: false, cards: [], total: 0, active: 0 };
  }
  return { supported: true, cards: graph.cards(), total: graph.size(), active: graph.activeSize(nowMs) };
}

/**
 * 长期记忆管理模块（#G-D / 4.3）：列表/查看/增/改/删/检索 + 事实时间图（memory.facts，只读）
 * + 变更实时通知（`memory.changed`）。
 */
export function memoryModule(): ServerModule {
  return {
    name: 'memory',
    register(ctx) {
      const s = ctx.services;
      const store = (): LongTermMemoryPort => s.options.config.longTermMemory;
      ctx.rpc('memory.facts', async () => factsSnapshot(store(), Date.now()));
      ctx.rpc('memory.list', async () => {
        const facts = store().all();
        return { count: facts.length, facts: facts.map((f) => ({ ...f })) };
      });
      ctx.rpc('memory.add', async (params) => {
        const fact = newFactFrom(params);
        store().remember(fact);
        ctx.notify('memory.changed', {});
        return { ok: true, id: fact.id };
      });
      ctx.rpc('memory.update', async (params) => {
        const id = memoryId(params, 'memory.update');
        const patch: MemoryFactPatch = {};
        if (typeof params['text'] === 'string') patch.text = params['text'];
        if (typeof params['topic'] === 'string') patch.topic = params['topic'];
        if (typeof params['importance'] === 'number') patch.importance = params['importance'];
        const ok = store().update(id, patch);
        if (!ok) {
          throw new Error('未找到记忆: ' + id);
        }
        ctx.notify('memory.changed', {});
        return { ok: true };
      });
      ctx.rpc('memory.delete', async (params) => {
        const id = memoryId(params, 'memory.delete');
        const ok = store().delete(id);
        if (!ok) {
          throw new Error('未找到记忆: ' + id);
        }
        ctx.notify('memory.changed', {});
        return { ok: true };
      });
      ctx.rpc('memory.search', async (params) => {
        const query = params['query'];
        if (typeof query !== 'string' || query.trim() === '') {
          throw new Error('memory.search 需要非空 query');
        }
        const limit =
          typeof params['limit'] === 'number'
            ? Math.max(1, Math.floor(params['limit'] as number))
            : 5;
        const hits = store().recall(query, limit);
        return {
          count: hits.length,
          results: hits.map((fact) => ({
            id: fact.id,
            topic: fact.topic,
            text: fact.text,
            importance: fact.importance,
          })),
        };
      });
    },
  };
}

/**
 * 从 RPC 参数里取记忆 id（守卫收敛：四个 memory 方法同一段「非空字符串」检查）。
 * @param params RPC 参数。
 * @param label 报错前缀（哪个方法）。
 * @returns 已校验的记忆 id。
 */
function memoryId(params: Record<string, unknown>, label: string): string {
  const idParam = params['id'];
  if (typeof idParam !== 'string' || idParam.length === 0) {
    throw new Error(`${label} 需要 id`);
  }
  return idParam;
}

/**
 * 从 `memory.add` 参数构造记忆事实（守卫 + 夹紧 importance + 来源标记）。
 * @param params RPC 参数。
 * @returns 待落盘的事实。
 */
function newFactFrom(params: Record<string, unknown>): MemoryFact {
  const text = params['text'];
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('memory.add 需要非空 text');
  }
  const topic = typeof params['topic'] === 'string' ? (params['topic'] as string) : undefined;
  const rawImp = typeof params['importance'] === 'number' ? params['importance'] : 3;
  const importance = Math.min(5, Math.max(1, Math.round(rawImp)));
  return {
    id: Id.id('mem'),
    text: text.trim(),
    topic,
    importance,
    createdAt: new Date().toISOString(),
    sessionId: 'ui-manual',
    source: 'tool',
  };
}
