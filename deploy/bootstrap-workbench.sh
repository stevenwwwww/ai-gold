#!/bin/bash
# ============================================================
# 阿里云 Workbench 首次初始化脚本
# 在 Workbench 终端中执行，完成首次部署并配置 SSH 公钥
# 用法: curl -fsSL <raw_url> | bash
#   或: bash bootstrap-workbench.sh
# ============================================================

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log() { echo -e "${GREEN}[bootstrap]${NC} $*"; }
warn() { echo -e "${YELLOW}[bootstrap]${NC} $*"; }
err() { echo -e "${RED}[bootstrap]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_URL="${REPO_URL:-}"
RAGFLOW_VERSION="${RAGFLOW_VERSION:-v0.24.0}"

# ---------- 1. 检查 REPO_URL（私有仓库需带 token） ----------
if [[ -z "$REPO_URL" ]]; then
  warn "请设置 REPO_URL 环境变量，例如："
  echo "  export REPO_URL=\"https://stevenwwwww:YOUR_TOKEN@github.com/stevenwwwww/ai-gold.git\""
  echo "  或公开仓库: export REPO_URL=\"https://github.com/stevenwwwww/ai-gold.git\""
  echo ""
  read -p "请输入仓库 URL（或 Ctrl+C 退出）: " REPO_URL
  [[ -z "$REPO_URL" ]] && err "REPO_URL 不能为空"
fi

# ---------- 2. 安装基础依赖 ----------
log "安装 git、curl..."
if command -v apt-get &>/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq curl git
elif command -v yum &>/dev/null; then
  sudo yum install -y curl git
else
  err "不支持的系统，请使用 Ubuntu 或 CentOS"
fi

# ---------- 3. 克隆项目 ----------
log "克隆项目到 $REMOTE_DIR ..."
sudo mkdir -p "$REMOTE_DIR"
sudo chown "$USER:$USER" "$REMOTE_DIR"
cd "$REMOTE_DIR"

if [[ -d ".git" ]]; then
  log "目录已存在，拉取最新代码..."
  git fetch origin 2>/dev/null; git reset --hard origin/main 2>/dev/null || git pull --ff-only 2>/dev/null || true
else
  [[ -z "$(ls -A 2>/dev/null)" ]] || err "目录非空且无 .git，请清空 $REMOTE_DIR 后重试"
  git clone "$REPO_URL" .
fi

# ---------- 4. 克隆 RAGFlow ----------
if [[ ! -d "ragflow-repo/docker" ]]; then
  log "克隆 RAGFlow..."
  mkdir -p ragflow-repo
  git clone https://github.com/infiniflow/ragflow.git ragflow-repo
  cd ragflow-repo && git checkout -f "$RAGFLOW_VERSION" 2>/dev/null || true
  cd "$REMOTE_DIR"
fi

# ---------- 5. 创建 .env.production ----------
DEPLOY_DIR="$REMOTE_DIR/deploy"
if [[ ! -f "$DEPLOY_DIR/.env.production" ]]; then
  log "创建 deploy/.env.production..."
  cp "$DEPLOY_DIR/.env.production.template" "$DEPLOY_DIR/.env.production"
  JWT=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p -c 64)
  sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$JWT/" "$DEPLOY_DIR/.env.production"
  warn "请编辑 $DEPLOY_DIR/.env.production 填写 RAGFLOW_API_KEY、QWEN_API_KEY"
  warn "可先留空 RAGFLOW_API_KEY，运行 deploy.sh 启动 RAGFlow 后访问 :8080 注册获取"
  echo ""
  read -p "按回车继续首次部署（RAGFlow 仅启动），或 Ctrl+C 退出先编辑配置..."
fi

# ---------- 6. 添加 GitHub Actions 公钥（可选） ----------
echo ""
log "=== 添加 GitHub Actions 部署公钥 ==="
echo "在本机执行: ssh-keygen -t ed25519 -f ~/.ssh/aliyun-deploy -N \"\" -C \"github-actions-deploy\""
echo "然后将 aliyun-deploy.pub 内容粘贴到下方（直接回车跳过）："
read -r PUBKEY
if [[ -n "$PUBKEY" ]]; then
  mkdir -p ~/.ssh
  chmod 700 ~/.ssh
  echo "$PUBKEY" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  log "公钥已添加，GitHub Actions 将可 SSH 部署"
fi

# ---------- 7. 执行首次部署 ----------
log "执行首次部署（安装依赖 + 启动 RAGFlow）..."
cd "$DEPLOY_DIR"
chmod +x deploy.sh
sudo ./deploy.sh

echo ""
log "=== 初始化完成 ==="
echo "1. 若 RAGFLOW_API_KEY 未填：访问 http://$(curl -s ifconfig.me 2>/dev/null || echo 'ECS_IP'):8080 注册获取"
echo "2. 填入 deploy/.env.production 后执行: cd $DEPLOY_DIR && sudo ./deploy.sh --skip-deps"
echo "3. 在 GitHub 仓库 Settings → Secrets 添加: ECS_HOST, ECS_USER, SSH_PRIVATE_KEY"
echo "4. 之后 push 到 main 将自动部署"
