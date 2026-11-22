// 应用层 en 词条分片（common）：跨层共用 / 企业 OIDC 等中等规模文案。
// 键 = 中文原文（与 AppText.t 的调用点逐字一致）；值 = English。
export const COMMON: Readonly<Record<string, string>> = {
  'OIDC discovery 缺少必需端点 authorization_endpoint / token_endpoint':
    'OIDC discovery is missing required endpoints authorization_endpoint / token_endpoint',
  'OIDC token 响应缺少 access_token': 'OIDC token response is missing access_token',
  '非法 JWT：段数不为 3': 'Invalid JWT: expected 3 segments',
  'id_token aud 不匹配 client_id': 'id_token aud does not match client_id',
  'id_token 缺少有效的 exp（数字）': 'id_token is missing a valid numeric exp',
  'id_token 已过期': 'id_token has expired',
  'id_token nonce 不匹配': 'id_token nonce mismatch',
  '找不到匹配的 RSA JWK': 'No matching RSA JWK found',
  'id_token 签名校验失败': 'id_token signature verification failed',
  'auth state 形状非法：不是对象': 'Invalid auth state: not an object',
  'auth state 形状非法：缺少 issuer/clientId/state/codeVerifier/createdAt':
    'Invalid auth state: missing issuer/clientId/state/codeVerifier/createdAt',
  'auth state 已过期（超过 10 分钟），请重新 auth login':
    'Auth state has expired (older than 10 minutes); run auth login again',
  'discovery 未提供 jwks_uri': 'Discovery did not provide jwks_uri',
  'OIDC discovery 文档与已装配配置不一致（issuer/authorization_endpoint）':
    'OIDC discovery document does not match the assembled configuration (issuer/authorization_endpoint)',
  'OIDC Configuration 未就绪（discovery 失败或被并发清空）':
    'OIDC configuration is not ready (discovery failed or was cleared concurrently)',
  'OIDC discovery 文档与已装配配置不一致（issuer/token_endpoint）':
    'OIDC discovery document does not match the assembled configuration (issuer/token_endpoint)',
  'OIDC 换码需要 redirect_uri（config 或 params 至少提供一处）':
    'OIDC code exchange requires redirect_uri (provide it in config or params)',
  'id_token 为空': 'id_token is empty',
  'laya 决策失败（fail-open）': 'laya decision failed (fail-open)',
  'Laya 热进程仍在加载权重，本次决策跳过（fail-open；加载继续在后台进行）':
    'The Laya warm process is still loading weights; skipping this decision (fail-open; loading continues in the background)',
  'Laya 决策失败（fail-open：本次降级为无预判，不影响主流程）':
    'Laya decision failed (fail-open: this decision runs without a prediction; the main flow is unaffected)',
  'Laya 决策引擎后端已就绪': 'Laya decision-engine backend is ready',
  'Laya 决策引擎后端不可用（fail-open，决策将回落到 LLM）':
    'Laya decision-engine backend is unavailable (fail-open; decisions fall back to the LLM)',
  'laya 后端不可用（fail-open）': 'laya backend unavailable (fail-open)',
  '桥无输出（进程可能被超时终止）': 'Bridge produced no output (the process may have been killed by a timeout)',
  'Laya 热进程已关闭（不重启）': 'Laya warm process closed (not restarting)',
  '热进程仍在加载权重（本次决策跳过；加载继续在后台进行）':
    'Warm process is still loading weights (skipping this decision; loading continues in the background)',
  '热进程已关闭': 'Warm process closed',
  '热进程 stdin 不可用': 'Warm process stdin is unavailable',
  '热进程已退出': 'Warm process exited',
  '热进程已回收': 'Warm process reclaimed',
  '注入快照顶层应为对象 { cases: [...] }': 'Injection snapshot top level must be an object { cases: [...] }',
  '注入快照 cases 应为非空数组': 'Injection snapshot cases must be a non-empty array',
  'MCP registry 响应必须是对象': 'MCP registry response must be an object',
  '探索者': 'Explorer',
  '先摸清代码与数据全貌，再下结论': 'Map the code and data first, then draw conclusions',
  '以「探索者」角色工作：先把相关目录结构、调用链与既有实现读清楚，再给结论。':
    'Work as the Explorer: read the relevant directory structure, call chains, and existing implementations before concluding.',
  '交付物是「事实清单 + 证据（文件路径与行号）+ 不确定项」，':
    'The deliverable is a fact list with evidence (file paths and line numbers) and open uncertainties;',
  '不要在证据不足时给实现建议，也不要顺手改代码。':
    'do not suggest implementations without evidence, and do not change code in passing.',
  '审查者': 'Reviewer',
  '找缺陷、找回归风险，不给风格意见': 'Find defects and regression risks; no style opinions',
  '以「审查者」角色工作：逐条给出可复现的缺陷、边界条件与回归风险，':
    'Work as the Reviewer: report reproducible defects, edge conditions, and regression risks one by one;',
  '每条必须附「触发条件 + 影响 + 证据（文件路径与行号）」，并按严重度排序。':
    'each item must include trigger, impact, and evidence (file paths and line numbers), sorted by severity.',
  '只报能站住的问题，不做风格偏好评审，不代替作者重写代码。':
    'Report only defensible issues; no style-preference review and no rewriting the author’s code.',
  '规划者': 'Planner',
  '产出可执行方案与验收标准': 'Produce an executable plan and acceptance criteria',
  '以「规划者」角色工作：输出分步方案，每步写清「改哪些文件、为什么这么改、怎么验证」，':
    'Work as the Planner: output a step-by-step plan where each step states which files change, why, and how to verify;',
  '并显式列出依赖关系与回滚方式。本轮只出方案与验收标准，不执行改动。':
    'explicitly list dependencies and rollback. This turn produces only the plan and acceptance criteria; make no changes.',
  '文档撰写者': 'Technical Writer',
  '把实现整理成可读的文档与示例': 'Turn the implementation into readable docs and examples',
  '以「文档撰写者」角色工作：面向第一次接触该项目的人写，先给最常用路径的最小可用示例，':
    'Work as the Technical Writer: write for someone new to the project, starting with a minimal usable example for the most common path,',
  '再补边界与陷阱。所有示例必须能在当前仓库真实跑通（写明命令与预期输出），':
    'then cover edge cases and pitfalls. Every example must actually run in this repository (state the command and expected output);',
  '不确定的地方标注「需核实」，不编造 API。':
    'mark anything uncertain as "needs verification" and never invent APIs.',
  'OpenIdClientFlow：须先调用 discovery(config) 再构造授权 URL':
    'OpenIdClientFlow: call discovery(config) before building the authorization URL',
};
