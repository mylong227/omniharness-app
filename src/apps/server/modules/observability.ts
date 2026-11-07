import { DaemonController } from '../../daemon/daemonController.ts';
import { AuditExporter, type AuditQuery } from '../services/auditExporter.ts';
import type { AuditEvent } from '../services/auditSink.ts';
import type {
  TraceReadRequest,
  TraceReadResult,
} from '../../../host/kernel/contracts.ts';
import type { ServerModule } from '../core/serverModule.ts';

/**
 * 只读可观测模块（Web 交付项，2026-10-11）：`daemon.status`、`doctor.report`、`audit.query`
 * 与只读 trace 自省 `trace.read`（T4.5）。
 *
 * 两条纪律（都在钉"没有就是没有"）：
 * 1. `daemon.status` 与 `omniharness daemon status` **同一事实源**：同一个 `DaemonController`、
 *    同一默认 pid 文件（`~/.omniharness/daemon.pid`）⇒ 面板与命令行不会互相打脸；
 * 2. `doctor.report` / `audit.query` 未注入实现时**显式报错**（`ok:false` + 原因），
 *    绝不返回空报告/空数组冒充"体检通过/无审计记录"。
 */
export function observabilityModule(): ServerModule {
  return {
    name: 'observability',
    register(ctx) {
      const s = ctx.services;
      ctx.rpc('daemon.status', () => Promise.resolve(new DaemonController().status()));
      ctx.rpc('doctor.report', async (params) => {
        const provided = s.options.doctorReport;
        if (provided === undefined) {
          return { ok: false, reason: 'doctor 未接线（serve 组合根未注入 doctorReport）' };
        }
        const workspaceRoot =
          typeof params['workspaceRoot'] === 'string' ? params['workspaceRoot'] : undefined;
        const report = await provided(workspaceRoot === undefined ? undefined : { workspaceRoot });
        return { ok: true, report };
      });
      // T4.5：只读 trace 自省 RPC（agent 自查「我刚做了什么」，无写方法，不可借道改历史）。
      ctx.rpc('trace.read', async (params) => readTraceRpc(s, params));
      ctx.rpc('audit.query', (params) => Promise.resolve(queryAuditRpc(s, params)));
    },
  };
}

/**
 * 解析 trace.read 参数（宽松：非法值按缺省处理，会话 id 原样透传以便如实报错）。
 * @param params RPC 原始参数
 * @returns 规范化后的 trace 查询（session 必填，limit/kind 可缺省）
 */
function traceRequest(params: Record<string, unknown>): TraceReadRequest {
  const rawSession = params['sessionId'];
  const session = typeof rawSession === 'string' ? rawSession : '';
  const kind = typeof params['kind'] === 'string' ? params['kind'] : undefined;
  const limit = typeof params['limit'] === 'number' ? params['limit'] : undefined;
  return {
    session,
    ...(kind !== undefined ? { kind } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

/**
 * 只读 trace 自省 RPC（T4.5）：先按会话把事件流加载进只读投影器，再取冻结条目返回。
 *
 * 只读保证：返回条目由 `ReadonlyTraceReader` 深拷贝 + `Object.freeze`，调用方拿到的只是快照；
 * 本 RPC 无任何写方法，agent 无法借道篡改自己的历史。fail-soft：会话不存在或事件源读取失败时
 * 回 `{ entries: [], count: 0, error }`，不抛 RPC 错误打断消费方。
 * @param params `{ sessionId, kind?, limit? }` — 目标会话与可选类别/条数过滤
 * @returns 冻结 trace 条目快照（新在前）+ 计数 + 失败原因
 */
async function readTraceRpc(
  s: import('../core/serverServices.ts').ServerServices,
  params: Record<string, unknown>,
): Promise<TraceReadResult> {
  const request = traceRequest(params);
  await s.trace.load(request.session);
  return s.trace.read(request);
}

/**
 * 审计查询 RPC：读取服务端审计 sink 并应用过滤条件返回事件。
 *
 * 2026-10-11（Web 交付 audit 面板）：返回体改为**判别联合**——未注入 audit 时回
 * `{ok:false, reason}`，而**不是**空数组。理由：面板拿到空数组只能渲染成"审计无记录"，
 * 而真相是"服务端根本没装审计 sink"；这两件事对排查者意义完全不同（与同批 `doctor.report`
 * 的处置同源）。
 * @param params `{ since?, until?, type?, session?, actor?, limit? }`
 * @returns `{ok:true, events}` 或 `{ok:false, reason}`。
 */
function queryAuditRpc(
  s: import('../core/serverServices.ts').ServerServices,
  params: Record<string, unknown>,
):
  | { readonly ok: true; readonly events: AuditEvent[] }
  | { readonly ok: false; readonly reason: string } {
  const sink = s.options.audit;
  if (sink === undefined) {
    return { ok: false, reason: 'audit 未接线（serve 组合根未注入 audit sink）' };
  }
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const num = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
    return undefined;
  };
  const query: AuditQuery = {
    since: str(params['since']),
    until: str(params['until']),
    type: str(params['type']),
    session: str(params['session']),
    actor: str(params['actor']),
    limit: num(params['limit']),
  };
  return { ok: true, events: AuditExporter.queryAudit(sink.read(), query) };
}
