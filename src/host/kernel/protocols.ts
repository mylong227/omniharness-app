/**
 * 内核对接面 · protocols 域 —— 本目录是 app 侧唯一的 `@omniharness/kernel` 导入点
 * （`scripts/checkKernelBoundary.mjs` 第 7 条判据强制）。
 *
 * 内核升级后需要增删符号时**只改本目录**，业务代码不动。分域的原因：按域再导出保持
 * 按需加载（实测根入口整包 ~780ms vs 单深路径 ~60ms，Node 22——见 vendor/README.md）。
 * 每条 re-export 都指向内核原始深路径，便于升级时逐条对照。
 */

export { ACP_PERMISSION_MODES, AcpServer, AcpStdioTransport, AgentAcpSession } from '@omniharness/kernel/protocols/acp/index.js';
export type { AcpPermissionMode, AcpSessionOptions, AcpSessionRuntime } from '@omniharness/kernel/protocols/acp/index.js';
export { McpApprovalInputHandler } from '@omniharness/kernel/protocols/mcp/mcpApprovalInputHandler.js';
export { McpAskUserInputHandler } from '@omniharness/kernel/protocols/mcp/mcpAskUserInputHandler.js';
export { McpClient } from '@omniharness/kernel/protocols/mcp/mcpClient.js';
export type { McpClientOptions } from '@omniharness/kernel/protocols/mcp/mcpClient.js';
export { McpCompositeInputHandler } from '@omniharness/kernel/protocols/mcp/mcpCompositeInputHandler.js';
export { McpConnector } from '@omniharness/kernel/protocols/mcp/mcpConnector.js';
export type { McpConnection, McpConnectorOptions } from '@omniharness/kernel/protocols/mcp/mcpConnector.js';
export { McpGateway } from '@omniharness/kernel/protocols/mcp/mcpGateway.js';
export type { McpBridgeResult, McpGatewayOptions, McpServerConfig } from '@omniharness/kernel/protocols/mcp/mcpGateway.js';
export { McpProtocol } from '@omniharness/kernel/protocols/mcp/mcpProtocol.js';
export type { McpCacheableResult, McpCallToolResult, McpCapabilities, McpClientCapabilities, McpInitializeResult, McpInputRequestSpec, McpInputRequests, McpInputRequiredResult, McpInputResponses, McpInputSchema, McpResourceTemplate, McpServerInfo, McpSubscriptionFilter, McpTextContent, McpToolDescriptor } from '@omniharness/kernel/protocols/mcp/mcpProtocol.js';
export { McpServer } from '@omniharness/kernel/protocols/mcp/mcpServer.js';
export type { McpServerOptions } from '@omniharness/kernel/protocols/mcp/mcpServer.js';
export { McpServerCommand } from '@omniharness/kernel/protocols/mcp/mcpServerCommand.js';
export { McpSseResponseTransport } from '@omniharness/kernel/protocols/mcp/mcpSseResponseTransport.js';
export type { McpSseFrame, McpSseWriter } from '@omniharness/kernel/protocols/mcp/mcpSseResponseTransport.js';
export { McpStatelessClient } from '@omniharness/kernel/protocols/mcp/mcpStatelessClient.js';
export type { McpStatelessClientOptions, McpSubscription, McpSubscriptionHandlers } from '@omniharness/kernel/protocols/mcp/mcpStatelessClient.js';
export { McpStdioTransport } from '@omniharness/kernel/protocols/mcp/mcpStdioTransport.js';
export type { McpStdioHandle, McpStdioServerOptions } from '@omniharness/kernel/protocols/mcp/mcpStdioTransport.js';
export { McpToolMapper } from '@omniharness/kernel/protocols/mcp/mcpToolMapper.js';
export { McpAuthFlow } from '@omniharness/kernel/protocols/mcp/mcpAuthFlow.js';
export { McpHttpServer } from '@omniharness/kernel/protocols/mcp/mcpHttpServer.js';
export { McpRegistryClient } from '@omniharness/kernel/protocols/mcp/mcpRegistryClient.js';
