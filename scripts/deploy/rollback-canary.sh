#!/bin/bash
# 灰度版本回滚脚本

set -e

echo "========================================"
echo "🔄 Starting Canary Rollback Process"
echo "========================================"

# 步骤1: 恢复Nginx配置，移除灰度版本
echo ""
echo "⚙️  Restoring Nginx configuration (100% traffic to stable)..."

# 注释掉灰度版本的upstream配置，恢复稳定版100%权重
sed -i "s/server backend-stable:8217 weight=[0-9]*/server backend-stable:8217 weight=100/" nginx/conf.d/default.conf
sed -i "s/server backend-canary:8217 weight=[0-9]*/# server backend-canary:8217 weight=0/" nginx/conf.d/default.conf

# 重载Nginx配置
docker compose -f docker-compose-canary.yml exec -T nginx-gateway nginx -s reload

echo "✅ Nginx configuration restored, 100% traffic now goes to stable version"

# 步骤2: 停止灰度版本服务
echo ""
echo "⏹️  Stopping canary service..."
docker compose -f docker-compose-canary.yml stop backend-canary
docker compose -f docker-compose-canary.yml rm -f backend-canary

echo "✅ Canary service stopped and removed"

# 步骤3: 验证稳定版服务状态
echo ""
echo "🔍 Verifying stable service health..."
sleep 5

STABLE_STATUS=$(docker inspect --format='{{.State.Health.Status}}' electrical_rnd_backend_stable 2>/dev/null || echo "unknown")

if [ "$STABLE_STATUS" = "healthy" ]; then
    echo "✅ Stable service is healthy"
else
    echo "⚠️  Warning: Stable service status: $STABLE_STATUS"
    docker compose -f docker-compose-canary.yml ps
fi

echo ""
echo "========================================"
echo "✅ Canary Rollback Completed Successfully!"
echo "========================================"
echo ""
echo "📋 Rollback Summary:"
echo "  - All traffic is now directed to stable version"
echo "  - Canary service has been stopped and removed"
echo "  - Nginx configuration has been restored"
