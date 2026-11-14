// 真机判据（2026-11-14 星际穿越星环轮）：工作态/思考态的品牌动画升级为 3D 立体星环——
// 验真 DOM 的结构链（星云晕/交叉背环/倾斜轨道/旋转面/星尘/Ω）与观感截图（明暗存档）。
// 逻辑层（bare 版进 ThinkingTrail）由 thinkingTrail.test.tsx 盖住。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStubSession, stubHtmlCdp, type CdpSession } from './browserHarness.ts';

const ARCHIVE = join(dirname(fileURLToPath(import.meta.url)), '..', 'archive');

/** 触发一个挂起的回合（stub 的 turns.run 由 __RESOLVE_TURN__ 控制收尾）→ busy 星环出现。 */
async function startBusy(cdp: CdpSession): Promise<void> {
  const sent = await cdp.evaluate(`(function(){
    var ta = document.querySelector('.composer-input textarea');
    var send = document.querySelector('button.send');
    if (ta === null || send === null) return false;
    ta.value = '跑一个长任务';
    send.click();
    return true;
  })()`);
  assert.strictEqual(sent, true, '找不到输入框/发送按钮');
  await cdp.waitFor("!!document.querySelector('.brand-mark--spin.brand-mark--compact')", 6000);
}

/** 读星环结构链（每个部件都必须在 DOM 里）。 */
function readGalaxy(cdp: CdpSession): Promise<Record<string, boolean>> {
  return cdp.evaluate(`(function(){
    var root = document.querySelector('.brand-mark--spin.brand-mark--compact');
    if (root === null) return { present: false };
    var q = function(sel){ return root.querySelector(sel) !== null; };
    return {
      present: true,
      nebula: q('.bm-nebula'),
      tilt: q('.bm-tilt'),
      orbit: q('.bm-orbit'),
      face: q('.bm-ring-face'),
      stars: root.querySelectorAll('.bm-star').length,
      omega: q('.bm-omega'),
    };
  })()`) as Promise<Record<string, boolean>>;
}

for (const theme of ['light', 'dark'] as const) {
  test(`真机观感：${theme} 主题下工作态星环截图存档`, { timeout: 120_000 }, async (t) => {
    const page = await openStubSession(t, { width: 1440, height: 900 });
    if (page === null) return;
    try {
      const { cdp } = page;
      await cdp.evaluate(`(function(){
        localStorage.setItem('omni-theme', '${theme}');
        return true;
      })()`);
      await cdp.navigate((await cdp.evaluate('location.href')) as string);
      await cdp.waitFor("!!document.querySelector('.composer-input textarea')", 10000);
      await startBusy(cdp);
      const galaxy = (await readGalaxy(cdp)) as { present: boolean; nebula: boolean; tilt: boolean; orbit: boolean; face: boolean; stars: number; omega: boolean };
      assert.strictEqual(galaxy.present, true, '工作态没有渲染星环');
      assert.ok(galaxy.nebula && galaxy.tilt && galaxy.orbit && galaxy.face, '星环结构链缺件');
      assert.strictEqual(galaxy.stars, 4, '星尘应为 4 颗');
      assert.ok(galaxy.omega, '缺居中 Ω');
      const shot = (await cdp.send('Page.captureScreenshot', { format: 'png' })) as { data: string };
      writeFileSync(join(ARCHIVE, 'brand-galaxy-' + theme + '.png'), Buffer.from(shot.data, 'base64'));
      // 星环本体只有 20px：clip 放大 8 倍再存一张，肉眼核对 3D 形态（倾斜/双环/星尘）。
      const box = (await cdp.evaluate(`(function(){
        var r = document.querySelector('.brand-mark--spin.brand-mark--compact').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      })()`)) as { x: number; y: number; w: number; h: number };
      const zoom = (await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: Math.max(0, box.x - 14), y: Math.max(0, box.y - 14), width: box.w + 28, height: box.h + 28, scale: 8 },
      })) as { data: string };
      writeFileSync(join(ARCHIVE, 'brand-galaxy-' + theme + '-zoom.png'), Buffer.from(zoom.data, 'base64'));
    } finally {
      await page.close();
    }
  });
}
