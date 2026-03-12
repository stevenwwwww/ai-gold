# 医生助手 RAG SaaS — ECS 一键部署

面向普通 ECS（4vCPU 16GB），单机部署 RAGFlow + Node.js 后端 + Web 前端。

## 方式一：GitHub Actions 自动部署（推荐）

push 到 `main` 分支即自动部署到 ECS，无需本地 SSH。

### 一次性前置（阿里云 Workbench）

1. 阿里云控制台 → ECS → 远程连接 → **Workbench 立即登录**（无需密钥）
2. 在 Workbench 终端执行：
   ```bash
   export REPO_URL="https://YOUR_USER:YOUR_TOKEN@github.com/stevenwwwww/ai-gold.git"  # 私有仓库需在 URL 中带 token
   cd /opt && sudo mkdir -p doctor-saas && sudo chown $USER:$USER doctor-saas
   git clone "$REPO_URL" doctor-saas
   cd doctor-saas/deploy && bash bootstrap-workbench.sh
   ```
3. 按提示添加 GitHub Actions 公钥、完成首次部署
4. 在 GitHub 仓库 Settings → Secrets 添加：`ECS_HOST`、`ECS_USER`、`SSH_PRIVATE_KEY`

之后 `git push origin main` 即自动部署。

---

## 方式二：本机一键部署到阿里云 ECS

在 Mac/Linux 本机运行，通过 SSH 将项目上传到 ECS 并自动部署。

### 需要提供的信息

| 变量 | 说明 | 获取方式 |
|------|------|----------|
| ECS_HOST | ECS 公网 IP | 阿里云控制台 → ECS → 实例 → 公网 IP |
| ECS_USER | SSH 用户名 | Ubuntu 填 ubuntu 或 root；CentOS 填 root 或 ecs-user |
| ECS_KEY_PATH | 密钥私钥路径 | 创建 ECS 时下载的 .pem 文件，如 ~/.ssh/aliyun.pem |
| （或）ECS_PASSWORD | SSH 密码 | 若用密码登录，需安装 sshpass |

### 步骤

```bash
cd deploy
cp aliyun.env.template aliyun.env
# 编辑 aliyun.env，填写 ECS_HOST、ECS_USER、ECS_KEY_PATH
cp .env.production.template .env.production
# 编辑 .env.production，填写 RAGFLOW_API_KEY、QWEN_API_KEY、JWT_SECRET 等

chmod +x deploy-to-aliyun.sh
./deploy-to-aliyun.sh
```

脚本会通过 rsync 上传项目到 ECS `/opt/doctor-saas`，并执行 `deploy.sh` 完成部署。

---

## 方式二：在 ECS 上手动部署

适用于已有 ECS，或代码已通过 git/scp 上传到 ECS。

### 前置

- 阿里云 ECS：Ubuntu 22.04 或 CentOS 8，4vCPU 16GB，40GB+ 磁盘
- 安全组开放：22、80、443、8080

## 2. 配置

```bash
cd deploy
cp .env.production.template .env.production
# 编辑 .env.production，填写以下必填项：
```

| 变量 | 说明 |
|------|------|
| RAGFLOW_API_KEY | 部署后访问 RAGFlow UI 注册并获取（见下） |
| QWEN_API_KEY | 通义千问 API Key |
| JWT_SECRET | 随机串，如 `openssl rand -hex 32` |
| ADMIN_PASSWORD | 超管密码 |
| NCBI_EMAIL | 可选，填写则首次部署时自动抓取医学文献 |

**RAGFLOW_API_KEY 获取**：首次可先运行 `./deploy.sh`（无 RAGFLOW_API_KEY 时会仅启动 RAGFlow），访问 `http://ECS_IP:8080` 注册 → 头像 → API → 复制 Key，填入 `.env.production` 后执行 `./deploy.sh --skip-deps` 完成部署。

## 3. 一键部署

```bash
# 上传项目到 ECS 后
cd /path/to/miniApp/deploy
chmod +x deploy.sh
./deploy.sh
```

首次会安装 Docker、Node、Nginx、PM2，拉取 RAGFlow 镜像（约 5–15 分钟）。

跳过依赖安装（仅更新应用）：

```bash
./deploy.sh --skip-deps
```

## 4. 验证

- 应用：http://ECS_IP
- 医生助手：http://ECS_IP/doctor
- RAGFlow 管理：http://ECS_IP:8080

## 5. 爬虫与知识库

- 若在 `.env.production` 中填写 `NCBI_EMAIL`，部署结束时会自动抓取一批医学文献写入知识库
- 也可手动运行：`cd server && NCBI_EMAIL=your@email.com yarn crawler`
- 24h 常驻：`CRAWLER_DAEMON=1 yarn crawler`

## 6. 目录说明

```
deploy/
├── deploy.sh                 # 在 ECS 上执行的部署脚本
├── deploy-to-aliyun.sh       # 本机运行，SSH 上传并远程部署
├── bootstrap-workbench.sh    # Workbench 首次初始化（克隆、安装、添加公钥）
├── aliyun.env.template       # 阿里云 ECS 连接配置模板
├── aliyun.env                # 实际配置（不提交）
├── .env.production.template  # 应用配置模板
├── .env.production           # 应用配置（不提交）
├── nginx.conf                # Nginx 配置
├── verify.sh                 # 自测脚本
├── verify-remote.sh          # 验证 ECS 部署状态
└── README.md
```
