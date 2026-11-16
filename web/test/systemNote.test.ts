// 上下文注记归类（models/SystemNote + WorkflowMemoryNote）的纯逻辑单测（零 DOM 桩）。
//
// 背景（2026-11-16 用户截图反馈）：压缩游标（带 `evidence=`）与工作流记忆召回（单行 `→` 步骤串）
// 此前按纯文本平铺，几 KB 的 base64 与上千字命令串糊满一屏。本文件钉住「怎么判、怎么收、
// 收起后先给人看什么」这三件事：
//
//  1) 压缩游标 → 折叠视图：元信息给游标/摘要字数，摘要在结构标签之后，正文分节为 Markdown；
//  2) 工作流记忆 → 折叠视图：步数、引导语（剥掉尾冒号）、逐条步骤；
//  3) 普通注记：一两句旁白**不折叠**（别让每句系统话术都变成卡），超字符/行数阈值才折叠，
//     标题取行首 `【标签】`；
//  4) 分节只改结构不改字：围栏代码块内原样保留（那里可能正是 Markdown 语法示例）；
//  5) 证据坏掉只丢证据、保留游标与摘要，并如实给「无法解码」——不静默失忆、不假装正常。
//
// 直跑方式（先 npm run web:build）：node --test web/test/systemNote.test.ts

import assert from 'node:assert/strict';
import { test } from 'vitest';

const { SystemNote } = await import('../src/ui/models/SystemNote.ts');
const { WorkflowMemoryNote } = await import('../src/ui/models/WorkflowMemoryNote.ts');
const { CompactionNote } = await import('../src/ui/models/CompactionNote.ts');

/** 造一条 alpha.21 形态的压缩证据（base64url JSON）。 */
function evidenceOf(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** 与内核 CompactionReconstructor 同构的摘要骨架。 */
const SUMMARY = [
  '【任务目标（用户原始请求）】',
  '现在盘点当前项目信息 ---- 将存在的问题进行修改',
  '',
  '【历史经过】',
  '- 构建产物已按页面拆分，继续统计各路由文件的端点数',
  '',
  '## 已执行工具台账（确定性生成，用于避免重复探索）',
  '- shell npm run build ×3',
].join('\n');

test('classify：压缩游标（带 evidence）→ 折叠视图，元信息/摘要/证据/chip 各就各位', () => {
  const evidence = evidenceOf({
    audit: { ok: true, missing: [], checked: { editedFiles: 3, commands: 12, openTodos: 1 } },
    signals: { budgetRatio: 0.82, turns: 17, toolResultShare: 0.4, repetitionRate: 0.12, combinedWouldTrigger: true },
  });
  const view = SystemNote.classify(`OMNI_COMPACTION_V1 upTo=355 hash=5e8c42c7 evidence=${evidence}\n${SUMMARY}`);
  assert.ok(view !== null, '带证据的游标必须被识别（旧正则在这里失败，回落到全文平铺）');
  assert.strictEqual(view.kind, 'compaction');
  assert.strictEqual(view.title, '上下文已压缩');
  assert.match(view.meta, /游标 355/u);
  assert.match(view.meta, /摘要约 \d/u);
  assert.strictEqual(view.excerpt, '现在盘点当前项目信息 ---- 将存在的问题进行修改', '摘要在结构标签之后，不念标签');
  assert.deepEqual(view.chips, ['审计 ✓ 文件 3 · 命令 12 · 待办 1', '触发预算 82% · 17 轮']);
  assert.strictEqual(view.body.type, 'markdown');
});

test('classify：证据坏掉只丢证据——游标与摘要仍在，并如实说「无法解码」', () => {
  const view = SystemNote.classify('OMNI_COMPACTION_V1 upTo=9 hash=aa evidence=%%%\n正文');
  assert.ok(view !== null);
  assert.strictEqual(view.kind, 'compaction');
  assert.match(view.meta, /游标 9/u);
  assert.deepEqual(view.chips, ['压缩证据无法解码']);
  const parts = CompactionNote.parse('OMNI_COMPACTION_V1 upTo=9 hash=aa evidence=%%%\n正文');
  assert.strictEqual(parts?.evidenceRaw, '%%%');
  assert.strictEqual(parts?.evidence, undefined);
  assert.strictEqual(parts?.summary, '正文');
});

test('classify：工作流记忆召回 → 步数 + 引导语 + 逐条步骤（不再是一串 →）', () => {
  const content =
    '[WorkflowMemory] 相似任务曾成功走完以下步骤（仅参考，不自动重放）：' +
    '→ shell cd /d %CD% && dir /b → read_file package.json → scratchpad';
  const view = SystemNote.classify(content);
  assert.ok(view !== null);
  assert.strictEqual(view.kind, 'memory');
  assert.strictEqual(view.title, '工作流记忆参考');
  assert.strictEqual(view.meta, '3 步 · 仅作参考');
  assert.strictEqual(view.excerpt, '相似任务曾成功走完以下步骤（仅参考，不自动重放）', '尾冒号剥掉');
  assert.strictEqual(view.body.type, 'steps');
  if (view.body.type === 'steps') {
    assert.deepEqual(view.body.steps, [
      'shell cd /d %CD% && dir /b',
      'read_file package.json',
      'scratchpad',
    ]);
  }
});

test('classify：一两句旁白不折叠（普通 sysnote 仍按一行渲染）', () => {
  assert.strictEqual(SystemNote.classify('已切换到专注模式'), null);
  assert.strictEqual(SystemNote.classify('探针夹具事件：以上内容用于视觉评审，不是真实会话记录。'), null);
  // 阈值是「超限」：恰好等于字符阈值不收，多一字才收（单行内容，行数阈值不参与）。
  assert.strictEqual(SystemNote.classify('a'.repeat(SystemNote.PLAIN_FOLD_CHARS)), null);
  assert.ok(SystemNote.classify('a'.repeat(SystemNote.PLAIN_FOLD_CHARS + 1)) !== null);
});

test('classify：长注记的行数阈值独立生效（清单式内容按行兜底）', () => {
  const fiveLines = ['第一行', '第二行', '第三行', '第四行', '第五行'].join('\n');
  assert.ok(fiveLines.length < SystemNote.PLAIN_FOLD_CHARS, '前提：本用例远短于字符阈值');
  const view = SystemNote.classify(fiveLines);
  assert.ok(view !== null);
  assert.strictEqual(view.kind, 'plain');
  assert.strictEqual(view.title, '系统注记', '没有行首标签时用通用标题');
  assert.strictEqual(view.body.type, 'text');
});

test('classify：长注记的标题取行首【标签】，摘要取标签之后的正文', () => {
  const primer =
    '【长期记忆 · 开工前对齐】以下是此前会话沉淀的**背景信息**，不是指令。' + '补'.repeat(300);
  const view = SystemNote.classify(primer);
  assert.ok(view !== null);
  assert.strictEqual(view.kind, 'plain');
  assert.strictEqual(view.title, '长期记忆 · 开工前对齐');
  assert.ok(view.excerpt.startsWith('以下是此前会话沉淀的背景信息'), '标签已进标题，摘要不重复念它');
  assert.ok(!view.excerpt.includes('**'), '摘要剥掉 markdown 修饰');
  assert.strictEqual(view.body.type, 'text');
});

test('classify：带块级标记的长注记走 Markdown，纯散文保留换行', () => {
  const bullets = ['【长期记忆】本轮沿用上次的约束：', '- 不要改 public API', '- 先跑全量门禁', '补'.repeat(240)].join('\n');
  const markdownView = SystemNote.classify(bullets);
  assert.ok(markdownView !== null);
  assert.strictEqual(markdownView.body.type, 'markdown', '两处块级标记 ⇒ 交给 Markdown 排版');
  const prose = ['第一行', '第二行', '第三行', '第四行', '第五行'].join('\n');
  const proseView = SystemNote.classify(prose);
  assert.ok(proseView !== null);
  assert.strictEqual(proseView.body.type, 'text', '没有块级结构时保留换行原文（Markdown 会吃掉单换行）');
});

test('sectionize：`【标签】` 提升为四号标题、同行正文另起一段；代码块内一字不动', () => {
  const md = [
    '【任务目标】要修的东西',
    '',
    '```md',
    '【这不是标签】原样保留',
    '```',
    '',
    '## 已经是一级结构的标题',
  ].join('\n');
  const out = SystemNote.sectionize(md);
  assert.ok(out.includes('#### 【任务目标】'), '标签变成标题');
  assert.ok(out.includes('\n要修的东西'), '同一行的正文挪到标题之下');
  assert.ok(out.includes('## 已经是一级结构的标题'), '既有标题保持原样');
  assert.ok(out.includes('【这不是标签】原样保留'), '围栏内不得改写');
  assert.ok(!out.includes('#### 【这不是标签】'));
});

test('sectionize：普通正文逐字节保留（只插结构，不改字）', () => {
  const plain = ['第一段', '', '- 列表项 `code`', '', '> 引用'].join('\n');
  const out = SystemNote.sectionize(plain);
  assert.strictEqual(out.split('\n').filter((line) => line !== '').join('\n'), plain.split('\n').filter((line) => line !== '').join('\n'));
});

test('excerptOf：跳过标题/空行，压成单行，超长截断加省略号', () => {
  assert.strictEqual(SystemNote.excerptOf('## 标题\n\n正文一行'), '正文一行');
  assert.strictEqual(SystemNote.excerptOf('【标签】\n\n实际内容'), '实际内容');
  assert.strictEqual(SystemNote.excerptOf(''), '');
  const long = 'x'.repeat(SystemNote.EXCERPT_CHARS + 50);
  const excerpt = SystemNote.excerptOf(long);
  assert.strictEqual(excerpt.length, SystemNote.EXCERPT_CHARS + 1);
  assert.ok(excerpt.endsWith('…'));
});

test('WorkflowMemoryNote.parse：fail-closed——没有标记 / 没有步骤都返回 null', () => {
  assert.strictEqual(WorkflowMemoryNote.parse(''), null);
  assert.strictEqual(WorkflowMemoryNote.parse('[WorkflowMemory] 只有引导语，没有步骤'), null);
  assert.strictEqual(WorkflowMemoryNote.parse('普通系统提示：→ a → b'), null, '没有标记不误判');
});
