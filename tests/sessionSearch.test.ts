// 会话内容搜索判据（2026-11-14，docs/design/session-search/ §5）：
// 命中 / 大小写不敏感 / 每会话片段与计数封顶 / 扫描会话上限截断 / 查询越界判别拒绝 /
// 单会话读取失败不拖垮整次搜索（fail-soft）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  CONTENT_SEARCH_LIMITS,
  SessionContentSearch,
} from '../src/apps/server/services/session/sessionContentSearch.ts';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';

/** 造一条会话事件（type + payload 只取服务端消费的字段）。 */
function eventOf(id: string, type: string, content: string): SessionEvent {
  return { id, type, sessionId: 's', timestamp: '2026-11-14T00:00:00.000Z', payload: { content } } as SessionEvent;
}

/** 造清单与事件读取器（按会话 id 查表）。 */
function serviceOf(
  sessions: readonly { sessionId: string; label: string; updatedAt: string }[],
  events: ReadonlyMap<string, readonly SessionEvent[]>,
  failIds: readonly string[] = [],
): SessionContentSearch {
  return new SessionContentSearch({
    sessions: async () => sessions,
    eventsOf: async (id: string) => {
      if (failIds.includes(id)) throw new Error('storage blip');
      return events.get(id) ?? [];
    },
  });
}

test('命中：大小写不敏感子串 + 片段居中截断 + 计数', async () => {
  const svc = serviceOf(
    [{ sessionId: 's1', label: '登录问题排查', updatedAt: '2026-11-14T01:00:00.000Z' }],
    new Map([
      [
        's1',
        [
          eventOf('e1', 'user', '帮我修复 Login button 的间距问题'),
          eventOf('e2', 'assistant', 'Login button 的间距来自 .login-gap 类。'),
          eventOf('e3', 'user', '登录页面没有这个问题'),
        ],
      ],
    ]),
  );
  const r = await svc.searchOf('login');
  assert.equal(r.hits.length, 1);
  const hit = r.hits[0]!;
  assert.equal(hit.sessionId, 's1');
  assert.equal(hit.matchCount, 2, '「登录页面」不含 login（大小写不敏感也只按子串匹配英文）');
  assert.equal(hit.matches.length, 2);
  assert.equal(hit.matches[0]!.eventId, 'e1');
  assert.match(hit.snippet, /Login/i);
  assert.equal(r.truncated, false);
});

test('每会话保留片段封顶（3 条）与命中行计数封顶（50）', async () => {
  const events = Array.from({ length: 60 }, (_, i) =>
    eventOf('e' + String(i), 'user', '关键字出现在第 ' + String(i) + ' 行'),
  );
  const svc = serviceOf(
    [{ sessionId: 's1', label: 'x', updatedAt: '2026-11-14T01:00:00.000Z' }],
    new Map([['s1', events]]),
  );
  const r = await svc.searchOf('关键字');
  const hit = r.hits[0]!;
  assert.equal(hit.matchCount, CONTENT_SEARCH_LIMITS.matchCountCapPerSession, '计数封顶 50');
  assert.equal(hit.matches.length, CONTENT_SEARCH_LIMITS.matchesKeptPerSession, '片段保留 3 条');
  assert.equal(r.truncated, true, '会话内截断要如实上报');
});

test('扫描会话上限：前 200 个会话之外的不扫（结果空 + truncated 如实上报）', async () => {
  const many = Array.from({ length: CONTENT_SEARCH_LIMITS.scanSessions + 30 }, (_, i) => ({
    sessionId: 's' + String(i),
    label: '会话 ' + String(i),
    updatedAt: '2026-11-14T00:00:00.000Z',
  }));
  // 命中只出现在索引 ≥ 200 的会话里：若扫描上限失效，这里必然出现命中——钉死上限本身。
  const events = new Map(
    many.map((s, i) => [
      s.sessionId,
      [eventOf('e', 'user', i < CONTENT_SEARCH_LIMITS.scanSessions ? '没有查询词的正文 ' + String(i) : '命中 ' + s.sessionId)],
    ]),
  );
  const svc = serviceOf(many, events);
  const r = await svc.searchOf('命中');
  assert.deepEqual(r.hits, [], '上限之外的会话不扫');
  assert.equal(r.truncated, true);
});

test('查询越界判别拒绝：过短 / 过长返回空且不截断', async () => {
  const svc = serviceOf(
    [{ sessionId: 's1', label: 'x', updatedAt: '2026-11-14T01:00:00.000Z' }],
    new Map([['s1', [eventOf('e1', 'user', '关键字')]]]),
  );
  for (const bad of ['a', '', 'x'.repeat(CONTENT_SEARCH_LIMITS.queryMax + 1)]) {
    const r = await svc.searchOf(bad);
    assert.deepEqual(r, { hits: [], truncated: false });
  }
});

test('fail-soft：单会话事件读取失败跳过，其余照常返回', async () => {
  const svc = serviceOf(
    [
      { sessionId: 's-broken', label: '会读失败的', updatedAt: '2026-11-14T01:00:00.000Z' },
      { sessionId: 's-ok', label: '正常的', updatedAt: '2026-11-14T00:59:00.000Z' },
    ],
    new Map([['s-ok', [eventOf('e1', 'user', '关键字在这里')]]]),
    ['s-broken'],
  );
  const r = await svc.searchOf('关键字');
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0]!.sessionId, 's-ok');
});

test('元数据命中不计入 + 按类型提取（tool_call→name / tool_result→text）', async () => {
  const svc = serviceOf(
    [{ sessionId: 's1', label: 'x', updatedAt: '2026-11-14T01:00:00.000Z' }],
    new Map([
      [
        's1',
        [
          // 命中落在事件 id 上（元数据）：不计入。
          eventOf('the-needle-id', 'user', '正文里没有这个词'),
          // tool_call → payload.name。
          { id: 'e1', type: 'tool_call', sessionId: 's1', timestamp: 't', payload: { name: 'needle-tool' } },
          // tool_result → payload.text。
          { id: 'e2', type: 'tool_result', sessionId: 's1', timestamp: 't', payload: { text: 'needle-result' } },
        ],
      ],
    ]),
  );
  const r = await svc.searchOf('needle');
  const hit = r.hits[0]!;
  assert.equal(hit.matchCount, 2, 'id 命中不计，name/text 命中计入');
  assert.deepEqual(
    hit.matches.map((m) => m.type),
    ['tool_call', 'tool_result'],
  );
});

test('排序：命中行数多者优先', async () => {
  const svc = serviceOf(
    [
      { sessionId: 's-few', label: '少', updatedAt: '2026-11-14T02:00:00.000Z' },
      { sessionId: 's-many', label: '多', updatedAt: '2026-11-14T01:00:00.000Z' },
    ],
    new Map([
      ['s-few', [eventOf('e1', 'user', '关键字')]],
      ['s-many', [eventOf('e1', 'user', '关键字 A'), eventOf('e2', 'user', '关键字 B')]],
    ]),
  );
  const r = await svc.searchOf('关键字');
  assert.equal(r.hits[0]!.sessionId, 's-many');
});
