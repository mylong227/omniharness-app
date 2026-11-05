/**
 * 授权失效横幅（2026-11-06 审计 P2）：监听 `omni:auth-required`（ApiClient 在 HTTP 401 时派发），
 * 在页面顶部挂一条不可关闭的提示——「令牌缺失/已失效，用带 token 的地址重新打开」。
 *
 * 为什么不进 React 状态树：401 可能在**任何**控制器路径发生（含 App 尚未挂载完成的早期请求），
 * DOM 级单例最简单且幂等（重复事件只挂一次横幅）；样式内联对齐 minimal 主题的警示色。
 */

/** 横幅是否已挂（幂等锚点）。 */
let installed = false;

/**
 * 安装监听（main.ts 启动期调用一次；重复调用无害）。
 * @returns 无返回值。
 */
export function installAuthRequiredBanner(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('omni:auth-required', () => {
    if (document.getElementById('omni-auth-banner') !== null) return;
    const banner = document.createElement('div');
    banner.id = 'omni-auth-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:10000',
      'padding:10px 16px',
      'background:#8a3a12',
      'color:#fff',
      'font:13px/1.6 var(--font-sans, system-ui, sans-serif)',
      'text-align:center',
    ].join(';');
    banner.textContent =
      '需要授权：访问令牌缺失或已失效（服务端可能已重启）。请复制服务端启动时打印的带 token 地址重新打开本页。';
    document.body.appendChild(banner);
  });
}
