import type {
  ProjectSchema,
  RepositoryFileExpandedSchema,
  RepositoryTreeSchema
} from '@gitbeaker/core';
import { Gitlab } from '@gitbeaker/rest';

export interface GitLabClientConfig {
  gitlabUrl: string;
  gitlabToken?: string;
}

export class GitLabClient {
  private defaultToken?: string;
  private gitlabUrl: string;

  constructor(config: GitLabClientConfig) {
    this.gitlabUrl = config.gitlabUrl;
    this.defaultToken = config.gitlabToken;
  }

  private createApi(overrideToken?: string): InstanceType<typeof Gitlab> {
    const token = overrideToken || this.defaultToken;
    if (!token) {
      throw new Error(
        'GitLab Token 未配置。请设置 GITLAB_TOKEN 环境变量或在工具参数中传入 gitlabToken。'
      );
    }
    return new Gitlab({
      host: this.gitlabUrl,
      token
    });
  }

  /**
   * 列出可访问的项目
   */
  async listProjects(params: {
    search?: string;
    page?: number;
    perPage?: number;
    gitlabToken?: string;
  }): Promise<ProjectSchema[]> {
    const api = this.createApi(params.gitlabToken);
    const projects = await api.Projects.all({
      search: params.search,
      pagination: 'offset',
      page: params.page,
      perPage: params.perPage || 20,
      membership: true,
      simple: true
    });
    return projects as ProjectSchema[];
  }

  /**
   * 列出仓库指定路径下的文件/目录
   */
  async listFiles(params: {
    projectId: string | number;
    path?: string;
    ref?: string;
    gitlabToken?: string;
  }): Promise<RepositoryTreeSchema[]> {
    const api = this.createApi(params.gitlabToken);
    const tree = await api.Repositories.allRepositoryTrees(params.projectId, {
      path: params.path,
      ref: params.ref || 'main'
    });
    return tree as RepositoryTreeSchema[];
  }

  /**
   * 读取仓库中指定文件的内容
   */
  async readFile(params: {
    projectId: string | number;
    filePath: string;
    ref?: string;
    gitlabToken?: string;
  }): Promise<{ content: string; fileName: string; filePath: string; size: number }> {
    const api = this.createApi(params.gitlabToken);
    const ref = params.ref || 'main';
    const file = (await api.RepositoryFiles.show(
      params.projectId,
      params.filePath,
      ref
    )) as RepositoryFileExpandedSchema;
    const content = Buffer.from(
      file.content as string,
      (file.encoding as BufferEncoding) || 'base64'
    ).toString('utf-8');
    return {
      content,
      fileName: file.file_name as string,
      filePath: file.file_path as string,
      size: file.size as number
    };
  }

  /**
   * 递归读取目录下所有文件内容
   */
  async readDirectory(params: {
    projectId: string | number;
    dirPath: string;
    ref?: string;
    maxFiles?: number;
    gitlabToken?: string;
  }): Promise<Array<{ filePath: string; content: string; size: number }>> {
    const api = this.createApi(params.gitlabToken);
    const ref = params.ref || 'main';
    const maxFiles = params.maxFiles || 20;

    // 递归获取目录树
    const tree = (await api.Repositories.allRepositoryTrees(params.projectId, {
      path: params.dirPath,
      ref
    })) as RepositoryTreeSchema[];

    // 只取文件（非目录），限制数量
    const files = tree.filter((item) => item.type === 'blob').slice(0, maxFiles);

    const results: Array<{ filePath: string; content: string; size: number }> = [];

    for (const file of files) {
      try {
        const fileData = (await api.RepositoryFiles.show(
          params.projectId,
          file.path as string,
          ref
        )) as RepositoryFileExpandedSchema;
        const content = Buffer.from(
          fileData.content as string,
          (fileData.encoding as BufferEncoding) || 'base64'
        ).toString('utf-8');
        results.push({
          filePath: file.path as string,
          content,
          size: fileData.size as number
        });
      } catch (error) {
        results.push({
          filePath: file.path as string,
          content: `[读取文件失败: ${error instanceof Error ? error.message : String(error)}]`,
          size: 0
        });
      }
    }

    return results;
  }

  /**
   * 在仓库中搜索代码
   */
  async searchCode(params: {
    projectId: string | number;
    query: string;
    ref?: string;
    gitlabToken?: string;
  }): Promise<Array<{ filePath: string; startLine: number; data: string }>> {
    const api = this.createApi(params.gitlabToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchApi = api.Search as any;
    const results = await searchApi.all('blobs', params.query, {
      projectId: String(params.projectId),
      ref: params.ref
    });

    return (Array.isArray(results) ? results : []).map((item: Record<string, unknown>) => ({
      filePath: String(item.path || ''),
      startLine: Number(item.startline || 0),
      data: String(item.data || '')
    }));
  }
}
