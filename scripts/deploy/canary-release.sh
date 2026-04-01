#!/bin/bash
# 灰度发布脚本
# 使用方法: ./canary-release.sh <版本号> <流量百分比>

set -e

VERSION=$1
CANARY_PERCENT=$2

if [ -z "$VERSION" ] || [ -z "$CANARY_PERCENT" ]; then
    echo "Usage: $0 <版本号> <流量百分比>"
    echo "Example: $0 v1.1.0 10"
    exit 1
fi

echo "========================================"
echo "🚀 Starting Canary Release Process"
echo "Version: $VERSION"
echo "Canary Traffic: $CANARY_PERCENT%"
echo "========================================"

# 配置
DOCKER_REGISTRY="ghcr.io/yourcompany"
PROJECT_NAME="electrical-rnd"
STABLE_WEIGHT=$((100 - CANARY_PERCENT))

# 步骤1: 检查灰度版本镜像是否存在
echo ""
echo "📦 Checking canary image..."
if ! docker manifest inspect $DOCKER_REGISTRY/$PROJECT_NAME-backend:$VERSION > /dev/null 2>&1; then
    echo "❌ Error: Image $DOCKER_REGISTRY/$PROJECT_NAME-backend:$VERSION not found!"
    exit 1
fi
echo "✅ Canary image found"

# 步骤2: 启动灰度版本服务
echo ""
echo "🔧 Starting canary service..."
export CANARY_VERSION=$VERSION
export CANARY_REPLICAS=1
export STABLE_REPLICAS=3

docker compose -f docker-compose-canary.yml --profile canary up -d backend-canary

echo "⏳ Waiting for canary service to be ready..."
sleep 30

# 检查灰度服务健康状态
CANARY_STATUS=$(docker inspect --format='{{.State.Health.Status}}' electrical_rnd_backend_canary)
if [ "$CANARY_STATUS" != "healthy" ]; then
    echo "❌ Canary service health check failed!"
    echo "📋 Logs from canary service:"
    docker logs electrical_rnd_backend_canary --tail 50
    exit 1
fi
echo "✅ Canary service is healthy"

# 步骤3: 更新Nginx配置以分配流量
echo ""
echo "🔄 Updating Nginx configuration to send $CANARY_PERCENT% traffic to canary..."

# 修改Nginx配置文件中的权重分配
sed -i "s/server backend-stable:8217 weight=[0-9]*/server backend-stable:8217 weight=$STABLE_WEIGHT/" nginx/conf.d/default.conf
sed -i "s/# server backend-canary:8217 weight=[0-9]*/server backend-canary:8217 weight=$CANARY_PERCENT/" nginx/conf.d/default.conf
sed -i "s/#\s*server backend-canary:8217/server backend-canary:8217/" nginx/conf.d/default.conf

# 重载Nginx配置
docker compose -f docker-compose-canary.yml exec -T nginx-gateway nginx -s reload

echo "✅ Nginx configuration updated"
echo "📊 Traffic distribution: $CANARY_PERCENT% to canary, $STABLE_WEIGHT% to stable"

# 步骤4: 监控灰度版本
echo ""
echo "📊 Monitoring canary service metrics..."
echo ""
echo "=== Canary Service Logs (last 20 lines) ==="
docker logs electrical_rnd_backend_canary --tail 20
echo ""
echo "=== Service Status ==="
docker compose -f docker-compose-canary.yml ps

echo ""
echo "========================================"
echo "✅ Canary Release Completed Successfully!"
echo "========================================"
echo ""
echo "📋 Useful commands for monitoring:"
echo "  - View canary logs: docker logs -f electrical_rnd_backend_canary"
echo "  - View service stats: docker compose -f docker-compose-canary.yml stats"
echo "  - Access canary directly: curl -H 'X-Canary-Release: true' http://localhost/api/health"
echo ""
echo "⚠️  Please monitor the system carefully!"
echo "   To increase canary traffic: Re-run this script with higher percentage"
echo "   To rollback: ./scripts/deploy/rollback-canary.sh"
echo "   To promote to full release: ./scripts/deploy/promote-canary.sh $VERSION"
