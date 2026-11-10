import { afterEach, describe, expect, it, vi } from 'vitest';
import { CliBuildConfig } from '../src/apps/cli/cliBuildConfig.ts';
import type { ModelPort, ModelRequest } from '../src/host/kernel/contracts.ts';
import type { CliArgs } from '../src/apps/cli/argParser.ts';

/**
 * 2026-11-08 用户报障的回归判据：**没有 API Key 时应用也必须能打开**。
 *
 * 故障形态：桌面侧车以 `serve` 启动，`buildModel` 因缺 Key 直接抛错 ⇒ 侧车就绪前退出 ⇒
 * 主进程弹「Harness 启动失败」并退出。用户连「设置 → 模型接入」都进不去，而那里正是唯一
 * 能补 Key 的地方（启动被配置反向卡死）。
 *
 * 本判据钉住两层语义：
 *  · 常驻服务（`allowUnconfigured`）拿到占位端口，启动不抛错，错误推迟到真正生成时且带设置指引；
 *  · 一次性 CLI 仍 fail-fast（缺 Key 当场抛错，不把问题拖到跑了半个任务之后）。
 */

/** 暴露 protected `buildModel` 的测试壳（生产调用点走继承链，无需额外 API）。 */
class ProbeBuildConfig extends CliBuildConfig {
  /**
   * @param args 最小 CLI 参数（只需模型段）。
   * @returns 默认策略（fail-fast）下的模型端口。
   */
  public modelFor(args: CliArgs): ModelPort {
    return this.buildModel(args);
  }

  /**
   * @param args 最小 CLI 参数（只需模型段）。
   * @returns 常驻服务策略（缺 Key 返回占位端口）下的模型端口。
   */
  public serviceModelFor(args: CliArgs): ModelPort {
    return this.buildModel(args, { allowUnconfigured: true });
  }
}

/** 最小参数：避开 `CliArgs` 二十余个必填字段（本判据不读它们）。 */
const args = {
  modelAdapter: 'openai',
  apiKey: undefined,
  baseUrl: undefined,
  model: 'gpt-4o-mini',
} as unknown as CliArgs;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('缺 API Key 时的模型装配', () => {
  it('常驻服务拿到占位端口：生成时才报错，且指向「设置 → 模型接入」', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const model = new ProbeBuildConfig().serviceModelFor(args);
    expect(model.name).toBe('openai:unconfigured');
    await expect(model.generate({} as unknown as ModelRequest)).rejects.toThrow(/设置 → 模型接入/u);
  });

  it('一次性 CLI 保持 fail-fast：缺 Key 当场抛错，提示 --api-key / 环境变量', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => new ProbeBuildConfig().modelFor(args)).toThrow(/--api-key/u);
  });
});
