/**
 * 厂商编辑抽屉的「可用模型」必须有可见文字（2026-11-15 用户截图：模型下拉空白）。
 *
 * 复现条件：probe 成功但 selectedModel 为空串/已被移除的旧模型时，antd Select
 * 拿到不在 options 里的值会显示空白；组件必须回退到清单首项。
 */
// @vitest-environment jsdom

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { render } from '@testing-library/react';
import { ProviderEditor } from '../src/ui/components/settings/ProviderEditor.tsx';
import { selectedModelFor } from '../src/ui/components/console/useProviderCatalog.ts';
import type { ProviderPreset } from '../src/types/models.ts';

const PRESET: ProviderPreset = {
  id: 'deepseek',
  label: 'DeepSeek',
  adapter: 'openai',
  baseUrl: 'https://api.deepseek.com',
  defaultModel: 'deepseek-chat',
  needsKey: true,
  models: ['deepseek-chat'],
  reasoningEffort: ['high'],
};

/**
 * 渲染编辑抽屉（只关心模型下拉）。
 * @param selectedModel 传入的选中值
 * @returns 容器
 */
function editor(selectedModel: string) {
  return render(
    <ProviderEditor
      preset={PRESET}
      activeId="deepseek"
      maskedKey="sk-****5137"
      probe={{ ok: true, models: ['deepseek-chat', 'deepseek-reasoner'] }}
      draft=""
      busy=""
      selectedModel={selectedModel}
      onDraft={() => {}}
      onModelPick={() => {}}
      onSaveKey={() => Promise.resolve()}
      onProbe={() => Promise.resolve()}
      onEnable={() => Promise.resolve()}
    />,
  );
}

test('selectedModelFor：过期/空的手选值不得穿透到启用请求', () => {
  const models = ['deepseek-chat', 'deepseek-reasoner'];
  assert.equal(selectedModelFor(PRESET, models, { deepseek: '' }, 'deepseek-chat'), 'deepseek-chat');
  assert.equal(
    selectedModelFor(PRESET, models, { deepseek: 'removed-model' }, 'deepseek-chat'),
    'deepseek-chat',
  );
  assert.equal(
    selectedModelFor(PRESET, models, { deepseek: 'deepseek-reasoner' }, 'deepseek-chat'),
    'deepseek-reasoner',
  );
  assert.equal(selectedModelFor(PRESET, [], { deepseek: 'x' }, 'deepseek-chat'), undefined);
});

test('选中的模型为空/不在清单：回退到第一个可用模型并显示文字', () => {
  for (const selected of ['', 'removed-model']) {
    const { container, unmount } = editor(selected);
    const item = container.querySelector('.ant-select-content');
    assert.ok(item !== null, `selected=${JSON.stringify(selected)} 时下拉没有选中项`);
    assert.match(item.textContent ?? '', /deepseek-chat/u, '必须显示清单首个模型名');
    const enable = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('重新启用'),
    );
    assert.ok(enable !== undefined);
    assert.equal(enable.disabled, false, '有回退模型时启用按钮必须可用');
    unmount();
  }
});


