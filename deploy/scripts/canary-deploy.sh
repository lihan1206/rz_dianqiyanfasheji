#!/bin/bash

# 灰度发布管理脚本

ACTION=$1
CANARY_PERCENTAGE=${2:-10}

case $ACTION in
    "start")
        echo "Starting canary deployment with ${CANARY_PERCENTAGE}% traffic..."
        # 修改Nginx配置调整权重
        sed -i "s/weight=.*/weight=${CANARY_PERCENTAGE};/" nginx/conf.d/canary.conf
        docker-compose up -d flask-canary
        docker-compose exec nginx nginx -s reload
        echo "Canary deployment started. Traffic: ${CANARY_PERCENTAGE}%"
        ;;
        
    "promote")
        echo "Promoting canary to stable..."
        # 停止旧版本，新版本接管全部流量
        docker-compose stop flask-stable
        docker-compose rename flask-canary flask-stable
        docker-compose up -d --scale flask-stable=3
        echo "Canary promoted successfully"
        ;;
        
    "rollback")
        echo "Rolling back canary deployment..."
        docker-compose stop flask-canary
        docker-compose rm -f flask-canary
        # 恢复Nginx配置
        sed -i "s/weight=.*/weight=0;/" nginx/conf.d/canary.conf
        docker-compose exec nginx nginx -s reload
        echo "Rollback completed"
        ;;
        
    "status")
        echo "Canary deployment status:"
        docker-compose ps flask-canary
        echo ""
        echo "Current traffic distribution:"
        docker-compose exec nginx cat /var/log/nginx/access.log | grep -c "canary=canary"
        ;;
        
    *)
        echo "Usage: $0 {start|promote|rollback|status} [percentage]"
        exit 1
        ;;
esac
