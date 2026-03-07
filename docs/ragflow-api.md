# RAGFlow API 封装清单

本文档说明项目中封装的所有 RAGFlow API，包括后端服务层、后端路由层、前端 API 层的完整对应关系。

---

## 一、架构概览

```
前端 (web/src/api/knowledge.ts)
  ↓ axios → /api/knowledge/*
后端路由 (server/src/routes/knowledge.ts)
  ↓ 调用
后端服务 (server/src/services/ragflowService.ts)
  ↓ fetch → RAGFlow HTTP API (http://localhost:9380/api/v1/*)
RAGFlow Docker 容器
```

---

## 二、后端服务层 (`ragflowService.ts`)

| 分类 | 函数名 | RAGFlow API | 说明 |
|------|--------|-------------|------|
| **Dataset** | `createDataset(name, opts)` | `POST /datasets` | 创建知识库 |
| | `listDatasets(opts)` | `GET /datasets` | 列出知识库（分页/名称筛选） |
| | `updateDataset(id, updates)` | `PUT /datasets/:id` | 更新知识库配置 |
| | `deleteDatasets(ids)` | `DELETE /datasets` | 批量删除知识库 |
| **Document** | `uploadDocument(dsId, buffer, name)` | `POST /datasets/:id/documents` | 上传 PDF（multipart/form-data） |
| | `listDocuments(dsId, opts)` | `GET /datasets/:id/documents` | 列出文档（分页/名称筛选） |
| | `deleteDocuments(dsId, docIds)` | `DELETE /datasets/:id/documents` | 批量删除文档 |
| | `triggerParsing(dsId, docIds)` | `POST /datasets/:id/documents/parse` | 触发异步解析（DeepDOC） |
| | `cancelParsing(dsId, docIds)` | `POST /datasets/:id/documents/parse/cancel` | 取消解析 |
| | `getDocumentStatus(dsId, docId)` | `GET /datasets/:id/documents` | 获取解析状态（run/progress） |
| | `downloadDocument(dsId, docId)` | `GET /datasets/:id/documents/:id/download` | 下载原始 PDF 文件 |
| **Chunk** | `listChunks(dsId, docId, opts)` | `GET /datasets/:id/documents/:id/chunks` | 列出文档分块（分页/关键词） |
| **Retrieval** | `retrieve(question, dsIds, opts)` | `POST /retrieval` | 混合检索（向量 + BM25） |
| **Chat** | `createChat(name, dsIds, opts)` | `POST /chats` | 创建 Chat Assistant |
| | `listChats()` | `GET /chats` | 列出 Chat Assistants |
| | `deleteChats(ids)` | `DELETE /chats` | 删除 Chat Assistants |
| | `chatCompletion(chatId, msgs, opts)` | `POST /chats_openai/:id/chat/completions` | 对话（带原文引用 reference） |
| **Health** | `healthCheck()` | `GET /datasets?page=1&page_size=1` | 心跳检查 |

---

## 三、后端路由层 (`knowledge.ts` → `/api/knowledge/*`)

| HTTP 方法 | 路由 | 对应服务函数 | 说明 |
|-----------|------|-------------|------|
| `GET` | `/knowledge/health` | `healthCheck()` | RAGFlow 在线状态 |
| `GET` | `/knowledge/ui-url` | 读取 config | 返回 RAGFlow UI 地址（iframe） |
| `GET` | `/knowledge/datasets` | `listDatasets()` | 列出知识库 |
| `POST` | `/knowledge/datasets` | `createDataset()` | 创建知识库 |
| `PUT` | `/knowledge/datasets/:id` | `updateDataset()` | 更新知识库 |
| `DELETE` | `/knowledge/datasets` | `deleteDatasets()` | 删除知识库 |
| `GET` | `/knowledge/datasets/:dsId/documents` | `listDocuments()` | 列出文档 |
| `POST` | `/knowledge/datasets/:dsId/documents` | `uploadDocument()` + `triggerParsing()` | 上传 + 自动触发解析 |
| `DELETE` | `/knowledge/datasets/:dsId/documents` | `deleteDocuments()` | 删除文档 |
| `POST` | `/knowledge/datasets/:dsId/documents/parse` | `triggerParsing()` | 手动触发解析 |
| `POST` | `/knowledge/datasets/:dsId/documents/parse/cancel` | `cancelParsing()` | 取消解析 |
| `GET` | `/knowledge/datasets/:dsId/documents/:docId/download` | `downloadDocument()` | 下载原始 PDF |
| `GET` | `/knowledge/datasets/:dsId/documents/:docId/chunks` | `listChunks()` | 列出分块 |
| `POST` | `/knowledge/retrieval` | `retrieve()` | 检索知识库 |
| `GET` | `/knowledge/chats` | `listChats()` | 列出 Chat Assistants |
| `POST` | `/knowledge/chats` | `createChat()` | 创建 Chat Assistant |
| `DELETE` | `/knowledge/chats` | `deleteChats()` | 删除 Chat Assistants |

---

## 四、前端 API 层 (`web/src/api/knowledge.ts`)

| 函数名 | 请求 | 说明 |
|--------|------|------|
| `getHealthStatus()` | `GET /knowledge/health` | 检查 RAGFlow 状态 |
| `getUiUrl()` | `GET /knowledge/ui-url` | 获取 iframe URL |
| `getDatasets(params)` | `GET /knowledge/datasets` | 列出知识库 |
| `createDataset(data)` | `POST /knowledge/datasets` | 创建知识库 |
| `updateDataset(id, data)` | `PUT /knowledge/datasets/:id` | 更新知识库 |
| `deleteDatasets(ids)` | `DELETE /knowledge/datasets` | 删除知识库 |
| `getDocuments(dsId, params)` | `GET /knowledge/datasets/:dsId/documents` | 列出文档 |
| `uploadDocument(dsId, file)` | `POST /knowledge/datasets/:dsId/documents` | 上传 PDF |
| `deleteDocuments(dsId, ids)` | `DELETE /knowledge/datasets/:dsId/documents` | 删除文档 |
| `triggerParsing(dsId, docIds)` | `POST .../parse` | 触发解析 |
| `cancelParsing(dsId, docIds)` | `POST .../parse/cancel` | 取消解析 |
| `getDocumentDownloadUrl(dsId, docId)` | 返回 URL 字符串 | PDF 下载地址（用于 iframe） |
| `getChunks(dsId, docId, params)` | `GET .../chunks` | 列出分块 |
| `retrievalTest(data)` | `POST /knowledge/retrieval` | 检索测试 |
| `getChatAssistants()` | `GET /knowledge/chats` | 列出 Assistants |
| `createChatAssistant(data)` | `POST /knowledge/chats` | 创建 Assistant |
| `deleteChatAssistants(ids)` | `DELETE /knowledge/chats` | 删除 Assistants |

---

## 五、其他路由中使用 RAGFlow 的场景

### 1. `parse.ts`（研报上传解析）

上传 PDF 时同步推送到 RAGFlow：

1. `createDataset()` — 如果默认知识库不存在则自动创建
2. `uploadDocument()` — 上传 PDF 到 RAGFlow
3. `triggerParsing()` — 触发异步解析
4. `getDocumentStatus()` — 轮询解析状态（每 5s，最长 10 分钟）

### 2. `chat.ts`（研报对话）

优先级模式：

1. **RAGFlow Chat 模式** — `chatCompletion()`，RAGFlow 内部完成检索+生成，返回原文引用
2. **RAGFlow Retrieval + 本地 LLM** — `retrieve()` 检索片段 → 本地 LLM 生成回答
3. **降级模式** — 纯文本截断 + 本地 LLM

---

## 六、配置项 (`server/.env`)

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `RAGFLOW_BASE_URL` | `http://localhost:9380` | RAGFlow API 地址 |
| `RAGFLOW_API_KEY` | 空 | RAGFlow API Key（必须配置） |
| `RAGFLOW_DEFAULT_DATASET_ID` | 空 | 默认知识库 ID |
| `RAGFLOW_CHAT_ID` | 空 | Chat Assistant ID |
| `RAGFLOW_UI_URL` | `http://localhost:80` | RAGFlow Web UI 地址 |

---

## 七、类型定义

所有类型在 `ragflowService.ts` 中定义：

- `RagflowDataset` — 知识库
- `RagflowDocument` — 文档（含 run/progress/chunk_count）
- `RagflowChunk` — 分块（含 content/positions/similarity）
- `RagflowReference` — 对话引用（chunks + doc_aggs）
- `RagflowChatResponse` — 对话响应（content + reference）
- `RagflowChat` — Chat Assistant 配置
