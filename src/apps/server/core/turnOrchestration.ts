import type { ImageContent, FileAttachment } from '../../../host/kernel/contracts.ts';
import { Id } from '../../../host/kernel/util.ts';
import type { WorkflowDef } from '../../../host/kernel/autonomy.ts';
import { log } from '../../../host/kernel/util.ts';
import { InterjectionClassifier } from '../../../host/kernel-compat/kernel/core/steering/interjectionClassifier.ts';
import type { SessionRewindOutcome } from '../services/session/sessionRewindService.ts';
import { ThreadPage } from '../services/session/threadPage.ts';
import type { ServerServices } from './serverServices.ts';

/**
 * 回合/线程跨域编排 —— 从原 `AppServer` / `AppServerBase` 逐字节搬移的编排方法
 * （`createThread` / `runTurn` / `steer` / `interject` / `alignRuntimeWorkspace` / `threadResult`）。
 *
 * 为什么独立于模块：`automations.run`（自动化模块）与 `threads.*` / `turns.*`（线程模块）
 * 都要触发「起一个回合」，编排放模块里会造成跨模块 import；放这里由两个模块共享同一事实源。
 * 本类不做参数校验以外的领域计算，全部委托共享协作者。
 */
export class TurnOrchestration {
  /**
   * @param services 共享服务门面（在 ServerServices 构造器**末尾**以 `this` 注入）。
   */
  public constructor(private readonly s: ServerServices) {}

  /**
   * 创建线程（threads.create）：以 prompt 启动一次全新 agent 任务并登记线程映射。
   * @param params `{ prompt }` — 首条用户消息，缺省为空串
   * @returns 线程结果（sessionId、本次回合事件等，见 threadResult）
   */
  public async createThread(params: Record<string, unknown>): Promise<unknown> {
    await this.s.awaitPlugins();
    const result = await this.s.runtime.agent().runTask(String(params['prompt'] ?? ''));
    this.s.threads.set(result.sessionId, result.sessionId);
    return this.threadResult(result);
  }

  /**
   * 续跑线程（threads.continue）：在既有 threadId 上追加一条用户消息并继续对话。
   * @param params `{ threadId, prompt }` — 目标线程与追加消息
   * @returns 线程结果（sessionId 与本次回合事件）
   */
  public async continueThread(params: Record<string, unknown>): Promise<unknown> {
    await this.s.awaitPlugins();
    const threadId = String(params['threadId'] ?? '');
    // 与 turns.run 同一把单飞锁：threads.continue 也不能在跑着的会话上再起一回合。
    if (threadId !== '' && this.s.activeTurns.has(threadId)) {
      return { ok: false, error: 'session_running' };
    }
    if (threadId !== '') this.s.activeTurns.add(threadId);
    try {
      const result = await this.s.runtime
        .agent()
        .resume(threadId, String(params['prompt'] ?? ''));
      this.s.threads.set(result.sessionId, result.sessionId);
      return this.threadResult(result);
    } finally {
      if (threadId !== '') this.s.activeTurns.delete(threadId);
    }
  }

  /**
   * 分叉线程（threads.fork）：复制既有 threadId 的历史后以 prompt 开启新分支。
   * @param params `{ threadId, prompt }` — 被分叉线程与新分支首条消息
   * @returns 线程结果（新分支 sessionId 与事件）
   */
  public async forkThread(params: Record<string, unknown>): Promise<unknown> {
    const result = await this.s.runtime
      .agent()
      .fork(String(params['threadId'] ?? ''), String(params['prompt'] ?? ''));
    this.s.threads.set(result.sessionId, result.sessionId);
    return this.threadResult(result);
  }

  /**
   * 获取线程事件（threads.get）：默认返回全部；可选 `limit`/`before` 分页（S2，2026-10-25）。
   * @param params `{ threadId, limit?, before? }` — 目标线程与可选分页
   * @returns `{ threadId, items, hasMore?, oldestId?, error? }`
   */
  public async getThread(params: Record<string, unknown>): Promise<unknown> {
    const threadId = String(params['threadId'] ?? '');
    // 2026-10-21 修：`replay` 会把整段历史**逐条广播给所有客户端**（同文件 `trace.read`
    // 早已改为纯读）。打开一个会话却让别的窗口收到它的历史，是跨会话串流 + O(N) 广播。
    // 这里只读（在跑会话读内存、否则读存档），响应里已带 items，无需广播。
    const events = await this.s.runtime.agent().eventsOf(threadId);
    const rawLimit = params['limit'];
    const numericLimit =
      typeof rawLimit === 'number'
        ? rawLimit
        : typeof rawLimit === 'string' && rawLimit.trim() !== ''
          ? Number(rawLimit)
          : Number.NaN;
    const limit = Number.isFinite(numericLimit) && numericLimit > 0 ? numericLimit : undefined;
    const before = typeof params['before'] === 'string' ? params['before'] : undefined;
    if (limit === undefined) {
      return { threadId, items: events, hasMore: false };
    }
    const page = ThreadPage.slice(events, limit, before);
    return {
      threadId,
      ...page,
    };
  }

  /**
   * 服务端回退线程（threads.rewind）：把持久化事件流截断到指定事件（含），使前端的
   * 「重生成」是**真回退**而不是「接着旧答案再来一轮」。
   *
   * 只做截断，不重跑（重跑仍走 `turns.run`，与既有提交通路一致）；失败一律如实回 `error`
   * 而不抛错给 RPC 层，便于前端直接把原因显示出来。
   *
   * @param params `{ threadId, keepEventId }` — 目标线程与保留到哪条事件（含）
   * @returns 保留/丢弃条数，或失败原因（见 {@link SessionRewindOutcome}）
   */
  public async rewindThread(params: Record<string, unknown>): Promise<SessionRewindOutcome> {
    const threadId = String(params['threadId'] ?? params['sessionId'] ?? '');
    return this.s.rewinder.rewind(threadId, String(params['keepEventId'] ?? ''));
  }

  /**
   * 运行回合（turns.run）：线程已存在则续跑，否则等价创建新线程。
   * images 可选，随首条用户消息送入模型（#B1）。
   * @param params `{ threadId, prompt, images?, files? }` — 目标线程、消息文本与可选附件
   * @returns 线程结果（sessionId、事件与用量）
   */
  public async runTurn(params: Record<string, unknown>): Promise<unknown> {
    await this.s.awaitPlugins();
    const requestedThreadId = String(params['threadId'] ?? '');
    // 新会话由服务端预生成 id：否则 `activeTurns` 只能记在空串下，`sessions.delete` /
    // `sessions.list` 的 running 判定与真实会话 id 对不上（2026-10-21 修）。
    const threadId = requestedThreadId === '' ? Id.id('sess') : requestedThreadId;
    // 单飞锁：同一 threadId 的第二个回合直接拒绝。没有它会两个回合各自 hydrate、
    // 各自在回合末全量覆盖写 ⇒ 后写者静默吃掉先写者的事件历史。
    if (this.s.activeTurns.has(threadId)) {
      return { ok: false, error: 'session_running' };
    }
    const prompt = String(params['prompt'] ?? '');
    const images = params['images'] as readonly ImageContent[] | undefined;
    const files = params['files'] as readonly FileAttachment[] | undefined;
    // 不串项目（2026-10-07 用户：「应该各自分离不要出现串项目」）：见 alignRuntimeWorkspace
    // —— 工具用运行时根、UI/`fs.*` 用显示根，两者分叉即回合前重基（逐回合留痕见该方法内的日志）。
    this.alignRuntimeWorkspace(threadId);
    // 会话模式（UI「+」菜单的目标 / 计划 / 绘图）在此合成前置指令：
    // 只改本回合的用户消息文本，不动系统提示词（系统提示词被缓存，改它会整体失效）。
    // 无模式时 compose 原样返回 prompt，行为与旧版逐字节一致。
    const effective = this.s.directives.compose(prompt, this.s.modes.get(threadId));
    // 真实运行态跟踪：并行任务卡据此显示「运行中」，而非前端猜测。
    this.s.activeTurns.add(threadId);
    try {
      // 显式给了 threadId 一律走 resume：服务端重启后 `threads` 缓存为空，但存档可能
      // 还在——若按「不在缓存就 runTask」处理，会用同一个 id 覆盖（清空）已有历史。
      // resume 空存档等价于新建（Agent 会补 session_meta），故两条路径都安全。
      const result =
        requestedThreadId !== '' || this.s.threads.has(threadId)
          ? await this.s.runtime.agent().resume(threadId, effective, images, files)
          : await this.s.runtime.agent().runTask(effective, images, files, threadId);
      this.s.threads.set(result.sessionId, result.sessionId);
      return this.threadResult(result);
    } finally {
      this.s.activeTurns.delete(threadId);
    }
  }

  /**
   * 回合中 steering：把一条用户追加指令入队，TurnRunner 在下一步边界消费。
   *
   * 2026-10-31：支持随文本携带 images / files（插话模式下的图片 / 视频 / GIF / 文件补充），
   * 队列项与 `turns.run` 的多模态入参同构。
   * @param params `{ threadId, text, images?, files? }`。
   * @returns `{ ok, queued }`；会话未在跑/内容为空时 `ok:false` 且不入队。
   */
  public async steerTurn(params: Record<string, unknown>): Promise<unknown> {
    const threadId = String(params['threadId'] ?? params['sessionId'] ?? '');
    const text = String(params['text'] ?? params['prompt'] ?? '');
    const images = params['images'] as readonly ImageContent[] | undefined;
    const files = params['files'] as readonly FileAttachment[] | undefined;
    const hasAttachments = (images?.length ?? 0) + (files?.length ?? 0) > 0;
    if (threadId === '' || (text.trim() === '' && !hasAttachments)) {
      return { ok: false, error: 'threadId 与 text（或附件）都必填' };
    }
    const agent = this.s.runtime.agent();
    if (!agent.runningSessionIds().includes(threadId)) {
      return { ok: false, error: 'session_not_running', threadId };
    }
    const queued = agent.steering.enqueue(threadId, {
      text,
      images,
      files,
    });
    return { ok: true, threadId, queued };
  }

  /**
   * 插话模式分流（`turns.interject`，2026-10-31）：相关并入 / 无关打断。
   *
   * 判定使用 {@link InterjectionClassifier} 的纯文本启发式（毫秒级、零模型调用）；
   * 判定依据 `reason` 会回传 UI，让「为什么被打断」可解释。无关时服务端直接取消该会话
   * 在跑回合（与 `turns.abort` 同一取消通道），客户端随后把本条内容作为新回合发送——
   * 这样"打断"与"开新任务"之间没有竞态窗口，也不会有两条回合同时写同一会话。
   * @param params `{ threadId, prompt, images?, files? }`。
   * @returns `{ ok, action: 'steered'|'interrupted', reason, score }`；会话未在跑时 `ok:false`。
   */
  public async interjectTurn(params: Record<string, unknown>): Promise<unknown> {
    const threadId = String(params['threadId'] ?? params['sessionId'] ?? '');
    const prompt = String(params['prompt'] ?? params['text'] ?? '');
    const images = params['images'] as readonly ImageContent[] | undefined;
    const files = params['files'] as readonly FileAttachment[] | undefined;
    const hasAttachments = (images?.length ?? 0) + (files?.length ?? 0) > 0;
    if (threadId === '' || (prompt.trim() === '' && !hasAttachments)) {
      return { ok: false, error: 'threadId 与 prompt（或附件）都必填' };
    }
    const agent = this.s.runtime.agent();
    if (!agent.runningSessionIds().includes(threadId)) {
      return { ok: false, error: 'session_not_running', threadId };
    }
    const context = InterjectionClassifier.contextOf(await agent.eventsOf(threadId));
    const decision = InterjectionClassifier.classify(prompt, context);
    if (!decision.related) {
      this.s.runtime.cancelAll('user', threadId);
      // 与 turns.abort 同口径：该会话在跑的图运行也一并中止，避免会话已停、子步还在烧 token。
      this.s.graphRuns.abortMatching(threadId);
      return {
        ok: true,
        threadId,
        action: 'interrupted',
        reason: decision.reason,
        score: decision.score,
      };
    }
    const queued = agent.steering.enqueue(threadId, {
      text: prompt.trim() === '' ? '（用户补充了附件，请结合附件继续）' : prompt,
      images,
      files,
    });
    return {
      ok: true,
      threadId,
      action: 'steered',
      queued,
      reason: decision.reason,
      score: decision.score,
    };
  }

  /**
   * 中断在跑回合（turns.abort 的编排半段）。
   *
   * 2026-09-22 修（审计 P1）：此前不带 threadId、一律取消「当前」会话，而服务端允许多回合并行
   * ⇒ 先结束者清空令牌会让「停止」静默失效，或把**别的会话**取消掉。现按会话定向取消：
   * 传了 threadId 只停该会话；旧前端不带参数时退化为「取消全部在跑回合」（不静默失效）。
   * @param params RPC 参数（threadId/sessionId 二选一，均可缺省）。
   * @returns abort 响应载荷。
   */
  public abortTurns(params: Record<string, unknown>): unknown {
    const threadId = String(params['threadId'] ?? params['sessionId'] ?? '');
    this.s.runtime.cancelAll('user', threadId === '' ? undefined : threadId);
    // 连带中止该会话在跑的**图运行**（F13）：图驱动的子步也是真 Agent 回合，会话已停就不该继续烧。
    return {
      ok: true,
      threadId: threadId === '' ? null : threadId,
      abortedGraphs: this.s.graphRuns.abortMatching(threadId),
    };
  }

  /**
   * 回合开始前把**运行时根**对齐到当前项目（用户口径：「应该各自分离不要出现串项目」）。
   *
   * 工具与系统提示用的是运行时根（`options.config.workspaceRoot`），而 UI / `fs.*` 用的是显示根
   * （`configStore.workspace()`）。两者一旦分叉，症状是 agent 去读**另一个项目**的树（真机：
   * 读到启动目录的 AGENTS.md / tsconfig.json，UI 按当前项目打开同名文件 ⇒ ENOENT），且此前没有任何
   * 一处记录过每回合实际用了哪个根 ⇒ 只能靠猜。故：**逐回合留痕** + **分叉即重基**。
   *
   * 触发条件收窄到「显示层**显式**给了工作区」（serve 由 UI 写入）：没有这一层时
   * `configStore.workspace()` 会回落到 `process.cwd()`（启动目录），认它权威正是本缺陷的成因
   * （过宽初版被 `appServer.test.js` 当场抓红）。
   * @param threadId 目标会话 id（仅用于日志）。
   */
  public alignRuntimeWorkspace(threadId: string): void {
    const runtimeRoot = this.s.options.config.workspaceRoot;
    const displayRoot = this.s.configStore.workspace();
    log.info('turn.workspaceRoot', {
      threadId,
      runtimeRoot,
      displayRoot,
      sameRoot: runtimeRoot === displayRoot,
    });
    if ((this.s.displayConfig['workspace'] ?? '') === '' || runtimeRoot === displayRoot) {
      return;
    }
    log.warn('turn.workspaceRootDrift', { threadId, runtimeRoot, displayRoot });
    this.s.switchWorkspace(displayRoot);
  }

  /**
   * 线程结果。
   * @param result agent 运行结果（sessionId、finalText、steps）。
   * @returns 对外线程结果形（threadId / finalText / steps）。
   */
  public threadResult(result: {
    sessionId: string;
    finalText?: string | undefined;
    steps: number;
  }): unknown {
    return { threadId: result.sessionId, finalText: result.finalText, steps: result.steps };
  }

  /** 图运行定义守卫：`graph.run` / `graph.save` 共用的「def 需含 steps」检查。 */
  public static isWorkflowDefLike(value: unknown): value is Partial<WorkflowDef> {
    return (
      value !== undefined && typeof value === 'object' && Array.isArray((value as Partial<WorkflowDef>).steps)
    );
  }
}
