#!/bin/bash
# 快速启动脚本 - 一键部署完整环境

set -e

echo "========================================"
echo "🚀 Electrical R&D System Quick Start"
echo "========================================"

# 检查Docker环境
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not found! Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose not found! Please install Docker Compose first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo "❌ Docker is not running! Please start Docker first."
        exit 1
    fi
    
    echo "✅ Docker environment is ready"
}

# 加载环境变量
load_env() {
    if [ -f .env.dev ]; then
        export $(cat .env.dev | grep -v '^#' | xargs)
        echo "✅ Loaded environment variables from .env.dev"
    else
        echo "⚠️  .env.dev not found, using default values"
    fi
}

# 创建必要目录
create_dirs() {
    mkdir -p logs/backend-stable logs/backend-canary logs/nginx-gateway logs/nginx-frontend
    mkdir -p nginx/ssl
    echo "✅ Created necessary directories"
}

# 启动服务
start_services() {
    echo ""
    echo "🔧 Starting core services..."
    
    # 先启动基础服务（不包含灰度）
    docker compose -f docker-compose-canary.yml up -d db redis backend-stable frontend nginx-gateway
    
    echo "⏳ Waiting for services to initialize..."
    sleep 60
    
    # 检查服务状态
    echo ""
    echo "📊 Service Status:"
    docker compose -f docker-compose-canary.yml ps
}

# 显示访问信息
show_access_info() {
    echo ""
    echo "========================================"
    echo "✅ System Deployment Complete!"
    echo "========================================"
    echo ""
    echo "🌐 Access Information:"
    echo "  - Frontend: http://localhost"
    echo "  - Backend API: http://localhost/api"
    echo "  - Health Check: http://localhost/health"
    echo ""
    echo "📋 Useful Commands:"
    echo "  - View logs: docker compose -f docker-compose-canary.yml logs -f [service]"
    echo "  - Stop services: docker compose -f docker-compose-canary.yml down"
    echo "  - Start canary: docker compose -f docker-compose-canary.yml --profile canary up -d backend-canary"
    echo "  - Canary release: ./scripts/deploy/canary-release.sh <version> <percent>"
    echo ""
    echo "🔒 Default Credentials (from seed data):"
    echo "  - Admin: admin / admin123"
    echo "  - Engineer: engineer / engineer123"
    echo ""
    echo "⚠️  Note: Please change default passwords in production!"
}

# 主流程
check_docker
load_env
create_dirs
start_services
show_access_info
