# 医学文献爬虫

从 PubMed/PMC 抓取医学文献并批量导入 RAGFlow 知识库。

## 运行

```bash
cd server
NCBI_EMAIL=your@email.com yarn crawler
```

单次运行后退出。

24 小时常驻模式（每小时执行一轮）：

```bash
CRAWLER_DAEMON=1 NCBI_EMAIL=your@email.com yarn crawler
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `RAGFLOW_BASE_URL` | RAGFlow API 地址，默认 `http://localhost:9380` |
| `RAGFLOW_API_KEY` | RAGFlow API Key（必填才能上传） |
| `RAGFLOW_MEDICAL_DATASET_ID` | 知识库 ID，不填则自动创建 `medical_literature` |
| `NCBI_EMAIL` | NCBI 礼貌使用邮箱（建议填写） |
| `CRAWLER_QUERIES` | 检索词，逗号分隔，默认 `diabetes,hypertension,COVID-19` |
| `CRAWLER_BATCH_SIZE` | 每轮每检索词最多抓取篇数，默认 20 |
| `CRAWLER_INTERVAL_MS` | 常驻模式轮次间隔（毫秒），默认 3600000（1 小时） |

## 文档命名格式

上传的文档命名为 `Title (Year) [PMC123456].txt` 或 `Title (Year) [PMID123].txt`，便于前端解析并生成「查看原文」链接。
