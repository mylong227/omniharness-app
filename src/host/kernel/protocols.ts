/**
 * 内核对接面 · protocols 域 —— **自动生成，勿手改**。
 *
 * 生成器：`npm run kernel:surface`（读业务代码实际 import + 内核包 .d.ts）。
 * 门禁：`npm run kernel:check` 第 8 条拒绝漂移。新增内核符号时，在业务代码里正常 import，
 * 再跑生成器即可（无需手写 re-export）；生成物只保留实际使用的符号。
 *
 * 分域原因：按域加载——根入口整包实测 ~780ms，单域 ~60ms（Node 22，见 vendor/README.md）。
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
export { McpSseResponseTransport } from '@omniharness/kernel/protocols/mcp/mcpSseResponseTransport.js';
export type { McpSseFrame, McpSseWriter } from '@omniharness/kernel/protocols/mcp/mcpSseResponseTransport.js';
export { McpStatelessClient } from '@omniharness/kernel/protocols/mcp/mcpStatelessClient.js';
export type { McpStatelessClientOptions, McpSubscription, McpSubscriptionHandlers } from '@omniharness/kernel/protocols/mcp/mcpStatelessClient.js';
export { McpStdioTransport } from '@omniharness/kernel/protocols/mcp/mcpStdioTransport.js';
export type { McpStdioHandle, McpStdioServerOptions } from '@omniharness/kernel/protocols/mcp/mcpStdioTransport.js';
export { McpToolMapper } from '@omniharness/kernel/protocols/mcp/mcpToolMapper.js';
export { McpAuthFlow } from '@omniharness/kernel/protocols/mcp/mcpAuthFlow.js';
export { McpHttpServer } from '@omniharness/kernel/protocols/mcp/mcpHttpServer.js';
