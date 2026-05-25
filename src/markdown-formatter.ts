/**
 * Markdown 格式化输出模块
 */
import type { ComponentAnalysis } from './code-analyzer.js';
import { renderTemplate, resolveTemplate } from './templates.js';

/**
 * 将组件分析结果格式化为 Markdown 文档
 * @param analysis 组件分析结果
 * @param template 内置模板名称或自定义模板字符串，默认 'component'
 */
export function formatComponentDoc(analysis: ComponentAnalysis, template?: string): string {
  const resolvedTemplate = resolveTemplate(template || 'component');
  return renderTemplate(resolvedTemplate, analysis);
}

/**
 * 将文件内容格式化为 Markdown 代码块
 */
export function formatFileContent(filePath: string, content: string): string {
  const ext = filePath.split('.').pop() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'vue',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    json: 'json',
    md: 'markdown',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust'
  };
  const lang = langMap[ext] || ext;
  return `\n### ${filePath}\n\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
}

/**
 * 将文件列表格式化为 Markdown 表格
 */
export function formatFileList(
  files: Array<{ name: string; path: string; type: string; size?: number }>
): string {
  const lines: string[] = [];
  lines.push('| 名称 | 路径 | 类型 | 大小 |');
  lines.push('|------|------|------|------|');
  for (const file of files) {
    const type = file.type === 'tree' ? '目录' : '文件';
    const size = file.size ? `${(file.size / 1024).toFixed(1)} KB` : '-';
    lines.push(`| ${file.name} | \`${file.path}\` | ${type} | ${size} |`);
  }
  return lines.join('\n');
}

/**
 * 将项目列表格式化为 Markdown 表格
 */
export function formatProjectList(
  projects: Array<{
    id: number | string;
    name: string;
    path_with_namespace?: string;
    description?: string;
    web_url?: string;
  }>
): string {
  const lines: string[] = [];
  lines.push('| ID | 名称 | 路径 | 描述 | URL |');
  lines.push('|-----|------|------|------|-----|');
  for (const project of projects) {
    const desc = project.description || '-';
    const url = project.web_url || '-';
    const path = project.path_with_namespace || '-';
    lines.push(`| ${project.id} | ${project.name} | \`${path}\` | ${desc} | ${url} |`);
  }
  return lines.join('\n');
}
