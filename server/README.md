# 研报分析后端服务

Express + TypeScript + SQLite，提供 PDF 解析、摘要生成、研报对话、数据持久化。

## 架构

```
server/
├── src/
│   ├── index.ts           # 入口（端口监听、优雅退出）
│   ├── app.ts             # Express 实例 + 中间件
│   ├── config/
│   │   ├── index.ts       # 统一配置（环境变量）
│   │   └── models.ts      # LLM 模型注册
│   ├── db/
│   │   └── index.ts       # SQLite 初始化 + Schema
│   ├── routes/
│   │   ├── index.ts       # 路由聚合
│   │   ├── health.ts      # GET  /health
│   │   ├── parse.ts       # POST /api/parse
│   │   ├── summary.ts     # POST /api/summary
│   │   ├── chat.ts        # POST /api/chat + GET /api/chat/:id/history
│   │   └── reports.ts     # GET/DELETE /api/reports
│   ├── services/
│   │   ├── pdfService.ts      # PDF 文本提取
│   │   ├── llmService.ts      # LLM 调用（重试+超时）
│   │   ├── summaryService.ts  # 摘要 prompt + 解析
│   │   └── reportStore.ts     # 研报 CRUD + 聊天记录
│   └── middleware/
│       ├── errorHandler.ts    # 全局错误处理（4xx/5xx 区分）
│       └── logger.ts          # 请求日志
└── data/
    └── reports.db             # SQLite 数据库（自动创建）
```

## 快速开始

```bash
cp .env.example .env   # 填入 QWEN_API_KEY
yarn install
yarn dev               # http://localhost:3000
```

## 数据库

- **SQLite**（better-sqlite3），文件存储于 `data/reports.db`
- 表结构：`reports`（研报信息+摘要）、`report_chats`（对话记录）
- WAL 模式，支持并发读
- 可通过 `DB_PATH` 环境变量自定义路径

## API 接口

### GET /health
健康检查。

### POST /api/parse
解析 PDF 或文本，存入数据库。

**文本模式**
```json
POST /api/parse
Content-Type: application/json
{ "text": "研报全文..." }

→ { "success": true, "reportId": "uuid", "text": "...", "source": "text", "pages": 0 }
```

**PDF 模式**
```
POST /api/parse
Content-Type: multipart/form-data
file: (PDF 文件)

→ { "success": true, "reportId": "uuid", "text": "...", "source": "pdf", "pages": 10 }
```

### POST /api/summary
生成一页纸摘要，自动回写数据库。

```json
{ "reportId": "uuid" }

→ {
    "success": true,
    "reportId": "uuid",
    "summary": {
      "stockName": "贵州茅台",
      "stockCode": "600519",
      "rating": "买入",
      "targetPrice": "2500",
      "coreLogic": "...",
      "catalysts": ["..."],
      "risks": ["..."],
      "financialForecast": [{"year":"2024","revenue":"1650亿"}]
    }
  }
```

### POST /api/chat
研报对话。传入 reportId 时自动从数据库取上下文，并持久化聊天记录。

```json
{ "reportId": "uuid", "messages": [{"role":"user","content":"核心逻辑是什么？"}] }

→ { "content": "..." }
```

### GET /api/chat/:reportId/history
获取某研报的聊天历史。

```json
→ { "history": [{"role":"user","content":"...","createdAt":1234},...] }
```

### GET /api/reports
研报列表（不含 rawText）。支持 `?limit=50&offset=0`。

```json
→ { "success": true, "data": [...], "total": 5 }
```

### GET /api/reports/:id
研报详情（含 rawText）。

### DELETE /api/reports/:id
删除研报及其聊天记录（级联删除）。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 端口 |
| NODE_ENV | development | 环境 |
| QWEN_API_KEY | - | 千问 API Key |
| DEEPSEEK_API_KEY | - | DeepSeek API Key |
| DEFAULT_MODEL | qwen-plus | 默认模型 |
| LLM_TIMEOUT_MS | 120000 | LLM 请求超时 |
| LLM_MAX_RETRIES | 2 | LLM 失败重试次数 |
| LLM_TEMPERATURE | 0.7 | 默认温度 |
| LLM_MAX_TOKENS | 4096 | 默认最大 token |
| SUMMARY_MAX_INPUT_CHARS | 30000 | 摘要输入截断长度 |
| MAX_PDF_SIZE_MB | 10 | PDF 大小限制 |
| DB_PATH | ./data/reports.db | 数据库文件路径 |
| CORS_ORIGIN | * | CORS 允许的来源 |
| BODY_LIMIT | 15mb | 请求体大小限制 |

## 扩展点

- **多模型**：在 `config/models.ts` 注册新模型即可
- **RAG**：在 `routes/chat.ts` 的 LLM 消息构造前注入检索结果
- **链接解析**：在 `routes/parse.ts` 根据 source 类型分支
- **用户认证**：在 `app.ts` 挂载 auth 中间件
- **数据库迁移**：可用 `db/index.ts` 的 `initSchema` 增加表
