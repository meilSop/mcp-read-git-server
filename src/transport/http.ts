/*
 * @Author: zhumanyao zhumanyao@sungrowpower.com
 * @Date: 2026-05-22 21:13:13
 * @LastEditors: zhumanyao zhumanyao@sungrowpower.com
 * @LastEditTime: 2026-06-01 12:30:00
 * @FilePath: \read-gitl\src\transport\http.ts
 * @Description: HTTP 传输 - 同时支持 Streamable HTTP 和 Legacy SSE 两种协议
 */
/**
 * HTTP 传输模式 - 远程部署
 *
 * 同时支持两种传输协议：
 * 1. Streamable HTTP (协议版本 2025-11-25)
 *    - 端点: POST/GET/DELETE /mcp
 *    - 新版 MCP 客户端使用
 *
 * 2. Legacy HTTP+SSE (协议版本 2024-11-05)
 *    - 端点: GET /sse (建立 SSE 流) + POST /messages (发送消息)
 *    - 旧版 MCP 客户端使用（如 Claude Code 的 "type": "sse" 配置）
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { randomUUID } from 'node:crypto';

// 存储所有传输实例（包括 Streamable HTTP 和 Legacy SSE），按 sessionId 索引
const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

/**
 * 创建 Streamable HTTP 传输的 MCP Server 实例
 */
function createStreamableHttpServer(serverCreator: () => McpServer): {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
} {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
  });
  const server = serverCreator();
  return { server, transport };
}

export async function startHttpTransport(
  serverCreator: () => McpServer,
  port: number,
  host: string
): Promise<void> {
  const app = express();
  app.use(express.json());

  // =====================================================================
  // Streamable HTTP 传输 (协议版本 2025-11-25)
  // =====================================================================

  const streamableHttpHandler = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // 1. 已有 session - 检查是否为 StreamableHTTP 传输
        const existingTransport = transports[sessionId];
        if (existingTransport instanceof StreamableHTTPServerTransport) {
          transport = existingTransport;
        } else {
          // Session 存在但使用的是 SSE 传输，协议不匹配
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session exists but uses a different transport protocol'
            },
            id: null
          });
          return;
        }
      } else if (req.method === 'GET' && !sessionId) {
        // 2. GET 无 session ID
        // 如果客户端不接受 SSE（如浏览器、curl、某些 MCP 客户端的健康探测），
        // 直接返回 200 JSON，说明服务可用，避免 406 导致客户端误判为不可达
        const acceptHeader = req.headers['accept'] || '';
        if (!acceptHeader.includes('text/event-stream')) {
          res.status(200).json({
            name: 'read-git MCP Server',
            version: '1.0.0',
            protocolVersion: '2025-11-25',
            transport: 'streamable-http',
            endpoints: {
              mcp: '/mcp',
              sse: '/sse',
              messages: '/messages',
              health: '/health'
            },
            hint: 'Send a POST request to /mcp with an initialize JSON-RPC message to start a session.'
          });
          return;
        }
        // 接受 SSE - 建立独立 SSE 流（服务端推送通知）
        const { server, transport: newTransport } = createStreamableHttpServer(serverCreator);
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
        const { server, transport: newTransport } = createStreamableHttpServer(serverCreator);
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
      console.error('Error handling Streamable HTTP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  };

  // Streamable HTTP 端点
  app.post('/mcp', streamableHttpHandler);
  app.get('/mcp', streamableHttpHandler);
  app.delete('/mcp', streamableHttpHandler);

  // =====================================================================
  // Legacy HTTP+SSE 传输 (协议版本 2024-11-05) — 兼容旧版客户端
  // =====================================================================

  // GET /sse - 建立 SSE 事件流
  app.get('/sse', async (_req: express.Request, res: express.Response) => {
    console.log('Received GET request to /sse (legacy SSE transport)');
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;

    res.on('close', () => {
      delete transports[transport.sessionId];
    });

    const server = serverCreator();
    await server.connect(transport);
  });

  // POST /messages - 接收客户端消息
  app.post('/messages', async (req: express.Request, res: express.Response) => {
    const sessionId = req.query.sessionId as string | undefined;

    try {
      let transport: SSEServerTransport | undefined;

      if (sessionId && transports[sessionId]) {
        const existingTransport = transports[sessionId];
        if (existingTransport instanceof SSEServerTransport) {
          transport = existingTransport;
        } else {
          // Session 存在但使用的是 StreamableHTTP 传输，协议不匹配
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session exists but uses a different transport protocol'
            },
            id: null
          });
          return;
        }
      }

      if (transport) {
        await transport.handlePostMessage(req as never, res as never, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    } catch (error) {
      console.error('Error handling legacy SSE message:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  // =====================================================================
  // 通用端点
  // =====================================================================

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', activeSessions: Object.keys(transports).length });
  });

  // 启动服务器
  app.listen(port, () => {
    console.log(`MCP Server listening on ${host}:${port}`);
    console.log(`
==============================================
SUPPORTED TRANSPORT OPTIONS:

1. Streamable HTTP (Protocol version: 2025-11-25)
   Endpoint: /mcp
   Methods: GET, POST, DELETE
   Usage:
     - Initialize with POST to /mcp
     - Establish SSE stream with GET to /mcp
     - Send requests with POST to /mcp
     - Terminate session with DELETE to /mcp

2. HTTP + SSE (Protocol version: 2024-11-05)
   Endpoints: /sse (GET) and /messages (POST)
   Usage:
     - Establish SSE stream with GET to /sse
     - Send requests with POST to /messages?sessionId=<id>
==============================================
    `);
  });

  // 优雅关闭
  const shutdown = async () => {
    console.log('Shutting down server...');
    for (const sid in transports) {
      try {
        await transports[sid].close();
        delete transports[sid];
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
