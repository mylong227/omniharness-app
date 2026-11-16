// 上下文注记卡（压缩游标 / 工作流记忆 / 长注记）真浏览器验证。
//
// 背景（2026-11-16 用户截图反馈）：压缩游标带 `evidence=` 时旧正则失配，整条事件回落到
// `— 全文 —` 平铺：几 KB 的 base64 + 数千字摘要糊满一屏；工作流记忆召回是一行上千字的
// `→ shell … → read_file …`。用户的要求是「可收起、可展开，展开后是有格式的预览」。
//
// 本判据钉住四条：
//   1) 三类注记在对话流里**默认收起**（标题 + 元信息 + 一行摘要），短旁白仍是一行 sysnote；
//   2) 展开后压缩摘要是**分节 Markdown**，且证据 base64 **绝不出现在正文里**；记忆召回是逐条步骤；
//   3) 收起=正文卸载（长会话里不白挂几万字），`aria-expanded` / `aria-controls` 与真实状态一致；
//   4) 键盘可达：聚焦卡头按空格即可开合（事件钻取不会跟着触发）。
//
// 直跑（先 npm run web:build）：node --test web/test/systemNoteCard.test.ts
// 截图默认落 `.workbuddy/`（不入库），可用 OMNI_SYSTEM_NOTE_SHOT 覆盖。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { test } from 'vitest';
import { openStubSession } from './browserHarness.ts';
import type { CdpSession } from './browserHarness.ts';

/** 压缩证据（与内核 alpha.21 同形的 base64url JSON）。 */
const EVIDENCE = Buffer.from(
  JSON.stringify({
    audit: { ok: true, missing: [], checked: { editedFiles: 3, commands: 12, openTodos: 2 } },
    signals: { budgetRatio: 0.82, turns: 17, toolResultShare: 0.46, repetitionRate: 0.09, combinedWouldTrigger: true },
  }),
  'utf8',
).toString('base64url');

/** 压缩游标事件（header + 内核同构摘要：结构标签 + 工具台账，够长到触发正文内部滚动）。 */
const COMPACTION = [
  `OMNI_COMPACTION_V1 upTo=355 hash=5e8c42c7 evidence=${EVIDENCE}`,
  '【任务目标（用户原始请求）】',
  '现在盘点当前项目信息 ---- 将存在的问题进行修改。核对前端调用的端点与后端实际路由是否一一对应，',
  '统计各路由文件的端点数，并核对残留文件情况。',
  '',
  '【历史经过】',
  '- 构建产物已按页面拆分，下面继续统计各路由文件的端点数，并按页面拆分逐项核对。',
  '- git log 的格式化命令在 cmd 下解析失败，因此改用简单形式重新尝试。',
  '- 逐项对比前端调用点与后端注册表：6 条 API 调用在后端并不存在，会落到 404 兜底。',
  '',
  '【关键结论】',
  '- 前端 6 条调用指向不存在的路由；后端 2 条路由无人调用（孤儿路由）。',
  '- 已按「完成一半成品」处理并在输出中声明，未擅自删除孤儿路由。',
  '',
  '## 已执行工具台账（确定性生成，用于避免重复探索）',
  ...Array.from({ length: 24 }, (_, i) => `- shell npm run check --step-${i + 1} ×${i + 1}`),
].join('\n');

/** 工作流记忆召回：内核真实形态（单行 + `→` 串）。 */
const MEMORY =
  '[WorkflowMemory] 相似任务曾成功走完以下步骤（仅参考，不自动重放）：' +
  '→ shell cd /d %CD% && dir /b → read_file package.json → scratchpad';

/** 短旁白（应保持一行 sysnote 渲染）。 */
const SHORT_NOTE = '系统提示：本回合的压缩与记忆内容已按折叠卡收纳，点击卡头展开。';

/**
 * 往空会话里推一轮「用户消息 + 一条压缩游标 + 一条工作流记忆 + 一句旁白」。
 * @param cdp CDP 会话
 * @returns 无
 */
async function seedThread(cdp: CdpSession): Promise<void> {
  await cdp.evaluate(`(function(){
    var push = window.__PUSH__;
    var n = 0;
    var base = Date.now();
    var ev = function(type, payload) {
      var i = n++;
      push({ method: 'thread.event', params: { event: { id: 'e' + i, type: type, timestamp: base + i * 1000, payload: payload } } });
    };
    ev('user', { content: '继续检查，并进行修复' });
    ev('system', { content: ${JSON.stringify(COMPACTION)} });
    ev('system', { content: ${JSON.stringify(MEMORY)} });
    ev('system', { content: ${JSON.stringify(SHORT_NOTE)} });
    return true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 900));
}

test('上下文注记卡：默认收起、展开是排好版的预览、键盘可开合（真浏览器）', async (t) => {
  const opened = await openStubSession(t, { width: 1180, height: 860 });
  if (!opened) return;
  const { cdp, close } = opened;
  try {
    await seedThread(cdp);

    const collapsed = (await cdp.evaluate(`(function(){
      var cards = document.querySelectorAll('.ctx-note');
      if (cards.length < 2) return { cards: cards.length };
      var head = function(card) { return card.querySelector('.ctx-note__head'); };
      var text = function(card, sel) {
        var el = card.querySelector(sel);
        return el ? el.textContent : '';
      };
      return {
        cards: cards.length,
        plainNotes: document.querySelectorAll('.sysnote').length,
        compactTitle: text(cards[0], '.ctx-note__title'),
        compactMeta: text(cards[0], '.ctx-note__meta'),
        compactExcerpt: text(cards[0], '.ctx-note__excerpt'),
        compactExpanded: head(cards[0]).getAttribute('aria-expanded'),
        compactBodyMounted: cards[0].querySelectorAll('.ctx-note__body').length,
        ariaControls: head(cards[0]).getAttribute('aria-controls'),
        memoryTitle: text(cards[1], '.ctx-note__title'),
        memoryMeta: text(cards[1], '.ctx-note__meta'),
        memoryExcerpt: text(cards[1], '.ctx-note__excerpt'),
      };
    })()`)) as Record<string, unknown>;
    assert.strictEqual(collapsed['cards'], 2, '压缩游标 + 工作流记忆各一张卡');
    assert.strictEqual(collapsed['plainNotes'], 1, '短旁白仍走一行 sysnote，不该变成卡');
    assert.strictEqual(collapsed['compactTitle'], '上下文已压缩');
    assert.match(String(collapsed['compactMeta']), /游标 355 · 摘要约/u);
    assert.strictEqual(
      collapsed['compactExcerpt'],
      '现在盘点当前项目信息 ---- 将存在的问题进行修改。核对前端调用的端点与后端实际路由是否一一对应，',
      '收起态摘要取结构标签之后的正文（不念【任务目标】）',
    );
    assert.strictEqual(collapsed['compactExpanded'], 'false', '默认收起');
    assert.strictEqual(collapsed['compactBodyMounted'], 0, '收起态正文不挂 DOM');
    assert.strictEqual(collapsed['ariaControls'], null, '正文不在 DOM 时不给 aria-controls 指向空 id');
    assert.strictEqual(collapsed['memoryTitle'], '工作流记忆参考');
    assert.strictEqual(collapsed['memoryMeta'], '3 步 · 仅作参考');
    assert.strictEqual(collapsed['memoryExcerpt'], '相似任务曾成功走完以下步骤（仅参考，不自动重放）');

    // 截图留档的公共路径（`-dark` / `-light` / `-light-collapsed` … 由 suffix 拼出）。
    const baseShot = process.env.OMNI_SYSTEM_NOTE_SHOT || '.workbuddy/system-note-card.png';
    const shotOf = (suffix: string): string => baseShot.replace(/\.png$/u, suffix + '.png');
    mkdirSync(dirname(baseShot), { recursive: true });

    // —— 展开压缩卡：分节 Markdown + 证据 chip，且证据 base64 绝不出现在正文 ——
    await cdp.click('.ctx-note__head');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const expanded = (await cdp.evaluate(`(function(){
      var card = document.querySelectorAll('.ctx-note')[0];
      var body = card.querySelector('.ctx-note__body');
      if (!body) return { mounted: false };
      var doc = body.querySelector('.md-content');
      var text = doc ? doc.textContent : '';
      var style = getComputedStyle(body);
      return {
        mounted: true,
        expanded: card.querySelector('.ctx-note__head').getAttribute('aria-expanded'),
        excerptGone: card.querySelectorAll('.ctx-note__excerpt').length,
        sections: Array.from(body.querySelectorAll('h4')).map(function(e){ return e.textContent; }),
        chips: Array.from(body.querySelectorAll('.ctx-note__chip')).map(function(e){ return e.textContent; }),
        ledgerHeading: body.querySelector('h2') ? body.querySelector('h2').textContent : '',
        leakedEvidence: text.indexOf('evidence=') >= 0 || text.indexOf(${JSON.stringify(EVIDENCE.slice(0, 40))}) >= 0,
        scrolls: body.scrollHeight > body.clientHeight,
        bodyIdMatches: body.id === card.querySelector('.ctx-note__head').getAttribute('aria-controls'),
      };
    })()`)) as Record<string, unknown>;
    assert.strictEqual(expanded['mounted'], true, '展开后正文挂载');
    assert.strictEqual(expanded['expanded'], 'true');
    assert.strictEqual(expanded['excerptGone'], 0, '展开后不再重复显示摘要行');
    assert.deepEqual(
      expanded['sections'],
      ['【任务目标（用户原始请求）】', '【历史经过】', '【关键结论】'],
      '结构标签升为分节标题',
    );
    assert.strictEqual(
      expanded['ledgerHeading'],
      '已执行工具台账（确定性生成，用于避免重复探索）',
      '既有 Markdown 标题保持原样',
    );
    assert.deepEqual(expanded['chips'], ['审计 ✓ 文件 3 · 命令 12 · 待办 2', '触发预算 82% · 17 轮']);
    assert.strictEqual(expanded['leakedEvidence'], false, '证据 base64 只能进 chip，绝不进正文');
    assert.strictEqual(expanded['scrolls'], true, '长摘要在正文内部滚动，不把对话顶出几屏');
    assert.strictEqual(expanded['bodyIdMatches'], true, 'aria-controls 指向真实正文节点');

    // —— 键盘：聚焦卡头按空格收起，再按空格展开 ——
    // 判据用空格：它是 `<button>` 的标准激活键。Enter 在 CDP 的 `keyDown`（不带 text）路径下
    // 连裸 `<button>` 都不触发激活（已用基线探针验证是 harness 限制，与组件无关），故不拿它当判据。
    await cdp.evaluate("document.querySelectorAll('.ctx-note__head')[0].focus()");
    await cdp.press(' ', { keyCode: 32, code: 'Space' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const afterCollapseKey = (await cdp.evaluate(
      "(function(){ return document.querySelectorAll('.ctx-note')[0].querySelectorAll('.ctx-note__body').length; })()",
    )) as number;
    assert.strictEqual(afterCollapseKey, 0, '键盘收起：正文卸载');
    await cdp.evaluate("document.querySelectorAll('.ctx-note__head')[0].focus()");
    await cdp.press(' ', { keyCode: 32, code: 'Space' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const afterExpandKey = (await cdp.evaluate(
      "(function(){ return document.querySelectorAll('.ctx-note')[0].querySelectorAll('.ctx-note__body').length; })()",
    )) as number;
    assert.strictEqual(afterExpandKey, 1, '键盘可再次展开');

    // —— 展开记忆卡：步骤逐条编号，工具名与目标分开 ——
    await cdp.evaluate("document.querySelectorAll('.ctx-note__head')[1].click()");
    await new Promise((resolve) => setTimeout(resolve, 250));
    const memory = (await cdp.evaluate(`(function(){
      var card = document.querySelectorAll('.ctx-note')[1];
      var items = card.querySelectorAll('.ctx-steps .ctx-step');
      return {
        steps: items.length,
        firstVerb: items[0] ? items[0].querySelector('.ctx-step__verb').textContent : '',
        firstTarget: items[0] ? items[0].querySelector('.ctx-step__target').textContent : '',
        noArrow: card.querySelector('.ctx-note__body').textContent.indexOf('→') < 0,
      };
    })()`)) as Record<string, unknown>;
    assert.strictEqual(memory['steps'], 3, '逐步列出，不再是一串 →');
    assert.strictEqual(memory['firstVerb'], 'shell');
    assert.strictEqual(memory['firstTarget'], 'cd /d %CD% && dir /b');
    assert.strictEqual(memory['noArrow'], true, '正文里不应再残留箭头分隔符');

    // —— 两种主题各留一屏：收起态 + 展开态 ——
    // 主题必须**经真实偏好重载**再截图：直改 `<html data-theme>` 会被应用状态在下一帧覆盖，
    // 而"跟随系统"在 headless 里的取值随环境变（同一台机器两次跑可以一暗一亮），截图不能碰运气。
    for (const theme of ['dark', 'light'] as const) {
      await reopenWithTheme(cdp, theme);
      await cdp.screenshot(shotOf(`-${theme}-collapsed`));
      await cdp.click('.ctx-note__head');
      await new Promise((resolve) => setTimeout(resolve, 250));
      await cdp.screenshot(shotOf(`-${theme}`));
      if (theme === 'dark') {
        // 记忆召回展开态（逐条步骤）只留一屏暗色即可：亮色下它用的仍是同一套 surface token。
        await cdp.click('.ctx-note__head');
        await cdp.evaluate("document.querySelectorAll('.ctx-note__head')[1].click()");
        await new Promise((resolve) => setTimeout(resolve, 250));
        await cdp.screenshot(shotOf('-dark-steps'));
      }
    }
  } finally {
    await close();
  }
});

/**
 * 以指定主题重载同一页，并推回同一轮事件（供截图复核用）。
 * @param cdp CDP 会话
 * @param theme 目标主题
 * @returns 无
 */
async function reopenWithTheme(cdp: CdpSession, theme: 'dark' | 'light'): Promise<void> {
  const url = String(await cdp.evaluate('document.URL'));
  await cdp.evaluate(`localStorage.setItem('omni-theme', ${JSON.stringify(theme)})`);
  await cdp.navigate(url);
  await cdp.waitMounted();
  await seedThread(cdp);
  const actual = await cdp.evaluate("document.documentElement.getAttribute('data-theme')");
  if (actual !== theme) {
    throw new Error(`主题未落到 <html data-theme>：期望 ${theme}，实际 ${String(actual)}（截图会是错的）`);
  }
}

test('上下文注记卡：窄窗 390 不横向溢出，元信息让位给标题与开合入口（真浏览器）', async (t) => {
  const opened = await openStubSession(t, { width: 390, height: 780 });
  if (!opened) return;
  const { cdp, close } = opened;
  try {
    await seedThread(cdp);
    const probe = (await cdp.evaluate(`(function(){
      var card = document.querySelector('.ctx-note');
      if (!card) return { cards: 0 };
      var head = card.querySelector('.ctx-note__head');
      var meta = card.querySelector('.ctx-note__meta');
      var toggle = card.querySelector('.ctx-note__toggle');
      var doc = document.documentElement;
      return {
        cards: document.querySelectorAll('.ctx-note').length,
        headOverflow: head.scrollWidth > head.clientWidth + 1,
        docOverflow: doc.scrollWidth > doc.clientWidth,
        metaHidden: meta ? getComputedStyle(meta).display === 'none' : true,
        toggleWidth: toggle ? Math.round(toggle.getBoundingClientRect().width) : 0,
      };
    })()`)) as Record<string, unknown>;
    assert.strictEqual(probe['cards'], 2, '窄窗下两张卡都在');
    assert.strictEqual(probe['headOverflow'], false, '卡头不得横向溢出（元信息该让位）');
    assert.strictEqual(probe['docOverflow'], false, '页面不得被卡片撑出横向滚动');
    assert.strictEqual(probe['metaHidden'], true, '≤560px 隐藏元信息，避免被截成「摘要约 138…」');
    assert.ok(Number(probe['toggleWidth']) > 0, '开合入口在窄窗仍可见');
  } finally {
    await close();
  }
});
