#!/bin/bash
# 自测脚本 — 验证知识库与医生助手
# 在前后端均启动后运行：./deploy/verify.sh

set -e
BASE="${1:-http://localhost:3000}"

echo "=== 1. 健康检查 ==="
curl -s "$BASE/health" | head -c 200 || curl -s "$BASE/api/health" | head -c 200
echo ""

echo ""
echo "=== 2. RAGFlow 状态 ==="
curl -s "$BASE/api/knowledge/health" | head -c 300
echo ""

echo ""
echo "=== 3. 医生助手知识库 ==="
curl -s "$BASE/api/doctor/datasets" -H "Authorization: Bearer $(cat /dev/null)" 2>/dev/null | head -c 500 || echo "需登录"
echo ""

echo ""
echo "=== 自测完成 ==="
echo "访问 $BASE/doctor 测试医生助手对话"
echo "知识库有爬虫数据后，提问如「糖尿病最新治疗」应能返回带引用的回答"
