#!/bin/bash
# ============================================================
# 一键部署到阿里云 ECS
# 通过 SSH 连接 ECS，上传项目并执行 deploy.sh
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy-aliyun]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy-aliyun]${NC} $*"; }
err() { echo -e "${RED}[deploy-aliyun]${NC} $*"; exit 1; }

# ---------- 读取配置 ----------
ALIYUN_ENV="$SCRIPT_DIR/aliyun.env"
[[ -f "$ALIYUN_ENV" ]] || err "未找到 aliyun.env，请复制 aliyun.env.template 为 aliyun.env 并填写"

source "$ALIYUN_ENV" 2>/dev/null || true
export $(grep -v '^#' "$ALIYUN_ENV" | grep -v '^$' | xargs) 2>/dev/null || true

[[ -n "$ECS_HOST" ]] || err "请填写 ECS_HOST（ECS 公网 IP）"
[[ -n "$ECS_USER" ]] || err "请填写 ECS_USER（如 root）"

# SSH 认证（支持：指定密钥 / 密码 / 默认 ~/.ssh 密钥）
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
if [[ -n "$ECS_KEY_PATH" ]] && [[ -f "$ECS_KEY_PATH" ]]; then
  SSH_OPTS="-i $ECS_KEY_PATH $SSH_OPTS"
  log "使用密钥: $ECS_KEY_PATH"
elif [[ -n "$ECS_PASSWORD" ]]; then
  if ! command -v sshpass &>/dev/null; then
    err "使用密码登录需安装 sshpass: brew install sshpass 或 apt install sshpass"
  fi
  export SSHPASS="$ECS_PASSWORD"
  SSH_PREFIX="sshpass -e "
  SCP_PREFIX="sshpass -e "
else
  log "使用默认 SSH 密钥连接"
fi

SSH_PREFIX="${SSH_PREFIX:-}"
SCP_PREFIX="${SCP_PREFIX:-}"
SSH_TARGET="${ECS_USER}@${ECS_HOST}"
REMOTE_DIR="/opt/doctor-saas"

# ---------- 检查本地必要文件 ----------
[[ -f "$SCRIPT_DIR/.env.production" ]] || {
  warn ".env.production 未找到，将使用模板"
  [[ -f "$SCRIPT_DIR/.env.production.template" ]] && cp "$SCRIPT_DIR/.env.production.template" "$SCRIPT_DIR/.env.production"
}
[[ -f "$SCRIPT_DIR/.env.production" ]] || err "请创建 deploy/.env.production 并填写 RAGFLOW_API_KEY、QWEN_API_KEY、JWT_SECRET"

# ---------- 1. 连接测试 ----------
log "测试 SSH 连接 $SSH_TARGET ..."
${SSH_PREFIX}ssh $SSH_OPTS "$SSH_TARGET" "echo OK" || err "SSH 连接失败，请检查 ECS_HOST、ECS_USER、ECS_KEY_PATH/ECS_PASSWORD"

# ---------- 2. 上传项目 ----------
log "上传项目到 $REMOTE_DIR ..."
${SSH_PREFIX}ssh $SSH_OPTS "$SSH_TARGET" "sudo mkdir -p $REMOTE_DIR && sudo chown \$USER:\$USER $REMOTE_DIR"

# 排除 node_modules、.git、dist 等
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'web/dist' \
  --exclude 'server/data/*.db' \
  --exclude 'ragflow-repo/docker/ragflow-logs' \
  -e "${SSH_PREFIX}ssh $SSH_OPTS" \
  "$PROJECT_ROOT/" "$SSH_TARGET:$REMOTE_DIR/"

# ---------- 3. 上传配置 ----------
${SCP_PREFIX}scp $SSH_OPTS "$SCRIPT_DIR/.env.production" "$SSH_TARGET:$REMOTE_DIR/deploy/.env.production"

# ---------- 4. 远程执行部署 ----------
log "在 ECS 上执行部署..."
${SSH_PREFIX}ssh $SSH_OPTS "$SSH_TARGET" "cd $REMOTE_DIR/deploy && chmod +x deploy.sh && sudo ./deploy.sh"

log "部署完成！"
log "应用: http://$ECS_HOST"
log "医生助手: http://$ECS_HOST/doctor"
log "RAGFlow 管理: http://$ECS_HOST:8080"
