import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configFile } from '../src/host/kernel/config.ts';

/**
 * 标品家具守卫：面向「第一次 clone 本仓的人」的东西必须**此刻就是好的**。
 *
 * 1. `omniharness.json.example` 必须能通过内核严格校验（normalizeConfig）——示例配置是
 *    新手抄的第一份文件，它自己坏掉等于把 fail-closed 闸门怼在用户脸上（ConfigError）。
 * 2. README 承诺的脚本与文档必须真实存在——悬空提示是本仓修过一整轮的缺陷类，判据钉住不再犯。
 */

describe('标品家具（首次上手面）', () => {
  it('omniharness.json.example 通过内核严格校验（ConfigError 即红）', () => {
    const example = resolve('omniharness.json.example');
    expect(existsSync(example), 'omniharness.json.example 缺失').toBe(true);
    expect(() => configFile.load(example)).not.toThrow();
  });

  it('README 承诺的 npm 脚本都存在', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    // README「脚本表」逐条列出并被快速开始引用的命令：
    for (const name of [
      'build',
      'build:web',
      'web:dev',
      'web:test',
      'typecheck',
      'kernel:check',
      'kernel:vendor',
      'smoke',
      'serve',
      'example:embed',
      'desktop:build',
      'desktop:test',
      'desktop:smoke',
      'desktop:stage',
      'desktop:dist',
      'verify',
      'start',
      'dev',
    ]) {
      expect(scripts[name], `package.json 缺少 README 承诺的脚本: ${name}`).toBeTypeOf('string');
    }
  });

  it('README / CHANGELOG / CONTRIBUTING 引用的文档都存在', () => {
    for (const doc of [
      'README.md',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'LICENSE',
      'NOTICE',
      'docs/KERNEL-CONTRACT.md',
      'docs/DESKTOP-SMOKE.md',
      'src/host/kernel-compat/README.md',
      'examples/embed-demo.mjs',
      'examples/catalog/registry.json',
      'omniharness.json.example',
    ]) {
      expect(existsSync(resolve(doc)), `被引用的文件缺失: ${doc}`).toBe(true);
    }
  });
});
