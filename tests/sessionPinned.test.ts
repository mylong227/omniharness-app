// 会话置顶**服务端侧车**门禁（2026-11-06：从 web-local localStorage 升级为跨设备真源）。
//
// ## 覆盖什么
//
// ① `sessions.setPinned` 只写侧车（`sessions.pinned.json`），`sessions.list` 按侧车回传 `pinned`；
// ② **换一个 SessionArchive 实例**（模拟另一台设备/另一个进程读同一存档目录）仍看到同一批置顶；
// ③ 取消置顶 / 重复置顶去重 / 非法 id 拒绝且不落盘。
//
// 直跑：npm run web:test（vitest 的 tests/** 项目）。
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { SessionArchive } from '../src/apps/server/services/session/sessionArchive.ts';

/** 会话列表结果的最小形状（SessionInfo 未导出；判据只看 id 与 pinned）。 */
interface ListRow {
  readonly sessionId: string;
  readonly pinned: boolean;
}

/** 造一个存档目录：两条真实会话（session_meta + user 事件）。 */
function makeStore(): string {
  const dir = mkdtempSync(join(tmpdir(), 'omni-pin-'));
  for (const [id, label] of [
    ['s1', '甲'],
    ['s2', '乙'],
  ] as const) {
    const lines = [
      JSON.stringify({ type: 'session_meta', timestamp: '2026-11-06T00:00:00.000Z', payload: { workspace: 'D:\\ws' } }),
      JSON.stringify({ type: 'user', timestamp: '2026-11-06T00:01:00.000Z', payload: { content: label } }),
    ];
    writeFileSync(join(dir, `${id}.jsonl`), lines.join('\n') + '\n', 'utf8');
  }
  return dir;
}

/** 以给定存档目录装配 SessionArchive（模拟一个客户端进程）。 */
function archiveOf(dir: string): SessionArchive {
  return new SessionArchive({
    workspaceRoot: () => dir,
    storageLocation: () => dir,
    configuredStorageDir: () => undefined,
  });
}

/** 读出列表里的 pinned 映射。 */
async function pinsOf(archive: SessionArchive): Promise<Record<string, boolean>> {
  const r = (await archive.list(false, '*')) as { sessions: ListRow[] };
  return Object.fromEntries(r.sessions.map((s) => [s.sessionId, s.pinned]));
}

test('置顶写侧车，列表回传 pinned；换实例（跨设备）仍看到同一批置顶', async () => {
  const dir = makeStore();
  try {
    const first = archiveOf(dir);
    assert.deepEqual(await pinsOf(first), { s1: false, s2: false }, '初始必须无置顶');

    assert.deepEqual(first.setPinned('s2', true), { ok: true });
    assert.deepEqual(await pinsOf(first), { s1: false, s2: true });
    const sidecarPath = join(dir, 'sessions.pinned.json');
    assert.ok(existsSync(sidecarPath), '置顶必须落在存档目录侧车（随同步盘/工作区走）');
    const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as { rev: number; ids: string[] };
    assert.deepEqual(sidecar.ids, ['s2']);
    assert.equal(typeof sidecar.rev, 'number');

    // 关键：不是内存态 —— 另一个进程（另一台设备）读同一目录，必须看到同一份置顶。
    const second = archiveOf(dir);
    assert.deepEqual(await pinsOf(second), { s1: false, s2: true }, '跨设备/跨进程必须共享置顶');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('取消置顶 / 重复置顶去重 / 多 id 保持登记顺序', async () => {
  const dir = makeStore();
  try {
    const archive = archiveOf(dir);
    archive.setPinned('s1', true);
    archive.setPinned('s1', true);
    archive.setPinned('s2', true);
    let sidecar = JSON.parse(readFileSync(join(dir, 'sessions.pinned.json'), 'utf8')) as { ids: string[] };
    assert.deepEqual(sidecar.ids, ['s1', 's2'], '重复置顶必须去重、顺序按首次登记');

    archive.setPinned('s1', false);
    assert.deepEqual(await pinsOf(archive), { s1: false, s2: true });
    sidecar = JSON.parse(readFileSync(join(dir, 'sessions.pinned.json'), 'utf8')) as { ids: string[] };
    assert.deepEqual(sidecar.ids, ['s2']);

    // 取消一个本来就没置顶的 id：幂等成功，不得报错。
    assert.deepEqual(archive.setPinned('s1', false), { ok: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('非法 sessionId 拒绝且不写侧车（与 reorder 同一校验口径）', () => {
  const dir = makeStore();
  try {
    const archive = archiveOf(dir);
    for (const bad of ['', '../escape', 'a/b', 'x'.repeat(129)]) {
      assert.deepEqual(archive.setPinned(bad, true), { ok: false, error: 'bad_session_id' }, `必须拒绝 ${JSON.stringify(bad)}`);
    }
    assert.equal(existsSync(join(dir, 'sessions.pinned.json')), false, '被拒绝的请求不得创建侧车文件');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
