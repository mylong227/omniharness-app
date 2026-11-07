// M29 审计 canonical 合并判据（应用侧）——审计哈希链的序列化口径收敛为内核 Jcs 单一真源。
//
// 背景：`apps/audit/auditCanonical.ts`（「RFC 8785 子集 + 宽松改写」第二实现）已退役；
// auditChain / auditReportBuilder / auditReportVerifier 改用内核 `Jcs.serialize`。
// 本判据钉住合并的三条承诺：
// ① JSON 合法值域内，Jcs 输出与历史 AuditCanonical 规则**逐字节恒同**（键序 UTF-16 sort /
//    JSON.stringify 转义 / Number::toString 数字含 -0→"0"）——历史审计报告逐字节可验；
// ② fail-closed 加固：历史宽松改写路径（NaN→null / Date→{} / 数组 undefined→null）现显式抛错
//    ——审计哈希不得盖住被静默改写的值；
// ③ 链路端到端 + HTML 内嵌复核脚本的 `canon` 与 Jcs 同一口径（离线复核字节一致）。
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { Jcs, JcsError } from '../src/host/kernel/util.ts';
import { AuditChain } from '../src/apps/audit/auditChain.ts';
import { AUDIT_VERIFIER_SCRIPT } from '../src/apps/audit/auditVerifierScript.ts';
import type { AuditRecord } from '../src/apps/audit/auditTypes.ts';

/** 历史 AuditCanonical 语义的期望值（按其规则独立构造，作为不可漂移的 golden）。 */
const GOLDEN_MATRIX: readonly { readonly value: unknown; readonly expected: string }[] = [
  { value: null, expected: 'null' },
  { value: 42, expected: '42' },
  { value: -0, expected: '0' },
  { value: '文本"引号"', expected: '"文本\\"引号\\""' },
  { value: { b: 1, a: 2, A: 3 }, expected: '{"A":3,"a":2,"b":1}' },
  { value: { 'z': [1, { c: null }], '键': '值' }, expected: '{"z":[1,{"c":null}],"键":"值"}' },
  { value: { emoji: '🌟', lone: '\uD83D', ctrl: '\u0000\u001f' }, expected: '{"ctrl":"\\u0000\\u001f","emoji":"🌟","lone":"\\ud83d"}' },
];

test('审计 canonical（历史矩阵）：Jcs 与历史 AuditCanonical 语义逐字节恒同', () => {
  for (const { value, expected } of GOLDEN_MATRIX) {
    assert.equal(Jcs.serialize(value), expected, JSON.stringify(value));
  }
  // undefined 对象字段跳过（两代实现同语义）。
  assert.equal(Jcs.serialize({ a: 1, ghost: undefined }), '{"a":1}');
});

test('审计 canonical（fail-closed 加固）：历史宽松改写路径显式抛错', () => {
  assert.throws(() => Jcs.serialize({ score: Number.NaN }), JcsError); // 历史：null
  assert.throws(() => Jcs.serialize({ at: new Date(0) }), JcsError); // 历史：{}
  assert.throws(() => Jcs.serialize([undefined]), JcsError); // 历史：[null]
  assert.throws(() => Jcs.serialize(makeDeep(65)), JcsError); // 历史：MAX_DEPTH=64 抛错（口径一致）
  assert.doesNotThrow(() => Jcs.serialize(makeDeep(64)));
});

/** 构造 n 层对象嵌套。 */
function makeDeep(n: number): unknown {
  let node: unknown = null;
  for (let i = 0; i < n; i++) node = { child: node };
  return node;
}

test('审计链端到端：link/verify 在 Jcs 口径下自洽，golden 链头哈希不变', () => {
  const records: AuditRecord[] = [
    { seq: 1, timestamp: '2026-11-07T00:00:00.000Z', actor: 'agent', action: 'file.write', target: 'src/app.ts' },
    { seq: 2, timestamp: '2026-11-07T00:00:01.000Z', actor: 'agent', action: 'tool.call', target: 'grep', meta: { pattern: 'Jcs', hits: 3 } },
  ] as unknown as AuditRecord[];
  const chain = new AuditChain();
  const linked = chain.link(records);
  assert.equal(linked[0]?.prev, AuditChain.GENESIS);
  assert.equal(linked[1]?.prev, linked[0]?.hash);
  // 首条记录的链哈希：SHA-256(GENESIS + "\n" + canonical(record_1))——按规则独立重算，
  // 与历史 AuditCanonical 口径逐字节一致（canonical 部分即 §1 的 golden 规则）。
  const canonicalFirst = Jcs.serialize(records[0]);
  const expectedFirst = createHash('sha256')
    .update(AuditChain.GENESIS + AuditChain.SEPARATOR + canonicalFirst, 'utf8')
    .digest('hex');
  assert.equal(linked[0]?.hash, expectedFirst);
  // verify：未篡改 = ok；改中间一条 = 检出。
  const verdict = chain.verify(linked);
  assert.equal(verdict.ok, true);
  const tampered = structuredClone(linked);
  (tampered[1]!.record as { target: string }).target = 'hacked.ts';
  const verdictTampered = chain.verify(tampered);
  assert.equal(verdictTampered.ok, false);
});

test('HTML 内嵌复核脚本：canon 与内核 Jcs 同一口径（离线复核字节一致）', () => {
  // 从报告脚本源里提取自包含的 canon 函数（花括号配平），在 Node 里独立求值。
  const start = AUDIT_VERIFIER_SCRIPT.indexOf('function canon(');
  assert.ok(start > 0, '脚本应含 canon 函数');
  let depth = 0;
  let end = start;
  for (let i = start; i < AUDIT_VERIFIER_SCRIPT.length; i++) {
    if (AUDIT_VERIFIER_SCRIPT[i] === '{') depth += 1;
    if (AUDIT_VERIFIER_SCRIPT[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const canonSource = AUDIT_VERIFIER_SCRIPT.slice(start, end);
  const canon = new Function(`return (${canonSource});`)() as (value: unknown) => string;
  for (const { value, expected } of GOLDEN_MATRIX) {
    assert.equal(canon(value), expected, JSON.stringify(value));
  }
  // 与 Jcs 在同一矩阵上逐字节一致。
  for (const { value } of GOLDEN_MATRIX) {
    assert.equal(canon(value), Jcs.serialize(value));
  }
});
