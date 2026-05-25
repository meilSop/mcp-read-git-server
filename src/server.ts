/**
 * MCP Server 核心逻辑 - 注册所有工具
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as z from 'zod/v4';
import { analyzeComponent } from './code-analyzer.js';
import { GitLabClient } from './gitlab-client.js';
import {
  formatComponentDoc,
  formatFileContent,
  formatFileList,
  formatProjectList
} from './markdown-formatter.js';
import { generateDemoFiles, getTemplateNames } from './templates.js';

export function createServer(gitlabClient: GitLabClient): McpServer {
  const server = new McpServer(
    {
      name: 'read-git',
      version: '1.0.0'
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  // ==================== Tool 1: gitlab_list_projects ====================
  server.registerTool(
    'gitlab_list_projects',
    {
      title: '列出 GitLab 项目',
      description: '列出当前 Token 可访问的 GitLab 项目。可通过 search 参数搜索项目。',
      inputSchema: {
        search: z.string().optional().describe('搜索关键词'),
        page: z.number().optional().describe('页码'),
        perPage: z.number().optional().describe('每页数量，默认 20'),
        gitlabToken: z
          .string()
          .optional()
          .describe('GitLab Personal Access Token（覆盖默认 Token）')
      }
    },
    async ({ search, page, perPage, gitlabToken }) => {
      try {
        const projects = await gitlabClient.listProjects({
          search,
          page,
          perPage,
          gitlabToken
        });
        const markdown = formatProjectList(
          projects.map((p) => ({
            id: p.id,
            name: p.name,
            path_with_namespace: (p as Record<string, unknown>).path_with_namespace as
              | string
              | undefined,
            description: p.description || undefined,
            web_url: (p as Record<string, unknown>).web_url as string | undefined
          }))
        );
        return {
          content: [{ type: 'text', text: markdown }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==================== Tool 2: gitlab_list_files ====================
  server.registerTool(
    'gitlab_list_files',
    {
      title: '列出仓库文件',
      description: '列出 GitLab 仓库中指定路径下的文件和目录。',
      inputSchema: {
        projectId: z.string().describe('项目 ID 或 URL 编码的路径（如 123 或 "group/project"）'),
        path: z.string().optional().describe('目录路径，默认为根目录'),
        ref: z.string().optional().describe('分支名或标签，默认为 main'),
        gitlabToken: z
          .string()
          .optional()
          .describe('GitLab Personal Access Token（覆盖默认 Token）')
      }
    },
    async ({ projectId, path, ref, gitlabToken }) => {
      try {
        const files = await gitlabClient.listFiles({ projectId, path, ref, gitlabToken });
        const markdown = formatFileList(
          files.map((f) => ({
            name: String(f.name),
            path: String(f.path),
            type: String(f.type),
            size: (f as Record<string, unknown>).size as number | undefined
          }))
        );
        return {
          content: [{ type: 'text', text: markdown }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==================== Tool 3: gitlab_read_file ====================
  server.registerTool(
    'gitlab_read_file',
    {
      title: '读取仓库文件',
      description: '读取 GitLab 仓库中指定文件的内容，以 Markdown 代码块格式输出。',
      inputSchema: {
        projectId: z.string().describe('项目 ID 或 URL 编码的路径'),
        filePath: z.string().describe('文件路径（如 src/components/Button.vue）'),
        ref: z.string().optional().describe('分支名或标签，默认为 main'),
        gitlabToken: z
          .string()
          .optional()
          .describe('GitLab Personal Access Token（覆盖默认 Token）')
      }
    },
    async ({ projectId, filePath, ref, gitlabToken }) => {
      try {
        const file = await gitlabClient.readFile({ projectId, filePath, ref, gitlabToken });
        const markdown = formatFileContent(file.filePath, file.content);
        return {
          content: [{ type: 'text', text: markdown }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==================== Tool 4: gitlab_read_directory ====================
  server.registerTool(
    'gitlab_read_directory',
    {
      title: '读取仓库目录',
      description:
        '递归读取 GitLab 仓库中指定目录下所有文件的内容，以 Markdown 代码块格式输出。默认最多读取 20 个文件。',
      inputSchema: {
        projectId: z.string().describe('项目 ID 或 URL 编码的路径'),
        dirPath: z.string().describe('目录路径（如 src/components）'),
        ref: z.string().optional().describe('分支名或标签，默认为 main'),
        maxFiles: z.number().optional().describe('最大读取文件数，默认 20'),
        gitlabToken: z
          .string()
          .optional()
          .describe('GitLab Personal Access Token（覆盖默认 Token）')
      }
    },
    async ({ projectId, dirPath, ref, maxFiles, gitlabToken }) => {
      try {
        const files = await gitlabClient.readDirectory({
          projectId,
          dirPath,
          ref,
          maxFiles,
          gitlabToken
        });
        const parts = files.map((f) => formatFileContent(f.filePath, f.content));
        const summary = `共读取 ${files.length} 个文件：\n\n`;
        return {
          content: [{ type: 'text', text: summary + parts.join('\n') }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==================== Tool 5: gitlab_search_code ====================
  server.registerTool(
    'gitlab_search_code',
    {
      title: '搜索仓库代码',
      description: '在 GitLab 仓库中搜索代码关键词，返回匹配的文件和代码片段。',
      inputSchema: {
        projectId: z.string().describe('项目 ID 或 URL 编码的路径'),
        query: z.string().describe('搜索关键词'),
        ref: z.string().optional().describe('分支名或标签'),
        gitlabToken: z
          .string()
          .optional()
          .describe('GitLab Personal Access Token（覆盖默认 Token）')
      }
    },
    async ({ projectId, query, ref, gitlabToken }) => {
      try {
        const results = await gitlabClient.searchCode({ projectId, query, ref, gitlabToken });
        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `未找到匹配 "${query}" 的代码。` }]
          };
        }
        const parts = results.map((r) => {
          let text = `### ${r.filePath}`;
          if (r.startLine) text += ` (第 ${r.startLine} 行)`;
          text += `\n\n\`\`\`\n${r.data}\n\`\`\`\n`;
          return text;
        });
        return {
          content: [
            { type: 'text', text: `找到 ${results.length} 个匹配结果：\n\n` + parts.join('\n') }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==================== Tool 6: gitlab_analyze_component ====================
  const templateDesc = `指定输出文档模板。内置模板: ${getTemplateNames().join(', ')}；也可传入自定义模板字符串（使用 {{变量名}} 占位符）。默认 component`;

  server.registerTool(
    'gitlab_analyze_component',
    {
      title: '分析组件结构',
      description:
        '分析 GitLab 仓库中指定组件文件的代码结构（Props、Methods、Events、Imports、Exports 等），输出结构化的 Markdown 文档。支持 Vue/React/TypeScript 组件。可通过 template 参数选择内置模板或传入自定义模板。',
      inputSchema: {
        projectId: z.string().describe('项目 ID 或 URL 编码的路径'),
        filePath: z.string().describe('组件文件路径（如 src/components/Button.vue）'),
        ref: z.string().optional().describe('分支名或标签，默认为 main'),
        template: z.string().optional().describe(templateDesc),
        gitlabToken: z
          .string()
          .optional()
          .describe('GitLab Personal Access Token（覆盖默认 Token）')
      }
    },
    async ({ projectId, filePath, ref, template, gitlabToken }) => {
      try {
        const file = await gitlabClient.readFile({ projectId, filePath, ref, gitlabToken });
        const analysis = analyzeComponent(file.filePath, file.content);
        const markdown = formatComponentDoc(analysis, template);
        return {
          content: [{ type: 'text', text: markdown }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==================== Tool 8: gitlab_generate_demos ====================
  server.registerTool(
    'gitlab_generate_demos',
    {
      title: '生成组件文档与 Demo 文件',
      description:
        '根据组件分析结果自动生成使用案例 (demo) 文件和使用文档 (index.md)，所有文件输出到以组件名称命名的同一文件夹中。文档使用 ui-doc 模板（案例在上 + API 在下，Element Plus 风格），demo 文件根据 Props/Events/Slots 自动推断场景。',
      inputSchema: {
        projectId: z.string().describe('项目 ID 或 URL 编码的路径'),
        filePath: z.string().describe('组件文件路径（如 src/components/Button.vue）'),
        ref: z.string().optional().describe('分支名或标签，默认为 main'),
        outputDir: z
          .string()
          .optional()
          .describe('输出根目录，默认为 ./output。文件将输出到 {outputDir}/{componentName}/ 下'),
        gitlabToken: z
          .string()
          .optional()
          .describe('GitLab Personal Access Token（覆盖默认 Token）')
      }
    },
    async ({ projectId, filePath, ref, outputDir, gitlabToken }) => {
      try {
        const file = await gitlabClient.readFile({ projectId, filePath, ref, gitlabToken });
        const analysis = analyzeComponent(file.filePath, file.content);
        const demos = generateDemoFiles(analysis);

        // 组件名称作为文件夹名，所有文件输出到同一目录
        const dir = outputDir
          ? path.join(outputDir, analysis.componentName)
          : path.join(process.cwd(), 'output', analysis.componentName);
        fs.mkdirSync(dir, { recursive: true });

        const savedFiles: string[] = [];

        // 1. 生成 demo 文件
        if (demos.length > 0) {
          for (const demo of demos) {
            const outputPath = path.join(dir, demo.filename);
            fs.writeFileSync(outputPath, demo.content, 'utf-8');
            savedFiles.push(`- ${outputPath}`);
          }
        }

        // 2. 生成 index.md 使用文档（ui-doc 模板）
        const markdown = formatComponentDoc(analysis, 'ui-doc');
        const indexPath = path.join(dir, 'index.md');
        fs.writeFileSync(indexPath, markdown, 'utf-8');
        savedFiles.unshift(`- ${indexPath}`); // index.md 放在最前面

        return {
          content: [
            {
              type: 'text',
              text: `已为组件 ${analysis.componentName} 生成文档与案例，输出目录：${dir}\n\n${savedFiles.join('\n')}\n\n文件结构：\n${dir}/\n├── index.md${demos.map((d, i) => `\n├── ${d.filename}`).join('')}\n\n请在 index.md 的 <demo> 标签 src 中引用同目录下的 demo 文件，根据实际业务修改 demo 内容后即可使用。`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==================== Tool 7: gitlab_save_documentation ====================
  server.registerTool(
    'gitlab_save_documentation',
    {
      title: '保存文档',
      description: '将 Markdown 文档内容保存为 .md 文件，可下载使用。',
      inputSchema: {
        content: z.string().describe('Markdown 文档内容'),
        filename: z.string().describe('文件名（如 component-docs.md）'),
        outputDir: z.string().optional().describe('输出目录路径，默认为 ./output')
      }
    },
    async ({ content, filename, outputDir }) => {
      try {
        const dir = outputDir || path.join(process.cwd(), 'output');
        const outputPath = path.join(dir, filename);

        // 确保目录存在
        fs.mkdirSync(dir, { recursive: true });

        // 写入文件
        fs.writeFileSync(outputPath, content, 'utf-8');

        return {
          content: [
            {
              type: 'text',
              text: `文档已保存至: ${outputPath}\n\n文件大小: ${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  return server;
}
