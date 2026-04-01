# CI/CD流程设计文档

## 一、CI/CD流程概览

```
代码提交 → 代码检查 → 单元测试 → 构建镜像 → 集成测试 → 部署 staging → 自动化测试 → 部署 prod
```

## 二、分支策略

### 1. Git Flow分支模型

```
master (main)
  ├── develop
  │   ├── feature/user-authentication
  │   ├── feature/bom-export
  │   └── feature/component-search
  ├── release/v1.2.0
  └── hotfix/critical-bug-fix
```

### 2. 分支说明

| 分支类型 | 命名规范 | 说明 | 生命周期 |
|---------|---------|------|---------|
| master/main | master, main | 生产环境代码，随时可部署 | 永久 |
| develop | develop | 开发环境代码，集成最新功能 | 永久 |
| feature | feature/功能名称 | 新功能开发 | 临时 |
| release | release/版本号 | 发布准备，bug修复 | 临时 |
| hotfix | hotfix/问题描述 | 生产环境紧急修复 | 临时 |

### 3. 分支保护规则

**master分支：**
- 禁止直接推送
- 必须通过Pull Request合并
- 需要至少2个代码审查批准
- 必须通过所有CI检查

**develop分支：**
- 禁止直接推送
- 需要至少1个代码审查批准
- 必须通过所有CI检查

**feature分支：**
- 从develop分支创建
- 开发完成后合并回develop
- 合并后删除分支

### 4. 工作流程

```
1. 从develop创建feature分支
   git checkout develop
   git pull origin develop
   git checkout -b feature/new-feature

2. 开发并提交代码
   git add .
   git commit -m "feat: add new feature"

3. 推送到远程仓库
   git push origin feature/new-feature

4. 创建Pull Request到develop分支
   - 填写PR描述
   - 关联Issue
   - 等待代码审查

5. 代码审查通过后合并
   - Squash and merge
   - 删除feature分支

6. 发布时创建release分支
   git checkout -b release/v1.0.0 develop
   # 修复bug，更新版本号
   git checkout master
   git merge --no-ff release/v1.0.0
   git tag -a v1.0.0

7. 合并回develop分支
   git checkout develop
   git merge --no-ff release/v1.0.0
```

## 三、CI流程设计

### 1. GitHub Actions工作流

**文件路径：** `.github/workflows/ci.yml`

```yaml
name: CI Pipeline

on:
  push:
    branches: [ develop, master ]
  pull_request:
    branches: [ develop, master ]

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  code-quality:
    name: 代码质量检查
    runs-on: ubuntu-latest
    steps:
      - name: Checkout代码
        uses: actions/checkout@v4

      - name: 设置Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: 安装依赖
        run: |
          cd backend
          npm ci

      - name: ESLint代码检查
        run: |
          cd backend
          npm run lint

      - name: Prettier格式检查
        run: |
          cd backend
          npm run format:check

      - name: 安全漏洞扫描
        run: |
          cd backend
          npm audit --audit-level=moderate

  unit-test:
    name: 单元测试
    runs-on: ubuntu-latest
    needs: code-quality
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: test_db
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3

    steps:
      - name: Checkout代码
        uses: actions/checkout@v4

      - name: 设置Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: 安装依赖
        run: |
          cd backend
          npm ci

      - name: 运行Prisma迁移
        run: |
          cd backend
          npx prisma migrate deploy
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/test_db

      - name: 运行单元测试
        run: |
          cd backend
          npm run test:unit -- --coverage
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/test_db
          JWT_SECRET: test_secret
          NODE_ENV: test

      - name: 上传测试覆盖率报告
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  build-image:
    name: 构建Docker镜像
    runs-on: ubuntu-latest
    needs: [code-quality, unit-test]
    if: github.event_name == 'push' && (github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/master')
    steps:
      - name: Checkout代码
        uses: actions/checkout@v4

      - name: 设置Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: 登录容器镜像仓库
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: 提取Docker元数据
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: 构建并推送Docker镜像
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NODE_ENV=production

  integration-test:
    name: 集成测试
    runs-on: ubuntu-latest
    needs: build-image
    if: github.ref == 'refs/heads/develop'
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: integration_test
        ports:
          - 3306:3306
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - name: Checkout代码
        uses: actions/checkout@v4

      - name: 运行集成测试
        run: |
          cd backend
          npm run test:integration
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/integration_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: integration_test_secret
          NODE_ENV: test

  security-scan:
    name: 安全扫描
    runs-on: ubuntu-latest
    needs: build-image
    steps:
      - name: 运行Trivy漏洞扫描
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: 上传Trivy扫描结果
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

## 四、CD流程设计

### 1. 自动化部署工作流

**文件路径：** `.github/workflows/cd.yml`

```yaml
name: CD Pipeline

on:
  push:
    branches: [ master ]
  release:
    types: [ published ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}
  KUBECTL_VERSION: '1.28.0'

jobs:
  deploy-staging:
    name: 部署到Staging环境
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - name: Checkout代码
        uses: actions/checkout@v4

      - name: 配置kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: ${{ env.KUBECTL_VERSION }}

      - name: 设置Kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > ~/.kube/config

      - name: 部署到Kubernetes
        run: |
          cd k8s/staging
          kubectl apply -f namespace.yaml
          kubectl apply -f configmap.yaml
          kubectl apply -f secrets.yaml
          kubectl apply -f deployment.yaml
          kubectl apply -f service.yaml
          kubectl apply -f ingress.yaml

      - name: 等待部署完成
        run: |
          kubectl rollout status deployment/backend -n staging --timeout=300s

      - name: 运行冒烟测试
        run: |
          npm run test:smoke
        env:
          API_URL: https://staging-api.example.com

  deploy-production:
    name: 部署到生产环境
    runs-on: ubuntu-latest
    if: github.event_name == 'release'
    environment:
      name: production
      url: https://www.example.com
    steps:
      - name: Checkout代码
        uses: actions/checkout@v4

      - name: 配置kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: ${{ env.KUBECTL_VERSION }}

      - name: 设置Kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBE_CONFIG_PRODUCTION }}" | base64 -d > ~/.kube/config

      - name: 金丝雀发布（10%流量）
        run: |
          cd k8s/production
          kubectl apply -f canary-10.yaml
          sleep 300

      - name: 监控金丝雀发布
        run: |
          ./scripts/monitor-canary.sh
        env:
          PROMETHEUS_URL: ${{ secrets.PROMETHEUS_URL }}

      - name: 增加流量到50%
        if: success()
        run: |
          kubectl apply -f k8s/production/canary-50.yaml
          sleep 300

      - name: 完成全量发布
        if: success()
        run: |
          kubectl apply -f k8s/production/deployment.yaml
          kubectl delete -f k8s/production/canary-50.yaml

      - name: 部署后健康检查
        run: |
          ./scripts/health-check.sh
        env:
          API_URL: https://www.example.com

  rollback:
    name: 回滚部署
    runs-on: ubuntu-latest
    if: failure()
    steps:
      - name: 回滚到上一版本
        run: |
          kubectl rollout undo deployment/backend -n production

      - name: 通知团队
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: '生产环境部署失败，已自动回滚'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## 五、Docker镜像构建策略

### 1. 多阶段构建

**文件路径：** `backend/Dockerfile`

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --chown=nodejs:nodejs src ./src

USER nodejs

EXPOSE 8217

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "src/server.js"]
```

### 2. 镜像标签策略

```
ghcr.io/org/project:latest              # 最新稳定版
ghcr.io/org/project:v1.2.0              # 语义化版本
ghcr.io/org/project:master-abc123       # 分支名-commit SHA
ghcr.io/org/project:develop-def456      # 开发分支
ghcr.io/org/project:release-1.2.0-xyz789 # 发布分支
```

### 3. 镜像安全

**安全扫描：**
- 使用Trivy扫描镜像漏洞
- 扫描失败阻止部署
- 定期扫描已部署镜像

**最小化镜像：**
- 使用Alpine基础镜像
- 多阶段构建减小镜像大小
- 不安装不必要的包

## 六、Kubernetes部署配置

### 1. Deployment配置

**文件路径：** `k8s/base/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  labels:
    app: backend
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        version: v1
    spec:
      containers:
      - name: backend
        image: ghcr.io/org/project:latest
        ports:
        - containerPort: 8217
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8217
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8217
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - backend
              topologyKey: kubernetes.io/hostname
```

### 2. Service配置

**文件路径：** `k8s/base/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  type: ClusterIP
  selector:
    app: backend
  ports:
  - port: 8217
    targetPort: 8217
    protocol: TCP
    name: http
```

### 3. Ingress配置

**文件路径：** `k8s/base/ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backend-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: backend-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 8217
```

### 4. ConfigMap配置

**文件路径：** `k8s/base/configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
data:
  NODE_ENV: production
  PORT: "8217"
  LOG_LEVEL: info
  CORS_ORIGIN: https://www.example.com
  RATE_LIMIT_WINDOW_MS: "900000"
  RATE_LIMIT_MAX_REQUESTS: "100"
```

### 5. Secrets配置

**文件路径：** `k8s/base/secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
type: Opaque
stringData:
  database-url: mysql://user:password@mysql:3306/dbname
  jwt-secret: your-jwt-secret-here
  redis-url: redis://redis:6379
```

## 七、灰度发布策略

### 1. 金丝雀发布

**文件路径：** `k8s/production/canary.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-canary
  labels:
    app: backend
    version: v2
    track: canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend
      track: canary
  template:
    metadata:
      labels:
        app: backend
        version: v2
        track: canary
    spec:
      containers:
      - name: backend
        image: ghcr.io/org/project:v2.0.0
        ports:
        - containerPort: 8217
```

### 2. 流量分割

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: backend
spec:
  hosts:
  - backend-service
  http:
  - route:
    - destination:
        host: backend-service
        subset: v1
      weight: 90
    - destination:
        host: backend-service
        subset: v2
      weight: 10
```

### 3. 自动化回滚

**监控指标：**
- 错误率 > 5%
- 响应时间 P99 > 2s
- 成功率 < 95%

**回滚脚本：** `scripts/auto-rollback.sh`

```bash
#!/bin/bash

ERROR_RATE=$(curl -s http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status="5xx"}[5m]) | jq -r '.data.result[0].value[1]')

if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
  echo "Error rate too high: $ERROR_RATE"
  kubectl rollout undo deployment/backend-canary -n production
  kubectl delete deployment backend-canary -n production
  exit 1
fi
```

## 八、自动化测试策略

### 1. 测试金字塔

```
        /\
       /  \      E2E测试 (10%)
      /----\     - 用户场景测试
     /      \    - 跨服务集成测试
    /--------\   
   /          \  集成测试 (20%)
  /------------\ - API测试
 /              \- 数据库集成测试
/----------------\
    单元测试 (70%)
- 函数测试
- 组件测试
- 快速反馈
```

### 2. 测试覆盖率要求

```
单元测试覆盖率：≥ 80%
集成测试覆盖率：≥ 60%
E2E测试覆盖率：关键业务流程 100%
```

### 3. 测试配置

**Jest配置：** `backend/jest.config.js`

```javascript
export default {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/middleware/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
```

## 九、通知与告警

### 1. Slack通知

**部署成功通知：**
```yaml
- name: 通知Slack
  uses: 8398a7/action-slack@v3
  with:
    status: success
    fields: repo,message,commit,author,action,eventName,ref,workflow
    text: '✅ 部署成功'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 2. 邮件通知

**部署失败通知：**
```yaml
- name: 发送邮件
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: 部署失败通知
    to: team@example.com
    from: CI/CD Pipeline
    body: |
      部署失败！
      项目：${{ github.repository }}
      分支：${{ github.ref }}
      提交：${{ github.sha }}
```

## 十、性能优化

### 1. 构建缓存

**npm缓存：**
```yaml
- name: 缓存npm依赖
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

**Docker层缓存：**
```yaml
- name: 缓存Docker层
  uses: actions/cache@v3
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-buildx-
```

### 2. 并行执行

**并行测试：**
```yaml
- name: 运行测试
  run: npm test -- --parallel --maxWorkers=4
```

**并行构建：**
```yaml
strategy:
  matrix:
    service: [backend, frontend]
  max-parallel: 2
```

## 十一、最佳实践总结

### 1. 代码质量

- ✅ 所有代码必须通过ESLint检查
- ✅ 单元测试覆盖率不低于80%
- ✅ 代码必须经过Code Review
- ✅ 提交信息遵循Conventional Commits规范

### 2. 安全性

- ✅ 镜像漏洞扫描
- ✅ 依赖安全审计
- ✅ 敏感信息使用Secrets管理
- ✅ 最小权限原则

### 3. 可靠性

- ✅ 健康检查
- ✅ 优雅关闭
- ✅ 自动重试
- ✅ 熔断降级

### 4. 可观测性

- ✅ 结构化日志
- ✅ 分布式追踪
- ✅ 性能监控
- ✅ 错误告警
