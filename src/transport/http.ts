/*
 * @Author: zhumanyao zhumanyao@sungrowpower.com
 * @Date: 2026-05-22 21:13:13
 * @LastEditors: zhumanyao zhumanyao@sungrowpower.com
 * @LastEditTime: 2026-05-25 09:30:28
 * @FilePath: \read-gitl\src\transport\http.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * Streamable HTTP 传输模式 - 远程部署
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { randomUUID } from 'node:crypto';

const transports: Record<string, StreamableHTTPServerTransport> = {};

/**
 * 创建并返回一个已连接到 transport 的 MCP Server 实例
 */
function getServer(creator: () => McpServer): {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
} {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
  });
  const server = creator();
  return { server, transport };
}

export async function startHttpTransport(
  serverCreator: () => McpServer,
  port: number,
  host: string
): Promise<void> {
  const app = express();
  app.use(express.json());

  // 统一 MCP 端点 - 处理 POST / GET / DELETE
  // MCP Streamable HTTP 协议要求所有方法共用同一个端点
  const mcpHandler = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // 1. 已有 session - 复用 transport
        transport = transports[sessionId];
      } else if (req.method === 'GET' && !sessionId) {
        // 2. GET 无 session ID - 建立独立 SSE 流（服务端推送通知）
        const { server, transport: newTransport } = getServer(serverCreator);
        transport = newTransport;
        await server.connect(transport);

        const sid = transport.sessionId;
        if (sid) {
          transports[sid] = transport;
          transport.onclose = () => {
            delete transports[sid];
          };
        }
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // 3. POST initialize 无 session ID - 创建新会话
        const { server, transport: newTransport } = getServer(serverCreator);
        transport = newTransport;
        await server.connect(transport);

        const sid = transport.sessionId;
        if (sid) {
          transports[sid] = transport;
          transport.onclose = () => {
            delete transports[sid];
          };
        }
      } else {
        // 4. POST 非 initialize 且无 session ID - 非法请求
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided. Send an initialize request first.'
          },
          id: null
        });
        return;
      }

      // 将请求透传给 SDK 的 transport.handleRequest
      await transport.handleRequest(req as never, res as never, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  };

  // POST /mcp - 处理 MCP JSON-RPC 请求
  app.post('/mcp', mcpHandler);

  // GET /mcp - SSE 流（服务端推送通知）
  app.get('/mcp', mcpHandler);

  // DELETE /mcp - 会话终止
  app.delete('/mcp', mcpHandler);

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', activeSessions: Object.keys(transports).length });
  });

  // 启动服务器
  app.listen(port, () => {
    console.log(`MCP Streamable HTTP Server listening on ${host}:${port}`);
    console.log(`Endpoints: POST/GET/DELETE http://${host}:${port}/mcp`);
    console.log(`Health check: http://${host}:${port}/health`);
  });

  // 优雅关闭
  const shutdown = async () => {
    console.log('Shutting down server...');
    for (const sid in transports) {
      try {
        await transports[sid].close();
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
