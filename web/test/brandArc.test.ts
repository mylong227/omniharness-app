// 真机判据（2026-11-14 月弧动画）：工作态的品牌动画为「月弧」——细底环 + 圆头亮弧
// 匀速旋转 + 居中 Ω，环收回芯片内。验真 DOM 结构链与明暗放大截图（8×）。
// 逻辑层（bare 版进 ThinkingTrail）由 thinkingTrail.test.tsx 盖住。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStubSession, type CdpSession } from './browserHarness.ts';

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
  await cdp.waitFor("!!document.querySelector('.brand-mark--spin.brand-mark--compact')", 40);
}

/** 读月弧结构链（每个部件都必须在 DOM 里）。 */
function readArc(cdp: CdpSession): Promise<Record<string, unknown>> {
  return cdp.evaluate(`(function(){
    var root = document.querySelector('.brand-mark--spin.brand-mark--compact');
    if (root === null) return { present: false };
    var q = function(sel){ return root.querySelector(sel) !== null; };
    return {
      present: true,
      svg: q('svg.bm-arc'),
      track: q('.bm-arc-track'),
      lead: q('.bm-arc-lead'),
      stars: root.querySelectorAll('.bm-star').length,
      nebula: q('.bm-nebula'),
      orbit: q('.bm-orbit'),
      omega: q('.bm-omega'),
    };
  })()`) as Promise<Record<string, unknown>>;
}

for (const theme of ['light', 'dark'] as const) {
  test(`真机观感：${theme} 主题下月弧工作态截图存档（含 8× 放大）`, { timeout: 120_000 }, async (t) => {
    const page = await openStubSession(t, { width: 1440, height: 900 });
    if (page === null) return;
    try {
      const { cdp } = page;
      await cdp.evaluate(`(function(){
        localStorage.setItem('omni-theme', '${theme}');
        return true;
      })()`);
      await cdp.navigate((await cdp.evaluate('location.href')) as string);
      await cdp.waitFor("!!document.querySelector('.composer-input textarea')", 40);
      await startBusy(cdp);
      const arc = (await readArc(cdp)) as unknown as {
        present: boolean;
        svg: boolean;
        track: boolean;
        lead: boolean;
        stars: number;
        nebula: boolean;
        orbit: boolean;
        omega: boolean;
      };
      assert.strictEqual(arc.present, true, '工作态没有渲染月弧');
      assert.ok(arc.svg && arc.track && arc.lead, '月弧结构链缺件');
      assert.strictEqual(arc.stars, 0, '星尘必须退役（简洁口径）');
      assert.strictEqual(arc.nebula, false, '星云必须退役');
      assert.strictEqual(arc.orbit, false, '3D 轨道必须退役');
      assert.ok(arc.omega, '缺居中 Ω');
      const box = (await cdp.evaluate(`(function(){
        var r = document.querySelector('.brand-mark--spin.brand-mark--compact').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      })()`)) as { x: number; y: number; w: number; h: number };
      const zoom = (await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: Math.max(0, box.x - 14), y: Math.max(0, box.y - 14), width: box.w + 28, height: box.h + 28, scale: 8 },
      })) as { data: string };
      writeFileSync(join(ARCHIVE, 'brand-arc-' + theme + '-zoom.png'), Buffer.from(zoom.data, 'base64'));
    } finally {
      await page.close();
    }
  });
}
