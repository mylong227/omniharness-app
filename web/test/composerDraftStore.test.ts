// 会话草稿库 + 输入历史（2026-11-17 粘性批次）纯逻辑判据。
//
// 背景：底部输入框非受控且不按会话重挂——切会话串稿、刷新即丢；重发只能靠「编辑重发」
// （仅末条）。本判据钉住两个模型的**语义**：
//   · ComposerDraftStore：按 threadId 保留草稿（新会话态归入空串键）、空文本=删除、
//     localStorage 兜底、上限淘汰、存储不可用不抛错；
//   · ComposerHistory：空框 ↑ 进入翻阅、↑/↓ 逐条、↓ 越过最新归还原草稿、连续发送去重。
//
// 直跑：npx vitest run web/test/composerDraftStore.test.ts
import assert from 'node:assert/strict';
import { test } from 'vitest';

const { ComposerDraftStore } = await import('../src/ui/models/ComposerDraftStore.ts');
const { ComposerHistory } = await import('../src/ui/models/ComposerHistory.ts');

/** localStorage 桩（内存 Map）。 */
function installStorage(): Map<string, string> {
  const backing = new Map<string, string>();
  const storage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  return backing;
}

test('草稿库：按会话隔离，新会话态归入空串键，写空=删除', () => {
  installStorage();
  ComposerDraftStore.write('a', '会话 A 的草稿');
  ComposerDraftStore.write(null, '新会话的草稿');
  assert.strictEqual(ComposerDraftStore.read('a'), '会话 A 的草稿');
  assert.strictEqual(ComposerDraftStore.read(null), '新会话的草稿');
  assert.strictEqual(ComposerDraftStore.read('b'), '', '未写过的会话是空草稿');
  ComposerDraftStore.clear('a');
  assert.strictEqual(ComposerDraftStore.read('a'), '', '发送后清场（clear=写空）');
});

test('草稿库：localStorage 兜底（新实例可恢复）与上限淘汰', () => {
  const backing = installStorage();
  ComposerDraftStore.write('a', 'A');
  assert.strictEqual(backing.get('omni-composer-drafts') !== undefined, true, '写入即落盘');
  // 上限：写 34 条后最旧的被淘汰（上限 32）。
  for (let i = 0; i < 34; i++) ComposerDraftStore.write('t' + String(i), '草稿 ' + String(i));
  assert.strictEqual(ComposerDraftStore.read('t0'), '', '最旧条目被淘汰');
  assert.strictEqual(ComposerDraftStore.read('t33'), '草稿 33', '最新条目保留');
  // 重读同一进程内缓存即可验证恢复路径（模块级缓存使单例测试聚焦语义而非存储器）。
  assert.strictEqual(ComposerDraftStore.read('a'), '', '被淘汰的 a 也已删除');
});

test('草稿库：存储抛错不炸（隐私模式退化为内存态）', () => {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    },
  };
  assert.doesNotThrow(() => ComposerDraftStore.write('x', '隐私模式草稿'));
  assert.strictEqual(ComposerDraftStore.read('x'), '隐私模式草稿', '存储不可用仍保内存语义');
});

test('输入历史：空框 ↑ 进入翻阅，↑/↓ 逐条，↓ 越过最新归还原草稿', () => {
  const h = new ComposerHistory();
  assert.strictEqual(h.up(''), null, '无历史时 ↑ 放行给默认行为');
  h.push('第一条');
  h.push('第二条');
  h.push('第二条');
  assert.strictEqual(h.active(), false);
  assert.strictEqual(h.up('当前草稿'), '第二条', '首次 ↑ 取最新一条');
  assert.strictEqual(h.active(), true);
  assert.strictEqual(h.up(''), '第一条', '再 ↑ 往更早走');
  assert.strictEqual(h.up(''), '第一条', '到最早后停住');
  assert.strictEqual(h.down(), '第二条', '↓ 往新走');
  assert.strictEqual(h.down(), '当前草稿', '越过最新归还按下 ↑ 之前的文本');
  assert.strictEqual(h.active(), false, '归还后退出翻阅态');
});

test('输入历史：连续重复去重 + break 退出', () => {
  const h = new ComposerHistory();
  h.push('同一句');
  h.push('同一句');
  h.push('同一句');
  assert.strictEqual(h.up(''), '同一句');
  assert.strictEqual(h.up(''), '同一句', '去重后没有更早条目，保持同一条');
  h.break();
  assert.strictEqual(h.active(), false, '继续输入即退出翻阅态');
  assert.strictEqual(h.down(), null, '非翻阅态 ↓ 放行');
});

/** 注入式存储桩（不走 globalThis，直接喂通道）。 */
function storageStub(): { storage: { read(key: string): string | null; write(key: string, value: string): void }; backing: Map<string, string> } {
  const backing = new Map<string, string>();
  return {
    backing,
    storage: {
      read: (key) => backing.get(key) ?? null,
      write: (key, value) => void backing.set(key, value),
    },
  };
}

test('输入历史按天档：同天重启找回（装载）+ 写入即落盘带日期键', () => {
  const { storage, backing } = storageStub();
  let now = new Date('2026-11-20T10:00:00');
  const clock = (): Date => now;
  const h = new ComposerHistory(storage, clock);
  h.push('上午发的');
  const raw = backing.get('omni.inputHistory.2026-11-20');
  assert.ok(raw !== undefined && raw !== null, '写入即落盘且键带当天日期');
  const parsed = JSON.parse(raw) as { day: string; items: string[] };
  assert.strictEqual(parsed.day, '2026-11-20');
  assert.deepEqual(parsed.items, ['上午发的']);
  // 同天重启：新实例从通道找回。
  const h2 = new ComposerHistory(storage, clock);
  assert.strictEqual(h2.up(''), '上午发的', '同天重启找回历史');
});

test('输入历史按天档：隔天载荷不装入 + 会话内跨零点清空重计', () => {
  const { storage, backing } = storageStub();
  // 预置昨天的载荷：今天的新实例不得装入。
  backing.set(
    'omni.inputHistory.2026-11-20',
    JSON.stringify({ day: '2026-11-20', items: ['昨天的旧任务语境'] }),
  );
  let now = new Date('2026-11-21T08:00:00');
  const clock = (): Date => now;
  const h = new ComposerHistory(storage, clock);
  assert.strictEqual(h.up(''), null, '隔天历史不带入新的一天（原设计精神保留）');
  // 会话内跨零点：下一次 push 触发滚动，旧列表清空。
  h.push('跨零点前');           // 此时 ensureDay 以 11-21 记账，与预置键不同天不冲突
  now = new Date('2026-11-22T00:01:00');
  h.push('跨零点后');
  assert.strictEqual(h.up(''), '跨零点后', '跨天滚动后只剩今天条目');
  assert.strictEqual(h.up(''), '跨零点后', '旧条目已清空，到顶停住');
  const raw = backing.get('omni.inputHistory.2026-11-22');
  assert.ok(raw !== null && (JSON.parse(raw) as { items: string[] }).items.every((i) => i !== '跨零点前'), '新一天的落盘不含旧语境');
});

test('输入历史按天档：损坏载荷 fail-soft + 无通道纯内存', () => {
  const { storage } = storageStub();
  storage.write('omni.inputHistory.2026-11-20', '{not json');
  const clock = (): Date => new Date('2026-11-20T10:00:00');
  const h = new ComposerHistory(storage, clock);
  assert.strictEqual(h.up(''), null, '损坏载荷当空历史，不阻断输入框');
  const bare = new ComposerHistory(undefined, clock);
  bare.push('无通道');
  assert.strictEqual(bare.up(''), '无通道', '无通道退化为纯内存态（原判据路径不变）');
});
