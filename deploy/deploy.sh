#!/bin/bash
# ============================================================
# 医生助手 RAG SaaS — 一键部署脚本（ECS）
# 适用: Ubuntu 20.04+/22.04、CentOS 7+/8
# 要求: 4vCPU 16GB 内存，40GB+ 系统盘
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
err() { echo -e "${RED}[deploy]${NC} $*"; exit 1; }

# ---------- 1. 检查配置 ----------
ENV_PROD="$SCRIPT_DIR/.env.production"
if [[ ! -f "$ENV_PROD" ]]; then
  err "未找到 $ENV_PROD，请复制 .env.production.template 为 .env.production 并填写配置"
fi

# 检查必填项（简单 grep，避免 source 执行任意代码）
# 若 RAGFLOW_API_KEY 为空，仅启动 RAGFlow（需先访问 UI 注册并获取 Key 后再次运行）
if grep -q "RAGFLOW_API_KEY=.\+" "$ENV_PROD" 2>/dev/null; then
  HAS_RAG_KEY=1
else
  HAS_RAG_KEY=0
  warn "RAGFLOW_API_KEY 未填，将仅启动 RAGFlow，请访问 http://ECS_IP:8080 注册后获取 Key 并再次运行"
fi
# 完整部署才需要 QWEN_API_KEY；仅启动 RAGFlow 时可不填
[[ "$HAS_RAG_KEY" == "1" ]] && { grep -q "QWEN_API_KEY=.\+" "$ENV_PROD" || err "请在 .env.production 中填写 QWEN_API_KEY"; }
grep -q "JWT_SECRET=.\+" "$ENV_PROD" || err "请在 .env.production 中填写 JWT_SECRET"

# ---------- 2. 检测系统并安装依赖 ----------
install_deps() {
  if command -v apt-get &>/dev/null; then
    log "检测到 Debian/Ubuntu"
    sudo apt-get update -qq
    sudo apt-get install -y -qq curl git
  elif command -v yum &>/dev/null; then
    log "检测到 CentOS/RHEL"
    sudo yum install -y curl git
  else
    err "不支持的系统，请使用 Ubuntu 或 CentOS"
  fi

  # Docker
  if ! command -v docker &>/dev/null; then
    log "安装 Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER" 2>/dev/null || true
  fi
  sudo systemctl enable docker
  sudo systemctl start docker 2>/dev/null || true

  # Docker Compose
  if ! command -v docker &>/dev/null || ! docker compose version &>/dev/null; then
    log "安装 Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
  fi

  # Node.js 18+
  if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 18 ]]; then
    log "安装 Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs 2>/dev/null || sudo yum install -y nodejs
  fi

  # PM2
  if ! command -v pm2 &>/dev/null; then
    log "安装 PM2..."
    sudo npm install -g pm2
  fi

  # Nginx
  if ! command -v nginx &>/dev/null; then
    log "安装 Nginx..."
    sudo apt-get install -y nginx 2>/dev/null || sudo yum install -y nginx
  fi
}

# ---------- 3. 启动 RAGFlow ----------
start_ragflow() {
  local RAG_DIR="$PROJECT_ROOT/ragflow-repo/docker"
  [[ ! -d "$RAG_DIR" ]] && err "未找到 ragflow-repo/docker，请确保项目完整"

  log "配置 RAGFlow（阿里云镜像加速，Web UI 使用 8080 避免与 Nginx 冲突）..."
  cd "$RAG_DIR"
  [[ -f .env ]] || cp .env.example .env 2>/dev/null || true
  grep -q "RAGFLOW_IMAGE" .env && sed -i.bak 's|RAGFLOW_IMAGE=.*|RAGFLOW_IMAGE=registry.cn-hangzhou.aliyuncs.com/infiniflow/ragflow:v0.24.0|' .env || echo 'RAGFLOW_IMAGE=registry.cn-hangzhou.aliyuncs.com/infiniflow/ragflow:v0.24.0' >> .env
  grep -q "^SVR_WEB_HTTP_PORT=" .env && sed -i.bak 's|SVR_WEB_HTTP_PORT=.*|SVR_WEB_HTTP_PORT=8080|' .env || echo 'SVR_WEB_HTTP_PORT=8080' >> .env

  log "启动 RAGFlow（首次拉镜像约 5–15 分钟）..."
  (docker compose -f docker-compose.yml --profile cpu up -d 2>/dev/null) || \
  (docker-compose -f docker-compose.yml --profile cpu up -d)

  log "等待 RAGFlow 就绪..."
  for i in $(seq 1 180); do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9380/ 2>/dev/null | grep -q 200; then
      log "RAGFlow 已就绪"
      return 0
    fi
    sleep 5
  done
  err "RAGFlow 启动超时"
}

# ---------- 4. 启动后端 ----------
start_backend() {
  log "配置后端 .env..."
  cd "$PROJECT_ROOT/server"
  cp "$ENV_PROD" .env
  grep -q "^NODE_ENV=" .env || echo "NODE_ENV=production" >> .env
  grep -q "^RAGFLOW_BASE_URL=" .env || echo "RAGFLOW_BASE_URL=http://127.0.0.1:9380" >> .env
  grep -q "^RAGFLOW_UI_URL=" .env || echo "RAGFLOW_UI_URL=http://127.0.0.1:8080" >> .env

  log "构建后端..."
  yarn install --production
  yarn build

  log "启动后端（PM2）..."
  pm2 delete doctor-server 2>/dev/null || true
  pm2 start dist/index.js --name doctor-server
  pm2 save
  pm2 startup 2>/dev/null || true
}

# ---------- 5. 构建前端 ----------
build_web() {
  log "构建 Web 前端..."
  cd "$PROJECT_ROOT/web"
  yarn install
  yarn build
}

# ---------- 6. 配置 Nginx ----------
setup_nginx() {
  log "配置 Nginx..."
  sudo cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/conf.d/doctor-saas.conf
  sudo nginx -t && sudo systemctl reload nginx
}

# ---------- 7. 首次爬虫（可选） ----------
run_crawler_once() {
  if grep -q "NCBI_EMAIL=.\+" "$ENV_PROD" 2>/dev/null; then
    log "运行爬虫导入医学文献..."
    cd "$PROJECT_ROOT/server"
    export $(grep -v '^#' "$ENV_PROD" | xargs)
    NCBI_EMAIL="${NCBI_EMAIL}" RAGFLOW_BASE_URL=http://127.0.0.1:9380 yarn crawler 2>/dev/null || warn "爬虫执行完成或跳过"
  fi
}

# ---------- 主流程 ----------
main() {
  log "项目根目录: $PROJECT_ROOT"
  [[ "$1" == "--skip-deps" ]] || install_deps
  start_ragflow

  if [[ "$HAS_RAG_KEY" == "1" ]]; then
    build_web
    start_backend
    setup_nginx
    run_crawler_once
    log "部署完成！访问 http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_ECS_IP')"
  else
    warn "请填写 RAGFLOW_API_KEY 后重新运行: ./deploy.sh --skip-deps"
    log "RAGFlow 已启动，访问 http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_ECS_IP'):8080 注册并获取 API Key"
  fi
}

main "$@"
