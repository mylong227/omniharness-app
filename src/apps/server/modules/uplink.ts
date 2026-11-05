import type { ServerModule } from '../core/serverModule.ts';

/**
 * 上行响应模块：`approval.respond` / `question.respond` 及挂起恢复查询
 * （`approval.pending` / `question.pending`，2026-11-01）。
 *
 * 挂起恢复为什么需要：`approval.request` / `question.request` 是 live-only 通知（不进 SSE 重放历史），
 * 页面刷新后新连接收不到「正在等待」这件事；客户端重连后各拉一次即可重建卡片。
 * 与传输层的断连宽限期配套：宽限期内复联 ⇒ 挂起仍在 ⇒ 恢复查询拿得到。
 */
export function uplinkModule(): ServerModule {
  return {
    name: 'uplink',
    register(ctx) {
      const s = ctx.services;
      // 响应审批上行（approval.respond）：委托事件桥把决定送达等待中的审批方。
      ctx.rpc('approval.respond', (params) => Promise.resolve(s.events.respondApproval(params)));
      // 提问上行（2026-10-08）：提问卡作答经此送达等待中的 ask_user / plan_present（此前只读卡无法提交）。
      ctx.rpc('question.respond', (params) => Promise.resolve(s.events.respondQuestion(params)));
      ctx.rpc('approval.pending', () => Promise.resolve(s.events.pendingApprovalRequests()));
      ctx.rpc('question.pending', () => Promise.resolve(s.events.pendingQuestionsSnapshot()));
    },
  };
}
