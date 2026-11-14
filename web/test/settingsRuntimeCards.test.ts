// 真机判据（settings-completion，2026-11-14）：设置「运行时」栏补全后的卡片结构
// 与**新开关/新字段的写回闭环**——node 单测（configWiring）验模型，这里验真 DOM：
// 四张卡渲染齐全、开关切换真实发出 config.update、number 字段留空提交=清除。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStubSession, stubHtmlCdp, type CdpSession } from './browserHarness.ts';

const ARCHIVE = join(dirname(fileURLToPath(import.meta.url)), '..', 'archive');

/** stub 页：config.get 返回带新键的配置 + config.update 记录 params。 */
function stubWithConfig(): string {
  return stubHtmlCdp()
    .replace(
      'RPC_CALLS.push({ method: method });',
      "RPC_CALLS.push({ method: method, params: (function(){ try { return JSON.parse(opts.body||'{}').params; } catch(e) { return undefined; } })() });",
    )
    .replace(
      "    'config.get': { modelAdapter:'mock', model:'mock-e2e', reasoning:'medium', approval:'ask' },",
      "    'config.get': { modelAdapter:'mock', model:'mock-e2e', reasoning:'medium', approval:'ask', modelCircuitBreaker:false, longTermMemoryEncryption:false, longTermMemoryGovernance:false },",
    );
}

/** 打开设置并跳到指定分栏（控制台左导航按文本点）。 */
async function openSettingsTab(cdp: CdpSession, tab: string): Promise<void> {
  await cdp.evaluate(`(function(){
    var b = document.querySelector('.side-foot button[aria-label="打开设置"]');
    if (b) b.click();
    return !!b;
  })()`);
  assert.ok(await cdp.waitFor("!!document.querySelector('.csl')", 4000), '控制台未出现');
  const clicked = await cdp.evaluate(`(function(){
    var hit = [].slice.call(document.querySelectorAll('.csl-nav-item')).filter(function(i){
      return (i.textContent || '').indexOf('${tab}') >= 0;
    })[0];
    if (hit === undefined) return false;
    hit.click();
    return true;
  })()`);
  assert.strictEqual(clicked, true, `找不到分栏导航「${tab}」`);
}

/** 读运行时栏卡片（标题 + 每卡的设置行数）。 */
function readCards(cdp: CdpSession): Promise<{ titles: string[]; rows: Record<string, number> }> {
  return cdp.evaluate(`(function(){
    var out = { titles: [], rows: {} };
    [].slice.call(document.querySelectorAll('.ant-card')).forEach(function(card){
      var h = card.querySelector('h2');
      if (h === null) return;
      var title = (h.textContent || '').trim();
      out.titles.push(title);
      out.rows[title] = card.querySelectorAll('.csl-row').length;
    });
    return out;
  })()`) as Promise<{ titles: string[]; rows: Record<string, number> }>;
}

test('真机：运行时栏四卡齐全（执行环境/存储/步数与成本/长期记忆）', { timeout: 120_000 }, async (t) => {
  const page = await openStubSession(t, { width: 1440, height: 900, stub: '_settings-stub.html', html: stubWithConfig() });
  if (page === null) return;
  try {
    const { cdp } = page;
    await openSettingsTab(cdp, '运行时');
    assert.ok(await cdp.waitFor("!!document.querySelector('.ant-card h2')", 3000), '卡片未渲染');
    const cards = await readCards(cdp);
    assert.ok(cards.titles.includes('适配器与执行环境'), '缺执行环境卡');
    assert.ok(cards.titles.includes('存储'), '缺存储卡');
    assert.ok(cards.titles.includes('步数与成本'), '缺步数与成本卡');
    assert.ok(cards.titles.includes('长期记忆'), '缺长期记忆卡');
    assert.strictEqual(cards.rows['适配器与执行环境'], 3, '执行环境 3 行（适配器/沙箱/越权沙箱）');
    assert.strictEqual(cards.rows['存储'], 2, '存储 2 行（适配器/目录）');
    assert.strictEqual(cards.rows['步数与成本'], 7, '步数与成本 7 行（maxSteps+成本三键+熔断三键）');
    assert.strictEqual(cards.rows['长期记忆'], 3, '长期记忆 3 行');
  } finally {
    await page.close();
  }
});

test('真机：新开关切换真实写回；number 非法值不落盘、合法值与留空清除落盘', { timeout: 120_000 }, async (t) => {
  const page = await openStubSession(t, { width: 1440, height: 900, stub: '_settings-stub.html', html: stubWithConfig() });
  if (page === null) return;
  try {
    const { cdp } = page;
    await openSettingsTab(cdp, '运行时');
    // 模型熔断开关：antd Switch（aria-label = 行标签）。
    const toggled = await cdp.evaluate(`(function(){
      var sw = document.querySelector('.csl-switch[aria-label="模型熔断"]');
      if (sw === null) return false;
      sw.click();
      return true;
    })()`);
    assert.strictEqual(toggled, true, '找不到「模型熔断」开关');
    // 记忆治理开关也切一下（长期记忆卡的布尔面）。
    await cdp.evaluate(`(function(){
      var sw = document.querySelector('.csl-switch[aria-label="长期记忆治理"]');
      if (sw) sw.click();
      return !!sw;
    })()`);
    // maxSteps：先输非法值（不落盘），再输合法值（落盘数字）。
    const setInput = await cdp.evaluate(`(function(){
      var input = document.querySelector('.csl-input[aria-label="单回合最大步数"]');
      if (input === null) return false;
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'abc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('blur'));
      return true;
    })()`);
    assert.strictEqual(setInput, true, '找不到 maxSteps 输入框');
    const updates = (await cdp.evaluate(
      "window.__RPC_CALLS__.filter(function(c){ return c.method === 'config.update'; }).map(function(c){ return c.params; })",
    )) as Record<string, unknown>[];
    assert.deepStrictEqual(
      updates.filter((p) => p !== undefined && p['modelCircuitBreaker'] !== undefined)[0],
      { modelCircuitBreaker: true },
      '开关切换必须真实发出 config.update',
    );
    assert.strictEqual(
      updates.some((p) => p !== undefined && p['longTermMemoryGovernance'] === true),
      true,
      '长期记忆治理开关写回',
    );
    assert.strictEqual(
      updates.some((p) => p !== undefined && p['maxSteps'] !== undefined),
      false,
      '非法 number 不落盘',
    );
  } finally {
    await page.close();
  }
});

test('真机：审批模式下拉含内核全部 6 档（deny/guardian/plan 补全）', { timeout: 120_000 }, async (t) => {
  const page = await openStubSession(t, { width: 1440, height: 900, stub: '_settings-stub.html', html: stubWithConfig() });
  if (page === null) return;
  try {
    const { cdp } = page;
    await openSettingsTab(cdp, '权限');
    assert.ok(await cdp.waitFor("!!document.querySelector('.ant-card')", 3000), '权限卡未渲染');
    const modes = (await cdp.evaluate(`(function(){
      // ConsoleSelect 是 antd Select：点开审批模式下拉，读取选项文本。
      var sel = [].slice.call(document.querySelectorAll('.csl-select')).filter(function(s){
        return (s.closest('.csl-row') || { textContent: '' }).textContent.indexOf('审批模式') >= 0;
      })[0];
      if (sel === undefined) return null;
      // antd Select 的开合靠 trigger 上的完整鼠标序列（合成 click 偶尔不开）。
      var r = sel.getBoundingClientRect();
      ['mousedown', 'mouseup', 'click'].forEach(function(type){
        sel.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: r.x + 10, clientY: r.y + 10 }));
      });
      return true;
    })()`)) as boolean | null;
    assert.strictEqual(modes, true, '找不到审批模式下拉');
    // 弹层挂在 body（getPopupContainer 默认）；没展开时重试完整鼠标序列。
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await cdp.waitFor("!!document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')", 2000)) break;
      await cdp.evaluate(`(function(){
        var sel = [].slice.call(document.querySelectorAll('.csl-select')).filter(function(s){
          return (s.closest('.csl-row') || { textContent: '' }).textContent.indexOf('审批模式') >= 0;
        })[0];
        if (sel === undefined) return;
        var r = sel.getBoundingClientRect();
        ['mousedown', 'mouseup', 'click'].forEach(function(type){
          sel.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: r.x + 10, clientY: r.y + 10 }));
        });
      })()`);
    }
    const opts = (await cdp.evaluate(`(function(){
      return [].slice.call(document.querySelectorAll('.ant-select-dropdown .ant-select-item-option')).map(function(o){
        return (o.textContent || '').trim();
      });
    })()`)) as string[];
    for (const need of ['auto', 'deny', 'rules', 'guardian', 'ask', 'plan']) {
      assert.ok(opts.includes(need), `审批模式下拉缺「${need}」档`);
    }
  } finally {
    await page.close();
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`真机观感：${theme} 主题下运行时栏四卡截图存档`, { timeout: 120_000 }, async (t) => {
    const page = await openStubSession(t, { width: 1440, height: 900, stub: '_settings-stub.html', html: stubWithConfig() });
    if (page === null) return;
    try {
      const { cdp } = page;
      // 与 themeSchemes ③ 同口径：antd token 挂载时定型，先写偏好再重载。
      await cdp.evaluate(`(function(){ localStorage.setItem('omni-theme', '${theme}'); return true; })()`);
      await cdp.navigate((await cdp.evaluate('location.href')) as string);
      await cdp.waitFor("!!document.querySelector('.composer-input textarea')", 10000);
      await openSettingsTab(cdp, '运行时');
      const shot = (await cdp.send('Page.captureScreenshot', { format: 'png' })) as { data: string };
      writeFileSync(join(ARCHIVE, 'settings-runtime-cards-' + theme + '.png'), Buffer.from(shot.data, 'base64'));
    } finally {
      await page.close();
    }
  });
}
