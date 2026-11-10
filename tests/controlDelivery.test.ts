import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';
import { AuditBundles, ExecutionCertificates } from '../src/host/kernel/util.ts';
import { FleetPatchReader } from '../src/apps/server/services/fleet/fleetPatchReader.ts';
import { ProofVerifier } from '../src/apps/server/services/proof/proofVerifier.ts';

/** 构造一条最小事件。 */
function event(index: number, content: string): SessionEvent {
  return {
    id: `evt_${String(index)}`,
    sessionId: 'sess_test',
    type: index === 0 ? 'user' : 'assistant',
    timestamp: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    payload: { content },
  };
}

/** 在临时工作区里准备 patch 文件。 */
function withPatchWorkspace(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'omni-patch-'));
  try {
    mkdirSync(join(root, '.omniharness', 'subagent-patches'), { recursive: true });
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('FleetPatchReader：只读 patch 目录内的普通文件并回报大小', () => {
  withPatchWorkspace((root) => {
    const patch = 'diff --git a/a.ts b/a.ts\n+hello\n';
    writeFileSync(join(root, '.omniharness', 'subagent-patches', 'sess_child.patch'), patch);
    const result = new FleetPatchReader({ workspaceRoot: () => root }).read(
      '.omniharness/subagent-patches/sess_child.patch',
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.content, patch);
    assert.equal(result.bytes, Buffer.byteLength(patch));
    assert.equal(result.truncated, false);
  });
});

test('FleetPatchReader：拒绝绝对路径、.. 穿越与目录', () => {
  withPatchWorkspace((root) => {
    const reader = new FleetPatchReader({ workspaceRoot: () => root });
    for (const path of [
      'D:/outside.patch',
      '../outside.patch',
      '.omniharness/subagent-patches/../../outside.patch',
      '.omniharness/subagent-patches',
    ]) {
      const result = reader.read(path);
      assert.equal(result.ok, false, `${path} 必须被拒绝`);
      if (!result.ok) assert.equal(result.code, 'patch_forbidden');
    }
  });
});

test('FleetPatchReader：超过 512 KB 只读前 512 KB 并标截断', () => {
  withPatchWorkspace((root) => {
    const body = 'x'.repeat(600 * 1024);
    writeFileSync(join(root, '.omniharness', 'subagent-patches', 'big.patch'), body);
    const result = new FleetPatchReader({ workspaceRoot: () => root }).read(
      '.omniharness/subagent-patches/big.patch',
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.truncated, true);
    assert.equal(result.bytes, body.length);
    assert.equal(result.content.length, 512 * 1024);
  });
});

test('FleetPatchReader：NUL 字节不冒充 diff 文本', () => {
  withPatchWorkspace((root) => {
    writeFileSync(join(root, '.omniharness', 'subagent-patches', 'bin.patch'), Buffer.from([0, 1, 2]));
    const result = new FleetPatchReader({ workspaceRoot: () => root }).read(
      '.omniharness/subagent-patches/bin.patch',
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'patch_not_text');
  });
});

test('ProofVerifier：未签名包只做结构复核，不谎称已验签', () => {
  const events = [event(0, 'hello'), event(1, 'world')];
  const certificate = ExecutionCertificates.build({ events });
  const bundle = AuditBundles.build({ runs: [{ events, certificate }] });
  const result = new ProofVerifier().verifyOf(bundle);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.verdict.ok, true);
  assert.equal(result.verdict.signatureChecked, false);
  assert.equal(result.verdict.commitmentChecked, false);
  assert.equal(result.summary.sessions.length, 1);
  assert.equal(result.summary.sessions[0]?.eventCount, 2);
  assert.equal(result.summary.eventCount, 2);
});

test('ProofVerifier：篡改事件后复核失败并给出问题码', () => {
  const events = [event(0, 'hello'), event(1, 'world')];
  const certificate = ExecutionCertificates.build({ events });
  const bundle = AuditBundles.build({ runs: [{ events, certificate }] });
  const tampered = {
    ...bundle,
    sessions: bundle.sessions.map((session) => ({
      ...session,
      events: session.events.map((item, index) =>
        index === 1 ? { ...item, payload: { content: 'tampered' } } : item,
      ),
    })),
  };
  const result = new ProofVerifier().verifyOf(tampered);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.verdict.ok, false);
  assert.ok(result.verdict.problems.length > 0);
});

test('ProofVerifier：非包对象 / 缺字段返回 bundle_invalid，不抛异常', () => {
  const verifier = new ProofVerifier();
  for (const value of [null, {}, { version: 2, sessions: [] }, 'not a bundle']) {
    const result = verifier.verifyOf(value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'bundle_invalid');
  }
});
