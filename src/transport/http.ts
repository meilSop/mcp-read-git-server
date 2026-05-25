/*
 * @Author: zhumanyao zhumanyao@sungrowpower.com
 * @Date: 2026-05-22 21:13:13
 * @LastEditors: zhumanyao zhumanyao@sungrowpower.com
 * @LastEditTime: 2026-05-25 09:30:28
 * @FilePath: \read-gitlabl\src\transport\http.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * Streamable HTTP 传输模式 - 远程部署
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
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
  const app = createMcpExpressApp({ host });

  // 解析 JSON body
  app.use((req: { body?: unknown }, _res: unknown, next: () => void) => {
    // Express 的 json middleware 已经解析了 body
    next();
  });

  // POST /mcp - 处理 MCP 请求
  app.post(
    '/mcp',
    async (
      req: { headers: Record<string, string | string[] | undefined>; body: unknown },
      res: {
        status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void };
        headersSent?: boolean;
      }
    ) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // 复用已有 transport
          transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // 新的初始化请求 - 创建新的 server + transport
          const { server, transport: newTransport } = getServer(serverCreator);
          transport = newTransport;
          await server.connect(transport);

          // 存储 transport
          const sid = transport.sessionId;
          if (sid) {
            transports[sid] = transport;

            // 清理已关闭的 transport
            transport.onclose = () => {
              delete transports[sid];
            };
          }

          await transport.handleRequest(req as never, res as never, req.body);
          return;
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
            id: null
          });
          return;
        }

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
    }
  );

  // GET /mcp - SSE 流
  app.get(
    '/mcp',
    async (
      req: { headers: Record<string, string | string[] | undefined> },
      res: {
        status: (code: number) => { send: (body: string) => void };
      }
    ) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      const transport = transports[sessionId];
      await transport.handleRequest(req as never, res as never);
    }
  );

  // DELETE /mcp - 会话终止
  app.delete(
    '/mcp',
    async (
      req: { headers: Record<string, string | string[] | undefined> },
      res: {
        status: (code: number) => { send: (body: string) => void };
        headersSent?: boolean;
      }
    ) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      try {
        const transport = transports[sessionId];
        await transport.handleRequest(req as never, res as never);
      } catch (error) {
        console.error('Error handling session termination:', error);
        if (!res.headersSent) {
          res.status(500).send('Error processing session termination');
        }
      }
    }
  );

  // 启动服务器
  app.listen(port, () => {
    console.log(`MCP Streamable HTTP Server listening on ${host}:${port}`);
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
