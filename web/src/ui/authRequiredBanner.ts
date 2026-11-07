/**
 * 授权失效横幅（2026-11-06 审计 P2 引入；2026-11-08 升级为可就地换令牌）：监听
 * `omni:auth-required`（ApiClient 在 HTTP 401 时派发），在页面顶部挂一条不可关闭的提示。
 *
 * 就地换令牌（本升级）：服务端重启令牌轮换后，旧页面**没有任何**拿到新令牌的通道——
 * EventSource 会拿旧 `?token=` 无限重试、RPC 全线 401，用户只能整页重开。现在横幅内置一个
 * 令牌输入框：粘贴新令牌 → `authToken.set()` 覆盖 → 派发 `omni:token-updated`（AppController
 * 收到后用新令牌重建 SSE 流）→ 横幅收起。RPC 侧无需重载：下一次请求 resolve() 即取新令牌。
 *
 * 为什么放 ui/ 而不是 core/：core 无 DOM 是既定约定（Router 都做了 `typeof window` 守卫）；
 * 本模块创建元素、挂载表单——是 UI 呈现，不属于服务层。事件协议不变：core 派发
 * `omni:auth-required`，本模块消费；向上的 `omni:token-updated` 由 AppController 消费。
 *
 * 为什么不进 React 状态树：401 可能在**任何**控制器路径发生（含 App 尚未挂载完成的早期请求），
 * DOM 级单例最简单且幂等（重复事件只挂一次横幅）；样式内联对齐 minimal 主题的警示色。
 */

import { authToken } from '../core/authToken.ts';

/** 横幅是否已装监听（幂等锚点）。 */
let installed = false;

/** 横幅挂载期间的输入框引用（重挂时复用 DOM 前先取值）。 */
let tokenInput: HTMLInputElement | null = null;

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
      'display:flex',
      'gap:8px',
      'align-items:center',
      'justify-content:center',
      'flex-wrap:wrap',
      'padding:10px 16px',
      'background:#8a3a12',
      'color:#fff',
      'font:13px/1.6 var(--font-sans, system-ui, sans-serif)',
      'text-align:center',
    ].join(';');

    const text = document.createElement('span');
    text.textContent = '需要授权：访问令牌缺失或已失效（服务端可能已重启）。';

    tokenInput = document.createElement('input');
    tokenInput.type = 'password';
    tokenInput.placeholder = '粘贴新令牌就地重连';
    tokenInput.setAttribute('aria-label', '新的访问令牌');
    tokenInput.style.cssText =
      'font:inherit;color:inherit;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.45);' +
      'border-radius:4px;padding:2px 8px;min-width:220px';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = '连接';
    submit.style.cssText =
      'font:inherit;color:#8a3a12;background:#fff;border:none;border-radius:4px;padding:2px 12px;cursor:pointer';

    const applyToken = (): void => {
      const token = (tokenInput?.value ?? '').trim();
      if (token === '') return;
      authToken.set(token);
      banner.remove();
      tokenInput = null;
      // AppController 收到后重建 SSE 流（新令牌）；RPC 侧下一次请求即用新令牌。
      window.dispatchEvent(new CustomEvent('omni:token-updated'));
    };
    submit.addEventListener('click', applyToken);
    tokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyToken();
    });

    const hint = document.createElement('span');
    hint.style.cssText = 'opacity:.72';
    hint.textContent = '（或用带 token 的地址重新打开本页）';

    banner.append(text, tokenInput, submit, hint);
    document.body.appendChild(banner);
    tokenInput.focus();
  });
}

/**
 * 收起横幅（AppController 在 SSE 重连成功后调用）：用户没提交令牌、但服务端带着原令牌回来了
 * （宽限期自愈路径），「需要授权」的横幅已不成立。无横幅时调用无害。
 * @returns 无返回值。
 */
export function dismissAuthBanner(): void {
  document.getElementById('omni-auth-banner')?.remove();
  tokenInput = null;
}
