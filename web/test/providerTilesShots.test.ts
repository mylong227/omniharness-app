// 厂商页重设计真机观感判据（2026-11-14 方案 A）：明暗两主题的总览网格与编辑抽屉截图存档。
// 行为判据见 providerTiles.test.tsx（jsdom）。node 环境（openStubSession 需要 Node WebSocket）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStubSession, stubHtmlCdp, type CdpSession } from './browserHarness.ts';

const ARCHIVE = join(dirname(fileURLToPath(import.meta.url)), '..', 'archive');


/** 多厂商目录 stub（stub 默认 providers 空 ⇒ 网格 0 卡）：覆盖为 3 家形状完整的厂商。 */
const CATALOG = {
  providers: [
    { id: 'deepseek', label: 'DeepSeek', adapter: 'openai', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', needsKey: true, models: ['deepseek-chat'], reasoningEffort: ['high'] },
    { id: 'moonshot', label: 'Moonshot Kimi', adapter: 'openai', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'kimi-latest', needsKey: true, models: [], reasoningEffort: ['high'] },
    { id: 'openai', label: 'OpenAI', adapter: 'openai', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-5', needsKey: true, models: [], reasoningEffort: ['minimal', 'high'] },
  ],
  active: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    model: 'deepseek-chat',
    models: ['deepseek-chat'],
    reasoningEffort: ['high'],
    effortsByModel: { 'deepseek-chat': ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] },
  },
};

/** stub 页：默认桩 + 目录覆盖。 */
function stubWithCatalog(): string {
  const base = stubHtmlCdp();
  const marker = '<script>';
  return base.replace(marker, `<script>window.__RPC_OVERRIDES__ = { 'model.catalog': ${JSON.stringify(CATALOG)} };</script><script>`);
}

/** 真机：打开设置「模型与厂商」页（stub 的 mock 厂商已够渲染网格）。 */
async function openModelPane(cdp: CdpSession): Promise<void> {
  const clicked = await cdp.evaluate(`(function(){
    var b = document.querySelector('.side-foot button[aria-label="打开设置"]');
    if (b === null) return false;
    b.click();
    return true;
  })()`);
  assert.strictEqual(clicked, true, '找不到设置入口');
  assert.ok(await cdp.waitFor("!!document.querySelector('.csl')", 40), '控制台未出现');
  const nav = await cdp.evaluate(`(function(){
    var hit = [].slice.call(document.querySelectorAll('.csl-nav-item')).filter(function(i){
      return (i.textContent || '').indexOf('模型与厂商') >= 0;
    })[0];
    if (hit === undefined) return false;
    hit.click();
    return true;
  })()`);
  assert.strictEqual(nav, true, '找不到「模型与厂商」导航项');
  assert.ok(await cdp.waitFor("!!document.querySelector('.sp-grid .sp-tile')", 40), '网格未渲染');
}

for (const theme of ['light', 'dark'] as const) {
  test(`真机观感：${theme} 主题下厂商网格与编辑抽屉截图存档`, { timeout: 120_000 }, async (t) => {
    const page = await openStubSession(t, { width: 1440, height: 900, stub: '_prov-stub.html', html: stubWithCatalog() });
    if (page === null) return;
    try {
      const { cdp } = page;
      await cdp.evaluate(`(function(){
        localStorage.setItem('omni-theme', '${theme}');
        return true;
      })()`);
      await cdp.navigate((await cdp.evaluate('location.href')) as string);
      await cdp.waitFor("!!document.querySelector('.composer-input textarea')", 40);
      await openModelPane(cdp);
      const shot = (await cdp.send('Page.captureScreenshot', { format: 'png' })) as { data: string };
      writeFileSync(join(ARCHIVE, 'provider-grid-' + theme + '.png'), Buffer.from(shot.data, 'base64'));
      const openDrawer = await cdp.evaluate(`(function(){
        var t = document.querySelector('.sp-tile');
        if (t === null) return false;
        t.click();
        return true;
      })()`);
      assert.strictEqual(openDrawer, true, '点卡失败');
      assert.ok(await cdp.waitFor("!!document.querySelector('.ant-drawer-content-wrapper')", 40), '抽屉未出现');
      const shot2 = (await cdp.send('Page.captureScreenshot', { format: 'png' })) as { data: string };
      writeFileSync(join(ARCHIVE, 'provider-drawer-' + theme + '.png'), Buffer.from(shot2.data, 'base64'));
    } finally {
      await page.close();
    }
  });
}
