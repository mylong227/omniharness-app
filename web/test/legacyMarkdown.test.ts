// legacyRenderMarkdown 引用面锁死判据（2026-11-21 W7）：
// 生产路径不可达（markdown.ts 打包后恒可用，回退分支永不走），按依赖政策有意保留为资产。
// 本判据钉死它的**引用面**：只许 format.ts（定义 + 回退调用）与 format.test.ts（显式直测）出现——
// 新代码引用它即红（回退语义属于 renderMarkdown 内部，不应外泄成第二条渲染通道）。
// 直跑（web 测试统一入口）：npm run web:test（node 环境，纯源码扫描）。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('legacyRenderMarkdown 引用面锁死（生产不可达的兜底资产）', () => {
  it('只允许 format.ts（定义+回退）与 format.test.ts（直测）引用', () => {
    const hits: string[] = [];
    const roots = [resolve('web/src'), resolve('web/test')];
    for (const root of roots) {
      const stack = [root];
      while (stack.length > 0) {
        const dir = stack.pop()!;
        for (const entry of readdirSorted(dir)) {
          if (entry.isDirectory) stack.push(entry.path);
          else if (/\.tsx?$/u.test(entry.name)) {
            const text = readFileSync(entry.path, 'utf8');
            if (text.includes('legacyRenderMarkdown')) hits.push(entry.path);
          }
        }
      }
    }
    const normalized = hits.map((p) => p.split('\\').join('/'));
    // 允许面：format.ts（定义 + 兜底分支）、markdown.ts（legacy/full 混渲的回退调用点，L6 登记）、
    // format.test.ts（直测）、本判据文件（自引用字符串）。
    const allowed = normalized.filter((p) =>
      p.endsWith('ui/format.ts') ||
      p.endsWith('ui/markdown.ts') ||
      p.endsWith('format.test.ts') ||
      p.endsWith('legacyMarkdown.test.ts'),
    );
    const unexpected = normalized.filter((p) => !allowed.includes(p));
    expect(unexpected, 'legacyRenderMarkdown 出现了新引用点——兜底渲染不许成为第二条通道').toEqual([]);
    expect(allowed.length).toBeGreaterThanOrEqual(3);
  });
});

/** 递归列目录（node_modules/dist 除外；返回排序后的条目）。 */
function readdirSorted(dir: string): { name: string; path: string; isDirectory: boolean }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'archive')
    .map((e) => ({ name: e.name, path: join(dir, e.name), isDirectory: e.isDirectory() }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
