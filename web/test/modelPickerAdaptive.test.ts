// 真机判据（adaptive-reasoning，2026-11-14）：「模型与推理强度」弹窗的档位进度条
// **按当前模型**渲染——切模型即变段数；确证不支持 effort 的模型整条隐藏；
// 越界档位在切换时被钳制并随同一次 config.update 写回。
//
// 与 node 单测（modelSwitchClamp.test.ts）的分工：这里验证的是**真 DOM 里**的
// ladder 段数/标签/隐藏分支（stub 注入多模型目录），以及浅/深两主题下的观感截图
// （存档 web/archive/，供肉眼复核——单测看不见颜色以外的观感）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStubSession, stubHtmlCdp, type CdpSession } from './browserHarness.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARCHIVE = join(HERE, '..', 'archive');

/** 多模型目录 stub：三档形状——3 档 / 4 档 / 确证无档位。 */
const CATALOG = {
  providers: [],
  active: {
    id: 'mock',
    label: 'Mock 厂商',
    defaultModel: 'mock-e2e',
    model: 'mock-e2e',
    models: ['mock-e2e', 'mock-mini', 'mock-chat'],
    reasoningEffort: ['low', 'medium', 'high', 'xhigh'],
    effortsByModel: {
      'mock-e2e': ['low', 'medium', 'high'],
      'mock-mini': ['low', 'medium', 'high', 'xhigh'],
      // 模型级 [] = 确证不接收 effort（与厂商级 [] 的"回落兜底"语义不同）。
      'mock-chat': [],
    },
  },
};

/** stub 页：默认桩 + 目录覆盖 + config.update 记录 params（钳制断言要读写回的 patch）。 */
function stubWithCatalog(): string {
  const base = stubHtmlCdp();
  const marker = 'RPC_CALLS.push({ method: method });';
  assert.ok(base.includes(marker), 'stub 源码口径变了：RPC_CALLS.push 行找不到');
  return base
    .replace(
      marker,
      "RPC_CALLS.push({ method: method, params: (function(){ try { return JSON.parse(opts.body||'{}').params; } catch(e) { return undefined; } })() });",
    )
    .replace(
      '<script>',
      `<script>window.__RPC_OVERRIDES__ = { 'model.catalog': ${JSON.stringify(CATALOG)} };</script><script>`,
    );
}

/** 打开「模型与推理强度」弹窗并等菜单出现（已在开态则直接复用——档位段点击不关弹窗）。 */
async function openPicker(cdp: CdpSession): Promise<void> {
  const already = await cdp.evaluate("!!document.querySelector('.mp-menu')");
  if (already === true) return;
  const clicked = await cdp.evaluate(`(function(){
    var t = document.querySelector('.mp');
    if (t === null) return false;
    t.click();
    return true;
  })()`);
  assert.strictEqual(clicked, true, '找不到模型触发器 .mp');
  assert.ok(await cdp.waitFor("!!document.querySelector('.mp-menu')", 3000), '弹窗未出现');
}

/** 读弹窗内进度条段（档位值/标签/当前态）。 */
function readLadder(cdp: CdpSession): Promise<{ values: string[]; current: string | null; hasLadder: boolean; sub: string | null }> {
  return cdp.evaluate(`(function(){
    var steps = [].slice.call(document.querySelectorAll('.mp-ladder .mp-step'));
    var cur = document.querySelector('.mp-step.current .mp-step-name');
    var trig = document.querySelector('.mp');
    return {
      values: steps.map(function(s){ return (s.querySelector('.mp-step-name') || {}).textContent || ''; }),
      current: cur === null ? null : cur.textContent,
      hasLadder: document.querySelector('.mp-ladder') !== null,
      sub: trig === null ? null : ((trig.querySelector('.mp-sub') || {}).textContent ?? null),
    };
  })()`) as Promise<{ values: string[]; current: string | null; hasLadder: boolean; sub: string | null }>;
}

/** 点弹窗里指定文本的模型行（点击即选并关闭弹窗）。 */
async function pickModel(cdp: CdpSession, model: string): Promise<void> {
  const picked = await cdp.evaluate(`(function(){
    var hit = [].slice.call(document.querySelectorAll('.mp-menu .mp-item')).filter(function(i){
      return (i.textContent || '').indexOf('${model}') >= 0;
    })[0];
    if (hit === undefined) return false;
    hit.click();
    return true;
  })()`);
  assert.strictEqual(picked, true, `找不到模型行 ${model}`);
}

test('真机：进度条按当前模型渲染段数，切模型即变', { timeout: 120_000 }, async (t) => {
  const page = await openStubSession(t, { width: 1440, height: 900, stub: '_adaptive-stub.html', html: stubWithCatalog() });
  if (page === null) return;
  try {
    const { cdp } = page;
    await openPicker(cdp);
    // 当前模型 mock-e2e（模型级 3 档）：进度条 3 段，而不是厂商档的 4 段。
    const first = await readLadder(cdp);
    assert.deepStrictEqual(first.values, ['弱', '中', '强']);
    assert.strictEqual(first.current, '中', 'stub config.get reasoning=medium');

    // 切到 mock-mini（4 档）：同弹窗段数变 4。
    await pickModel(cdp, 'mock-mini');
    await openPicker(cdp);
    const second = await readLadder(cdp);
    assert.deepStrictEqual(second.values, ['弱', '中', '强', '极强']);
    assert.strictEqual(second.current, '中', '合法档位跨模型保留');
  } finally {
    await page.close();
  }
});

test('真机：确证不接收 effort 的模型整条隐藏；越界档位切换时钳制写回', { timeout: 120_000 }, async (t) => {
  const page = await openStubSession(t, { width: 1440, height: 900, stub: '_adaptive-stub.html', html: stubWithCatalog() });
  if (page === null) return;
  try {
    const { cdp } = page;
    // 把当前值推到 mock-mini 的最强档 xhigh，为越界钳制造现场（先切到 4 档的模型）。
    await openPicker(cdp);
    await pickModel(cdp, 'mock-mini');
    await openPicker(cdp);
    const clicked = await cdp.evaluate(`(function(){
      var hit = [].slice.call(document.querySelectorAll('.mp-ladder .mp-step')).filter(function(s){
        return (s.textContent || '').indexOf('极强') >= 0;
      })[0];
      if (hit === undefined) return false;
      hit.click();
      return true;
    })()`);
    assert.strictEqual(clicked, true, '找不到「极强」段');
    await openPicker(cdp);
    // 切到 mock-chat（模型级 []）：进度条整条消失、触发按钮无强度副文案。
    await pickModel(cdp, 'mock-chat');
    await openPicker(cdp);
    const hidden = await readLadder(cdp);
    assert.strictEqual(hidden.hasLadder, false, '确证不支持的模型不得渲染进度条');
    assert.strictEqual(hidden.sub, null, '触发按钮不得残留强度副文案');

    // 切回 mock-mini：进度条回来，段数 = 4。
    await pickModel(cdp, 'mock-mini');
    await openPicker(cdp);
    const back = await readLadder(cdp);
    assert.deepStrictEqual(back.values, ['弱', '中', '强', '极强']);

    // 切到 mock-e2e（3 档）：xhigh 越界 → 钳到 high，且与 model 合并进同一次 config.update。
    await pickModel(cdp, 'mock-e2e');
    await openPicker(cdp);
    const clamped = await readLadder(cdp);
    assert.strictEqual(clamped.current, '强', '越界值钳到最近支持档');
    const updates = (await cdp.evaluate(
      "window.__RPC_CALLS__.filter(function(c){ return c.method === 'config.update'; }).map(function(c){ return c.params; })",
    )) as Record<string, unknown>[];
    const last = updates[updates.length - 1];
    assert.ok(last !== undefined, '没有 config.update 调用');
    assert.strictEqual(last['model'], 'mock-e2e');
    assert.strictEqual(last['reasoning'], 'high', '钳制结果必须写回配置');
  } finally {
    await page.close();
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`真机观感：${theme} 主题下自适应进度条截图存档`, { timeout: 120_000 }, async (t) => {
    const page = await openStubSession(t, { width: 1440, height: 900, stub: '_adaptive-stub.html', html: stubWithCatalog() });
    if (page === null) return;
    try {
      const { cdp } = page;
      // 与 themeSchemes ③ 同口径：antd token 挂载时定型，先写偏好再重载。
      await cdp.evaluate(`(function(){
        localStorage.setItem('omni-theme', '${theme}');
        return true;
      })()`);
      await cdp.navigate((await cdp.evaluate('location.href')) as string);
      await cdp.waitFor("!!document.querySelector('.composer-input textarea')", 10000);
      await openPicker(cdp);
      const shot = (await cdp.send('Page.captureScreenshot', { format: 'png' })) as { data: string };
      if (!existsSync(ARCHIVE)) mkdirSync(ARCHIVE);
      writeFileSync(join(ARCHIVE, `adaptive-reasoning-${theme}.png`), Buffer.from(shot.data, 'base64'));
    } finally {
      await page.close();
    }
  });
}
