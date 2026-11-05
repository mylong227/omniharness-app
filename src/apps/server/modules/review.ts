import type { ServerModule } from '../core/serverModule.ts';

/**
 * 内联 diff 审查模块：hunk/file 级 stage 与 revert（`changes.stageFile` / `changes.revertFile` /
 * `changes.stageHunk` / `changes.revertHunk`）+ 行级评论（`changes.comments.*`）。
 * 委托 {@link DiffReview} / {@link DiffCommentStore}。
 */
export function reviewModule(): ServerModule {
  return {
    name: 'review',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('changes.stageFile', (params) => Promise.resolve(s.diffReview.stageFile(params)));
      ctx.rpc('changes.revertFile', (params) => Promise.resolve(s.diffReview.revertFile(params)));
      ctx.rpc('changes.stageHunk', (params) => Promise.resolve(s.diffReview.stageHunk(params)));
      ctx.rpc('changes.revertHunk', (params) => Promise.resolve(s.diffReview.revertHunk(params)));
      ctx.rpc('changes.comments.list', () => Promise.resolve(s.diffComments.list()));
      ctx.rpc('changes.comments.add', (params) => Promise.resolve(s.diffComments.add(params)));
      ctx.rpc('changes.comments.delete', (params) => Promise.resolve(s.diffComments.remove(params)));
    },
  };
}
