# read-git MCP Server

一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的 GitLab 代码阅读服务，支持读取公司私有仓库代码、分析组件结构，并以 Element Plus 风格自动生成 UI 组件使用文档（含 demo 案例文件），也可将文档保存为 `.md` 文件下载。

---

## 功能特性

- **读取私有 GitLab 仓库**：列举项目、浏览文件结构、读取文件/目录内容、代码搜索
- **组件结构分析**：自动解析 Vue 2 / Vue 3 / React / TypeScript 组件的 Props、Events、Slots、Methods
- **UI 文档一键生成**：基于组件分析，生成 Element Plus 风格文档（案例在上 + API 在下），并同步生成各场景 demo 文件
- **多模板支持**：内置 `component`、`api-reference`、`quick-start`、`minimal`、`ui-doc` 五种模板，也支持自定义模板
- **双 Token 策略**：服务端配置默认 Token，每个工具调用均可通过参数单独覆盖
- **双传输模式**：`stdio`（本地 AI 编辑器）+ `http`（服务端部署，兼容新旧两种 MCP 协议）

---

## 快速开始

### 1. 安装依赖 & 构建

```bash
npm install
npm run build
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# GitLab 配置（必填）
GITLAB_URL=https://gitlab.your-company.com
GITLAB_TOKEN=your-personal-access-token

# 传输模式: stdio（本地）| http（服务端）
MCP_TRANSPORT=stdio

# HTTP 模式端口（仅 MCP_TRANSPORT=http 时生效）
MCP_PORT=3000
MCP_HOST=0.0.0.0
```

### 3. 启动服务

```bash
# stdio 模式（供 AI 编辑器本地调用）
npm start

# HTTP 模式（服务端部署）
MCP_TRANSPORT=http npm start
```

---

## 部署方式

### 方式一：本地 stdio 模式

适用于 Claude Desktop、Cursor、VS Code 等本地 AI 编辑器直接调用。

```bash
MCP_TRANSPORT=stdio node dist/index.js
```

### 方式二：HTTP 服务端模式

适用于部署到服务器，供公司智能体平台通过 HTTP 接入。

```bash
MCP_TRANSPORT=http MCP_PORT=3000 node dist/index.js
```

HTTP 模式同时支持两种传输协议，兼容新旧 MCP 客户端：

| 协议            | 端点                          | 协议版本   | 说明                     |
| --------------- | ----------------------------- | ---------- | ------------------------ |
| Streamable HTTP | `POST/GET/DELETE /mcp`        | 2025-11-25 | 新版客户端（推荐）       |
| Legacy HTTP+SSE | `GET /sse` + `POST /messages` | 2024-11-05 | 旧版客户端兼容           |
| 健康检查        | `GET /health`                 | —          | 返回服务状态和活跃会话数 |

### 方式三：Docker 部署

```bash
# 构建镜像
docker build -t read-git-mcp .

# 运行容器
docker run -d \
  --name read-git-mcp \
  --restart unless-stopped \
  -e GITLAB_URL=https://gitlab.your-company.com \
  -e GITLAB_TOKEN=your-personal-access-token \
  -e MCP_TRANSPORT=http \
  -e MCP_PORT=3000 \
  -p 3000:3000 \
  -v /data/read-git-mcp/output:/app/output \
  read-git-mcp
```

**Nginx 反向代理（生产环境推荐 HTTPS）：**

```nginx
server {
    listen 443 ssl;
    server_name mcp-gitlab.your-company.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location /mcp {
        proxy_pass http://127.0.0.1:3000/mcp;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_read_timeout 86400s;
    }

    location ~ ^/(sse|messages|health) {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_buffering off;
    }
}
```

---

## AI 编辑器配置

### Claude Desktop

配置文件路径：`~/Library/Application Support/Claude/claude_desktop_config.json`（Windows：`%APPDATA%\Claude\claude_desktop_config.json`）

**stdio 本地模式：**

```json
{
  "mcpServers": {
    "read-git": {
      "command": "node",
      "args": ["/path/to/read-gitl/dist/index.js"],
      "env": {
        "GITLAB_URL": "https://gitlab.your-company.com",
        "GITLAB_TOKEN": "your-personal-access-token"
      }
    }
  }
}
```

**HTTP 远程模式（Streamable HTTP）：**

```json
{
  "mcpServers": {
    "read-git": {
      "url": "https://mcp-gitlab.your-company.com/mcp"
    }
  }
}
```

---

### Cursor

配置文件路径：`~/.cursor/mcp.json`

**stdio 本地模式：**

```json
{
  "mcpServers": {
    "read-git": {
      "command": "node",
      "args": ["/path/to/read-gitl/dist/index.js"],
      "env": {
        "GITLAB_URL": "https://gitlab.your-company.com",
        "GITLAB_TOKEN": "your-personal-access-token"
      }
    }
  }
}
```

**HTTP 远程模式：**

```json
{
  "mcpServers": {
    "read-git": {
      "url": "https://mcp-gitlab.your-company.com/mcp"
    }
  }
}
```

**HTTP SEE：**

```json
{
  "mcpServers": {
    "read-git": {
      "type": "sse",
      "url"："https://mcp-gitlab.your-company.com/sse"
    }
  }
}
```

---

### VS Code（Cline / Continue）

**Cline** 配置文件：`~/.vscode/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "read-git": {
      "command": "node",
      "args": ["/path/to/read-gitl/dist/index.js"],
      "env": {
        "GITLAB_URL": "https://gitlab.your-company.com",
        "GITLAB_TOKEN": "your-personal-access-token"
      }
    }
  }
}
```

**Continue** 配置文件：`~/.continue/config.json`

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["/path/to/read-gitl/dist/index.js"],
          "env": {
            "GITLAB_URL": "https://gitlab.your-company.com",
            "GITLAB_TOKEN": "your-personal-access-token"
          }
        }
      }
    ]
  }
}
```

---

### Windsurf

配置文件路径：`~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "read-git": {
      "command": "node",
      "args": ["/path/to/read-gitl/dist/index.js"],
      "env": {
        "GITLAB_URL": "https://gitlab.your-company.com",
        "GITLAB_TOKEN": "your-personal-access-token"
      }
    }
  }
}
```

---

### JetBrains AI Assistant

进入 **Settings → Tools → AI Assistant → Model Context Protocol**，选择 **Command** 类型，填入：

- **Command**: `node`
- **Arguments**: `/path/to/read-gitl/dist/index.js`
- **Environment variables**:
  - `GITLAB_URL` = `https://gitlab.your-company.com`
  - `GITLAB_TOKEN` = `your-personal-access-token`

---

### CodeBuddy（腾讯云代码助手）

CodeBuddy 支持 **IDE 版**和 **VS Code 插件版**两种形式，配置方式相同。

在侧栏对话面板右上角点击 **CodeBuddy Settings → MCP 标签页**，打开配置文件后添加：

**本地 stdio 模式：**

```json
{
  "mcpServers": {
    "read-git": {
      "command": "node",
      "args": ["/path/to/read-gitlabl/dist/index.js"],
      "env": {
        "GITLAB_URL": "https://gitlab.your-company.com",
        "GITLAB_TOKEN": "your-personal-access-token"
      }
    }
  }
}
```

**远程 HTTP 模式（Streamable HTTP）：**

```json
{
  "mcpServers": {
    "read-git": {
      "url": "https://mcp-gitlab.your-company.com/mcp"
    }
  }
}
```

**远程 HTTP+SSE 模式：**

```json
{
  "mcpServers": {
    "read-git": {
      "type": "sse",
      "url": "https://mcp-gitlab.your-company.com/sse"
    }
  }
}
```

> **配置文件位置**：CodeBuddy IDE 版配置文件通常位于用户目录下的 `.codebuddy/mcp_settings.json`；VS Code 插件版在 VS Code 的 `settings.json` 中或通过界面直接编辑。

---

## MCP 工具列表

服务共提供 **8 个工具**，所有工具均支持通过 `gitlabToken` 参数覆盖服务端默认 Token。

### 1. `gitlab_list_projects` — 列出项目

列出当前 Token 可访问的 GitLab 项目。

| 参数          | 类型   | 必填 | 说明              |
| ------------- | ------ | ---- | ----------------- |
| `search`      | string | 否   | 搜索关键词        |
| `page`        | number | 否   | 页码              |
| `perPage`     | number | 否   | 每页数量，默认 20 |
| `gitlabToken` | string | 否   | 覆盖默认 Token    |

---

### 2. `gitlab_list_files` — 列出仓库文件

列出仓库中指定路径下的文件和目录。

| 参数          | 类型   | 必填 | 说明                            |
| ------------- | ------ | ---- | ------------------------------- |
| `projectId`   | string | 是   | 项目 ID 或 `group/project` 路径 |
| `path`        | string | 否   | 目录路径，默认为根目录          |
| `ref`         | string | 否   | 分支名或标签，默认 `main`       |
| `gitlabToken` | string | 否   | 覆盖默认 Token                  |

---

### 3. `gitlab_read_file` — 读取文件内容

读取仓库中指定文件的内容，以 Markdown 代码块格式输出。

| 参数          | 类型   | 必填 | 说明                                     |
| ------------- | ------ | ---- | ---------------------------------------- |
| `projectId`   | string | 是   | 项目 ID 或路径                           |
| `filePath`    | string | 是   | 文件路径，如 `src/components/Button.vue` |
| `ref`         | string | 否   | 分支名或标签                             |
| `gitlabToken` | string | 否   | 覆盖默认 Token                           |

---

### 4. `gitlab_read_directory` — 递归读取目录

递归读取指定目录下所有文件的内容。

| 参数          | 类型   | 必填 | 说明                          |
| ------------- | ------ | ---- | ----------------------------- |
| `projectId`   | string | 是   | 项目 ID 或路径                |
| `dirPath`     | string | 是   | 目录路径，如 `src/components` |
| `ref`         | string | 否   | 分支名或标签                  |
| `maxFiles`    | number | 否   | 最大读取文件数，默认 20       |
| `gitlabToken` | string | 否   | 覆盖默认 Token                |

---

### 5. `gitlab_search_code` — 搜索代码

在仓库中全文搜索代码关键词。

| 参数          | 类型   | 必填 | 说明           |
| ------------- | ------ | ---- | -------------- |
| `projectId`   | string | 是   | 项目 ID 或路径 |
| `query`       | string | 是   | 搜索关键词     |
| `ref`         | string | 否   | 分支名或标签   |
| `gitlabToken` | string | 否   | 覆盖默认 Token |

---

### 6. `gitlab_analyze_component` — 分析组件结构

分析 Vue / React / TypeScript 组件文件，提取 Props、Events、Slots、Methods，输出结构化 Markdown 文档。

| 参数          | 类型   | 必填 | 说明                     |
| ------------- | ------ | ---- | ------------------------ |
| `projectId`   | string | 是   | 项目 ID 或路径           |
| `filePath`    | string | 是   | 组件文件路径             |
| `ref`         | string | 否   | 分支名或标签             |
| `template`    | string | 否   | 文档模板，见下方模板说明 |
| `gitlabToken` | string | 否   | 覆盖默认 Token           |

---

### 7. `gitlab_generate_demos` — 生成组件文档与 Demo 文件

**一键生成**：根据组件分析自动创建 `index.md`（ui-doc 模板）和多个 demo 文件，所有文件输出到以组件名命名的同一文件夹下。

| 参数          | 类型   | 必填 | 说明                                                            |
| ------------- | ------ | ---- | --------------------------------------------------------------- |
| `projectId`   | string | 是   | 项目 ID 或路径                                                  |
| `filePath`    | string | 是   | 组件文件路径                                                    |
| `ref`         | string | 否   | 分支名或标签                                                    |
| `outputDir`   | string | 否   | 输出根目录，默认 `./output`，文件输出到 `{outputDir}/{组件名}/` |
| `gitlabToken` | string | 否   | 覆盖默认 Token                                                  |

**输出文件结构：**

```
output/
└── Button/
    ├── index.md       ← ui-doc 风格使用文档
    ├── demo.vue       ← 基础用法
    ├── demo2.vue      ← 枚举属性模式
    └── demo3.vue      ← 事件/插槽场景
```

**Demo 场景自动推断规则：**

| 场景             | 触发条件                               | 文件名        |
| ---------------- | -------------------------------------- | ------------- |
| 基础用法         | 始终生成                               | `demo.vue`    |
| 枚举属性模式     | Prop 类型为联合类型（如 `'a' \| 'b'`） | `demo2.vue`   |
| Boolean 属性开启 | Prop 类型为 `boolean` 且默认非 `true`  | `demo{n}.vue` |
| 事件监听         | 组件有 Events                          | `demo{n}.vue` |
| 自定义插槽       | 组件有 Slots                           | `demo{n}.vue` |

---

### 8. `gitlab_save_documentation` — 保存文档

将 Markdown 内容保存为 `.md` 文件。

| 参数        | 类型   | 必填 | 说明                      |
| ----------- | ------ | ---- | ------------------------- |
| `content`   | string | 是   | Markdown 文档内容         |
| `filename`  | string | 是   | 文件名，如 `Button.md`    |
| `outputDir` | string | 否   | 输出目录，默认 `./output` |

---

## 文档模板说明

`gitlab_analyze_component` 的 `template` 参数支持以下内置模板：

| 模板名          | 说明                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| `component`     | 完整组件文档（默认），含基本信息、Props、Methods、Events、Slots             |
| `api-reference` | API 参考风格，侧重属性/事件/方法详细说明                                    |
| `quick-start`   | 快速上手风格，侧重引入方式和基础用法                                        |
| `minimal`       | 精简摘要，仅输出关键信息行内展示                                            |
| `ui-doc`        | **UI 组件库文档风格**（Element Plus / Ant Design Vue），案例在上 + API 在下 |

也可传入**自定义模板字符串**，使用 `{{变量名}}` 占位符：

```
template: "# {{componentName}}\n\n**Props**: {{propsInline}}\n**Events**: {{eventsInline}}"
```

**支持的模板变量：**

| 变量                                                                         | 说明                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------- |
| `{{componentName}}`                                                          | 组件名称                                  |
| `{{description}}`                                                            | 组件描述                                  |
| `{{filePath}}`                                                               | 文件路径                                  |
| `{{language}}`                                                               | 语言类型（vue / react / typescript）      |
| `{{propsTable}}`                                                             | Props 表格（Markdown）                    |
| `{{eventsTable}}`                                                            | Events 表格                               |
| `{{slotsTable}}`                                                             | Slots 表格                                |
| `{{methodsTable}}`                                                           | Methods 表格                              |
| `{{propsApiTable}}`                                                          | Props API 表格（ui-doc 风格，含可选值列） |
| `{{eventsApiTable}}`                                                         | Events API 表格（ui-doc 风格）            |
| `{{slotsApiTable}}`                                                          | Slots API 表格（ui-doc 风格）             |
| `{{methodsApiTable}}`                                                        | Methods API 表格（ui-doc 风格）           |
| `{{demosBlock}}`                                                             | demo 引用区块（`<demo>` 标签集合）        |
| `{{propsCount}}` / `{{eventsCount}}` / `{{slotsCount}}` / `{{methodsCount}}` | 数量统计                                  |
| `{{propsInline}}` / `{{eventsInline}}` / `{{methodsInline}}`                 | 行内逗号分隔列表                          |

**条件块语法**（变量为空时自动移除整段）：

```
{{#if props}}
## Props
{{propsTable}}
{{/if}}
```

---

## ui-doc 模板文档结构

`ui-doc` 模板遵循 Element Plus / Ant Design Vue 组件文档风格，`<demo>` 标签引用同目录下的 demo 文件：

```markdown
# Button 按钮

组件描述

## 基础用法

<demo title="基础用法" description="Button 组件的基础用法。" src="./demo.vue" />

## type 模式

<demo title="type 模式" description="通过 `type` 属性设置为 `primary`、`success` 切换不同模式。" src="./demo2.vue" />

## API

### Attributes

| 属性名 | 说明 | 类型 | 可选值 | 默认值 |

### Events

| 事件名 | 说明 | 回调参数 |

### Slots

| 插槽名 | 说明 |

### Methods

| 方法名 | 说明 | 参数 | 返回值 |
```

**`<demo>` 标签属性：**

| 属性          | 说明                                                 |
| ------------- | ---------------------------------------------------- |
| `title`       | 案例标题                                             |
| `description` | 案例说明，支持 Markdown 行内语法（反引号等自动转义） |
| `src`         | demo 文件相对路径，如 `./demo.vue`                   |

---

## 典型使用流程

### 场景一：为组件编写 UI 风格使用文档（推荐）

```
1. 调用 gitlab_generate_demos
   → 自动在 ./output/{组件名}/ 下生成 index.md + demo 文件

2. 根据实际业务完善 demo 文件内容

3. index.md 和 demo 文件同级，<demo src="./demo.vue"> 直接引用
```

### 场景二：快速分析组件结构

```
1. 调用 gitlab_list_projects 找到项目
2. 调用 gitlab_list_files 查看文件结构
3. 调用 gitlab_analyze_component 分析组件（指定 template 参数）
4. 调用 gitlab_save_documentation 保存文档
```

### 场景三：批量阅读目录代码

```
1. 调用 gitlab_read_directory 一次性读取整个目录
2. AI 理解组件间关系和整体架构
3. 输出分析报告或文档
```

---

## 项目结构

```
read-gitl/
├── src/
│   ├── index.ts              # 主入口，根据模式选择传输方式
│   ├── server.ts             # MCP Server 核心，注册 8 个工具
│   ├── gitlab-client.ts      # GitLab API 封装（双 Token 策略）
│   ├── code-analyzer.ts      # 代码结构分析器（Vue/React/TS）
│   ├── markdown-formatter.ts # Markdown 格式化输出
│   ├── templates.ts          # 模板引擎 + demo 生成（5 个内置模板）
│   └── transport/
│       ├── stdio.ts          # stdio 本地传输
│       └── http.ts           # HTTP 传输（Streamable HTTP + Legacy SSE 双协议）
├── dist/                     # 编译产物（npm run build 生成）
├── output/                   # 文档/demo 默认输出目录
├── Dockerfile
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 环境变量说明

| 变量            | 必填   | 默认值    | 说明                                                                               |
| --------------- | ------ | --------- | ---------------------------------------------------------------------------------- |
| `GITLAB_URL`    | **是** | —         | GitLab 实例地址，如 `https://gitlab.example.com`                                   |
| `GITLAB_TOKEN`  | 否     | —         | 服务端默认 Personal Access Token（需 `read_api` 权限）。不设置时需每次工具调用传入 |
| `MCP_TRANSPORT` | 否     | `stdio`   | 传输模式：`stdio` 或 `http`                                                        |
| `MCP_PORT`      | 否     | `3000`    | HTTP 模式监听端口                                                                  |
| `MCP_HOST`      | 否     | `0.0.0.0` | HTTP 模式监听地址                                                                  |

---

## 常见问题

**Q: 浏览器访问 `/mcp` 报 "Not Acceptable: Client must accept text/event-stream"？**

A: 正常现象。`/mcp` 是 MCP 协议端点，不是普通 HTTP 接口，需用 MCP 客户端调用。可通过 `GET /health` 验证服务是否正常运行。

**Q: 调用工具时报 "Bad Request: No valid session ID"？**

A: MCP Streamable HTTP 协议要求先发送 `initialize` 请求建立会话，再发送后续请求。请使用支持 MCP 协议的客户端，或参考 MCP Inspector 调试工具。

**Q: 如何调试 HTTP 模式？**

```bash
npx @modelcontextprotocol/inspector
```

浏览器打开后选择 `Streamable HTTP`，URL 填 `http://localhost:3000/mcp` 即可可视化调试。

**Q: Token 如何管理？**

服务端通过环境变量 `GITLAB_TOKEN` 设置默认 Token；每次工具调用可通过 `gitlabToken` 参数临时覆盖，适合多账号场景。
