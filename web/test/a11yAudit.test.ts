// 判据：真实 Chrome 里的 **WCAG 2.1 A/AA 自动审计**（axe-core，2026-10-18 准入的 devDependency）。
//
// ## 为什么加这条（此前只有"对比度 + 键盘焦点"两条手工判据）
//
// 现有判据只覆盖两件事：颜色对比（a11yContrast）与焦点可见（a11yKeyboard）。但无障碍的
// 大多数缺陷是**结构性的**——按钮没有可读名字、dialog 缺 aria-modal、滚动容器不可聚焦、
// 表单没有 label、列表用了错误的 role……这些手工判据完全看不到，而 axe 一次就能扫出来。
//
// ## 口径（避免"扫了但没牙"）
//
//   · 规则集固定为 WCAG 2.1 A/AA（`wcag2a/wcag2aa/wcag21a/wcag21aa`），不扫 best-practice
//     （那会把"内联 SVG 建议加 title"这类风格问题当成缺陷）；
//   · 只把 **serious / critical** 判红；moderate/minor 打印出来供观察（不阻断）；
//   · 必须真有 `passes`（否则说明 axe 没真正跑，判据会变假绿）；
//   · 两套主题、两个状态（空态 + 打开工作台控制台）各扫一次——主题会改变颜色，模态会引入
//     dialog / 焦点陷阱 / 表单控件。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { openStubSession, type CdpSession } from './browserHarness.ts';

/** axe-core 运行脚本（devDependency；随仓库一起离线可用）。 */
const AXE_SOURCE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

/** axe 报告里我们关心的字段。 */
interface AxeViolation {
  readonly id: string;
  readonly impact: string | null;
  readonly help: string;
  readonly nodes: { target: string[]; failureSummary?: string }[];
}

/** 一次扫描的摘要。 */
interface AxeResult {
  readonly violations: AxeViolation[];
  readonly passCount: number;
}

/**
 * 在页面里执行一次 axe 扫描。
 * @param cdp CDP 会话
 * @param theme dark / light
 * @returns 违规清单与通过项数量
 */
async function scan(cdp: CdpSession, theme: 'dark' | 'light'): Promise<AxeResult> {
  await cdp.evaluate(`document.documentElement.setAttribute('data-theme','${theme}')`);
  await new Promise((r) => setTimeout(r, 150));
  // 注入 axe（幂等：脚本自己挂在 window.axe 上）。
  await cdp.evaluate(`(function(){ if (window.axe) return true; ${AXE_SOURCE}\n; return !!window.axe; })()`);
  const raw = (await cdp.evaluate(`(async function(){
    var res = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] },
      resultTypes: ['violations','passes']
    });
    return {
      passCount: res.passes.length,
      violations: res.violations.map(function(v){
        return { id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 5).map(function(n){
          return { target: n.target, failureSummary: n.failureSummary };
        }) };
      })
    };
  })()`)) as AxeResult;
  return raw;
}

/**
 * 把违规清单格式化成可读断言消息。
 * @param rows 违规项
 * @param label 状态标签
 * @returns 消息
 */
function report(rows: readonly AxeViolation[], label: string): string {
  return (
    `${label}：axe 检出 serious/critical 违规 ${String(rows.length)} 条\n` +
    rows
      .map(
        (v) =>
          `  · [${String(v.impact)}] ${v.id} — ${v.help}\n` +
          v.nodes
            .slice(0, 3)
            .map((n) => `      ${n.target.join(' ')}｜${(n.failureSummary ?? '').replace(/\n/g, ' ').slice(0, 160)}`)
            .join('\n'),
      )
      .join('\n')
  );
}

test('axe WCAG 2.1 A/AA：两套主题 × 空态/工作台控制台，无 serious/critical 违规', { timeout: 180_000 }, async (t) => {
  const page = await openStubSession(t, { stub: '_a11y-audit.html', width: 1280, height: 900 });
  if (page === null) return;
  try {
    await page.cdp.waitFor("!!document.querySelector('#root .composer-box')", 8000);
    await new Promise((r) => setTimeout(r, 400));

    /** 收集两套主题 × 两个状态的扫描结果。 */
    const seen: { label: string; result: AxeResult }[] = [];
    // 主题必须走**产品自己的开关**（设置 → 主题模式）：antd 的面板/文字颜色来自 React 主题状态，
    // 只改 <html data-theme> 会让 antd 停在上一套，出现「浅纸面 + 深色字」这种产品里不可达的组合
    // （2026-11-11 迁移到 antd 后实测：1.04:1）。
    const openSettings = `(function(){var b=document.querySelector('.side-foot .iconbtn[aria-label="打开设置"]'); if(b) b.click(); return !!b;})()`;
    const closeSettings = `(function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return true;})()`;
    for (const theme of ['dark', 'light'] as const) {
      await page.cdp.evaluate(openSettings);
      await page.cdp.waitFor("!!document.querySelector('.sp')", 5000);
      const label = theme === 'dark' ? '深色' : '浅色';
      const switched = await page.cdp.evaluate(`(function(){
        var seg = document.querySelector('.ant-segmented[aria-label="主题"]');
        if (!seg) return false;
        var hit = [].slice.call(seg.querySelectorAll('.ant-segmented-item')).filter(function(b){
          return (b.textContent || '').trim() === '${label}';
        })[0];
        if (!hit) return false;
        hit.click();
        return true;
      })()`);
      assert.strictEqual(switched, true, `设置里没有「主题模式」控件，无法切到 ${theme}`);
      await new Promise((r) => setTimeout(r, 250));
      seen.push({ label: `${theme} / 设置模态`, result: await scan(page.cdp, theme) });
      await page.cdp.evaluate(closeSettings);
      await new Promise((r) => setTimeout(r, 250));
      seen.push({ label: `${theme} / 空态`, result: await scan(page.cdp, theme) });
    }

    for (const s of seen) {
      assert.ok(s.result.passCount > 0, `${s.label}：axe 没有通过项 ⇒ 扫描没真正跑（假绿）`);
      const bad = s.result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      assert.deepStrictEqual(bad, [], report(bad, s.label));
    }
    const moderate = seen.flatMap((s) => s.result.violations.filter((v) => v.impact !== 'serious' && v.impact !== 'critical'));
    if (moderate.length > 0) {
      process.stdout.write(`[axe] 非阻断（moderate/minor）：${moderate.map((v) => v.id).join('、')}\n`);
    }
  } finally {
    await page.close();
  }
});
