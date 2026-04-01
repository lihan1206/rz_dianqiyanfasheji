# Docker Compose部署方案

## 一、部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (反向代理)                         │
│                    Port: 80/443                              │
└─────────────────────────────────────────────────────────────┘
           ↓ 10%流量              ↓ 90%流量
┌──────────────────┐      ┌──────────────────┐
│  Backend (v2)    │      │  Backend (v1)    │
│  灰度版本         │      │  稳定版本         │
│  Port: 8218      │      │  Port: 8217      │
└──────────────────┘      └──────────────────┘
           ↓                       ↓
┌─────────────────────────────────────────────────────────────┐
│                      MySQL 8.0                               │
│                    Port: 3306                                │
└─────────────────────────────────────────────────────────────┘
```

## 二、基础Docker Compose配置

**文件路径：** `docker-compose.yml`

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: electrical_rnd_db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-root}
      MYSQL_DATABASE: electrical_rnd
      MYSQL_USER: ${DB_USER:-app_user}
      MYSQL_PASSWORD: ${DB_PASSWORD:-app_password}
      TZ: Asia/Shanghai
    command:
      - --default-authentication-plugin=mysql_native_password
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --max_connections=500
      - --innodb_buffer_pool_size=1G
      - --innodb_log_file_size=256M
      - --slow_query_log=1
      - --slow_query_log_file=/var/log/mysql/slow.log
      - --long_query_time=2
    ports:
      - "${DB_PORT:-33367}:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/init:/docker-entrypoint-initdb.d
      - ./mysql/conf.d:/etc/mysql/conf.d
      - mysql_logs:/var/log/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD:-root}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    networks:
      - backend_network

  redis:
    image: redis:7-alpine
    container_name: electrical_rnd_redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD:-redis_password}
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --appendfsync everysec
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-redis_password}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - backend_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    image: electrical-rnd-backend:${IMAGE_TAG:-latest}
    container_name: electrical_rnd_backend
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 8217
      DATABASE_URL: mysql://${DB_USER:-app_user}:${DB_PASSWORD:-app_password}@mysql:3306/electrical_rnd?charset=utf8mb4
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis_password}@redis:6379/0
      JWT_SECRET: ${JWT_SECRET:-change_me_in_production}
      JWT_EXPIRE: ${JWT_EXPIRE:-7d}
      UPLOAD_DIR: /app/uploads
      LOG_LEVEL: ${LOG_LEVEL:-info}
      TZ: Asia/Shanghai
    ports:
      - "${BACKEND_PORT:-18267}:8217"
      - "${METRICS_PORT:-9090}:9090"
    volumes:
      - backend_uploads:/app/uploads
      - ./logs/backend:/app/logs
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - backend_network
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_BASE_URL: ${API_BASE_URL:-http://localhost:8217}
    image: electrical-rnd-frontend:${IMAGE_TAG:-latest}
    container_name: electrical_rnd_frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "${FRONTEND_PORT:-31267}:80"
    networks:
      - backend_network

  nginx:
    image: nginx:alpine
    container_name: electrical_rnd_nginx
    restart: unless-stopped
    depends_on:
      - backend
      - frontend
    ports:
      - "${NGINX_HTTP_PORT:-80}:80"
      - "${NGINX_HTTPS_PORT:-443}:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    networks:
      - backend_network

volumes:
  mysql_data:
    driver: local
  mysql_logs:
    driver: local
  redis_data:
    driver: local
  backend_uploads:
    driver: local

networks:
  backend_network:
    driver: bridge
    ipam:
      config:
        - subnet: 10.230.0.0/24
```

## 三、灰度发布Docker Compose配置

**文件路径：** `docker-compose.canary.yml`

```yaml
version: '3.8'

services:
  backend-v1:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    image: electrical-rnd-backend:v1.0.0
    container_name: electrical_rnd_backend_v1
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 8217
      DATABASE_URL: mysql://${DB_USER:-app_user}:${DB_PASSWORD:-app_password}@mysql:3306/electrical_rnd?charset=utf8mb4
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis_password}@redis:6379/0
      JWT_SECRET: ${JWT_SECRET:-change_me_in_production}
      JWT_EXPIRE: ${JWT_EXPIRE:-7d}
      UPLOAD_DIR: /app/uploads
      LOG_LEVEL: ${LOG_LEVEL:-info}
      TZ: Asia/Shanghai
      VERSION: v1.0.0
    expose:
      - "8217"
      - "9090"
    volumes:
      - backend_uploads:/app/uploads
      - ./logs/backend-v1:/app/logs
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      backend_network:
        aliases:
          - backend-v1
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    labels:
      - "version=v1.0.0"
      - "deployment=stable"

  backend-v2:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    image: electrical-rnd-backend:v2.0.0
    container_name: electrical_rnd_backend_v2
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 8218
      DATABASE_URL: mysql://${DB_USER:-app_user}:${DB_PASSWORD:-app_password}@mysql:3306/electrical_rnd?charset=utf8mb4
      REDIS_URL: redis://:${REDIS_PASSWORD:-redis_password}@redis:6379/0
      JWT_SECRET: ${JWT_SECRET:-change_me_in_production}
      JWT_EXPIRE: ${JWT_EXPIRE:-7d}
      UPLOAD_DIR: /app/uploads
      LOG_LEVEL: ${LOG_LEVEL:-info}
      TZ: Asia/Shanghai
      VERSION: v2.0.0
    expose:
      - "8218"
      - "9091"
    volumes:
      - backend_uploads:/app/uploads
      - ./logs/backend-v2:/app/logs
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      backend_network:
        aliases:
          - backend-v2
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    labels:
      - "version=v2.0.0"
      - "deployment=canary"

  nginx-canary:
    image: nginx:alpine
    container_name: electrical_rnd_nginx_canary
    restart: unless-stopped
    depends_on:
      - backend-v1
      - backend-v2
    ports:
      - "${NGINX_HTTP_PORT:-80}:80"
      - "${NGINX_HTTPS_PORT:-443}:443"
    volumes:
      - ./nginx/nginx-canary.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    networks:
      - backend_network
```

## 四、Nginx灰度发布配置

**文件路径：** `nginx/nginx-canary.conf`

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'upstream=$upstream_addr response_time=$upstream_response_time';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    upstream backend_v1 {
        server backend-v1:8217 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    upstream backend_v2 {
        server backend-v2:8218 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    upstream backend_canary {
        zone backend_canary 64k;
        
        server backend-v1:8217 weight=90 max_fails=3 fail_timeout=30s;
        server backend-v2:8218 weight=10 max_fails=3 fail_timeout=30s;
        
        keepalive 32;
    }

    map $http_cookie $backend_sticky {
        default backend_canary;
        "~*canary=true" backend_v2;
        "~*canary=false" backend_v1;
    }

    map $request_uri $backend_route {
        default backend_canary;
        "~^/api/v2/" backend_v2;
        "~^/api/v1/" backend_v1;
    }

    server {
        listen 80;
        server_name _;

        client_max_body_size 50m;
        client_body_buffer_size 128k;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffer_size 4k;
        proxy_buffers 4 32k;
        proxy_busy_buffers_size 64k;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        location /api/ {
            proxy_pass http://$backend_route;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";

            add_header X-Upstream-Version $upstream_addr;
            add_header X-Response-Time $upstream_response_time;

            proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
            proxy_next_upstream_tries 3;
        }

        location /api/v2/ {
            proxy_pass http://backend_v2;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
        }

        location /api/v1/ {
            proxy_pass http://backend_v1;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
        }

        location / {
            root /usr/share/nginx/html;
            index index.html index.htm;
            try_files $uri $uri/ /index.html;
        }

        location /nginx_status {
            stub_status on;
            access_log off;
            allow 127.0.0.1;
            allow 10.0.0.0/8;
            deny all;
        }
    }

    server {
        listen 443 ssl http2;
        server_name _;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        location /api/ {
            proxy_pass http://$backend_route;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header Connection "";
        }

        location / {
            root /usr/share/nginx/html;
            index index.html index.htm;
            try_files $uri $uri/ /index.html;
        }
    }
}
```

## 五、灰度发布脚本

### 1. 灰度发布控制脚本

**文件路径：** `scripts/canary-deploy.sh`

```bash
#!/bin/bash

set -e

CANARY_WEIGHT=${1:-10}
STABLE_WEIGHT=$((100 - CANARY_WEIGHT))

echo "=========================================="
echo "灰度发布控制"
echo "=========================================="
echo "当前灰度权重: ${CANARY_WEIGHT}%"
echo "稳定版本权重: ${STABLE_WEIGHT}%"
echo "=========================================="

NGINX_CONF="./nginx/conf.d/upstream.conf"

cat > $NGINX_CONF <<EOF
upstream backend_canary {
    zone backend_canary 64k;
    
    server backend-v1:8217 weight=${STABLE_WEIGHT} max_fails=3 fail_timeout=30s;
    server backend-v2:8218 weight=${CANARY_WEIGHT} max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}
EOF

echo "更新Nginx配置..."
docker exec electrical_rnd_nginx_canary nginx -s reload

echo "✅ 灰度发布配置已更新"
echo "   稳定版本 (v1): ${STABLE_WEIGHT}%"
echo "   灰度版本 (v2): ${CANARY_WEIGHT}%"
```

### 2. 灰度发布流程脚本

**文件路径：** `scripts/canary-pipeline.sh`

```bash
#!/bin/bash

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-v2.0.0}

echo "=========================================="
echo "灰度发布流程"
echo "环境: ${ENVIRONMENT}"
echo "新版本: ${VERSION}"
echo "=========================================="

echo ""
echo "步骤 1/7: 健康检查..."
./scripts/health-check.sh

echo ""
echo "步骤 2/7: 启动灰度版本..."
docker-compose -f docker-compose.canary.yml up -d backend-v2

echo ""
echo "步骤 3/7: 等待灰度版本就绪..."
sleep 30
docker exec electrical_rnd_backend_v2 node healthcheck.js

echo ""
echo "步骤 4/7: 配置10%流量到灰度版本..."
./scripts/canary-deploy.sh 10

echo ""
echo "步骤 5/7: 监控灰度版本 (5分钟)..."
./scripts/monitor-canary.sh 300

echo ""
echo "步骤 6/7: 增加流量到50%..."
./scripts/canary-deploy.sh 50

echo ""
echo "步骤 7/7: 监控灰度版本 (5分钟)..."
./scripts/monitor-canary.sh 300

echo ""
read -p "是否完成全量发布？(yes/no): " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
    echo "完成全量发布..."
    ./scripts/canary-deploy.sh 100
    
    echo "停止旧版本..."
    docker-compose -f docker-compose.canary.yml stop backend-v1
    
    echo "✅ 灰度发布完成！"
else
    echo "回滚到稳定版本..."
    ./scripts/canary-deploy.sh 0
    docker-compose -f docker-compose.canary.yml stop backend-v2
    echo "✅ 已回滚到稳定版本"
fi
```

### 3. 监控脚本

**文件路径：** `scripts/monitor-canary.sh`

```bash
#!/bin/bash

DURATION=${1:-300}
INTERVAL=10
ITERATIONS=$((DURATION / INTERVAL))

echo "监控灰度版本 ${DURATION} 秒..."

for i in $(seq 1 $ITERATIONS); do
    ERROR_RATE=$(curl -s http://localhost:9090/api/v1/query?query=rate(http_requests_total{status_code=~\"5..\"}[1m])/rate(http_requests_total[1m]) | jq -r '.data.result[0].value[1]')
    
    LATENCY=$(curl -s http://localhost:9090/api/v1/query?query=histogram_quantile\(0.99,sum\(rate\(http_request_duration_seconds_bucket\[1m\]\)\)by\(le\)\) | jq -r '.data.result[0].value[1]')
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误率: ${ERROR_RATE}, P99延迟: ${LATENCY}s"
    
    if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
        echo "❌ 错误率过高: ${ERROR_RATE}"
        echo "触发自动回滚..."
        ./scripts/canary-deploy.sh 0
        exit 1
    fi
    
    if (( $(echo "$LATENCY > 2.0" | bc -l) )); then
        echo "⚠️  延迟过高: ${LATENCY}s"
    fi
    
    sleep $INTERVAL
done

echo "✅ 监控完成，灰度版本表现正常"
```

### 4. 健康检查脚本

**文件路径：** `scripts/health-check.sh`

```bash
#!/bin/bash

echo "执行健康检查..."

check_mysql() {
    echo "检查 MySQL..."
    docker exec electrical_rnd_db mysqladmin ping -h localhost -uroot -proot
    if [ $? -eq 0 ]; then
        echo "✅ MySQL 健康"
    else
        echo "❌ MySQL 不健康"
        return 1
    fi
}

check_redis() {
    echo "检查 Redis..."
    docker exec electrical_rnd_redis redis-cli -a redis_password ping
    if [ $? -eq 0 ]; then
        echo "✅ Redis 健康"
    else
        echo "❌ Redis 不健康"
        return 1
    fi
}

check_backend() {
    echo "检查 Backend..."
    curl -f http://localhost:8217/health > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Backend 健康"
    else
        echo "❌ Backend 不健康"
        return 1
    fi
}

check_nginx() {
    echo "检查 Nginx..."
    curl -f http://localhost/health > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Nginx 健康"
    else
        echo "❌ Nginx 不健康"
        return 1
    fi
}

check_mysql && check_redis && check_backend && check_nginx

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 所有服务健康检查通过"
    exit 0
else
    echo ""
    echo "❌ 健康检查失败"
    exit 1
fi
```

## 六、环境变量配置文件

**文件路径：** `.env.production`

```bash
NODE_ENV=production
IMAGE_TAG=v1.0.0

DB_ROOT_PASSWORD=secure_root_password_here
DB_USER=app_user
DB_PASSWORD=secure_app_password_here
DB_PORT=33367

REDIS_PASSWORD=secure_redis_password_here
REDIS_PORT=6379

JWT_SECRET=your_jwt_secret_at_least_32_characters_long
JWT_EXPIRE=7d

BACKEND_PORT=18267
FRONTEND_PORT=31267
METRICS_PORT=9090

NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

LOG_LEVEL=info

API_BASE_URL=https://api.example.com
```

## 七、部署命令

### 1. 基础部署

```bash
docker-compose up -d
```

### 2. 灰度发布

```bash
./scripts/canary-pipeline.sh staging v2.0.0
```

### 3. 调整灰度权重

```bash
./scripts/canary-deploy.sh 30
```

### 4. 完全切换到新版本

```bash
./scripts/canary-deploy.sh 100
```

### 5. 回滚

```bash
./scripts/canary-deploy.sh 0
docker-compose -f docker-compose.canary.yml stop backend-v2
```

### 6. 查看日志

```bash
docker-compose logs -f backend
```

### 7. 查看服务状态

```bash
docker-compose ps
```

## 八、灰度发布策略说明

### 1. 流量分配策略

| 阶段 | 稳定版本 | 灰度版本 | 持续时间 |
|------|---------|---------|---------|
| 初始 | 100% | 0% | - |
| 阶段1 | 90% | 10% | 5分钟 |
| 阶段2 | 50% | 50% | 5分钟 |
| 阶段3 | 0% | 100% | - |

### 2. 自动回滚条件

- 错误率 > 5%
- P99延迟 > 2秒
- 服务健康检查失败
- CPU/内存使用率异常

### 3. 灰度发布检查清单

- [ ] 新版本镜像已构建
- [ ] 数据库迁移已完成
- [ ] 配置已更新
- [ ] 健康检查通过
- [ ] 监控告警正常
- [ ] 回滚脚本就绪

## 九、最佳实践

### 1. 镜像管理

- 使用语义化版本标签
- 保留历史版本镜像
- 定期清理无用镜像

### 2. 配置管理

- 敏感信息使用环境变量
- 配置文件版本控制
- 多环境配置分离

### 3. 监控告警

- 实时监控关键指标
- 设置合理的告警阈值
- 自动化回滚机制

### 4. 备份恢复

- 定期备份数据库
- 备份配置文件
- 测试恢复流程
