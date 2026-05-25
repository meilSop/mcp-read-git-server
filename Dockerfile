# 构建阶段
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# 运行阶段
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# 创建 output 目录
RUN mkdir -p /app/output

# 环境变量默认值
ENV GITLAB_URL=""
ENV GITLAB_TOKEN=""
ENV MCP_TRANSPORT=http
ENV MCP_PORT=3000
ENV MCP_HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "dist/index.js"]
