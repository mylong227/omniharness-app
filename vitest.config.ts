// 判据（web/test/** + tests/**）的 Vitest 配置：**双项目**（2026-11-20 工程效率批拆分）。
//
// 两条纪律沿用自上游（都踩过坑）：
//   · 环境按**文件**声明：组件判据在文件头写 `// @vitest-environment jsdom`，
//     真 Chrome 判据自己拉起浏览器并在 node 宿主里跑——整项目切 jsdom 会让后者集体红；
//   · **真 Chrome 判据必须文件级串行**：并发会抢 CPU/端口产生假红（单跑全绿、并发偶红）。
//
// 2026-11-20 变化：单项目全串行 → 双项目。~40 个真 Chrome 判据保持串行（纪律不变），
// 其余 ~180 个纯 node/jsdom 判据并行执行——它们无端口、无浏览器实例，此前被同一开关
// 钉死属「最便宜的判据为最贵的判据买单」。识别在配置期做内容扫描（宽匹配 + 对本地
// helper 的一层传递闭包；过纳只会多一个串行文件，漏纳才是风险）。

import { defineConfig } from 'vitest/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** 仓库根（本文件所在目录）。 */
const ROOT = import.meta.dirname;

/** 真 Chrome 判据的内容特征（宽匹配：过纳无害，漏纳有害）。 */
const CHROME_MARKERS =
  /browserHarness|composerProbe|diffShots|keyStateShots|minimalShots|browserSwitch|responsiveProbe|questionCardProbe|chrome-launcher|CDP|DOM_PROBE|openStubSession/u;

/**
 * 收集真 Chrome 判据文件（相对仓库根，posix 分隔）。识别 = 文件内容直接命中特征，或其
 * import 的本地 helper（一层传递）命中——helper 自身不是 *.test.ts，不进清单。
 * @returns 相对路径数组
 */
function collectChromeTests(): string[] {
  const dir = join(ROOT, 'web/test');
  const chrome = new Set<string>();
  for (const name of readdirSync(dir)) {
    if (!/\.test\.(ts|tsx)$/u.test(name)) continue;
    const src = readFileSync(join(dir, name), 'utf8');
    const isChrome = CHROME_MARKERS.test(src);
    if (!isChrome) {
      // 一层传递闭包：./helper 形式的本地导入，helper 内容命中也算 Chrome 判据。
      const importsLocal = [...src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].some((m) => {
        const target = resolve(dir, m[1]);
        for (const candidate of [target, `${target}.ts`, `${target}.tsx`]) {
          try {
            if (CHROME_MARKERS.test(readFileSync(candidate, 'utf8'))) return true;
          } catch {
            /* 非 .ts 后缀等：忽略 */
          }
        }
        return false;
      });
      if (!importsLocal) continue;
    }
    const posix = name.split('\\').pop();
    chrome.add(`web/test/${posix}`);
  }
  return [...chrome].sort();
}

const CHROME_TESTS = collectChromeTests();

export default defineConfig({
  test: {
    // 双项目：chrome 串行（纪律不变）+ fast 并行（node/jsdom 判据无共享资源）。
    projects: [
      {
        test: {
          name: 'chrome',
          include: CHROME_TESTS,
          environment: 'node',
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'fast',
          include: ['web/test/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
          exclude: [
            ...CHROME_TESTS,
            '**/node_modules/**',
            '**/dist/**',
            '**/.{idea,git,cache,output,temp}/**',
          ],
          environment: 'node',
          fileParallelism: true,
          // fork 并发上限：无界并发会把机器打满、worker 启动超时（实测 7 个文件
          // 「Failed to start forks worker」）——限到 CPU 的一半量级，稳定优先。
          poolOptions: { forks: { maxForks: 6, minForks: 1 } },
        },
      },
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
    environment: 'node',
    // jsdom 缺的布局全局（matchMedia / ResizeObserver / requestIdleCallback）在 setup 里「缺失才补」。
    setupFiles: [resolve(ROOT, 'web/test/setupWeb.ts')],
    // 真 Chrome 判据耗时长，给足超时；钩子预算独立声明。
    testTimeout: 120000,
    hookTimeout: 60000,
    reporters: ['default'],
    // 与 `node --test` 行为对齐：不吞掉未处理的 rejection。
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
