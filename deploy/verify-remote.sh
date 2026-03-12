#!/bin/bash
# 验证 ECS 部署是否成功 — 对公网 IP 做健康检查
# 用法: ./verify-remote.sh [ECS_IP]
# 默认: 8.140.221.86

ECS_IP="${1:-8.140.221.86}"
BASE="http://$ECS_IP"

echo "=== 验证 ECS 部署: $ECS_IP ==="
echo ""

echo "1. 应用首页 (HTTP 80)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null || echo "000")
[[ "$CODE" == "200" ]] && echo "   ✓ 应用可访问 ($CODE)" || echo "   ✗ 应用不可访问 (HTTP $CODE)"

echo ""
echo "2. 医生助手页 (/doctor)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/doctor" 2>/dev/null || echo "000")
[[ "$CODE" == "200" ]] && echo "   ✓ 医生助手可访问 ($CODE)" || echo "   ✗ 医生助手不可访问 (HTTP $CODE)"

echo ""
echo "3. RAGFlow 管理 (8080)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE:8080/" 2>/dev/null || echo "000")
[[ "$CODE" == "200" ]] && echo "   ✓ RAGFlow 可访问 ($CODE)" || echo "   ✗ RAGFlow 不可访问 (HTTP $CODE)"

echo ""
echo "=== 验证完成 ==="
echo "应用: $BASE"
echo "医生助手: $BASE/doctor"
echo "RAGFlow: $BASE:8080"
