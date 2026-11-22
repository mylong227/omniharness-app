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
  'OpenIdClientFlow：须先调用 discovery(config) 再构造授权 URL':
    'OpenIdClientFlow: call discovery(config) before building the authorization URL',
};
