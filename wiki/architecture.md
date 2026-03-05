# AI 研报分析系统 — 完整架构文档 (v2)

> 这份文档面向**新接手的开发人员**，目标是让你在 30 分钟内理解整个系统、跑通开发环境、知道怎么改代码。

---

## 1. 项目全貌（一句话理解）

这是一个「上传研报 PDF → AI 自动生成 6 维度分析报告 → 可以向 AI 提问研报细节 → 支持图表/表格编辑」的系统。

它由 **三个独立模块** 组成，共享同一个后端：

| 模块 | 目录 | 技术栈 | 用途 |
|------|------|--------|------|
| 小程序 | `src/` | Taro + React | C 端用户，只读浏览研报、对话 |
| Web 管理端 | `web/` | React + Vite + Ant Design + ECharts + Monaco | 内部管理，深度分析、搜索、图表编辑、用户管理 |
| 后端服务 | `server/` | Express + TypeScript + SQLite | API、RAG、LLM、视觉识别、数据存储 |

```
miniApp/
├── src/              ← 小程序前端（Taro）
│   └── pages/report/browse/   ← v2 新增：只读研报浏览
├── web/              ← Web 管理端（React + Vite）
│   └── src/
│       ├── components/
│       │   ├── ChartRenderer.tsx  ← v2 新增：ECharts 图表渲染+编辑
│       │   ├── JsonEditor.tsx     ← v2 新增：Monaco JSON 编辑器
│       │   └── EditableTable.tsx  ← v2 新增：行内编辑表格
│       └── pages/
├── server/           ← 后端服务（Express + SQLite）
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.ts   ← v2: 新增 VL_MODEL/VL_ENABLED/VL_MAX_PAGES
│   │   │   └── models.ts  ← v2: 新增 qwen-vl-max/qwen-vl-plus
│   │   ├── db/            ← v2: schema 新增 structured_content/status/chunk_type
│   │   ├── middleware/
│   │   ├── routes/
│   │   │   ├── parse.ts   ← v2: ★ 双通道解析管线
│   │   │   ├── reports.ts ← v2: 完善 CRUD + 搜索 + 统计 + 批量删除
│   │   │   ├── chat.ts    ← v2: 多研报联合对话 + 结构化合成
│   │   │   └── summary.ts ← v2: 注入结构化内容
│   │   └── services/
│   │       ├── rag/
│   │       │   ├── chunker.ts     ← v2: ★ 类型感知分块 (text/table/chart)
│   │       │   ├── vectorStore.ts ← v2: 多研报联合检索
│   │       │   └── index.ts       ← v2: retrieveMultiContext()
│   │       ├── pdfImageService.ts ← v2 新增：PDF 转图片
│   │       ├── visionService.ts   ← v2 新增：Qwen-VL 多模态识别
│   │       ├── synthesizer.ts     ← v2 新增：结构化合成器
│   │       ├── deepAnalysisService.ts ← v2: 图表数据输出
│   │       └── reportStore.ts     ← v2: 新增字段 + 搜索 + 统计
│   ├── scripts/
│   └── data/
├── wiki/
└── package.json
```

---

## 2. 快速启动（5 分钟跑通）

### 前置条件

- Node.js >= 18
- yarn

### 步骤

```bash
# 1. 安装所有依赖
cd miniApp
yarn install              # 小程序依赖
cd server && yarn install # 后端依赖
cd ../web && yarn install # Web 前端依赖
cd ..

# 2. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env，必须填写：
#   QWEN_API_KEY=你的通义千问 API Key（去 DashScope 申请）
#   JWT_SECRET=改成一个随机字符串

# 3. 启动后端（端口 3000）
cd server && yarn dev

# 4. 启动 Web 开发服务（端口 5173，自动代理到后端）
cd ../web && yarn dev

# 5. 启动小程序开发
cd .. && yarn dev:weapp
# 然后用微信开发者工具打开 dist/ 目录
```

### 默认账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | 超管 | 首次启动自动创建，可在 .env 中修改 |

---

## 3. ★ v2 核心改造：双通道 PDF 解析管线

### 3.1 为什么需要双通道？

v1 只用 `pdf-parse` 提取纯文本，**表格变成乱序文字，图表完全丢失**。
v2 引入 **Qwen-VL 多模态视觉模型**，逐页识别 PDF 页面图片，精准提取表格结构和图表数据。

### 3.2 双通道流程图

```
                   用户上传 PDF
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
    通道 A（快速）            通道 B（异步）
    pdf-parse                  PDF 转图片
    提取纯文本                 (pdfImageService)
          │                         │
          ▼                         ▼
    创建报告记录              逐页发给 Qwen-VL
    status = parsing          (visionService)
          │                         │
          ▼                         ▼
    立即返回 reportId         结构化 JSON
    不阻塞前端                { text, table, chart }
                                    │
                                    ▼
                              存入 structured_content
                                    │
                         ┌──────────┴──────────┐
                         ▼                      ▼
                   类型感知分块             增强文本
                   (text/table/chart)       (表格→Markdown)
                         │                      │
                         ▼                      ▼
                   Embedding 向量化        RAG 索引
                         │
                         ▼
                   存入 report_chunks
                   status → pending
```

### 3.3 降级策略

| 场景 | 行为 |
|------|------|
| VL_ENABLED=false | 跳过视觉识别，只用 pdf-parse |
| Qwen-VL API 故障 | 降级为纯文本模式 |
| 某一页识别失败 | 跳过该页，继续下一页 |
| 视觉文本过短 | 保留 pdf-parse 原文 |

### 3.4 关键文件导读

#### `pdfImageService.ts` — PDF 转图片

```
PDF Buffer → pdf-to-img (基于 pdfjs-dist + @napi-rs/canvas)
         → 逐页渲染 PNG → base64 编码
         → 返回 PageImage[]
```

- 技术选型：纯 JS 实现，零系统级依赖
- 默认 scale=2.0（144 DPI），平衡清晰度和传输大小
- 最大页数通过 VL_MAX_PAGES 配置（默认 30）

#### `visionService.ts` — 多模态 LLM 调用

```
PageImage → Qwen-VL API (image_url + prompt)
         → 结构化 JSON { sections: [text, table, chart] }
```

- 输出类型：text（段落文本）、table（表头+行数据）、chart（类型+数据点+描述）
- 每页约 2000 token ≈ 0.006 元
- 20 页研报约 0.12 元
- 单页超时 120s，失败的页用空内容占位

#### `synthesizer.ts` — 结构化合成器（多研报对比）

用途：将多篇研报的检索片段加工整理成结构化分析

输出：
```json
{
  "conclusion": "核心结论",
  "keyData": [{ "metric": "PE", "value": "15x", "source": "中信证券" }],
  "viewpoints": [{ "institution": "中信", "view": "...", "rating": "买入" }],
  "comparison": "不同研报观点对比",
  "risks": ["风险1", "风险2"]
}
```

---

## 4. ★ RAG 核心功能（PDF → 分块 → 检索）

### 4.1 v2 类型感知分块

v1 只做纯文本段落分块。v2 的 `chunker.ts` 支持三种内容类型：

| 类型 | 分块策略 | 存储格式 |
|------|---------|---------|
| text | 滑动窗口（800字/200重叠） | 纯文本 |
| table | 整个表格 = 1个chunk（不切割） | Markdown 表格格式 |
| chart | 图表描述+数据 = 1个chunk | 结构化描述文本 |

### 4.2 多研报联合检索

```
用户选择 [研报A, 研报B, 研报C]
     ↓
输入问题
     ↓
searchMultipleReports()
遍历所有研报的所有 chunk，余弦相似度排序
     ↓
返回 Top-K（跨研报，标注来源）
     ↓
synthesizer 加工整理
     ↓
结构化输出（含来源引用）
```

### 4.3 数据库 report_chunks 表（v2 新增字段）

```sql
CREATE TABLE report_chunks (
  id           TEXT PRIMARY KEY,
  report_id    TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  text         TEXT NOT NULL,
  embedding    BLOB NOT NULL,
  chunk_type   TEXT NOT NULL DEFAULT 'text',  -- v2: text/table/chart
  metadata     TEXT,                           -- v2: JSON 扩展信息
  created_at   INTEGER NOT NULL
);
```

metadata 示例：
- table: `{ "title": "营收预测", "headers": ["年份","营收"], "rowCount": 5 }`
- chart: `{ "chartType": "bar", "title": "毛利率趋势", "dataPoints": [...] }`

---

## 5. 后端 API 接口完整列表

### 5.1 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |
| POST | `/api/auth/refresh` | 刷新 token |
| GET | `/api/auth/me` | 当前用户信息 |
| PUT | `/api/auth/password` | 修改密码 |

### 5.2 研报相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/parse` | 上传 PDF 或文本（双通道异步解析） |
| POST | `/api/summary` | 生成一页纸摘要 |
| POST | `/api/deep-analysis` | 生成 6 维度深度分析（含图表数据） |
| POST | `/api/chat` | 研报对话（支持单研报/多研报/结构化合成） |
| GET | `/api/chat/:id/history` | 对话历史 |
| GET | `/api/reports` | 研报列表（支持 keyword/status/sortBy） |
| GET | `/api/reports/stats` | v2: 统计数据（总数/已分析/本月新增/平均评分） |
| GET | `/api/reports/:id` | 研报详情（含 structuredContent） |
| PUT | `/api/reports/:id` | v2: 更新标题 |
| PUT | `/api/reports/:id/analysis` | v2: 更新分析结果（前端编辑回写） |
| DELETE | `/api/reports/:id` | 删除研报（含索引） |
| POST | `/api/reports/batch-delete` | v2: 批量删除 |
| POST | `/api/reports/:id/index` | 手动触发 RAG 索引 |
| GET | `/api/reports/:id/index` | 查看索引状态 |
| GET | `/api/reports/:id/status` | v2: 解析状态轮询（前端用） |

### 5.3 多研报对话

POST `/api/chat` 支持两种模式：

```json
// 模式1: 单研报
{ "reportId": "xxx", "messages": [...] }

// 模式2: 多研报联合
{ "reportIds": ["id1", "id2"], "messages": [...], "structured": true }
// structured=true 时返回结构化合成结果
```

### 5.4 用户管理（超管权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表 |
| POST | `/api/users` | 创建用户 |
| PUT | `/api/users/:id` | 修改用户 |
| DELETE | `/api/users/:id` | 删除用户 |

---

## 6. 配置文件说明

所有配置在 `server/.env`：

```bash
# ===== 基础 =====
PORT=3000
NODE_ENV=development

# ===== LLM 大模型 =====
QWEN_API_KEY=sk-xxx          # ★ 必填！
DEEPSEEK_API_KEY=
DEFAULT_MODEL=qwen-plus

# ===== 视觉模型 (v2 新增) =====
VL_MODEL=qwen-vl-max         # qwen-vl-max(高精度) 或 qwen-vl-plus(低成本)
VL_ENABLED=true               # 是否启用视觉识别
VL_MAX_PAGES=30               # 单份 PDF 最大处理页数

# ===== 多研报 (v2 新增) =====
MULTI_REPORT_MAX=5            # 联合检索最大研报数

# ===== PDF =====
MAX_PDF_SIZE_MB=10

# ===== JWT =====
JWT_SECRET=your-secret-here   # ★ 生产必改！
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# ===== 默认超管 =====
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123       # ★ 生产必改！
```

---

## 7. 数据库设计 (v2 更新)

### reports 表 — v2 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| structured_content | TEXT | v2: Qwen-VL 视觉解析的结构化 JSON |
| status | TEXT | v2: pending / parsing / analyzed / error |

### report_groups 表 — v2 新增

| 字段 | 说明 |
|------|------|
| id | UUID |
| name | 分组名（如"贵州茅台研报合集"） |
| stock_code | 股票代码 |
| industry | 行业 |

### report_group_items 表 — v2 新增

| 字段 | 说明 |
|------|------|
| group_id | 分组 ID |
| report_id | 研报 ID |

---

## 8. Web 前端 v2 改动

### 新增组件

| 组件 | 文件 | 功能 |
|------|------|------|
| ChartRenderer | `components/ChartRenderer.tsx` | ECharts 图表渲染 + 点击编辑 JSON |
| JsonEditor | `components/JsonEditor.tsx` | Monaco Editor JSON 编辑器 |
| EditableTable | `components/EditableTable.tsx` | Ant Design 行内编辑表格 |

### 页面改造

| 页面 | 改动 |
|------|------|
| Dashboard | 使用 stats API，展示服务端统计 |
| 研报列表 | 批量删除、行内编辑标题、状态显示 |
| 研报详情 | 6维度卡片、图表渲染、表格编辑、JSON编辑器、保存回写 |
| 搜索页 | 服务端搜索、分页、状态/评级筛选 |

### 图表编辑交互

```
图表卡片右上角 [编辑] 按钮
    ↓
弹出 Monaco JSON 编辑器
    ↓
修改 labels / datasets / data 数组
    ↓
保存 → 图表实时更新 → 页面顶部出现 [保存修改] 按钮
    ↓
点击保存 → PUT /api/reports/:id/analysis 回写后端
```

---

## 9. 小程序 v2 改动

### 新增页面

| 路由 | 页面 | 功能 |
|------|------|------|
| `/pages/report/browse/index` | 研报浏览列表 | 搜索 + 卡片展示（只读） |
| `/pages/report/browse/detail` | 研报详情 | 6 维度展示（只读，不支持编辑） |

小程序端定位为 **只看不改**：
- 不支持删除、编辑、触发分析
- 所有管理操作在 Web 端进行

---

## 10. 商业级升级建议

| 方向 | 建议 |
|------|------|
| 向量数据库 | 数据量 >10万块 时迁移到 Milvus / Qdrant |
| PDF 预览 | 引入 PDF.js 在线预览，高亮 RAG 命中片段 |
| 多用户协作 | 研报加 workspace 字段，不同团队数据隔离 |
| 导出功能 | 分析报告导出为 Word/PDF |
| 审批流 | 交易员提交分析 → 超管审批 → 发布 |
| 实时行情 | 对接 Wind/同花顺 API，在分析中嵌入实时股价 |
| 历史追踪 | 分析结果版本化，追踪 AI 判断准确率 |
| 微调模型 | 用历史研报 fine-tune Embedding 和 LLM，提升金融领域表现 |
| 自动对比 | 同股票新研报上传后，自动与历史观点对比 |
| WebSocket | 长文档解析进度实时推送（替代轮询） |
| CDN 部署 | Web 静态资源走 CDN，后端负载均衡 |

---

## 11. 项目运行端口汇总

| 服务 | 端口 | 说明 |
|------|------|------|
| 后端 API | 3000 | Express，同时 serve Web 静态文件 |
| Web 开发服务 | 5173 | Vite dev server，自动代理 `/api` 到 3000 |
| 小程序 | - | 通过微信开发者工具运行 |

生产部署只需要端口 3000：后端 API + Web 静态文件一起 serve。
