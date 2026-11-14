// 厂商页重设计判据（2026-11-14，docs/design/provider-settings-redesign 方案 A）：
// ① 首字徽标切词；② 总览网格 + 单一状态档 + 「当前」单命中（activeId 真源）；
// ③ 点卡开抽屉 → 「保存并检测」链路（setProviderKey + probeModels 都被调）→ Esc 关。
// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { fireEvent, renderFacadeAsync, waitFor } from './rtlHarness.ts';
import { allText, facadeOf, type Facade, type FacadeNode } from './domFacade.ts';

const { providerBadgeOf, ProviderTile } = await import(
  '../src/ui/components/settings/ProviderTile.tsx'
);
const { ConsoleView } = await import('../src/ui/components/console/ConsoleView.tsx');

/** 打开控制台「模型与厂商」页所需的最小 props（与 settingsLoadFailure 同口径）。 */
const PROPS = {
  open: true,
  active: 'model' as const,
  onPick: () => {},
  onClose: () => {},
  settings: {
    theme: 'light' as const,
    themePref: 'light' as const,
    onThemePrefChange: () => {},
    locale: 'zh' as const,
    onLocaleChange: () => {},
    workspacePath: '',
    sessionScopeAll: false,
    onToggleSessionsScope: () => {},
    leftWidth: 248,
    rightWidth: 420,
    onLeftWidthChange: () => {},
    onRightWidthChange: () => {},
  },
  workspacePath: '',
  connected: true,
};

/** 两家厂商：deepseek（当前 + 已配 Key + 已实测）、moonshot（未配置）。 */
const PROVIDERS = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    adapter: 'openai' as const,
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    needsKey: true,
    models: ['deepseek-v4-flash'],
    reasoningEffort: ['high'],
  },
  {
    id: 'moonshot',
    label: 'Moonshot Kimi',
    adapter: 'openai' as const,
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-latest',
    needsKey: true,
    models: [],
    reasoningEffort: ['high'],
  },
];

test('providerBadgeOf：驼峰/分词切段取前两段首字符（中文逐字）', () => {
  assert.strictEqual(providerBadgeOf('DeepSeek'), 'DS');
  assert.strictEqual(providerBadgeOf('Moonshot Kimi'), 'MK');
  assert.strictEqual(providerBadgeOf('OpenAI'), 'OA');
  assert.strictEqual(providerBadgeOf('智谱 GLM'), '智谱', '中文逐字成段：两段取两段首字符');
  assert.strictEqual(providerBadgeOf('Ollama'), 'Ol');
});

test('总览网格：单一状态档 + 「当前」单命中 + 点卡开抽屉 + 保存并检测链路 + Esc 关', async () => {
  /** api 调用记录（方法名 → 次数与参数）。 */
  const calls: Record<string, unknown[]> = {};
  const record = (method: string, args: unknown[]): unknown => {
    calls[method] = [...(calls[method] ?? []), args];
    return undefined;
  };
  const bundleJson = JSON.stringify({});
  const ui = await renderFacadeAsync(ConsoleView, {
    props: PROPS,
    responses: {
      listProfiles: () => Promise.resolve([]),
      getActiveProfile: () => Promise.resolve({}),
      getConfig: () => Promise.resolve({ providerKeys: { deepseek: 'sk-****5137' }, model: 'deepseek-v4-flash' }),
      modelCatalog: () =>
        Promise.resolve({
          providers: PROVIDERS,
          active: {
            id: 'deepseek',
            label: 'DeepSeek',
            defaultModel: 'deepseek-v4-flash',
            model: 'deepseek-v4-flash',
            models: ['deepseek-v4-flash'],
            reasoningEffort: ['high'],
            effortsByModel: { 'deepseek-v4-flash': ['high'] },
          },
        }),
      probeModels: (id: string) => {
        record('probeModels', [id]);
        return Promise.resolve({
          providers: [{ id, label: '', configured: true, ok: true, models: ['deepseek-v4-flash', 'deepseek-r2'], source: 'models-endpoint' }],
        });
      },
      updateConfig: (patch: Record<string, unknown>) => {
        record('updateConfig', [patch]);
        void bundleJson;
        return Promise.resolve({ ok: true });
      },
    },
  });
  const tree = (): Facade => facadeOf(ui.container.firstElementChild);

  // 总览网格：两张 tile；「当前使用」只出现一次（activeId 真源）。
  await waitFor(() => {
    if (ui.container.querySelectorAll('.sp-tile').length < 2) throw new Error('网格未渲染');
  });
  assert.strictEqual(ui.container.querySelectorAll('.sp-tile').length, 2);
  const tileText = allText(tree() as FacadeNode);
  assert.match(tileText, /当前使用/u);
  assert.strictEqual(
    (tileText.match(/当前使用/g) ?? []).length,
    1,
    '「当前使用」必须单命中（旧行为是 adapter 宽松匹配多行同亮）',
  );
  assert.match(tileText, /未配置/u);
  assert.match(tileText, /已配置/u, 'deepseek 有打码 Key → ✓ 已配置档');
  // 首字徽标。
  assert.match(tileText, /DS/u);
  assert.match(tileText, /MK/u);

  // 点 deepseek 卡 → 抽屉出现（编辑内容：保存并检测 / 启用等）。Drawer portal 到 body。
  const tile = ui.container.querySelector('.sp-tile[data-provider="deepseek"]');
  assert.ok(tile instanceof HTMLElement, '找不到 deepseek 总览卡');
  fireEvent.click(tile);
  await waitFor(() => {
    if (document.querySelector('.ant-drawer-content-wrapper') === null) throw new Error('抽屉未出现');
  });
  await waitFor(() => {
    if (document.querySelector('input[aria-label="DeepSeek API Key"]') === null) throw new Error('抽屉内容未渲染');
  });
  const keyInput = document.querySelector('input[aria-label="DeepSeek API Key"]');
  assert.ok(keyInput instanceof HTMLInputElement, '抽屉里没有 Key 输入框');
  fireEvent.change(keyInput, { target: { value: 'sk-new-key' } });
  const saveBtn = Array.from(document.querySelectorAll('.ant-drawer button')).find((b) =>
    (b.textContent ?? '').replace(/\s/g, '').includes('保存并检测'),
  );
  assert.ok(saveBtn instanceof HTMLElement, '找不到「保存并检测」主按钮');
  fireEvent.click(saveBtn);
  await waitFor(() => {
    if ((calls['probeModels']?.length ?? 0) < 1) throw new Error('检测未触发');
  });
  assert.ok(
    (calls['updateConfig'] ?? []).some((a) =>
      JSON.stringify(a).includes('setProviderKey'),
    ),
    '保存 Key 必须先落盘（setProviderKey）',
  );
  assert.deepStrictEqual(calls['probeModels']?.[0], ['deepseek'], '检测必须针对该厂商');

  // Esc 关抽屉（PickerModal 纪律一致：焦点归还由 antd Drawer 承担，这里验开合）。
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => {
    const drawer = ui.container.querySelector('.ant-drawer-content');
    if (drawer !== null && drawer.getAttribute('class')?.includes('ant-drawer-open') === true) {
      throw new Error('抽屉未关闭');
    }
  });
});

