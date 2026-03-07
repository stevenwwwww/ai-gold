# 阿里云 ECS 私有化部署指南

本文档说明如何在阿里云 ECS 上部署整套前后端服务及 RAGFlow，实现单机私有化部署。

---

## 一、架构概览

```
                    ┌─────────────────────────────────────────────┐
                    │              阿里云 ECS 实例                   │
                    │                                              │
  Internet   ──►   │  Nginx (80/443)                              │
                    │    ├── / → Web 前端（静态）                    │
                    │    └── /api → 后端 Node (3000)                │
                    │                                              │
                    │  Node 后端 (3000)                             │
                    │    ├── /api/parse, /api/chat, /api/reports   │
                    │    └── /api/knowledge → 代理 RAGFlow API     │
                    │                                              │
                    │  RAGFlow (Docker Compose)                    │
                    │    ├── Web UI: 80                            │
                    │    ├── API: 9380                             │
                    │    └── ES/MySQL/MinIO/Redis 等               │
                    │                                              │
                    │  SQLite 数据文件 (server/data/)               │
                    └─────────────────────────────────────────────┘
```

---

## 二、ECS 规格建议

| 场景 | 规格 | 内存 | 磁盘 | 说明 |
|------|------|------|------|------|
| 最小可用 | ecs.c6.xlarge | 4 核 8 GB | 100 GB SSD | 仅开发/测试 |
| 推荐生产 | ecs.c6.2xlarge | 8 核 16 GB | 200 GB SSD | RAGFlow 建议 16 GB 内存 |
| 高负载 | ecs.c6.4xlarge | 16 核 32 GB | 300 GB SSD | 多用户 |

**系统要求**：

- 操作系统：Ubuntu 22.04 LTS（推荐）或 CentOS 7+
- 安全组：开放 80、443、22（SSH）

---

## 三、部署步骤

### 1. 购买 ECS 并初始化

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
2. 创建 ECS 实例，选择 Ubuntu 22.04、按规格选择实例
3. 配置安全组：入方向放行 22、80、443
4. 绑定弹性公网 IP（或使用负载均衡）
5. 使用 SSH 登录：`ssh root@你的公网IP`

### 2. 安装基础环境

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 安装 Yarn
npm install -g yarn

# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# 安装 Docker Compose
apt install -y docker-compose-plugin

# 安装 Nginx
apt install -y nginx

# 安装 Git
apt install -y git
```

### 3. 部署 RAGFlow

```bash
# 1. 克隆 RAGFlow
cd /opt
git clone https://github.com/infiniflow/ragflow.git ragflow-repo
cd ragflow-repo/docker
git checkout -f v0.18.0

# 2. 修改 vm.max_map_count（Elasticsearch 要求）
echo "vm.max_map_count=262144" >> /etc/sysctl.conf
sysctl -p

# 3. 启动 RAGFlow
docker compose -f docker-compose.yml up -d

# 4. 等待启动完成（约 30 秒）
sleep 30
docker logs ragflow-server 2>&1 | tail -20
# 若看到 "RAGFlow is running" 则成功

# 5. 首次访问 http://你的公网IP:80 注册管理员
# 配置 Qwen API Key
# 复制 API Key 备用
```

**注意**：RAGFlow 默认监听 80 和 9380。部署 Nginx 后，80 需改为其他端口或由 Nginx 反向代理。

### 4. 修改 RAGFlow 端口（避免与 Nginx 冲突）

编辑 `ragflow-repo/docker/docker-compose.yml`，将 RAGFlow 的 80 端口改为 8080：

```yaml
# 找到 ragflow 服务的 ports 配置，类似：
ports:
  - "8080:80"    # 改为 8080
  - "9380:9380"
```

然后重启：

```bash
cd /opt/ragflow-repo/docker
docker compose down
docker compose -f docker-compose.yml up -d
```

访问 RAGFlow UI：`http://你的公网IP:8080`

### 5. 部署后端服务

```bash
# 1. 上传代码（或 git clone）
cd /opt
git clone 你的仓库地址 miniApp
cd miniApp/server

# 2. 安装依赖
yarn install

# 3. 配置环境变量
cp .env.example .env
vim .env

# 必须填写：
# PORT=3000
# QWEN_API_KEY=你的通义千问 Key
# RAGFLOW_BASE_URL=http://127.0.0.1:9380
# RAGFLOW_API_KEY=从 RAGFlow UI 复制的 Key
# RAGFLOW_UI_URL=http://127.0.0.1:8080
# JWT_SECRET=随机字符串（生产环境务必修改）

# 4. 构建
yarn build

# 5. 使用 PM2 守护进程
npm install -g pm2
pm2 start dist/index.js --name report-server
pm2 save
pm2 startup
```

### 6. 构建并部署 Web 前端

```bash
cd /opt/miniApp/web

# 1. 配置 API 地址（生产环境）
# 编辑 vite.config.ts 或 .env.production，确保 API 指向 /api（由 Nginx 代理）

# 2. 构建
yarn install
yarn build

# 3. 复制到 Nginx 目录
cp -r dist/* /var/www/html/
# 或
mkdir -p /var/www/report-app
cp -r dist/* /var/www/report-app/
```

### 7. 配置 Nginx

```bash
vim /etc/nginx/sites-available/report-app
```

写入：

```nginx
server {
    listen 80;
    server_name 你的域名或公网IP;

    root /var/www/report-app;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

启用并重启：

```bash
ln -sf /etc/nginx/sites-available/report-app /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 8. 配置 HTTPS（可选）

使用 Let's Encrypt：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名
```

---

## 四、环境变量汇总

| 变量 | 说明 | 示例 |
|------|------|------|
| `PORT` | 后端端口 | 3000 |
| `QWEN_API_KEY` | 通义千问 API Key | sk-xxx |
| `RAGFLOW_BASE_URL` | RAGFlow API 地址 | http://127.0.0.1:9380 |
| `RAGFLOW_API_KEY` | RAGFlow API Key | 从 RAGFlow UI 获取 |
| `RAGFLOW_UI_URL` | RAGFlow Web UI 地址 | http://127.0.0.1:8080 |
| `JWT_SECRET` | JWT 签名密钥 | 随机 32 位字符串 |
| `DB_PATH` | SQLite 路径 | 默认 ./data/reports.db |

---

## 五、常用运维命令

```bash
# 查看 RAGFlow 状态
docker ps | grep ragflow

# 查看 RAGFlow 日志
docker logs -f ragflow-server

# 重启后端
pm2 restart report-server

# 查看后端日志
pm2 logs report-server

# 查看 Nginx 状态
systemctl status nginx
```

---

## 六、数据备份

```bash
# 1. SQLite 数据库
cp /opt/miniApp/server/data/reports.db /backup/reports.db.$(date +%Y%m%d)

# 2. RAGFlow 数据（Docker volumes）
docker run --rm -v ragflow-repo_ragflow_data:/data -v /backup:/backup alpine tar czf /backup/ragflow-data.tar.gz /data
```

---

## 七、故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 500 错误 /api/knowledge/* | RAGFlow 未启动或 API Key 错误 | 检查 `docker ps`、`RAGFLOW_API_KEY` |
| 404 刷新页面 | SPA 路由未配置 | Nginx 增加 `try_files $uri $uri/ /index.html` |
| 跨域错误 | 后端 CORS 未配置 | 检查 `server/.env` 的 `CORS_ORIGIN` |
| RAGFlow 启动失败 | 内存不足 | 升级 ECS 至 16 GB 内存 |
