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
  assert.match(document.body.textContent ?? '', /不会自动应用/u);
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
  const file = new File(['{\"version\":1,\"sessions\":[]}'], 'bundle.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve('{\"version\":1,\"sessions\":[]}') });
  fireEvent.change(screen.getByLabelText('选择证据包文件'), { target: { files: [file] } });
  await waitFor(() => {
    assert.ok(screen.getByText('结构自洽（未签名）'));
  });
  assert.match(document.body.textContent ?? '', /未验签/u);
});
