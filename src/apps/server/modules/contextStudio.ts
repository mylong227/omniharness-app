import { AppText } from '../../i18n/AppText.ts';
import type { ServerModule } from '../core/serverModule.ts';
import { stringOf, tagsOf } from './rpcParams.ts';

/**
 * 上下文工作室模块（2026-11-20 批次三从 control.ts/surface.ts 按域归位）：
 * 快照读 + 工作区便签 + 压缩写回 + 容量读数（`context.usage` 同属上下文域）。
 *
 * **写（全部要求显式确认）**：`context.handoff.add/clear`（工作区便签）、`context.compact`
 * （写回压缩游标）。入参校验在模块层；会话 id 原样透传给服务，由服务 fail-soft 返回
 * 空快照，**绝不抛 JSON-RPC 错误打断面板**。
 */
export function contextStudioModule(): ServerModule {
  return {
    name: 'contextStudio',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('context.usage', async (params) =>
        s.contextUsage.usage(s.usageThreadId(stringOf(params['threadId']))),
      );
      ctx.rpc('context.studio', async (params) => {
        const threadId = stringOf(params['threadId']);
        return s.contextStudio.snapshotOf(threadId);
      });
      ctx.rpc('context.handoff.add', async (params) => {
        const text = stringOf(params['text']);
        const tags = tagsOf(params['tags']);
        return s.contextStudio.appendHandoff(text, tags) ?? null;
      });
      ctx.rpc('context.handoff.clear', async () => {
        return { ok: s.contextStudio.clearHandoff() };
      });
      ctx.rpc('context.compact', async (params) => {
        if (params['confirm'] !== true) {
          return {
            ok: false,
            code: 'confirm_required',
            message: AppText.t('手动压缩会改写历史游标；必须显式确认。'),
          };
        }
        return s.contextCompaction.compactOf(stringOf(params['threadId']));
      });
    },
  };
}
