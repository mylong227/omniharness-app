import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import type { SessionEvent } from '../src/host/kernel/contracts.ts';
import { AuditBundles, ExecutionCertificates } from '../src/host/kernel/util.ts';
import { ProofSignerService } from '../src/apps/server/services/proof/proofSignerService.ts';
import { ProofService } from '../src/apps/server/services/proof/proofService.ts';
import { ProofVerifier } from '../src/apps/server/services/proof/proofVerifier.ts';

/** 构造一条最小事件。 */
function event(index: number, content: string): SessionEvent {
  return {
    id: `evt_${String(index)}`,
    sessionId: 'sess_sign',
    type: index === 0 ? 'user' : 'assistant',
    timestamp: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    payload: { content },
  };
}

test('ProofSignerService：本机 Ed25519 签名可被本机信任根复核', async () => {
  const home = mkdtempSync(join(tmpdir(), 'omni-sign-'));
  const previous = process.env['OMNI_HOME'];
  process.env['OMNI_HOME'] = home;
  try {
    const events = [event(0, 'do it'), event(1, 'done')];
    const certificate = ExecutionCertificates.build({ events });
    const signer = new ProofSignerService();
    const signed = await signer.signCertificate(certificate);
    const verdict = ExecutionCertificates.verify(events, signed, { trustStore: signer.trustStore });
    assert.equal(verdict.ok, true);
    assert.equal(signer.alg, 'EdDSA');
    assert.match(signer.kid, /^[0-9a-f]{16}$/u);
  } finally {
    if (previous === undefined) delete process.env['OMNI_HOME'];
    else process.env['OMNI_HOME'] = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test('ProofService：配置本机签名器后 state=signed 且 SIGNATURE 真正通过', async () => {
  const home = mkdtempSync(join(tmpdir(), 'omni-sign-'));
  const previous = process.env['OMNI_HOME'];
  process.env['OMNI_HOME'] = home;
  try {
    const signer = new ProofSignerService();
    const events = [event(0, 'do it'), event(1, 'done')];
    const service = new ProofService({
      events: () => Promise.resolve(events),
      tools: () => [],
      audit: () => undefined,
      signer,
    });
    const bundle = await service.buildOf('sess_sign', 0);
    assert.ok(!('ok' in bundle));
    assert.equal(bundle.state, 'signed');
    assert.equal(bundle.signature?.kid, signer.kid);
    assert.equal(bundle.checks.find((check) => check.code === 'SIGNATURE')?.status, 'pass');
    const exported = await service.exportOf('sess_sign', 0);
    assert.ok(!('ok' in exported));
    assert.ok(exported.content.includes('"signature"'));
  } finally {
    if (previous === undefined) delete process.env['OMNI_HOME'];
    else process.env['OMNI_HOME'] = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test('ProofVerifier：本机签名包在 trustStore 下 signatureChecked=true', async () => {
  const home = mkdtempSync(join(tmpdir(), 'omni-sign-'));
  const previous = process.env['OMNI_HOME'];
  process.env['OMNI_HOME'] = home;
  try {
    const signer = new ProofSignerService();
    const events = [event(0, 'do it'), event(1, 'done')];
    const certificate = ExecutionCertificates.build({ events });
    const bundle = AuditBundles.build({ runs: [{ events, certificate }] });
    const signed = await signer.signBundle(bundle);
    const result = new ProofVerifier(signer.trustStore).verifyOf(signed);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.verdict.signatureChecked, true);
    assert.equal(result.verdict.ok, true);
  } finally {
    if (previous === undefined) delete process.env['OMNI_HOME'];
    else process.env['OMNI_HOME'] = previous;
    rmSync(home, { recursive: true, force: true });
  }
});
