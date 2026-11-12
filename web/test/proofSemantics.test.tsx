// @vitest-environment jsdom
// 复核问题码语义判据（2026-11-13 alpha.18 对接）：
// ① 纯映射：内核机读码 → 人读语义 + 严重档（诚实标记 warn/info，未收录 fail-closed 到 err）；
// ② 渲染：导入复核结果按语义档渲染 + 诚实 chips + nonce 回验脚注。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { fireEvent, renderFacadeAsync, waitFor } from './rtlHarness.ts';
import { allText, byClass, facadeOf, type Facade, type FacadeNode } from './domFacade.ts';
import { ProofMode, problemSemanticsOf } from '../src/ui/components/tabs/control/ProofMode.tsx';

test('problemSemanticsOf：机读码 → 语义档（诚实标记不与失败混档）', () => {
  // 诚实档：未验证类 = warn，正面记录 = info。
  assert.equal(problemSemanticsOf('COMMITMENT_UNVERIFIED').kind, 'warn');
  // UNPROVEN_ORIGIN 在 bundle 路径会翻 ok（内核 NON_STRUCTURAL_CODES 只含 COMMITMENT_UNVERIFIED）→ err。
  assert.equal(problemSemanticsOf('UNPROVEN_ORIGIN').kind, 'err');
  assert.equal(problemSemanticsOf('ANCHOR_UNTRUSTED').kind, 'warn');
  assert.equal(problemSemanticsOf('ANCHOR_VERIFIED').kind, 'info');
  // 失败档。
  assert.equal(problemSemanticsOf('ANCHOR_NONCE_MISMATCH').kind, 'err');
  assert.equal(problemSemanticsOf('CHAIN_BREAK').kind, 'err');
  // 语义非空。
  assert.notEqual(problemSemanticsOf('ANCHOR_NONCE_MISMATCH').label, '');
  // 未收录：fail-closed 到 err，label 空（UI 展示机读码）。
  assert.deepEqual(problemSemanticsOf('TOTALLY_UNKNOWN'), { label: '', kind: 'err' });
});

test('ProofMode 导入复核：问题按语义档渲染 + 诚实 chips + nonce 回验脚注', async () => {
  const ui = await renderFacadeAsync(ProofMode, {
    props: { threadId: 's1', active: true },
    responses: {
      proofTurns: [],
      proofVerify: {
        ok: true,
        verdict: {
          ok: true,
          problems: [
            { code: 'ANCHOR_NONCE_MISMATCH', detail: '令牌 nonce 与锚声明不符。' },
            { code: 'COMMITMENT_UNVERIFIED', detail: '未提供带外承诺。' },
            { code: 'ANCHOR_VERIFIED', detail: '锚定已验证。' },
            { code: 'MYSTERY_CODE', detail: '未知问题。' },
          ],
          signatureChecked: false,
          commitmentChecked: false,
        },
        summary: { exportedAt: '', sessions: [], eventCount: 0 },
      },
    },
  });
  // 交互后必须从容器重取渲染树（旧快照会过期，见 domFacade 的使用口径）。
  const tree = (): Facade => facadeOf(ui.container.firstElementChild);

  // 造一个证据包文件并触发导入复核（jsdom 的 File 无 .text()，给最小形状替身）。
  const bundleJson = JSON.stringify({ version: 1, sessions: [] });
  const file = {
    name: 'bundle.json',
    size: bundleJson.length,
    text: async () => bundleJson,
  } as unknown as File;
  const input = ui.container.querySelector('input[type="file"]');
  assert.ok(input !== null, '证据包选择器存在');
  Object.defineProperty(input, 'files', { value: [file] });
  fireEvent.change(input);

  await waitFor(() => {
    if (allText(tree()).indexOf('ANCHOR_NONCE_MISMATCH') < 0) throw new Error('复核结果未渲染');
  });
  const text = allText(tree() as FacadeNode);
  // 语义标签（人读）与机读码并存。
  assert.match(text, /nonce 绑定不匹配/u);
  assert.match(text, /无带外承诺可核对/u);
  assert.match(text, /锚定验证通过/u);
  assert.match(text, /MYSTERY_CODE/u, '未收录码原样展示（fail-closed）');
  // 诚实 chips：未验签（verify.verdict.signatureChecked=false → warn 档）。
  assert.match(text, /未验签：不能确认来源/u);
  // nonce 回验脚注。
  assert.match(text, /自动回验/u, 'nonce 回验脚注（断言脚注独有词，不吃问题码的 nonce）');
  // 档位着色：ANCHOR_VERIFIED = info（processing 类），失败码 = err（error 类）。
  const kinds = byClass(tree(), 'ant-tag').map((n) => String(n.props.className ?? ''));
  assert.ok(
    kinds.some((c) => c.includes('ant-tag-processing')),
    'ANCHOR_VERIFIED 走 info（processing）档',
  );
  assert.ok(kinds.some((c) => c.includes('ant-tag-error')), '失败档走 error 类');
});
