// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppContext, type AppContextValue } from '../src/ui/context.ts';
import { FleetMode } from '../src/ui/components/tabs/control/FleetMode.tsx';
import { ProofMode } from '../src/ui/components/tabs/control/ProofMode.tsx';
import type { FleetPatchResultLike, FleetSnapshotLike, ProofVerifyResultLike } from '../src/types/models.ts';

afterEach(cleanup);

/** 一个有 patch 的编队快照。 */
const SNAPSHOT: FleetSnapshotLike = {
  parentSessionId: 'sess_parent',
  runningCount: 0,
  collectedAt: new Date().toISOString(),
  nodes: [
    {
      childSessionId: 'sess_child',
      parentSessionId: 'sess_parent',
      task: '补类型',
      status: 'ok',
      startedAt: new Date(0).toISOString(),
      isolation: 'worktree',
      steps: 3,
      patchPath: '.omniharness/subagent-patches/sess_child.patch',
      patchBytes: 22,
    },
  ],
};

/** 构造只满足 FleetMode 调用的 App 上下文。 */
function contextOf(patchResult: FleetPatchResultLike): AppContextValue {
  return {
    api: {
      fleetList: () => Promise.resolve(SNAPSHOT),
      fleetPatch: () => Promise.resolve(patchResult),
    } as unknown as AppContextValue['api'],
    toast: () => {},
    dialog: {} as AppContextValue['dialog'],
    sessionId: 'sess_parent',
    sessionTick: 0,
  };
}

test('FleetMode：选中车道后可展开只读补丁预览，明确不会自动应用', async () => {
  render(
    <AppContext.Provider
      value={contextOf({
        ok: true,
        path: '.omniharness/subagent-patches/sess_child.patch',
        content: 'diff --git a/a.ts b/a.ts\n+hello\n',
        bytes: 29,
        truncated: false,
      })}
    >
      <FleetMode threadId="sess_parent" active />
    </AppContext.Provider>,
  );
  await waitFor(() => {
    assert.ok(screen.getByText('补类型'));
  });
  fireEvent.click(screen.getByText('补类型'));
  fireEvent.click(screen.getByRole('button', { name: '查看补丁' }));
  await waitFor(() => {
    assert.ok(screen.getByText(/diff --git a\/a.ts/u));
  });
  assert.match(document.body.textContent ?? '', /确认后才会写入主工作区/u);
});

test('FleetMode：patch 不可取回时不显示查看入口', async () => {
  const snapshot = {
    ...SNAPSHOT,
    nodes: [{ ...SNAPSHOT.nodes[0]!, writesUnrecoverable: true }],
  };
  const value = contextOf({ ok: false, code: 'patch_forbidden', message: 'x' });
  value.api.fleetList = () => Promise.resolve(snapshot);
  render(
    <AppContext.Provider value={value}>
      <FleetMode threadId="sess_parent" active />
    </AppContext.Provider>,
  );
  await waitFor(() => {
    assert.ok(screen.getByText('补类型'));
  });
  fireEvent.click(screen.getByText('补类型'));
  assert.equal(screen.queryByRole('button', { name: '查看补丁' }), null);
});

test('ProofMode：导入本地证据包后展示结构自洽与未验签口径', async () => {
  const verify: ProofVerifyResultLike = {
    ok: true,
    verdict: {
      ok: true,
      problems: [{ code: 'COMMITMENT_UNVERIFIED', detail: '无带外承诺' }],
      signatureChecked: false,
      commitmentChecked: false,
    },
    summary: {
      exportedAt: new Date(0).toISOString(),
      sessions: [{ sessionId: 'sess_test', eventCount: 2, eventRoot: 'abc' }],
      eventCount: 2,
    },
  };
  const value: AppContextValue = {
    api: {
      proofTurns: () => Promise.resolve([
        {
          sessionId: 'sess_test',
          turnIndex: 0,
          displayIndex: 1,
          startedAt: new Date(0).toISOString(),
          endedAt: new Date(0).toISOString(),
          eventCount: 2,
          toolCalls: 0,
          changedFiles: 0,
          systemTurn: false,
        },
      ]),
      listFs: () => Promise.resolve({ tree: [{ name: 'bundle.json', path: 'D:/workspace/bundle.json', type: 'file' }] }),
      browseFs: () => Promise.resolve({ level: 'drives', roots: [], home: '' }),
      attachRead: () => Promise.resolve({
        files: [{ name: 'bundle.json', mediaType: 'application/json', data: Buffer.from('{\"version\":1,\"sessions\":[]}').toString('base64'), size: 24, kind: 'file' }],
        errors: [],
      }),
      proofVerify: () => Promise.resolve(verify),
    } as unknown as AppContextValue['api'],
    toast: () => {},
    dialog: {} as AppContextValue['dialog'],
    sessionId: 'sess_test',
    sessionTick: 0,
  };
  render(
    <AppContext.Provider value={value}>
      <ProofMode threadId="sess_test" active />
    </AppContext.Provider>,
  );
  // 证据包选择走统一资源选择面板（FilePicker，2026-11-14 弃原生 input file）：
  // 点「选择证据包…」→ 勾选 bundle.json → 「添加 1 个文件」→ attachRead → proofVerify。
  fireEvent.click(screen.getByText('选择证据包…'));
  await waitFor(() => assert.ok(document.querySelector('[role="treeitem"]')));
  const node = Array.from(document.querySelectorAll('[role="treeitem"]')).find((el) =>
    (el.textContent ?? '').includes('bundle.json'),
  );
  assert.ok(node !== undefined, '面板树里没有证据包节点');
  fireEvent.click(node.querySelector('.ant-tree-checkbox') as HTMLElement);
  const confirm = Array.from(document.querySelectorAll('.fp-actions button')).find((b) =>
    (b.textContent ?? '').includes('添加 1 个文件'),
  );
  assert.ok(confirm instanceof HTMLElement);
  fireEvent.click(confirm);
  await waitFor(() => {
    assert.ok(screen.getByText('结构自洽（未签名）'));
  });
  assert.match(document.body.textContent ?? '', /未验签/u);
});

test('FleetMode：运行中车道可单独取消并调用 fleet.cancel', async () => {
  const calls: string[] = [];
  const running: FleetSnapshotLike = {
    ...SNAPSHOT,
    runningCount: 1,
    nodes: [{ ...SNAPSHOT.nodes[0]!, status: 'running', callId: 'call_live', childSessionId: undefined, patchPath: undefined }],
  };
  const value: AppContextValue = {
    api: {
      fleetList: () => Promise.resolve(running),
      fleetCancel: (callId: string) => {
        calls.push(callId);
        return Promise.resolve({ ok: true as const, callId });
      },
    } as unknown as AppContextValue['api'],
    toast: () => {},
    dialog: { confirm: () => Promise.resolve(true) } as unknown as AppContextValue['dialog'],
    sessionId: 'sess_parent',
    sessionTick: 0,
  };
  render(
    <AppContext.Provider value={value}>
      <FleetMode threadId="sess_parent" active />
    </AppContext.Provider>,
  );
  await waitFor(() => assert.ok(screen.getByText('补类型')));
  fireEvent.click(screen.getByText('补类型'));
  fireEvent.click(screen.getByRole('button', { name: '取消子代理' }));
  await waitFor(() => assert.deepEqual(calls, ['call_live']));
});
