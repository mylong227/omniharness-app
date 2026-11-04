// Vite 配置：**root 必须是 `web/`，产物必须是 `web/dist/`**。
//
// 为什么 root 是本仓的 `web/`：桌面端与后端宿主都按「`web/dist/index.html` + `web/dist/*`
// 就是运行时的全部」来托管静态资源；把 root 设成仓库根会让产物落错位置，托管端 404 白屏。
//
// 开发态（`npm run web:dev`）：Vite dev server + HMR，把 `/rpc` `/events` `/files` `/healthz`
// 代理到后端。生产态（`npm run web:build`）：Vite 默认单 bundle（带 hash）→ `web/dist/assets/`。
// 两条路径共用同一份 `web/index.html` 作为入口。
//
// 开发回路地址（端口/主机/origin）唯一事实源是 `scripts/devConfig.mjs`：
// `OMNI_BACKEND_PORT` / `OMNI_UI_PORT`|`OMNI_FRONTEND_PORT` / `OMNI_DEV_HOST` 可覆盖。
// 后端不在本机/默认端口时，用 `OMNI_BACKEND_ORIGIN` 直接给整条 origin（优先级最高）。

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { resolveDevAddress } from './scripts/devConfig.mjs';

const dev = resolveDevAddress();

/** 代理目标：显式 `OMNI_BACKEND_ORIGIN` 优先，否则按 devConfig 解析。 */
const backendOrigin = (process.env['OMNI_BACKEND_ORIGIN'] ?? '').trim() || dev.backendOrigin;

export default defineConfig({
  root: resolve(import.meta.dirname, 'web'),
  // 相对基路径：产物里的 `assets/app.js` 用 `./assets/...` 引用。
  // 前端既可能挂在站点根，也可能被反向代理到子路径下；相对基路径两种都成立。
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // `hidden`：生成 .map 但不写 sourceMappingURL 注释——浏览器不自动加载，
    // 报错上报方持有 map 时才可用；换来压榨后可诊断性。
    sourcemap: 'hidden',
    target: 'es2020',
    // `keepNames`：保留函数/类名，错误边界才能显示组件栈（如 `SessionPanel`）。
    minify: 'esbuild',
    // 单 bundle 实测约 1030 KB（react + markdown-it + katex + highlight + 应用码），
    // 1200 KB = 实测 + 约 15% 余量；越过它说明依赖膨胀，值得有人看一眼。
    chunkSizeWarningLimit: 1200,
    /**
     * vendor 分块（沿用上游 W4 口径）：
     *
     *   · 默认：react 基座 → `vendor-react`；其余 npm 依赖 → `vendor-antd`（构造上完备，
     *     避免第三方跟随包随导入方漂进面板块，产生 panel→vendor→panel 循环块）；
     *   · 例外：面板级 antd 组件族与其同族 @rc-component 实现 → `panel-antd`
     *     （可预测命名的异步共享块，只被异步面板可达 ⇒ 不进首屏）；
     *   · 例外：katex / markdown-it / highlight.js 随 entry（历史口径，按 entry 桶记账预算）。
     *
     * denylist 的准入纪律：一个族只有当「没有任何 vendor 侧（壳层/静态文件）可达的模块
     * 导入它」时才能进 denylist——漏了只会落 vendor（闸红），错加了会让它落 entry。
     */
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
            return 'vendor-react';
          // 跨族共享的小件先行回收进 vendor（顺序在 denylist 之前）。
          if (
            /[\\/]node_modules[\\/](?:antd[\\/](?:es|lib)[\\/](?:.*[\\/]style[\\/]|form[\\/](?:context|validateMessagesContext)\.js|tooltip[\\/]UniqueProvider[\\/]|table[\\/]TableMeasureRowContext\.js|(?:pagination|calendar|date-picker|time-picker)[\\/]locale[\\/]|locale[\\/])|@rc-component[\\/](?:picker|pagination)[\\/](?:es|lib)[\\/]locale[\\/])/.test(
              id,
            )
          )
            return 'vendor-antd';
          // 面板级 antd 组件族 → 统一进可预测命名的异步共享块 panel-antd。
          if (
            /[\\/]node_modules[\\/]antd[\\/]es[\\/](alert|auto-complete|calendar|cascader|checkbox|date-picker|descriptions|dropdown|form|grid|row|col|image|input|input-number|layout|list|mentions|menu|pagination|popconfirm|popover|progress|qr-code|qrcode|radio|rate|result|segmented|select|slider|spin|statistic|steps|switch|table|time-picker|timeline|tooltip|tour|transfer|tree-select|upload)[\\/]/.test(
              id,
            )
          )
            return 'panel-antd';
          // 同族 @rc-component 内部实现跟组件族一起走 panel-antd。
          if (
            /[\\/]node_modules[\\/]@rc-component[\\/](cascader|image|input|input-number|listy|mentions|mini-decimal|pagination|picker|progress|segmented|select|slider|steps|switch|table|tooltip|tour|tree-select|upload)[\\/]/.test(
              id,
            )
          )
            return 'panel-antd';
          // 历史口径三库随 entry。
          if (/[\\/]node_modules[\\/](katex|markdown-it|highlight\.js)[\\/]/.test(id))
            return undefined;
          // 其余一切 npm 依赖一律 vendor（构造上完备，见上方纪律）。
          if (/[\\/]node_modules[\\/]/.test(id)) return 'vendor-antd';
          return undefined;
        },
      },
    },
  },
  esbuild: {
    keepNames: true,
  },
  server: {
    port: dev.uiPort,
    strictPort: false,
    // 前后端分离开发：RPC 走 POST /rpc（JSON-RPC 2.0），事件走 GET /events（SSE）。
    // 前端代码里仍用同源相对路径（`/rpc`），无需读环境变量拼地址。
    proxy: {
      '/rpc': { target: backendOrigin, changeOrigin: false },
      '/events': { target: backendOrigin, changeOrigin: false },
      // 工作区文件下载 / 预览（GET /files）
      '/files': { target: backendOrigin, changeOrigin: false },
      // 运行时自述（右栏网页标签从 `/healthz.previewPort` 取工作区预览源端口）。
      '/healthz': { target: backendOrigin, changeOrigin: false },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
});
