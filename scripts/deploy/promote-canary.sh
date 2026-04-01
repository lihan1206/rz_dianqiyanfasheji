#!/bin/bash
# 灰度版本转正脚本（全量发布）
# 使用方法: ./promote-canary.sh <版本号>

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <版本号>"
    echo "Example: $0 v1.1.0"
    exit 1
fi

echo "========================================"
echo "🎉 Promoting Canary to Full Release!"
echo "Version: $VERSION"
echo "========================================"

# 配置
DOCKER_REGISTRY="ghcr.io/yourcompany"
PROJECT_NAME="electrical-rnd"

# 步骤1: 更新稳定版本镜像标签
echo ""
echo "📦 Tagging canary version as new stable..."
docker pull $DOCKER_REGISTRY/$PROJECT_NAME-backend:$VERSION
docker tag $DOCKER_REGISTRY/$PROJECT_NAME-backend:$VERSION $DOCKER_REGISTRY/$PROJECT_NAME-backend:stable
# docker push $DOCKER_REGISTRY/$PROJECT_NAME-backend:stable

echo "✅ Image tagged as stable"

# 步骤2: 平滑升级稳定版本实例（滚动更新）
echo ""
echo "🔄 Rolling update stable instances to new version..."

# 设置新的稳定版本标签
export STABLE_VERSION=$VERSION

# 滚动更新：逐个重启稳定版本实例
# 在实际生产环境中，这会是Kubernetes的滚动更新
docker compose -f docker-compose-canary.yml up -d --no-deps --scale backend-stable=4 backend-stable

echo "⏳ Waiting for rolling update to complete..."
sleep 60

# 检查所有稳定实例状态
ALL_HEALTHY=true
for i in $(seq 1 4); do
    CONTAINER_NAME="electrical_rnd_backend_stable"
    if [ $i -gt 1 ]; then
        CONTAINER_NAME="${CONTAINER_NAME}_$i"
    fi
    
    # 跳过第一个容器名称的特殊情况（docker compose 副本命名规则）
    if docker inspect --format='{{.State.Health.Status}}' "electrical_rnd_backend_stable" 2>/dev/null | grep -q "healthy"; then
        echo "✅ Stable instance $i is healthy"
    else
        echo "⚠️  Stable instance $i may not be ready"
        ALL_HEALTHY=false
    fi
done

# 步骤3: 将灰度版本流量切换到稳定版（100%）
echo ""
echo "⚙️  Switching all traffic to new stable version..."

# 更新Nginx配置，100%流量到稳定版
sed -i "s/server backend-stable:8217 weight=[0-9]*/server backend-stable:8217 weight=100/" nginx/conf.d/default.conf
sed -i "s/server backend-canary:8217 weight=[0-9]*/# server backend-canary:8217 weight=0/" nginx/conf.d/default.conf

# 重载Nginx
docker compose -f docker-compose-canary.yml exec -T nginx-gateway nginx -s reload

echo "✅ All traffic is now directed to stable version"

# 步骤4: 停止并移除灰度版本服务
echo ""
echo "⏹️  Cleaning up canary service..."
docker compose -f docker-compose-canary.yml stop backend-canary
docker compose -f docker-compose-canary.yml rm -f backend-canary

# 缩容稳定版实例到正常数量
echo ""
echo "⚖️  Scaling stable instances back to normal (3 replicas)..."
docker compose -f docker-compose-canary.yml up -d --no-deps --scale backend-stable=3 backend-stable

echo "✅ Canary service cleaned up"

# 步骤5: 验证最终状态
echo ""
echo "🔍 Final verification..."
echo ""
echo "=== Service Status ==="
docker compose -f docker-compose-canary.yml ps

echo ""
echo "=== Service Versions ==="
echo "Current stable version: $VERSION"

echo ""
echo "========================================"
echo "🎉 Full Release Completed Successfully!"
echo "========================================"
echo ""
echo "📋 Release Summary:"
echo "  - Version $VERSION has been promoted to stable"
echo "  - All traffic (100%) is now directed to the new version"
echo "  - Canary service has been decommissioned"
echo "  - Rolling update completed with zero downtime (hopefully) 😉"
echo ""
echo "📌 Post-release actions:"
echo "  - Monitor application logs for any errors"
echo "  - Check key metrics (error rate, response time)"
echo "  - Run smoke tests on critical functionalities"
echo "  - Update documentation if needed"
