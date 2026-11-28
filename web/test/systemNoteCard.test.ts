// 上下文注入注（压缩游标 / 工作流记忆 / 长注记）真浏览器验证。
//
// 背景（2026-11-16 用户截图反馈）：压缩游标带 `evidence=` 时旧正则失配，整条事件回落到
// `— 全文 —` 平铺：几 KB 的 base64 + 数千字摘要糊满一屏；工作流记忆召回是一行上千字的
// `→ shell … → read_file …`。当时的要求是「可收起、可展开，展开后是有格式的预览」。
//
// 2026-11-27/28 用户口径（再收敛）：**压缩游标与工作流记忆都降为单行注入注**——无展开、
// 无卡片底、背景与对话流一致（内容写给模型看，人看标题 + 元信息就够；压缩详情在
// 「上下文」面板的压缩时间线里仍有完整呈现）。卡片壳只留给长注记（plain）。
//
// 本判据钉住三条：
//   1) 压缩游标与工作流记忆各是一行 `.ctx-inline--*` 注（透明背景、无开合、正文/证据不进 DOM）；
//   2) 短旁白仍是一行 sysnote；长注记（plain）仍是可展开卡（不在本 fixture，单测覆盖）；
//   3) 窄窗 390 不横向溢出。
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

/** 压缩游标事件（header + 内核同构摘要：结构标签 + 工具台账）。 */
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
const SHORT_NOTE = '系统提示：本轮的压缩与记忆内容已按单行注收纳。';

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
      push({ method: 'thread.event', params: { event: { id: 'e' + i, sessionId: 's1', type: type, timestamp: base + i * 1000, payload: payload } } });
    };
    ev('user', { content: '继续检查，并进行修复' });
    ev('system', { content: ${JSON.stringify(COMPACTION)} });
    ev('system', { content: ${JSON.stringify(MEMORY)} });
    ev('system', { content: ${JSON.stringify(SHORT_NOTE)} });
    return true;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 900));
}

test('注入注：压缩游标与工作流记忆各一行（无展开、透明背景、证据不进 DOM）（真浏览器）', async (t) => {
  const opened = await openStubSession(t, { width: 1180, height: 860 });
  if (!opened) return;
  const { cdp, close } = opened;
  try {
    await seedThread(cdp);
    // 带 sessionId 的事件会认领 currentThreadId（多一拍重渲染）；判定渲染正确性而非时序，
    // 显式等到两张注都在再探针。
    await cdp.waitFor("!!document.querySelector('.ctx-inline--compaction') && !!document.querySelector('.ctx-inline--memory')", 4000);

    const probe = (await cdp.evaluate(`(function(){
      var inlineOf = function(kind) { return document.querySelector('.ctx-inline--' + kind); };
      var text = function(root, sel) {
        var el = root.querySelector(sel);
        return el ? el.textContent : '';
      };
      var compaction = inlineOf('compaction');
      var memory = inlineOf('memory');
      var doc = document.documentElement;
      return {
        cards: document.querySelectorAll('.ctx-note').length,
        plainNotes: document.querySelectorAll('.sysnote').length,
        quoteBtns: document.querySelectorAll('button[aria-label="引用追问"]').length,
        compactionPresent: compaction !== null,
        compactionTitle: compaction ? text(compaction, '.ctx-inline__title') : '',
        compactionMeta: compaction ? text(compaction, '.ctx-inline__meta') : '',
        compactionExcerpt: compaction ? compaction.querySelectorAll('.ctx-inline__text').length : -1,
        compactionBg: compaction ? getComputedStyle(compaction).backgroundColor : '',
        compactionToggle: compaction ? compaction.querySelectorAll('.ctx-note__toggle, .ctx-note__body').length : -1,
        compactionSteps: compaction ? compaction.querySelectorAll('.ctx-steps, .ctx-step, .md-content').length : -1,
        compactionJump: compaction ? compaction.querySelectorAll('button.ctx-inline__jump').length : -1,
        memoryPresent: memory !== null,
        memoryTitle: memory ? text(memory, '.ctx-inline__title') : '',
        memoryMeta: memory ? text(memory, '.ctx-inline__meta') : '',
        memoryExcerpt: memory ? text(memory, '.ctx-inline__text') : '',
        memoryBg: memory ? getComputedStyle(memory).backgroundColor : '',
        memoryToggle: memory ? memory.querySelectorAll('.ctx-note__toggle, button, .ctx-note__body').length : -1,
        docOverflow: doc.scrollWidth > doc.clientWidth,
        leakedEvidence: document.body.textContent.indexOf('evidence=') >= 0
          || document.body.textContent.indexOf(${JSON.stringify(EVIDENCE.slice(0, 40))}) >= 0,
        leakedLedger: document.body.textContent.indexOf('已执行工具台账') >= 0,
      };
    })()`)) as Record<string, unknown>;
    const dump = String(await cdp.evaluate(`(function(){
      var out = [];
      var els = document.querySelectorAll('.ctx-inline, .ctx-note, .sysnote');
      for (var i = 0; i < els.length; i++) out.push(els[i].className + ' :: ' + (els[i].textContent || '').slice(0, 50));
      var k = [];
      var b = document.querySelectorAll('.sw-block');
      for (var j = 0; j < b.length; j++) k.push(b[j].getAttribute('data-sw-key'));
      return out.join(' || ') + ' #KEYS# ' + k.join(',');
    })()`));
    console.log('DUMP:', dump);
    assert.strictEqual(probe['cards'], 0, '压缩与记忆都不再是卡（卡片壳只留给长注记）');
    assert.strictEqual(probe['plainNotes'], 1, '短旁白仍走一行 sysnote');
    assert.ok(Number(probe['quoteBtns']) >= 1, '引用追问入口已挂到用户卡（msg-act，与复制/重开同排）');

    // —— 压缩游标：一行完成信号 ——
    assert.ok(probe['compactionPresent'], '压缩游标渲染为 .ctx-inline--compaction 单行注');
    assert.strictEqual(probe['compactionTitle'], '上下文压缩✔', '✔ 表达压缩完成');
    assert.match(String(probe['compactionMeta']), /游标 355 · 摘要约/u, '元信息带游标与摘要字数');
    assert.strictEqual(probe['compactionExcerpt'], 0, '压缩单行注不带摘要预览行');
    assert.strictEqual(probe['compactionBg'], 'rgba(0, 0, 0, 0)', '背景与对话流一致（无卡片底）');
    assert.strictEqual(probe['compactionToggle'], 0, '无开合入口、无正文容器（详情在上下文面板，不重建');
    assert.strictEqual(probe['compactionJump'], 1, '有且只有一个「压缩详情」跳转按钮');

    // —— 压缩注跳转：点击后路由落到上下文面板（详情的家，不重建） ——
    await cdp.click('button.ctx-inline__jump');
    await new Promise((resolve) => setTimeout(resolve, 400));
    const jump = String(await cdp.evaluate('location.hash'));
    assert.ok(jump.indexOf('pane=control') >= 0, '路由 pane=control：' + jump);
    assert.ok(jump.indexOf('view=context') >= 0, '路由 view=context：' + jump);
    // 回到对话视图（hash 已变，推事件即可继续截图流程）
    await cdp.evaluate("location.hash = '#pane=tools'");
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.strictEqual(probe['compactionSteps'], 0, '分节 Markdown / 台账不渲染');

    // —— 工作流记忆：一行 + 引导语 ——
    assert.ok(probe['memoryPresent'], '记忆召回渲染为 .ctx-inline--memory 单行注');
    assert.strictEqual(probe['memoryTitle'], '工作流记忆参考');
    assert.strictEqual(probe['memoryMeta'], '3 步 · 仅作参考');
    assert.strictEqual(probe['memoryExcerpt'], '相似任务曾成功走完以下步骤（仅参考，不自动重放）');
    assert.strictEqual(probe['memoryBg'], 'rgba(0, 0, 0, 0)', '背景与对话流一致（无卡片底）');
    assert.strictEqual(probe['memoryToggle'], 0, '无开合入口、无正文容器');

    // —— 收敛后的硬承诺：展开体没了，证据与摘要正文在对话流中完全不可见 ——
    assert.strictEqual(probe['leakedEvidence'], false, '证据 base64 绝不进 DOM');
    assert.strictEqual(probe['leakedLedger'], false, '工具台账/分节摘要不进 DOM');
    assert.strictEqual(probe['docOverflow'], false, '页面不得被撑出横向滚动');

    // —— 两种主题各留一屏（收起即全部，无展开态可截） ——
    // 主题必须**经真实偏好重载**再截图：直改 `<html data-theme>` 会被应用状态在下一帧覆盖，
    // 而"跟随系统"在 headless 里的取值随环境变（同一台机器两次跑可以一暗一亮），截图不能碰运气。
    const baseShot = process.env.OMNI_SYSTEM_NOTE_SHOT || '.workbuddy/system-note-card.png';
    const shotOf = (suffix: string): string => baseShot.replace(/\.png$/u, suffix + '.png');
    mkdirSync(dirname(baseShot), { recursive: true });
    for (const theme of ['dark', 'light'] as const) {
      await reopenWithTheme(cdp, theme);
      await cdp.screenshot(shotOf(`-${theme}`));
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
  // 显式 reload（不靠 URL 差异触发）：本判据中途回写过 hash，navigate 同址会变成同文档
  // 导航（不重载）⇒ data-theme 保持 boot 时的 system 值，截图主题就错了（2026-11-28 实测）。
  await cdp.evaluate(`localStorage.setItem('omni-theme', ${JSON.stringify(theme)})`);
  await cdp.evaluate('location.reload()');
  await cdp.waitMounted();
  await seedThread(cdp);
  const actual = await cdp.evaluate("document.documentElement.getAttribute('data-theme')");
  if (actual !== theme) {
    throw new Error(`主题未落到 <html data-theme>：期望 ${theme}，实际 ${String(actual)}（截图会是错的）`);
  }
}

test('注入注：窄窗 390 不横向溢出，单行注不折行不撑高（真浏览器）', async (t) => {
  const opened = await openStubSession(t, { width: 390, height: 780 });
  if (!opened) return;
  const { cdp, close } = opened;
  try {
    await seedThread(cdp);
    const probe = (await cdp.evaluate(`(function(){
      var inlineOf = function(kind) { return document.querySelector('.ctx-inline--' + kind); };
      var doc = document.documentElement;
      return {
        compaction: inlineOf('compaction') !== null,
        memory: inlineOf('memory') !== null,
        docOverflow: doc.scrollWidth > doc.clientWidth,
        compactionHeight: inlineOf('compaction') ? Math.round(inlineOf('compaction').getBoundingClientRect().height) : 0,
        memoryHeight: inlineOf('memory') ? Math.round(inlineOf('memory').getBoundingClientRect().height) : 0,
      };
    })()`)) as Record<string, unknown>;
    assert.strictEqual(probe['compaction'], true, '窄窗下压缩单行注在');
    assert.strictEqual(probe['memory'], true, '窄窗下记忆单行注在');
    assert.strictEqual(probe['docOverflow'], false, '页面不得被撑出横向滚动');
    assert.ok(Number(probe['compactionHeight']) <= 24, '压缩注单行高（≤24px，不折行）');
    assert.ok(Number(probe['memoryHeight']) <= 24, '记忆注单行高（≤24px，不折行）');
  } finally {
    await close();
  }
});
