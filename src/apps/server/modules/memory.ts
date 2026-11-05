import type { LongTermMemoryPort, MemoryFact, MemoryFactPatch } from '../../../host/kernel/contracts.ts';
import { Id } from '../../../host/kernel/util.ts';
import type { ServerModule } from '../core/serverModule.ts';

/**
 * 长期记忆管理模块（#G-D / 4.3）：列表/查看/增/改/删/检索 + 变更实时通知（`memory.changed`）。
 */
export function memoryModule(): ServerModule {
  return {
    name: 'memory',
    register(ctx) {
      const s = ctx.services;
      const store = (): LongTermMemoryPort => s.options.config.longTermMemory;
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
