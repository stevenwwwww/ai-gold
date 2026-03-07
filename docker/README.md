# RAGFlow Docker 部署指南

## 一、Mac 端本地开发环境

### 1. 安装 Docker Desktop（需自行安装）

**我没有替你安装 Docker**，请按以下步骤自行安装：

1. 打开 [Docker 官网](https://www.docker.com/products/docker-desktop/)
2. 下载 **Docker Desktop for Mac**（根据芯片选择：Apple Silicon / Intel）
3. 安装后启动 Docker Desktop，等待状态栏图标显示为运行中
4. 在终端执行 `docker --version` 和 `docker compose version` 确认安装成功

**资源要求**（在 Docker Desktop → Settings → Resources 中配置）：
- 内存 >= 16 GB
- 磁盘 >= 50 GB

### 2. 启动 RAGFlow

```bash
# 1. 克隆 RAGFlow 官方仓库（若已克隆可跳过）
git clone https://github.com/infiniflow/ragflow.git ragflow-repo
cd ragflow-repo/docker

# 2. 切换到稳定版
git checkout -f v0.18.0

# 3. 启动（首次会拉取镜像，约 5–15 分钟）
docker compose -f docker-compose.yml up -d

# 4. 查看日志，等待出现 "RAGFlow is running"
docker logs -f ragflow-server
# 按 Ctrl+C 退出日志
```

### 3. 配置 RAGFlow 与后端

1. **访问 RAGFlow Web UI**：http://localhost:80  
2. **注册管理员账号**（首次访问）  
3. **配置大模型**：右上角头像 → 模型提供商 → 配置 Qwen API Key  
4. **获取 API Key**：右上角头像 → API → 复制 API Key  
5. **配置后端**：编辑 `server/.env`，添加或修改：

```bash
RAGFLOW_BASE_URL=http://localhost:9380
RAGFLOW_API_KEY=你复制的API_Key
RAGFLOW_UI_URL=http://localhost:80
```

6. **重启后端**：`cd server && yarn dev`

### 4. 验证

- 访问 http://localhost:80 能打开 RAGFlow 管理界面
- 访问 http://localhost:3000/api/knowledge/health 返回 `{"healthy":true,...}`

---

## 二、500 错误排查

若 `/api/knowledge/datasets` 返回 500，按顺序检查：

| 原因 | 处理方式 |
|------|----------|
| Docker 未启动 | 打开 Docker Desktop，等待完全启动 |
| RAGFlow 未运行 | 执行 `docker ps`，确认有 `ragflow-server` 容器；若无则按上文启动 |
| RAGFLOW_API_KEY 未配置 | 在 `server/.env` 中填写从 RAGFlow UI 复制的 API Key |
| RAGFlow 仍在启动 | 查看 `docker logs -f ragflow-server`，等待 "RAGFlow is running" |

**快速诊断**：

```bash
# 1. 检查 Docker 是否运行
docker ps

# 2. 检查 RAGFlow 是否在运行
curl -s http://localhost:9380/api/v1/datasets?page=1&page_size=1 \
  -H "Authorization: Bearer 你的API_KEY" | head -c 200

# 3. 检查后端健康接口
curl http://localhost:3000/api/knowledge/health
```

---

## 三、端口说明

| 端口 | 用途 |
|------|------|
| 80   | RAGFlow Web UI |
| 9380 | RAGFlow API |
| 1200 | Elasticsearch |

---

## 四、停止与重置

```bash
cd ragflow-repo/docker
docker compose down          # 停止
docker compose down -v       # 停止并删除数据卷（完全重置）
```
