// 右栏纯文本预览「填满面板」的判据（真机）。
//
// ## 用户报障（2026-11-08 截图）
//
// 打开 `TECH-UPGRADE-REPORT.md.bak`（扩展名不在语言表里 ⇒ 走纯文本分支）后，右栏正文只长到
// 七成视口高，下面留出一大块空白。`.file-content` 在 layout.css 里仍带着 `max-height:70vh`，
// 而 shell.css 的 `.file-pane .file-content`（flex:1）没有覆盖它 ⇒ flex 高度被 max-height 截断。
//
// ## 判据
//
// A. `.file-content` 底边必须贴住 `.rv-pane-body` 底边（只允许 2px 内间隙 + 1px 边框）；
// B. **正对照**：把 `max-height:70vh` 注回去后，间隙必须显著变大——否则这条判据只是量了个恒真值。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { openStubSession, stubHtmlCdp, type CdpSession } from './browserHarness.ts';

/** 与用户截图同档的桌面视口（1000 高 ⇒ 70vh ≈ 700，足以暴露截断）。 */
const VIEWPORT = { width: 1440, height: 1000 };

/** 桩页：文件树里放一份长纯文本（`.bak` ⇒ langOf 推不出语言 ⇒ 走 file-content 分支）。 */
function stubWithPlainFile(): string {
  const content = Array.from(
    { length: 120 },
    (_, i) => `第 ${String(i + 1)} 行：纯文本预览内容，用来验证面板纵向是否被填满。`,
  ).join('\n');
  const overrides = {
    'fs.list': {
      tree: [
        {
          name: 'web',
          path: 'web',
          type: 'dir',
          children: [{ name: 'NOTES.md.bak', path: 'web/NOTES.md.bak', type: 'file' }],
        },
      ],
    },
    'fs.read': {
      path: 'web/NOTES.md.bak',
      content,
      size: content.length,
      isBinary: false,
      truncated: false,
    },
  };
  return stubHtmlCdp().replace(
    '<div id="root"></div>',
    '<div id="root"></div>\n<script>window.__RPC_OVERRIDES__ = ' +
      JSON.stringify(overrides) +
      ';</script>',
  );
}

/** 一次几何测量（CSS 像素）。 */
interface Fill {
  readonly paneBottom: number;
  readonly preBottom: number;
  readonly preHeight: number;
}

/**
 * 读面板与正文的底边几何。
 * @param cdp CDP 会话
 * @returns 几何；节点不在时 null
 */
async function readFill(cdp: CdpSession): Promise<Fill | null> {
  const raw = (await cdp.evaluate(`(function(){
    var body = document.querySelector('.rv-pane-body');
    var pre = document.querySelector('.file-pane .file-content');
    if (!body || !pre) return null;
    var b = body.getBoundingClientRect(), p = pre.getBoundingClientRect();
    return { paneBottom: b.bottom, preBottom: p.bottom, preHeight: p.height };
  })()`)) as Fill | null;
  if (raw === null) return null;
  return {
    paneBottom: Math.round(raw.paneBottom * 10) / 10,
    preBottom: Math.round(raw.preBottom * 10) / 10,
    preHeight: Math.round(raw.preHeight * 10) / 10,
  };
}

/**
 * 打开文件面板里的 NOTES.md.bak（展开「文件」区块 → 展开 web → 点击文件）。
 * @param cdp CDP 会话
 * @returns 无
 */
async function openPlainFile(cdp: CdpSession): Promise<void> {
  await cdp.evaluate(`(function(){
    var hit=[].slice.call(document.querySelectorAll('.sec-toggle')).filter(function(b){ return (b.textContent||'').includes('文件'); })[0];
    if (hit) hit.click(); return true;
  })()`);
  assert.ok(
    await cdp.waitFor("!!document.querySelector('.tree [role=\\\"treeitem\\\"]')", 4000),
    '文件树没有渲染（判据失去意义）',
  );
  const clickTree = async (label: string): Promise<boolean> =>
    (await cdp.evaluate(`(function(){
      var items=[].slice.call(document.querySelectorAll('.tree [role="treeitem"]'));
      var f=items.filter(function(el){ return (el.textContent||'').trim().indexOf('${label}')===0; })[0];
      if (!f) return false;
      var w=f.querySelector('.ant-tree-node-content-wrapper'); (w||f).click(); return true;
    })()`)) === true;
  assert.strictEqual(await clickTree('web'), true, '展不开 web 目录');
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(await clickTree('NOTES.md.bak'), true, '打不开 NOTES.md.bak');
  assert.ok(
    await cdp.waitFor("!!document.querySelector('.file-pane .file-content')", 3000),
    '纯文本正文没有渲染',
  );
}

test(
  '右栏纯文本预览必须填满面板（附正对照：max-height:70vh 注回去必须变红）',
  { timeout: 120_000 },
  async (t) => {
    const page = await openStubSession(t, {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      html: stubWithPlainFile(),
    });
    if (page === null) return;
    try {
      const { cdp } = page;
      await openPlainFile(cdp);
      const fill = await readFill(cdp);
      assert.ok(fill !== null, '量不到面板几何');
      assert.ok(fill.preHeight > 300, `正文高度异常（${String(fill.preHeight)}px），判据可能失去意义`);
      assert.ok(
        fill.paneBottom - fill.preBottom <= 4,
        `纯文本正文没有填满面板：底边差 ${String(fill.paneBottom - fill.preBottom)}px`,
      );

      // ── 正对照：注回修复前的 max-height，间隙必须显著变大 ───────────────────
      await cdp.evaluate(`(function(){
        var s = document.createElement('style');
        s.id = 'legacy-file-content-max';
        s.textContent = '.file-pane .file-content{max-height:70vh !important;}';
        document.head.appendChild(s);
        return true;
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const broken = await readFill(cdp);
      assert.ok(broken !== null, '注入旧规则后量不到几何');
      assert.ok(
        broken.paneBottom - broken.preBottom > 60,
        '正对照失败：注回 max-height:70vh 后间隙仍然很小（判据恒真）',
      );
      await cdp.evaluate("document.getElementById('legacy-file-content-max').remove(); true");
    } finally {
      await page.close();
    }
  },
);
