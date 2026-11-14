// 切模型即钳强度判据（2026-11-14，docs/design/adaptive-reasoning/ §5 交互面）：
//  越界值 → 钳到最近支持档并随**同一次** config.update 写回；
//  合法值 → patch 不带 reasoning 字段（不产生多余写回）；
//  模型级 []（确证不接收 effort）→ patch 不写 reasoning（空串是非法配置值，内核枚举
//    fail-closed；保留原值让切回支持模型时偏好恢复）；
//  旧服务端（档位源完全未知）→ 保持现状不钳制；
//  未设置值（''）→ 不视为越界（钳到最强档等于替用户悄悄开启推理）。
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ComposerController } from '../src/ui/controllers/ComposerController.ts';
import type { SessionController } from '../src/ui/controllers/SessionController.ts';
import type { AppHost, AppServices } from '../src/ui/controllers/AppController.ts';

/** 造控制器与调用记录（桩只承载被测方法实际读写的最小字段——与 controllerBindings 同口径）。 */
function rigOf(initial: { model: string; reasoning: string; effortsByModel?: Record<string, string[]>; reasoningOptions?: string[] }) {
  /** 一次桩调用记录（[方法名, ...参数]）。 */
  const calls: unknown[][] = [];
  const state = { ...initial };
  const host = {
    patch(action: Parameters<AppHost['patch']>[0]): void {
      Object.assign(state, typeof action === 'function' ? (action as (prev: unknown) => unknown)(state) : action);
    },
    getState: () => state,
  } as unknown as AppHost;
  const services = {
    api: {
      updateConfig: async (patch: Record<string, unknown>) => {
        calls.push(['updateConfig', patch]);
        return { ok: true };
      },
    },
    toast: (message: string) => calls.push(['toast', message]),
  } as unknown as AppServices;
  // 第三个参数是会话子控制器（changeModel 不触会话，桩为空壳即可）。
  const ctrl = new ComposerController(host, services, {} as unknown as SessionController);
  return { ctrl, calls, state };
}

test('changeModel：越界档位钳到最近支持档，且与 model 合并进同一次 config.update', async () => {
  const rig = rigOf({
    model: 'gpt-5',
    reasoning: 'xhigh',
    effortsByModel: { 'gpt-5': ['minimal', 'low', 'medium', 'high', 'xhigh'], o3: ['low', 'medium', 'high'] },
    reasoningOptions: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  });
  await rig.ctrl.changeModel('o3');
  assert.strictEqual(rig.state.model, 'o3');
  assert.strictEqual(rig.state.reasoning, 'high', 'xhigh 越界 → 钳到 max 端 high');
  assert.deepStrictEqual(rig.calls[0], ['updateConfig', { model: 'o3', reasoning: 'high' }], '合并写回，不产生第二个请求');
});

test('changeModel：当前档位合法时不写 reasoning（patch 只含 model）', async () => {
  const rig = rigOf({
    model: 'gpt-5',
    reasoning: 'medium',
    effortsByModel: { 'gpt-5': ['minimal', 'low', 'medium', 'high', 'xhigh'] },
    reasoningOptions: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  });
  await rig.ctrl.changeModel('gpt-5.1'); // 未命中表 → 回落厂商档（合法集合含 medium）
  assert.strictEqual(rig.state.model, 'gpt-5.1');
  assert.strictEqual(rig.state.reasoning, 'medium', '合法值不得被改动');
  assert.deepStrictEqual(rig.calls[0], ['updateConfig', { model: 'gpt-5.1' }]);
});

test('changeModel：模型确证不接收 effort（模型级 []）→ 保留原值、不写 reasoning 字段', async () => {
  const rig = rigOf({
    model: 'gpt-5',
    reasoning: 'high',
    effortsByModel: { 'gpt-5': ['minimal', 'low', 'medium', 'high', 'xhigh'], 'gpt-4o': [] },
    reasoningOptions: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  });
  await rig.ctrl.changeModel('gpt-4o');
  // 空串是非法配置值（内核枚举拒绝）：不支持只是"当前模型不显示强度"，偏好保留在配置里，
  // 切回 gpt-5 时 high 原样恢复。
  assert.strictEqual(rig.state.reasoning, 'high', '偏好不得被清掉');
  assert.deepStrictEqual(rig.calls[0], ['updateConfig', { model: 'gpt-4o' }], 'patch 不含 reasoning 键');
});

test('changeModel：旧服务端（无模型级表也无厂商档）保持现状不钳制', async () => {
  const rig = rigOf({ model: 'mock', reasoning: 'xhigh' });
  await rig.ctrl.changeModel('mock-b');
  assert.strictEqual(rig.state.reasoning, 'xhigh', '档位源未知时不得瞎动用户已存值');
  assert.deepStrictEqual(rig.calls[0], ['updateConfig', { model: 'mock-b' }]);
});

test('changeModel：当前值为空串（未设置）不钳制——未设置不是越界', async () => {
  const rig = rigOf({
    model: 'mock',
    reasoning: '',
    effortsByModel: { 'mock-b': ['low', 'medium', 'high'] },
    reasoningOptions: ['low', 'medium', 'high'],
  });
  await rig.ctrl.changeModel('mock-b');
  assert.strictEqual(rig.state.reasoning, '', '钳到最强档等于替用户悄悄开启推理');
  assert.deepStrictEqual(rig.calls[0], ['updateConfig', { model: 'mock-b' }]);
});

test('changeModel：写回失败仍单条 toast（不因钳制重复打扰）', async () => {
  const calls: unknown[][] = [];
  const state = { model: 'a', reasoning: 'xhigh', effortsByModel: { b: ['low'] }, reasoningOptions: undefined };
  const host = {
    patch(action: Parameters<AppHost['patch']>[0]): void {
      Object.assign(state, typeof action === 'function' ? (action as (prev: unknown) => unknown)(state) : action);
    },
    getState: () => state,
  } as unknown as AppHost;
  const services = {
    api: {
      updateConfig: async () => {
        calls.push(['updateConfig']);
        throw new Error('offline');
      },
    },
    toast: (message: string) => calls.push(['toast', message]),
  } as unknown as AppServices;
  await new ComposerController(host, services, {} as unknown as SessionController).changeModel('b');
  assert.strictEqual(
    calls.filter((c) => c[0] === 'toast').length,
    1,
    '合并写回失败只弹一次错误提示',
  );
});
