import { WorkflowRunner, WorkflowRunLog } from '../../../host/kernel/autonomy.ts';
import type { WorkflowDef } from '../../../host/kernel/autonomy.ts';
import type { GraphRunRegistry } from '../core/graphRunRegistry.ts';
import type { ServerModule } from '../core/serverModule.ts';
import type { AgentRuntimeHost } from '../core/agentRuntimeHost.ts';

/** 图运行落地管道的最小依赖面（从 ctx 提取，便于函数签名收窄）。 */
interface GraphDeps {
  readonly runtime: AgentRuntimeHost;
  readonly graphRuns: GraphRunRegistry;
  notify(event: string, params: Record<string, unknown>): void;
  messageOf(error: unknown): string;
}

/**
 * 多 Agent 编排模块（G-C，多 Agent 图存储）：图增删查 + 运行 + 实时状态。
 * 运行落地管道（`startGraphRun`）随本模块搬移：建态、登记、装配 `WorkflowRunner` 并接线通知。
 */
export function graphsModule(): ServerModule {
  return {
    name: 'graphs',
    register(ctx) {
      const s = ctx.services;
      const deps: GraphDeps = {
        runtime: s.runtime,
        graphRuns: s.graphRuns,
        notify: ctx.notify,
        messageOf: ctx.messageOf,
      };
      ctx.rpc('graph.list', async () => s.runtime.graphStore().list());
      ctx.rpc('graph.get', async (params) => {
        const idParam = params['id'];
        if (typeof idParam !== 'string' || idParam.length === 0) {
          throw new Error('graph.get 需要 id');
        }
        const def = s.runtime.graphStore().get(idParam);
        if (def === undefined) {
          throw new Error('未找到图: ' + idParam);
        }
        return def;
      });
      ctx.rpc('graph.save', async (params) => {
        const def = params['def'];
        if (!isWorkflowDefLike(def)) {
          throw new Error('graph.save 需要 def（含 name 与 steps）');
        }
        const savedId = s.runtime.graphStore().save(def as WorkflowDef);
        return { ok: true, id: savedId };
      });
      ctx.rpc('graph.delete', async (params) => {
        const idParam = params['id'];
        if (typeof idParam !== 'string' || idParam.length === 0) {
          throw new Error('graph.delete 需要 id');
        }
        return { ok: s.runtime.graphStore().delete(idParam) };
      });
      ctx.rpc('graph.run', async (params) => runGraph(deps, params));
      // 续跑入口（2026-10-08）：自 `graph.run` 的运行存档读回规格与已完成步骤，交给同一条落地管道。
      // 规格来自**存档首行**（不取调用方传入的定义）——这样「续跑哪一份定义」没有歧义；
      // 存档缺失 / 损坏 / 自校验失败一律作为 RPC 错误上抛（fail-closed，绝不新建一次「看着像续跑」的运行）。
      ctx.rpc('graph.resume', async (params) => {
        const runId = params['runId'];
        if (typeof runId !== 'string' || runId.length === 0) {
          throw new Error('graph.resume 需要 runId（来自上次 graph.run 的返回值）');
        }
        const threadId = params['threadId'];
        const owner = typeof threadId === 'string' && threadId.length > 0 ? threadId : undefined;
        // 存档根必须与**图运行落盘时用的那一个**同源：`WorkflowRunner` 写的是
        // `graphPorts().workspaceRoot`（配置根），而 `effectiveWorkspace()` 是「UI 当前工作区」
        // （可随会话切换）。实测两套根会分叉：用后者读会报「找不到运行日志」，而文件其实就在前者下面。
        const replay = new WorkflowRunLog(s.runtime.graphPorts().workspaceRoot).read(runId);
        return startGraphRun(deps, replay.header.spec, undefined, owner, runId);
      });
      ctx.rpc('graph.status', async (params) => {
        const runId = params['runId'];
        if (typeof runId !== 'string') {
          throw new Error('graph.status 需要 runId');
        }
        // 视图塑形下沉到台账（`GraphRunRegistry.describe`）：「运行态 → UI 视图」本就是台账职责。
        return s.graphRuns.describe(runId);
      });
    },
  };
}

/** 图运行定义守卫：`graph.run` / `graph.save` 共用的「def 需含 steps」检查。 */
function isWorkflowDefLike(value: unknown): value is Partial<WorkflowDef> {
  return (
    value !== undefined &&
    typeof value === 'object' &&
    Array.isArray((value as Partial<WorkflowDef>).steps)
  );
}

/**
 * 异步运行图（DAG 编排）：立即返回 runId，节点状态经 graph.progress 通知实时推送，
 * 结束经 graph.done 通知。运行态存于 graphRuns 供 graph.status 查询。
 * @param params `{ id?, def? }` — 已存图 id 或内联图定义（含 name 与 steps），二者必居其一
 * @returns `{ runId, nodeCount }` — 本次运行标识与节点总数
 */
function runGraph(deps: GraphDeps, params: Record<string, unknown>): { runId: string; nodeCount: number } {
  const store = deps.runtime.graphStore();
  let def: WorkflowDef | undefined;
  const idParam = typeof params['id'] === 'string' ? params['id'] : undefined;
  const defArg = params['def'];
  if (idParam !== undefined) {
    def = store.get(idParam);
    if (def === undefined) {
      throw new Error('未找到图: ' + idParam);
    }
  } else if (isWorkflowDefLike(defArg)) {
    def = defArg as WorkflowDef;
  } else {
    throw new Error('graph.run 需要 id（已存图）或 def（内联定义）');
  }
  // 空计划必须拒绝：`WorkflowRunner.run([])` 会返回 `ok:true` 且零节点，于是模型收到
  // 「图跑成功了」却什么都没做（模型面的 `run_workflow` 早有同款守卫，两条入口口径必须一致）。
  if (def.steps.length === 0) {
    throw new Error('graph.run 拒绝空计划：steps 至少需要一步');
  }
  const owner = typeof params['threadId'] === 'string' ? params['threadId'] : '';
  return startGraphRun(deps, def, idParam, owner === '' ? undefined : owner);
}

/**
 * 启动一次图运行（`runGraph` 的落地半段：建态、登记、淘汰、装配 `WorkflowRunner` 并接线通知）。
 * @param def 已解析的图定义（调用方保证 `steps` 非空）。
 * @param idParam 已存图 id（内联定义时为 undefined）。
 * @param owner 归属会话 id（用于 `turns.abort` 连带取消；无归属时 undefined）。
 * @returns `{ runId, nodeCount }`。
 */
function startGraphRun(
  deps: GraphDeps,
  def: WorkflowDef,
  idParam: string | undefined,
  owner: string | undefined,
  resumeRunId?: string,
): { runId: string; nodeCount: number } {
  const handle = deps.graphRuns.begin(def, idParam, owner, resumeRunId);
  const { runId, state } = handle;
  const ports = deps.runtime.graphPorts();
  const runner = new WorkflowRunner(ports, {
    maxConcurrency: def.maxConcurrency,
    signal: handle.signal,
    // 运行存档（2026-10-08）：serve 发起的图运行同样落盘到
    // `<workspace>/.omniharness/graph-runs/<runId>.jsonl`，并用**台账 runId** 作为存档 id——
    // 这样 `graph.status`/通知里的 id 与「可续跑的 runId」是同一个，用户不必在两套 id 之间对照。
    persist: true,
    runId,
    onNodeUpdate: (update) => {
      const node = state.nodes[update.id];
      if (node !== undefined) {
        node.status = update.status;
        node.error = update.error;
        node.steps = update.steps;
        node.durationMs = update.durationMs;
      }
      deps.notify('graph.progress', { runId, ...update });
    },
  });
  // 续跑（`graph.resume`）与首跑走同一条落地管道：唯一的差别是交给 runner 的是 `resume(runId)`
  // 而不是 `run(def)`——这样进度通知、`graph.done`、台账释放三项行为不会出现两套实现。
  const started = resumeRunId === undefined ? runner.run(def) : runner.resume(resumeRunId);
  void started
    .then((result) => {
      state.done = true;
      state.ok = result.ok;
      state.blackboard = result.blackboard;
      deps.notify('graph.done', {
        runId,
        ok: result.ok,
        blackboard: { ...result.blackboard },
      });
    })
    .catch((error: unknown) => {
      state.done = true;
      state.ok = false;
      deps.notify('graph.done', { runId, ok: false, error: deps.messageOf(error) });
    })
    .finally(() => deps.graphRuns.release(runId));
  return { runId, nodeCount: def.steps.length };
}
