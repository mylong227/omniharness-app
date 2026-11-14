// 路径字段「选择…」交互判据（2026-11-14 用户口径：路径不手输粘贴，一律可点选）。
// 验真链路：点「选择…」→ FolderPicker/FilePicker 统一面板弹出 → 确认 → 值直接落盘
// （config.update patch = 选中的绝对路径），手输通道仍可用。
// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { act, fireEvent } from './rtlHarness.ts';
import { renderUi } from './rtlHarness.ts';

const { PathBrowseControl } = await import('../src/ui/components/console/PathBrowseControl.tsx');

/** 收集 config.update 调用（落盘断言）。 */
function rig() {
  const updates: Record<string, unknown>[] = [];
  const api = {
    listFs: async () => ({
      tree: [{ name: 'keys', path: 'D:/workspace/keys', type: 'dir', children: [] }],
    }),
    browseFs: async () => ({ level: 'drives', roots: [], home: '' }),
    updateConfig: async (patch: Record<string, unknown>) => {
      updates.push(patch);
      return { ok: true };
    },
  };
  return { api, updates };
}

test('dir 形态：点「选择…」→ FolderPicker → 确认目录 → 值直接落盘', async () => {
  const { api, updates } = rig();
  const commits: string[] = [];
  const ui = renderUi(PathBrowseControl, {
    props: {
      browse: 'dir',
      value: '',
      ariaLabel: '存储目录',
      placeholder: '留空 = 内核默认目录',
      onCommit: (p: string) => {
        commits.push(p);
      },
      onDraft: () => {},
      onCommitDraft: () => {},
    },
    app: { api },
  });
  const browse = ui.container.querySelector('button.path-browse-btn');
  assert.ok(browse instanceof HTMLElement, '找不到「选择…」按钮');
  fireEvent.click(browse);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  // FolderPicker 的「选择此文件夹」确认按钮：选中根目录行后确认回传。
  const items = Array.from(document.querySelectorAll('[role="treeitem"]'));
  assert.ok(items.length > 0, '目录选择面板未出现（或树为空）');
  const row = items.find((el) => (el.textContent ?? '').includes('keys'));
  assert.ok(row !== undefined, '目录树里没有 keys 目录');
  fireEvent.click(row.querySelector('.ant-tree-node-content-wrapper') ?? row);
  const confirm = Array.from(document.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes('选择此文件夹'),
  );
  assert.ok(confirm instanceof HTMLElement, '找不到「选择此文件夹」确认按钮');
  fireEvent.click(confirm);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  assert.deepStrictEqual(commits, ['D:/workspace/keys'], '确认后必须回传目录绝对路径');
  assert.strictEqual(document.querySelector('[role="treeitem"]'), null, '确认后面板应关闭');
  ui.unmount();
});

test('file 形态：点「选择…」→ FilePicker → 勾选文件确认 → 值直接落盘；手输通道仍可用', async () => {
  const { api, updates } = rig();
  void updates;
  const commits: string[] = [];
  const drafts: string[] = [];
  const ui = renderUi(PathBrowseControl, {
    props: {
      browse: 'file',
      value: '',
      ariaLabel: '记忆密钥文件',
      placeholder: '留空 = 派生默认密钥',
      pickerTitle: '选择密钥文件',
      onCommit: (p: string) => {
        commits.push(p);
      },
      onDraft: (v: string) => drafts.push(v),
      onCommitDraft: () => {},
    },
    app: {
      api: {
        ...api,
        listFs: async () => ({
          tree: [{ name: 'mem.key', path: 'D:/workspace/mem.key', type: 'file' }],
        }),
      },
    },
  });
  const browse = ui.container.querySelector('button.path-browse-btn');
  assert.ok(browse instanceof HTMLElement);
  fireEvent.click(browse);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  const items = Array.from(document.querySelectorAll('[role="treeitem"]'));
  const node = items.find((el) => (el.textContent ?? '').includes('mem.key'));
  assert.ok(node !== undefined, '文件树里没有 mem.key');
  fireEvent.click(node.querySelector('.ant-tree-checkbox') as HTMLElement);
  const confirm = Array.from(document.querySelectorAll('.fp-actions button')).find((b) =>
    (b.textContent ?? '').includes('添加 1 个文件'),
  );
  assert.ok(confirm instanceof HTMLElement, '页脚必须显示「添加 1 个文件」');
  fireEvent.click(confirm);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  assert.deepStrictEqual(commits, ['D:/workspace/mem.key'], '确认后必须回传文件绝对路径');
  // 手输通道：改输入框值触发 onDraft（不落盘——落盘在 onCommitDraft）。
  const input = ui.container.querySelector('input[aria-label="记忆密钥文件"]');
  assert.ok(input instanceof HTMLInputElement, '手输输入框不存在（两通道并存）');
  fireEvent.change(input, { target: { value: 'D:/custom.key' } });
  assert.ok(drafts.includes('D:/custom.key'), '手输草稿通道失效');
  ui.unmount();
});
