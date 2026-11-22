#!/usr/bin/env node
// Web 压力 / 极限探针（2026-11-17 批次 4）：真 Chrome + CDP + 确定性假后端，回答五个问题：
//   S1 大会话（2000 事件）打开全耗时、DOM/内存量级（StreamView 有窗口化，DOM 应有界）；
//   S2 流式热路径（600 条高频 text_delta）会不会积压、长任务占比是否失控；
//   S3 轨迹 3000 行（含「显示剩余」全量展开）——轨迹虚拟化（账本候选 1）按此数据决策；
//   S4 会话列表 800 行首屏是否可控（以 DOM 稳定为口径，兼容分页/上限）；
//   S5 队列 50 项收尾续发（批次 0 修复在大队列下的行为）。
//
// 复用 web/test/browserHarness.ts 的 CDP 传输与假后端（Node ≥22 原生类型剥离直接吃 .ts）。
// 用法：npm run build:web && node scripts/eval/webStressProbe.ts
// 规模覆盖：PROBE_SCALE / PROBE_TRACE_ROWS / PROBE_SESSION_ROWS / PROBE_QUEUE_ITEMS / PROBE_DELTAS
// 输出逐场景一行摘要 + 末尾 JSON；任一场景超预算以非零退出（可当回归护栏）。
import process from 'node:process';

const SCALE = Number(process.env.PROBE_SCALE ?? 2000);
const TRACE_ROWS = Number(process.env.PROBE_TRACE_ROWS ?? 3000);
const SESSION_ROWS = Number(process.env.PROBE_SESSION_ROWS ?? 800);
const QUEUE_ITEMS = Number(process.env.PROBE_QUEUE_ITEMS ?? 50);
const DELTAS = Number(process.env.PROBE_DELTAS ?? 600);
const DELTA_TEXT = '正在分析第N段，流式热路径压测文本。'; // 17 字/条 ×600 ≈ 10KB 正文

// 预算（本机开发机口径；不是 SLA，是「明显失控才红」的护栏）。
const BUDGET = {
  bigThreadMs: 15000,
  streamMs: 20000,
  streamLongTaskRatio: 0.5,
  traceRenderMs: 6000,
  traceExpandMs: 10000,
  sessionsMs: 6000,
  queueDrainMs: 20000,
} as const;

/** 探针消费的 CDP 页面（browserHarness.ts 的 openStubSession 产物——脚本区与 web/test 解耦，
 *  这里只钉探针用到的契约形状）。 */
interface ProbeCdp {
  evaluate(expr: string): Promise<unknown>;
  type(selector: string, text: string): Promise<void>;
}

interface ProbePage {
  cdp: ProbeCdp;
  close(): Promise<void>;
}

const { openStubSession, stubHtmlCdp } = (await import(
  new URL('../../web/test/browserHarness.ts', import.meta.url).href
)) as {
  openStubSession: (
    ctx: unknown,
    options: { width: number; height: number; html: string; hash: string },
  ) => Promise<ProbePage>;
  stubHtmlCdp: () => string;
};

/** 伪 vitest 上下文（openStubSession 只用 t.skip；探针里 skip = 环境不支持，如实报错）。 */
function makeFakeContext(): { skip: (msg: string) => never } {
  return {
    skip: (msg: string): never => {
      throw new Error('[probe-skip] ' + msg);
    },
  };
}

/** 一条 thread 事件（与内核事件流同形）。 */
interface ProbeEvent {
  id: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

function ev(id: string, type: string, payload: Record<string, unknown>, ts: number): ProbeEvent {
  return { id, sessionId: 's-stress', type, payload, timestamp: ts };
}

/** 大会话事件流：每 6 条一组（user / 长 markdown 助手卡 / tool_call / tool_result / 系统注记 / turn_diff）。 */
function buildThreadEvents(n: number): ProbeEvent[] {
  const events: ProbeEvent[] = [];
  let ts = 1_700_000_000_000;
  const rounds = Math.ceil(n / 6);
  for (let i = 0; i < rounds; i++) {
    ts += 1000;
    events.push(ev('u' + i, 'user', { content: '第 ' + i + ' 轮：分析模块并给改动建议。' }, ts));
    events.push(ev('a' + i, 'assistant', {
      content: [
        '## 分析 ' + i, '', '这段代码的**核心问题**是职责混杂：', '',
        '```ts', 'export function rebalance(cache: Cache, pool: Pool): Plan {',
        '  const hot = cache.top(' + i + ');', '  return pool.split(hot);', '}', '```', '',
        '结论：先拆读路径，再补缓存版本化。' + '长正文段落'.repeat(30),
      ].join('\n'),
    }, ts + 1));
    events.push(ev('tc' + i, 'tool_call', { name: 'read_file', callId: 'c' + i, args: { path: 'src/mod-' + i + '.ts' } }, ts + 2));
    events.push(ev('tr' + i, 'tool_result', { callId: 'c' + i, ok: true, output: 'export const x = 1;\n'.repeat(20) }, ts + 3));
    events.push(ev('sn' + i, 'system', { content: '【长期记忆 · 开工前对齐】沿用上一轮命名约定；' + '补充上下文'.repeat(15) }, ts + 4));
    events.push(ev('td' + i, 'turn_diff', { diff: '--- a/src/mod-' + i + '.ts\n+++ b/src/mod-' + i + '.ts\n@@ -1,1 +1,2 @@\n+export const y = 2;' }, ts + 5));
  }
  return events.slice(0, n);
}

/** 轨迹事件流：user + tool_call/tool_result 交错（TraceView 行源）。 */
function buildTraceEvents(n: number): ProbeEvent[] {
  const events: ProbeEvent[] = [ev('tu', 'user', { content: '跑一轮长任务' }, 1)];
  for (let i = 0; events.length < n; i++) {
    events.push(ev('t' + i, 'tool_call', { name: i % 3 === 0 ? 'shell' : 'read_file', callId: 'r' + i, args: { path: 'src/a-' + i + '.ts' } }, 10 + i * 10));
    if (events.length < n) {
      events.push(ev('t' + i + 'r', 'tool_result', { callId: 'r' + i, ok: i % 7 !== 0, output: 'ok ' + i }, 12 + i * 10));
    }
  }
  return events;
}

/** 会话列表条目（sessions.list 形状）。 */
interface ProbeSession {
  sessionId: string;
  label: string;
  updatedAt: number;
  turns: number;
  running: boolean;
  archived: boolean;
  pinned: boolean;
}

function buildSessions(n: number): ProbeSession[] {
  const sessions: ProbeSession[] = [];
  for (let i = 0; i < n; i++) {
    sessions.push({ sessionId: 'x' + i, label: '会话 ' + i + '：重构缓存层', updatedAt: 1_700_000_000_000 + i * 60_000, turns: 3, running: i === 0, archived: false, pinned: false });
  }
  return sessions;
}

/** 往 stub 页头部注入 RPC 覆盖（必须在注入体脚本之前挂 __RPC_OVERRIDES__；JSON 即合法 JS 字面量）。 */
function stubWith(overrides: Record<string, unknown>): string {
  const head = '<head><script>window.__RPC_OVERRIDES__ = ' + JSON.stringify(overrides) + ';</script>';
  return stubHtmlCdp().replace('<head>', head);
}

/** 每个场景一个全新 stub 页（测量互不污染），结束整树清理。 */
async function withPage<T>(
  html: string,
  hash: string,
  fn: (cdp: ProbeCdp) => Promise<T>,
): Promise<T> {
  const page = await openStubSession(makeFakeContext(), { width: 1280, height: 900, html, hash: hash ?? '' });
  try {
    return await fn(page.cdp);
  } finally {
    await page.close();
  }
}

/** 轮询求值直到 truthy（非 0 / 非 null / 非空串）或超时；返回最终值。 */
async function pollUntil(cdp: ProbeCdp, expr: string, timeoutMs: number): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown = null;
  while (Date.now() < deadline) {
    last = await cdp.evaluate(expr);
    if (last && last !== '0' && last !== 'false') return last;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error('探针等待超时（' + timeoutMs + 'ms）：' + expr.slice(0, 100));
}

/** 页面快照：导航起点起的耗时 / DOM 节点 / JS 堆。 */
const SNAPSHOT =
  '(function(){ return { now: Math.round(performance.now()), dom: document.getElementsByTagName("*").length, heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0 }; })()';

/** SNAPSHOT 求值结果的形状。 */
interface PageSnapshot {
  now: number;
  dom: number;
  heapMb: number;
}

const results: Record<string, unknown> = {};
let failed = false;

/** 记录并裁决一个场景（ms 字段对预算）。 */
function report(name: string, data: Record<string, unknown>, budgetMs?: number, msKey = 'now'): void {
  const over = budgetMs !== undefined && (data[msKey] as number) > budgetMs;
  if (over) failed = true;
  results[name] = { ...data, budgetMs, over };
  console.log(
    (over ? '✗' : '✓') + ' ' + name + '：' + Math.round(data[msKey] as number) + 'ms（预算 ' + budgetMs + 'ms）' +
    (data.dom !== undefined ? ' / DOM ' + String(data.dom) : '') +
    (data.heapMb !== undefined ? ' / heap ' + String(data.heapMb) + 'MB' : '') +
    Object.entries(data)
      .filter(([k]) => !['now', 'ms', 'dom', 'heapMb', 'budgetMs', 'over'].includes(k))
      .map(([k, v]) => ' / ' + k + '=' + String(v))
      .join(''),
  );
}

async function main(): Promise<void> {
  console.log('[probe] 规模：大会话 ' + SCALE + ' 事件 / 轨迹 ' + TRACE_ROWS + ' 行 / 会话 ' + SESSION_ROWS + ' / 队列 ' + QUEUE_ITEMS + ' / delta ' + DELTAS);

  // ── S1 大会话打开：hash 直达会话，全耗时（bundle 加载 + mount + loadThread + 渲染 + 滚到底）。
  {
    const events = buildThreadEvents(SCALE);
    const lastRound = Math.ceil(SCALE / 6) - 1;
    const html = stubWith({ 'threads.get': { items: events, hasMore: false } });
    const snap = (await withPage(html, '#pane=tools&thread=s-stress', async (cdp) => {
      await cdp.evaluate('(function(){ var s = document.querySelector(".stream"); if (s) s.scrollTop = s.scrollHeight; return true; })()');
      await pollUntil(cdp, "document.body.textContent.indexOf('第 " + lastRound + " 轮') >= 0 ? 1 : 0", BUDGET.bigThreadMs);
      return (await cdp.evaluate(SNAPSHOT)) as PageSnapshot;
    })) as PageSnapshot;
    report('S1.大会话打开', { ...snap, events: SCALE }, BUDGET.bigThreadMs);
  }

  // ── S2 流式热路径：挂起回合 + 高频 text_delta，测完成耗时与 longtask 占比。
  {
    const html = stubWith({});
    const expectLen = DELTAS * DELTA_TEXT.length;
    const data = (await withPage(html, '', async (cdp) => {
      await cdp.type('.composer-input textarea', '流式压测任务');
      await cdp.evaluate("(function(){ document.querySelector('button.send').click(); return true; })()");
      await pollUntil(cdp, "window.__RPC_CALLS__.filter(function(c){ return c.method === 'turns.run'; }).length === 1 ? 1 : 0", 8000);
      await cdp.evaluate('(function(){ window.__LT__ = 0; new PerformanceObserver(function(l){ for (var e of l.getEntries()) window.__LT__ += e.duration; }).observe({ type: "longtask" }); window.__T0__ = performance.now(); return true; })()');
      // 分批推送（每批 10 条、批间 5ms ⇒ ~0.3s 全推完，制造高频并发增量）。
      const pushBatch =
        '(function(){ var N=' + DELTAS + ', B=10, i=0, T=' + JSON.stringify(DELTAS !== 0 ? DELTA_TEXT : '') + ';' +
        ' function batch(){ for (var j=0;j<B && i<N;j++,i++) window.__PUSH__({ method:"thread.text_delta", params:{ text: T } });' +
        ' if (i<N) setTimeout(batch, 5); } batch(); return true; })()';
      await cdp.evaluate(pushBatch);
      await pollUntil(
        cdp,
        '(function(){ var el = document.querySelector(".streaming-assistant .content"); return el && el.textContent.length >= ' + expectLen + ' ? 1 : 0; })()',
        BUDGET.streamMs,
      );
      return (await cdp.evaluate('(function(){ return { now: Math.round(performance.now() - window.__T0__), lt: Math.round(window.__LT__), dom: document.getElementsByTagName("*").length, heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0 }; })()')) as { now: number; lt: number; dom: number; heapMb: number };
    })) as { now: number; lt: number; dom: number; heapMb: number };
    const ratio = data.lt / Math.max(data.now, 1);
    const overRatio = ratio > BUDGET.streamLongTaskRatio;
    if (overRatio) failed = true;
    results['S2.流式热路径'] = { ...data, longTaskRatio: Math.round(ratio * 100) / 100, deltas: DELTAS, over: overRatio };
    console.log((overRatio ? '✗' : '✓') + ' S2.流式热路径：' + data.now + 'ms / longtask ' + data.lt + 'ms（占比 ' + Math.round(ratio * 100) + '%）/ DOM ' + data.dom + ' / heap ' + data.heapMb + 'MB');
  }

  // ── S3 轨迹极限：中栏「对话/轨迹」切到轨迹视图（TraceView，行源 = 已加载事件），
  //      测 300 行分页首屏 + 「显示剩余」全量展开到 TRACE_ROWS 行。
  {
    const events = buildTraceEvents(TRACE_ROWS);
    const html = stubWith({ 'threads.get': { items: events, hasMore: false } });
    const data = await withPage(html, '#pane=tools&thread=s-stress', async (cdp) => {
      await pollUntil(cdp, "!!document.querySelector('.composer-input textarea') ? 1 : 0", 15000);
      await cdp.evaluate('(function(){ window.__T0__ = performance.now(); return true; })()');
      await cdp.evaluate("(function(){ var tabs = document.querySelectorAll('.chat-tab'); if (tabs.length < 2) return false; tabs[1].click(); return true; })()");
      await pollUntil(cdp, "document.querySelectorAll('.tr-row').length > 0 ? 1 : 0", BUDGET.traceRenderMs);
      const first = (await cdp.evaluate(SNAPSHOT)) as PageSnapshot;
      const renderMs = first.now - ((await cdp.evaluate('window.__T0__')) as number);
      // 展开是分页式（每次 +300 行）：循环点击直至「显示剩余」消失，测全量展开总耗时。
      let clicks = 0;
      while (clicks < 20) {
        const has = (await cdp.evaluate("document.querySelector('.tr-more') ? 1 : 0")) as number;
        if (has !== 1) break;
        await cdp.evaluate("(function(){ document.querySelector('.tr-more').click(); return true; })()");
        clicks += 1;
        await pollUntil(cdp, "document.querySelectorAll('.tr-row').length > 0 ? 1 : 0", BUDGET.traceExpandMs);
      }
      const full = (await cdp.evaluate(SNAPSHOT)) as PageSnapshot;
      const rows = (await cdp.evaluate("document.querySelectorAll('.tr-row').length")) as number;
      return { renderMs, expandMs: full.now - first.now, rows, clicks, dom: full.dom, heapMb: full.heapMb };
    });
    report('S3.轨迹极限', { ...data, traceEvents: TRACE_ROWS }, BUDGET.traceRenderMs, 'renderMs');
    if (data.expandMs > BUDGET.traceExpandMs) failed = true;
  }

  // ── S4 会话列表 800 行：mount + 左栏渲染计时（DOM 节点数连续 3 次不变视为稳定，兼容分页/上限）。
  {
    const html = stubWith({ 'sessions.list': { dir: '', sessions: buildSessions(SESSION_ROWS) } });
    const snap = (await withPage(html, '', async (cdp) => {
      await pollUntil(cdp, "!!document.querySelector('.composer-input textarea') ? 1 : 0", 15000);
      let stable = 0;
      let prev = -1;
      const deadline = Date.now() + BUDGET.sessionsMs;
      let last: PageSnapshot | null = null;
      while (Date.now() < deadline && stable < 3) {
        last = (await cdp.evaluate(SNAPSHOT)) as PageSnapshot;
        if (last.dom === prev) stable += 1;
        else stable = 0;
        prev = last.dom;
        await new Promise((r) => setTimeout(r, 120));
      }
      return last;
    })) as PageSnapshot | null;
    report('S4.会话列表', { ...(snap ?? {}), sessions: SESSION_ROWS }, BUDGET.sessionsMs);
  }

  // ── S5 队列 50 项：入队 + 逐轮收尾续发（stub 每次新 turns.run 会重挂 __RESOLVE_TURN__，
  //      队列语义 = 收尾一条续发一条；批次 0 修复的大队列行为在此验证）。
  {
    const html = stubWith({});
    const data = await withPage(html, '', async (cdp) => {
      await cdp.type('.composer-input textarea', '队列压测第 0 条');
      await cdp.evaluate("(function(){ document.querySelector('button.send').click(); return true; })()");
      await pollUntil(cdp, "window.__RPC_CALLS__.filter(function(c){ return c.method === 'turns.run'; }).length === 1 ? 1 : 0", 8000);
      await cdp.evaluate('(function(){ window.__T0__ = performance.now(); return true; })()');
      for (let i = 1; i <= QUEUE_ITEMS; i++) {
        await cdp.type('.composer-input textarea', '队列压测第 ' + i + ' 条');
        await cdp.evaluate("(function(){ document.querySelector('button.send').click(); return true; })()");
      }
      await pollUntil(cdp, "!!document.querySelector('.chat-queue') ? 1 : 0", 10000);
      const queued = (await cdp.evaluate("document.querySelector('.chat-queue').getAttribute('data-queue-count')")) as string | null;
      if (queued !== String(QUEUE_ITEMS)) throw new Error('队列应有 ' + QUEUE_ITEMS + ' 条，实际 ' + String(queued));
      // 逐轮收尾：每轮 turns.run 出现即 resolve，驱动队列连续续发 50 次。
      for (let k = 1; k <= QUEUE_ITEMS + 1; k++) {
        await pollUntil(cdp, "window.__RPC_CALLS__.filter(function(c){ return c.method === 'turns.run'; }).length >= " + k + ' ? 1 : 0', BUDGET.queueDrainMs);
        await cdp.evaluate("window.__RESOLVE_TURN__({ threadId:'s1', finalText:'第 ' + " + (k - 1) + " + ' 条完成', steps:1 }); true");
      }
      const drainMs = ((await cdp.evaluate('performance.now()')) as number) - ((await cdp.evaluate('window.__T0__')) as number);
      const runs = (await cdp.evaluate("window.__RPC_CALLS__.filter(function(c){ return c.method === 'turns.run'; }).length")) as number;
      const dockGone = (await cdp.evaluate("document.querySelector('.chat-queue') ? 0 : 1")) as number;
      return { now: Math.round(drainMs), queued, dockGone, runs };
    });
    const over = data.now > BUDGET.queueDrainMs || data.dockGone !== 1 || data.runs < QUEUE_ITEMS + 1;
    if (over) failed = true;
    results['S5.队列续发'] = { ms: data.now, budgetMs: BUDGET.queueDrainMs, over, dockGone: data.dockGone === 1, queued: data.queued, runs: data.runs };
    console.log((over ? '✗' : '✓') + ' S5.队列续发：入队 ' + String(data.queued) + ' 条 → 连续续发 ' + String(data.runs) + ' 轮耗时 ' + String(data.now) + 'ms / 队列坞消失 ' + (data.dockGone === 1 ? '是' : '否'));
  }

  console.log('\n[probe] 汇总：' + (failed ? '有场景超预算（见 ✗）' : '全部在预算内'));
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = failed ? 1 : 0;
}

main().catch((e: unknown) => {
  const message = (e as { message?: unknown } | undefined)?.message;
  console.error('[probe] 失败：', message ?? e);
  process.exit(1);
});
