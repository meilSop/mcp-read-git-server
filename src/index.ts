#!/usr/bin/env node

/**
 * GitLab 代码阅读 MCP Server
 *
 * 支持两种传输模式：
 * - stdio: 本地运行，通过标准输入输出通信
 * - http: 远程部署，通过 Streamable HTTP 通信
 */

import 'dotenv/config';
import { GitLabClient } from './gitlab-client.js';
import { createServer } from './server.js';
import { startHttpTransport } from './transport/http.js';
import { startStdioTransport } from './transport/stdio.js';

// 读取环境变量
const GITLAB_URL = process.env.GITLAB_URL;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const MCP_TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';
const MCP_PORT = parseInt(process.env.MCP_PORT || '3000', 10);
const MCP_HOST = process.env.MCP_HOST || '0.0.0.0';

// 验证必要配置
if (!GITLAB_URL) {
  console.error('错误: GITLAB_URL 环境变量未设置。请在 .env 文件或环境变量中配置。');
  process.exit(1);
}

// 创建 GitLab 客户端
const gitlabClient = new GitLabClient({
  gitlabUrl: GITLAB_URL,
  gitlabToken: GITLAB_TOKEN
});

// 根据传输模式启动服务
async function main() {
  const transport = MCP_TRANSPORT.toLowerCase();

  if (transport === 'http') {
    // HTTP 模式 - 远程部署
    await startHttpTransport(() => createServer(gitlabClient), MCP_PORT, MCP_HOST);
  } else {
    // stdio 模式 - 本地运行
    const server = createServer(gitlabClient);
    await startStdioTransport(server);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
