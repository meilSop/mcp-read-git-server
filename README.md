# read-git MCP Server

一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的 GitLab 代码阅读服务，支持读取公司私有仓库代码、分析组件结构，并输出结构化的 Markdown 文档，也可保存为 `.md` 文件下载。

## 特性

- 读取 GitLab 私有仓库中的文件和目录
- 代码结构分析（支持 Vue 2/3、React、TypeScript 组件）
- 结构化 Markdown 文档输出
- 保存文档为 `.md` 文件
- **双模式部署**：stdio 本地运行 + Streamable HTTP 远程部署
- **双 Token 策略**：服务端默认 Token + 用户传入 Token 覆盖

## 技术栈

| 技术                      | 版本  | 用途                  |
| ------------------------- | ----- | --------------------- |
| TypeScript                | 6.x   | 开发语言              |
| @modelcontextprotocol/sdk | 1.x   | MCP 协议实现          |
| @gitbeaker/rest           | 43.x  | GitLab API 客户端     |
| Express                   | 5.x   | HTTP 服务（远程模式） |
| Zod                       | 4.x   | 参数校验              |
| Node.js                   | >= 18 | 运行时                |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译

```bash
npm run build
```

### 3. 配置环境变量

复制示例配置文件并填写：

```bash
cp .env.example .env
```

`.env` 文件内容：

```env
# GitLab 配置（必填）
GITLAB_URL=https://gitlab.your-company.com
GITLAB_TOKEN=your-personal-access-token

# MCP 传输模式: stdio | http（默认 stdio）
MCP_TRANSPORT=stdio

# HTTP 模式配置（仅 MCP_TRANSPORT=http 时生效）
MCP_PORT=3000
MCP_HOST=0.0.0.0
```

### 4. 启动

```bash
npm start
```

## 部署方式

### 方式一：本地 stdio 模式

适用于个人使用，MCP Server 作为本地子进程运行。各 AI 编辑器的具体配置方式请参见下方 [AI 编辑器配置](#ai-编辑器配置) 章节。

通用 stdio 配置结构：

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

### 方式二：远程 HTTP 模式

适用于公司级共享部署，AI 智能体通过 HTTP 接口调用。

**直接启动：**

```bash
export GITLAB_URL=https://gitlab.your-company.com
export GITLAB_TOKEN=server-default-token
export MCP_TRANSPORT=http
export MCP_PORT=3000
node dist/index.js
```

**Docker 部署：**

```bash
# 构建镜像
docker build -t read-git-mcp .

# 运行容器
docker run -d \
  -e GITLAB_URL=https://gitlab.your-company.com \
  -e GITLAB_TOKEN=server-default-token \
  -e MCP_TRANSPORT=http \
  -e MCP_PORT=3000 \
  -p 3000:3000 \
  -v /path/to/output:/app/output \
  read-git-mcp
```

**公司智能体配置：**

```json
{
  "mcpServers": {
    "read-git": {
      "url": "https://mcp-gitlab.your-company.com/mcp"
    }
  }
}
```

## AI 编辑器配置

以下列出了常见 AI 编辑器 / 客户端中集成本 MCP Server 的配置方式。所有编辑器均支持 **stdio 本地模式**；部分编辑器同时支持 **HTTP 远程模式**。

> **路径提示**：请将下方配置中的 `/path/to/read-gitl` 替换为你本项目的实际绝对路径。

---

### Claude Desktop

**配置文件位置**：

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

---

### Cursor

**配置入口**：`Settings` → `Features` → `MCP` → `Add new global MCP server`

也可以直接编辑配置文件：

- macOS: `~/.cursor/mcp.json`
- Windows: `%USERPROFILE%\.cursor\mcp.json`

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

---

### VS Code (Cline 插件)

**配置入口**：Cline 侧边栏 → `MCP Servers` → `Edit MCP Settings`

配置文件位置：`~/.cline/mcp_settings.json`（也可在项目 `.vscode/mcp.json` 中按项目配置）

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

---

### VS Code (Continue 插件)

**配置入口**：Continue 侧边栏 → `Configure` → `experimental/mcp.json`

配置文件位置：`~/.continue/mcp.json`

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

---

### Windsurf (Codeium)

**配置入口**：`Settings` → `MCP` → `Add MCP Server`

配置文件位置：

- macOS: `~/.codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

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

---

### JetBrains AI (WebStorm / IntelliJ 等)

**配置入口**：`Settings` → `Tools` → `AI Assistant` → `MCP` → `Add Server`

选择 **Command** 类型，填入：

- **Command**: `node`
- **Arguments**: `/path/to/read-gitl/dist/index.js`
- **Environment variables**:
  - `GITLAB_URL` = `https://gitlab.your-company.com`
  - `GITLAB_TOKEN` = `your-personal-access-token`

---

### 通用配置说明

所有支持 MCP 的客户端配置结构一致，核心字段如下：

| 字段      | stdio 模式                     | HTTP 模式               |
| --------- | ------------------------------ | ----------------------- |
| `command` | `node`                         | -                       |
| `args`    | `["/path/to/dist/index.js"]`   | -                       |
| `env`     | `{ GITLAB_URL, GITLAB_TOKEN }` | -                       |
| `url`     | -                              | `https://host:port/mcp` |

如果你的编辑器未在上方列出，请参照其 MCP 集成文档，按以上通用结构配置即可。

### Token 管理策略

| 场景        | Token 来源              | 说明                                           |
| ----------- | ----------------------- | ---------------------------------------------- |
| 本地 stdio  | 环境变量 `GITLAB_TOKEN` | 用户自行配置                                   |
| 远程 - 默认 | 环境变量 `GITLAB_TOKEN` | 服务端统一管理，所有用户共享权限               |
| 远程 - 覆盖 | 工具参数 `gitlabToken`  | 用户传入自己的 Token，覆盖默认值，实现权限隔离 |

### 环境变量说明

| 变量名          | 必填 | 默认值    | 说明                              |
| --------------- | ---- | --------- | --------------------------------- |
| `GITLAB_URL`    | 是   | -         | GitLab 实例地址                   |
| `GITLAB_TOKEN`  | 否   | -         | 默认 GitLab Personal Access Token |
| `MCP_TRANSPORT` | 否   | `stdio`   | 传输模式：`stdio` / `http`        |
| `MCP_PORT`      | 否   | `3000`    | HTTP 模式监听端口                 |
| `MCP_HOST`      | 否   | `0.0.0.0` | HTTP 模式监听地址                 |

## MCP 工具列表

### 1. gitlab_list_projects

列出当前 Token 可访问的 GitLab 项目。

**参数：**

| 参数          | 类型   | 必填 | 说明              |
| ------------- | ------ | ---- | ----------------- |
| `search`      | string | 否   | 搜索关键词        |
| `page`        | number | 否   | 页码              |
| `perPage`     | number | 否   | 每页数量，默认 20 |
| `gitlabToken` | string | 否   | 覆盖默认 Token    |

**示例输出：**

```
| ID | 名称 | 路径 | 描述 | URL |
|-----|------|------|------|-----|
| 123 | my-project | `group/my-project` | 项目描述 | https://... |
```

---

### 2. gitlab_list_files

列出仓库中指定路径下的文件和目录。

**参数：**

| 参数          | 类型   | 必填 | 说明                                                     |
| ------------- | ------ | ---- | -------------------------------------------------------- |
| `projectId`   | string | 是   | 项目 ID 或 URL 编码的路径（如 `123` 或 `group/project`） |
| `path`        | string | 否   | 目录路径，默认根目录                                     |
| `ref`         | string | 否   | 分支名或标签，默认 `main`                                |
| `gitlabToken` | string | 否   | 覆盖默认 Token                                           |

---

### 3. gitlab_read_file

读取仓库中指定文件的内容，以 Markdown 代码块格式输出。

**参数：**

| 参数          | 类型   | 必填 | 说明                                       |
| ------------- | ------ | ---- | ------------------------------------------ |
| `projectId`   | string | 是   | 项目 ID 或 URL 编码的路径                  |
| `filePath`    | string | 是   | 文件路径（如 `src/components/Button.vue`） |
| `ref`         | string | 否   | 分支名或标签，默认 `main`                  |
| `gitlabToken` | string | 否   | 覆盖默认 Token                             |

**示例输出：**

````markdown
### src/components/Button.vue

```vue
<template>
  <button class="btn" @click="handleClick">
    <slot />
  </button>
</template>
...
```
````

---

### 4. gitlab_read_directory

递归读取目录下所有文件内容，以 Markdown 代码块格式输出。

**参数：**

| 参数          | 类型   | 必填 | 说明                            |
| ------------- | ------ | ---- | ------------------------------- |
| `projectId`   | string | 是   | 项目 ID 或 URL 编码的路径       |
| `dirPath`     | string | 是   | 目录路径（如 `src/components`） |
| `ref`         | string | 否   | 分支名或标签，默认 `main`       |
| `maxFiles`    | number | 否   | 最大读取文件数，默认 20         |
| `gitlabToken` | string | 否   | 覆盖默认 Token                  |

---

### 5. gitlab_search_code

在仓库中搜索代码关键词，返回匹配的文件和代码片段。

**参数：**

| 参数          | 类型   | 必填 | 说明                      |
| ------------- | ------ | ---- | ------------------------- |
| `projectId`   | string | 是   | 项目 ID 或 URL 编码的路径 |
| `query`       | string | 是   | 搜索关键词                |
| `ref`         | string | 否   | 分支名或标签              |
| `gitlabToken` | string | 否   | 覆盖默认 Token            |

---

### 6. gitlab_analyze_component

分析组件的代码结构，提取 Props、Methods、Events、Imports、Exports 等信息，输出结构化的 Markdown 文档。

支持的组件类型：

- **Vue 2** - Options API（props、methods、events）
- **Vue 3** - Composition API / `<script setup>`（defineProps、defineEmits、defineExpose）
- **React** - 函数组件（Props interface、方法）
- **TypeScript** - 通用模块（interface、function、export）

**参数：**

| 参数          | 类型   | 必填 | 说明                                             |
| ------------- | ------ | ---- | ------------------------------------------------ |
| `projectId`   | string | 是   | 项目 ID 或 URL 编码的路径                        |
| `filePath`    | string | 是   | 组件文件路径（如 `src/components/Button.vue`）   |
| `ref`         | string | 否   | 分支名或标签，默认 `main`                        |
| `template`    | string | 否   | 内置模板名称或自定义模板字符串，默认 `component` |
| `gitlabToken` | string | 否   | 覆盖默认 Token                                   |

#### 内置模板

| 模板名称        | 说明                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `component`     | 完整组件文档（默认），包含基本信息、Props、Methods、Events、Slots、依赖、导出 |
| `api-reference` | API 参考文档风格，侧重属性/事件/方法的详细说明                                |
| `quick-start`   | 快速上手风格，侧重引入方式和基础用法                                          |
| `minimal`       | 精简摘要，仅输出关键信息行内展示                                              |
| `ui-doc`        | UI 组件库文档风格（Element Plus / Ant Design Vue），案例在上 + API 在下       |

**使用内置模板示例：**

```
template: "api-reference"
```

#### 自定义模板

你也可以传入自定义模板字符串，使用 `{{变量名}}` 占位符和 `{{#if 变量名}}...{{/if}}` 条件块。

**可用变量：**

| 变量名                | 说明                                     |
| --------------------- | ---------------------------------------- |
| `{{componentName}}`   | 组件名称                                 |
| `{{description}}`     | 组件描述                                 |
| `{{filePath}}`        | 文件路径                                 |
| `{{language}}`        | 语言类型                                 |
| `{{propsCount}}`      | Props 数量                               |
| `{{methodsCount}}`    | Methods 数量                             |
| `{{eventsCount}}`     | Events 数量                              |
| `{{slotsCount}}`      | Slots 数量                               |
| `{{propsTable}}`      | Props 表格（Markdown 表格行）            |
| `{{methodsTable}}`    | Methods 表格（Markdown 表格行）          |
| `{{eventsTable}}`     | Events 表格（Markdown 表格行）           |
| `{{slotsTable}}`      | Slots 表格（Markdown 表格行）            |
| `{{importsList}}`     | 依赖列表（Markdown 列表）                |
| `{{exportsList}}`     | 导出列表（Markdown 列表）                |
| `{{propsDetailed}}`   | Props 详细列表（含必填/默认值/说明）     |
| `{{eventsDetailed}}`  | Events 详细列表（含载荷/说明）           |
| `{{methodsDetailed}}` | Methods 详细列表（含参数/返回值/可见性） |
| `{{slotsDetailed}}`   | Slots 详细列表（含说明）                 |
| `{{propsList}}`       | Props 简要列表                           |
| `{{eventsList}}`      | Events 简要列表                          |
| `{{slotsList}}`       | Slots 简要列表                           |
| `{{propsInline}}`     | Props 行内展示（逗号分隔）               |
| `{{eventsInline}}`    | Events 行内展示（逗号分隔）              |
| `{{methodsInline}}`   | Methods 行内展示（逗号分隔）             |

**条件块语法：** 当变量为空时自动移除整个块：

```
{{#if props}}
## 属性
{{propsTable}}
{{/if}}
```

**自定义模板示例：**

```
template: "# {{componentName}}\n\n> {{description}}\n\n{{#if props}}\n## 属性\n{{propsDetailed}}\n{{/if}}\n\n{{#if events}}\n## 事件\n{{eventsDetailed}}\n{{/if}}"
```

**示例输出（默认 `component` 模板）：**

```markdown
# Button

## 基本信息

| 属性         | 值                          |
| ------------ | --------------------------- |
| 文件路径     | `src/components/Button.vue` |
| 语言类型     | vue                         |
| Props 数量   | 3                           |
| Methods 数量 | 1                           |
| Events 数量  | 1                           |

## Props

| 名称       | 类型      | 必填 | 默认值      | 说明 |
| ---------- | --------- | ---- | ----------- | ---- |
| `type`     | `string`  | 否   | `'primary'` | -    |
| `size`     | `string`  | 否   | `'medium'`  | -    |
| `disabled` | `boolean` | 否   | `false`     | -    |

## Events

| 事件名  | 载荷类型     | 说明 |
| ------- | ------------ | ---- |
| `click` | `MouseEvent` | -    |
```

---

### 7. gitlab_save_documentation

将 Markdown 文档内容保存为 `.md` 文件。

**参数：**

| 参数        | 类型   | 必填 | 说明                             |
| ----------- | ------ | ---- | -------------------------------- |
| `content`   | string | 是   | Markdown 文档内容                |
| `filename`  | string | 是   | 文件名（如 `component-docs.md`） |
| `outputDir` | string | 否   | 输出目录路径，默认 `./output`    |

**示例输出：**

```
文档已保存至: /app/output/component-docs.md

文件大小: 2.3 KB
```

---

### 8. gitlab_generate_demos

根据组件分析结果自动生成使用案例（demo）文件和使用文档（index.md），**所有文件输出到以组件名称命名的同一文件夹中**。文档使用 `ui-doc` 模板（案例在上 + API 在下，Element Plus 风格）。

**参数：**

| 参数          | 类型   | 必填 | 说明                                                               |
| ------------- | ------ | ---- | ------------------------------------------------------------------ |
| `projectId`   | string | 是   | 项目 ID 或 URL 编码的路径                                          |
| `filePath`    | string | 是   | 组件文件路径（如 `src/components/Button.vue`）                     |
| `ref`         | string | 否   | 分支名或标签，默认 `main`                                          |
| `outputDir`   | string | 否   | 输出根目录，默认 `./output`。文件输出到 `{outputDir}/{组件名}/` 下 |
| `gitlabToken` | string | 否   | 覆盖默认 Token                                                     |

**输出文件结构：**

```
output/
└── Button/              ← 组件名称作为文件夹名
    ├── index.md         ← 使用文档（ui-doc 模板）
    ├── demo.vue         ← 基础用法案例
    ├── demo2.vue        ← 不同模式案例
    └── demo3.vue        ← 事件/插槽案例
```

**Demo 场景自动推断规则：**

| 场景             | 触发条件                               | 文件名        |
| ---------------- | -------------------------------------- | ------------- |
| 基础用法         | 始终生成                               | `demo.vue`    |
| 枚举属性模式     | Prop 类型为联合类型（如 `'a' \| 'b'`） | `demo2.vue`   |
| Boolean 属性开启 | Prop 类型为 `boolean` 且默认非 `true`  | `demo{n}.vue` |
| 事件监听         | 组件有 Events                          | `demo{n}.vue` |
| 自定义插槽       | 组件有 Slots                           | `demo{n}.vue` |

**示例输出：**

```
已为组件 Upload 生成文档与案例，输出目录：/app/output/Upload

- /app/output/Upload/index.md
- /app/output/Upload/demo.vue
- /app/output/Upload/demo2.vue
- /app/output/Upload/demo3.vue

文件结构：
/app/output/Upload/
├── index.md
├── demo.vue
├── demo2.vue
└── demo3.vue

请在 index.md 的 <demo> 标签 src 中引用同目录下的 demo 文件，根据实际业务修改 demo 内容后即可使用。
```

---

## ui-doc 模板详细说明

`ui-doc` 模板遵循 Element Plus / Ant Design Vue 的组件文档风格，文档结构为**案例在上，API 在下**。

### 文档结构

```
# 组件名 中文名

组件描述

## 基础用法

<demo title="基础用法" description="..." src="./demo.vue" />

## 不同模式

<demo title="xxx 模式" description="..." src="./demo2.vue" />

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

### 典型工作流

1. **一键生成**：调用 `gitlab_generate_demos`，自动在 `./output/{组件名}/` 下生成 `index.md`（ui-doc 模板）+ 所有 demo 文件
2. **完善 demo**：AI 或开发者根据实际需求修改 demo 文件内容
3. 文件夹内 `index.md` 和 demo 文件同级，`<demo>` 标签通过 `src="./demo.vue"` 引用同目录文件

### <demo> 标签格式

```html
<demo title="案例标题" description="案例说明" src="./demo.vue" />
```

| 属性          | 说明                                    |
| ------------- | --------------------------------------- |
| `title`       | 案例标题，如 "基础用法"、"文件列表模式" |
| `description` | 案例说明，支持 Markdown 行内语法        |
| `src`         | demo 文件相对路径                       |

## 典型使用流程

### 场景：为指定组件编写使用文档

1. **查找项目**：调用 `gitlab_list_projects` 搜索目标项目
2. **浏览文件**：调用 `gitlab_list_files` 查看项目文件结构
3. **读取代码**：调用 `gitlab_read_file` 读取组件源码
4. **分析结构**：调用 `gitlab_analyze_component` 自动分析组件的 Props、Events 等
5. **编写文档**：AI 根据分析结果编写使用文档
6. **保存文件**：调用 `gitlab_save_documentation` 将文档保存为 `.md` 文件

### 场景：生成 UI 组件库文档（Element Plus 风格）

1. **一键生成**：调用 `gitlab_generate_demos`，自动在 `./output/{组件名}/` 下生成 `index.md` + demo 文件
2. **完善 demo**：AI 或开发者修改 demo 文件内容为实际业务代码
3. 文件夹内 `index.md` 和 demo 文件同级，`<demo>` 标签通过 `src="./demo.vue"` 引用同目录文件

### 场景：批量阅读目录代码

1. 调用 `gitlab_read_directory` 一次性读取整个目录下的代码
2. AI 根据代码内容理解组件间的关系和整体架构
3. 输出文档或保存

## 项目结构

```
read-gitl/
├── src/
│   ├── index.ts              # 主入口，根据模式选择传输方式
│   ├── server.ts             # MCP Server 核心，注册工具
│   ├── gitlab-client.ts      # GitLab API 封装（双 Token 策略）
│   ├── code-analyzer.ts      # 代码结构分析器
│   ├── markdown-formatter.ts # Markdown 格式化输出
│   ├── templates.ts         # 模板引擎 + demo 生成（5 个内置模板）
│   └── transport/
│       ├── stdio.ts          # stdio 本地传输
│       └── http.ts           # Streamable HTTP 远程传输
├── Dockerfile
├── .dockerignore
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## 开发

```bash
# 安装依赖
npm install

# 监听模式编译
npm run dev

# 构建
npm run build

# 启动
npm start
```

## 获取 GitLab Personal Access Token

1. 登录 GitLab
2. 进入 **Settings > Access Tokens**
3. 创建新 Token，勾选以下权限：
   - `read_api` - 读取 API 数据
   - `read_repository` - 读取仓库代码
4. 复制生成的 Token

## 常见问题

**Q: 提示 "GitLab Token 未配置"？**

A: 请确保设置了 `GITLAB_TOKEN` 环境变量，或在调用工具时通过 `gitlabToken` 参数传入。

**Q: 远程 HTTP 模式下如何实现权限隔离？**

A: 服务端设置一个低权限的默认 Token，用户在调用工具时通过 `gitlabToken` 参数传入自己的高权限 Token。

**Q: 读取大目录时性能较慢？**

A: `gitlab_read_directory` 默认最多读取 20 个文件，可通过 `maxFiles` 参数调整。建议先使用 `gitlab_list_files` 浏览目录结构，再使用 `gitlab_read_file` 按需读取。

**Q: 读取大目录时性能较慢？**

A: `gitlab_read_directory` 默认最多读取 20 个文件，可通过 `maxFiles` 参数调整。建议先使用 `gitlab_list_files` 浏览目录结构，再使用 `gitlab_read_file` 按需读取。
