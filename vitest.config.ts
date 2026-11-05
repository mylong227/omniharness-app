// 判据（web/test/** + tests/**）的 Vitest 配置：**只有一套栈**。
//
// 为什么不再有 workspace 双项目：本仓库只承载应用壳（web + desktop）+ 后端宿主；
// web 判据与少量后端判据（如 RPC parity 快照）都在本仓跑，单项目即可。
//
// 两条纪律沿用自上游（都踩过坑）：
//   · 环境按**文件**声明：组件判据在文件头写 `// @vitest-environment jsdom`，
//     真 Chrome 判据自己拉起浏览器并在 node 宿主里跑——整项目切 jsdom 会让后者集体红；
//   · **文件级串行**：十余个判据各自启动真 Chrome，并发会抢 CPU/端口产生假红
//     （单跑全绿、并发偶红）。慢但可信 > 快但不可信。

import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/** 仓库根（本文件所在目录）。 */
const ROOT = import.meta.dirname;

export default defineConfig({
  test: {
    include: ['web/test/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
    environment: 'node',
    // jsdom 缺的布局全局（matchMedia / ResizeObserver / requestIdleCallback）在 setup 里「缺失才补」。
    setupFiles: [resolve(ROOT, 'web/test/setupWeb.ts')],
    // 真 Chrome 判据耗时长，给足超时；钩子预算独立声明。
    testTimeout: 120000,
    hookTimeout: 60000,
    // 见文件头：并发会造假红。
    fileParallelism: false,
    reporters: ['default'],
    // 与 `node --test` 行为对齐：不吞掉未处理的 rejection。
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
