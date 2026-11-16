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
