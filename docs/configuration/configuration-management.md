# 配置管理设计文档

## 一、配置管理策略概述

本项目采用分层配置管理策略，支持多环境部署，确保配置的安全性、可维护性和可追溯性。

### 配置层次结构

```
环境变量 > 配置文件 > 默认值
```

## 二、环境配置文件设计

### 1. 目录结构

```
config/
├── default.yml          # 默认配置
├── development.yml      # 开发环境
├── test.yml            # 测试环境
├── staging.yml         # 预发布环境
├── production.yml      # 生产环境
└── secrets/            # 敏感配置（加密存储）
    ├── development.enc.yml
    ├── staging.enc.yml
    └── production.enc.yml
```

### 2. 默认配置文件

**文件路径：** `config/default.yml`

```yaml
app:
  name: electrical-rnd-system
  version: 1.0.0
  port: 8217
  env: development

server:
  host: 0.0.0.0
  port: 8217
  cors:
    enabled: true
    origins:
      - http://localhost:3000
      - http://localhost:5173
    methods:
      - GET
      - POST
      - PUT
      - DELETE
      - PATCH
    credentials: true
  rateLimit:
    enabled: true
    windowMs: 900000
    maxRequests: 100

database:
  type: mysql
  host: localhost
  port: 3306
  name: electrical_rnd
  username: root
  password: root
  charset: utf8mb4
  timezone: +08:00
  pool:
    min: 5
    max: 20
    acquire: 30000
    idle: 10000
  logging: false

redis:
  enabled: false
  host: localhost
  port: 6379
  password: ''
  db: 0
  keyPrefix: 'ernd:'

jwt:
  secret: change-me-in-production
  expiresIn: 7d
  refreshExpiresIn: 30d
  issuer: electrical-rnd-system

upload:
  provider: local
  maxSize: 52428800
  allowedTypes:
    - image/jpeg
    - image/png
    - image/gif
    - application/pdf
    - application/msword
    - application/vnd.openxmlformats-officedocument.wordprocessingml.document
    - application/vnd.ms-excel
    - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  path: ./uploads

log:
  level: info
  format: json
  output: stdout
  file:
    enabled: false
    path: ./logs
    maxSize: 10485760
    maxFiles: 5

monitoring:
  enabled: false
  metrics:
    enabled: false
    port: 9090
  tracing:
    enabled: false
    serviceName: electrical-rnd-backend
    endpoint: http://localhost:14268/api/traces

security:
  bcrypt:
    saltRounds: 10
  helmet:
    enabled: true
  hsts:
    enabled: false
    maxAge: 31536000
    includeSubDomains: true
```

### 3. 开发环境配置

**文件路径：** `config/development.yml`

```yaml
app:
  env: development
  debug: true

server:
  cors:
    origins:
      - http://localhost:3000
      - http://localhost:5173
      - http://127.0.0.1:3000
      - http://127.0.0.1:5173
  rateLimit:
    enabled: false

database:
  host: localhost
  port: 3306
  name: electrical_rnd_dev
  username: root
  password: root
  logging: true
  pool:
    min: 2
    max: 10

redis:
  enabled: false

log:
  level: debug
  format: pretty
  file:
    enabled: true
    path: ./logs/dev

monitoring:
  enabled: false

security:
  hsts:
    enabled: false
```

### 4. 测试环境配置

**文件路径：** `config/test.yml`

```yaml
app:
  env: test
  debug: true

server:
  port: 8217
  cors:
    origins:
      - http://test.example.com
  rateLimit:
    enabled: false

database:
  host: test-db
  port: 3306
  name: electrical_rnd_test
  username: test_user
  password: test_password
  logging: false
  pool:
    min: 2
    max: 10

redis:
  enabled: true
  host: test-redis
  port: 6379

log:
  level: debug
  format: json

monitoring:
  enabled: true
  metrics:
    enabled: true
  tracing:
    enabled: true
    endpoint: http://jaeger:14268/api/traces

security:
  hsts:
    enabled: false
```

### 5. 预发布环境配置

**文件路径：** `config/staging.yml`

```yaml
app:
  env: staging
  debug: false

server:
  cors:
    origins:
      - https://staging.example.com
  rateLimit:
    enabled: true
    windowMs: 900000
    maxRequests: 200

database:
  host: staging-db.cluster-xxx.region.rds.amazonaws.com
  port: 3306
  name: electrical_rnd_staging
  username: staging_user
  password: ${DB_PASSWORD}
  logging: false
  pool:
    min: 5
    max: 15
  ssl:
    enabled: true
    rejectUnauthorized: true

redis:
  enabled: true
  host: staging-redis.cache.amazonaws.com
  port: 6379
  password: ${REDIS_PASSWORD}

log:
  level: info
  format: json
  file:
    enabled: true
    path: /var/log/app

monitoring:
  enabled: true
  metrics:
    enabled: true
    port: 9090
  tracing:
    enabled: true
    endpoint: http://jaeger-collector:14268/api/traces

security:
  hsts:
    enabled: true
    maxAge: 31536000
```

### 6. 生产环境配置

**文件路径：** `config/production.yml`

```yaml
app:
  env: production
  debug: false

server:
  cors:
    origins:
      - https://www.example.com
      - https://app.example.com
  rateLimit:
    enabled: true
    windowMs: 900000
    maxRequests: 100

database:
  host: ${DB_HOST}
  port: 3306
  name: electrical_rnd_prod
  username: ${DB_USER}
  password: ${DB_PASSWORD}
  logging: false
  pool:
    min: 10
    max: 50
    acquire: 30000
    idle: 10000
  ssl:
    enabled: true
    rejectUnauthorized: true
    ca: ${DB_SSL_CA}

redis:
  enabled: true
  host: ${REDIS_HOST}
  port: 6379
  password: ${REDIS_PASSWORD}
  db: 0
  keyPrefix: 'ernd:prod:'
  cluster:
    enabled: true
    nodes:
      - host: redis-node-1
        port: 6379
      - host: redis-node-2
        port: 6379
      - host: redis-node-3
        port: 6379

jwt:
  secret: ${JWT_SECRET}
  expiresIn: 1h
  refreshExpiresIn: 7d

upload:
  provider: s3
  s3:
    bucket: ${S3_BUCKET}
    region: ${AWS_REGION}
    accessKeyId: ${AWS_ACCESS_KEY_ID}
    secretAccessKey: ${AWS_SECRET_ACCESS_KEY}

log:
  level: warn
  format: json
  output: stdout
  file:
    enabled: false

monitoring:
  enabled: true
  metrics:
    enabled: true
    port: 9090
  tracing:
    enabled: true
    serviceName: electrical-rnd-backend-prod
    endpoint: ${JAEGER_ENDPOINT}

security:
  bcrypt:
    saltRounds: 12
  helmet:
    enabled: true
  hsts:
    enabled: true
    maxAge: 31536000
    includeSubDomains: true
    preload: true
```

## 三、环境变量配置

### 1. 环境变量文件

**文件路径：** `.env.development`

```bash
NODE_ENV=development
APP_ENV=development
APP_PORT=8217

DATABASE_URL=mysql://root:root@localhost:3306/electrical_rnd_dev
DB_HOST=localhost
DB_PORT=3306
DB_NAME=electrical_rnd_dev
DB_USER=root
DB_PASSWORD=root

REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=dev_secret_key_change_in_production
JWT_EXPIRE=7d

LOG_LEVEL=debug
LOG_FORMAT=pretty

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

**文件路径：** `.env.staging`

```bash
NODE_ENV=production
APP_ENV=staging
APP_PORT=8217

DATABASE_URL=mysql://staging_user:password@staging-db:3306/electrical_rnd_staging
DB_HOST=staging-db.cluster-xxx.region.rds.amazonaws.com
DB_PORT=3306
DB_NAME=electrical_rnd_staging
DB_USER=staging_user
DB_PASSWORD=staging_secure_password_here

REDIS_URL=redis://:password@staging-redis:6379
REDIS_HOST=staging-redis.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=staging_redis_password_here

JWT_SECRET=staging_jwt_secret_key_here
JWT_EXPIRE=1h

LOG_LEVEL=info
LOG_FORMAT=json

UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=52428800

CORS_ORIGIN=https://staging.example.com

AWS_REGION=us-east-1
S3_BUCKET=staging-uploads-bucket
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**文件路径：** `.env.production`

```bash
NODE_ENV=production
APP_ENV=production
APP_PORT=8217

DATABASE_URL=${DB_CONNECTION_STRING}
DB_HOST=${DB_HOST}
DB_PORT=3306
DB_NAME=electrical_rnd_prod
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_SSL_CA=${DB_SSL_CA}

REDIS_URL=${REDIS_CONNECTION_STRING}
REDIS_HOST=${REDIS_HOST}
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRE=1h

LOG_LEVEL=warn
LOG_FORMAT=json

UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=52428800

CORS_ORIGIN=https://www.example.com,https://app.example.com

AWS_REGION=${AWS_REGION}
S3_BUCKET=${S3_BUCKET}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}

JAEGER_ENDPOINT=${JAEGER_ENDPOINT}
```

### 2. 环境变量加载顺序

```javascript
import dotenv from 'dotenv';
import path from 'path';

const env = process.env.NODE_ENV || 'development';

dotenv.config({
  path: path.resolve(process.cwd(), `.env.${env}`)
});

dotenv.config();
```

## 四、配置加密与安全注入

### 1. 敏感配置加密

**使用加密配置文件：**

**文件路径：** `config/secrets/production.enc.yml`

```yaml
# 加密后的配置文件
# 使用 ansible-vault 或 sops 加密
database:
  password: ENC[AES256_GCM,data:encrypted_password_here,iv:iv_here,tag:tag_here]
redis:
  password: ENC[AES256_GCM,data:encrypted_redis_password,iv:iv_here,tag:tag_here]
jwt:
  secret: ENC[AES256_GCM,data:encrypted_jwt_secret,iv:iv_here,tag:tag_here]
aws:
  accessKeyId: ENC[AES256_GCM,data:encrypted_access_key,iv:iv_here,tag:tag_here]
  secretAccessKey: ENC[AES256_GCM,data:encrypted_secret_key,iv:iv_here,tag:tag_here]
```

**加密工具：** `scripts/encrypt-config.js`

```javascript
import crypto from 'crypto';
import fs from 'fs';
import yaml from 'js-yaml';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.CONFIG_ENCRYPTION_KEY, 'hex');

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  };
}

function decrypt(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export { encrypt, decrypt };
```

### 2. Kubernetes Secrets管理

**Secret配置：** `k8s/base/secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
  namespace: production
type: Opaque
stringData:
  database-url: mysql://user:password@prod-db:3306/electrical_rnd_prod
  db-password: your-db-password
  redis-password: your-redis-password
  jwt-secret: your-jwt-secret
  aws-access-key-id: AKIAIOSFODNN7EXAMPLE
  aws-secret-access-key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**从文件创建Secret：**

```bash
kubectl create secret generic backend-secrets \
  --from-literal=db-password=$(cat /run/secrets/db_password) \
  --from-literal=jwt-secret=$(cat /run/secrets/jwt_secret) \
  -n production
```

### 3. HashiCorp Vault集成

**Vault配置：** `vault/config.hcl`

```hcl
storage "consul" {
  address = "127.0.0.1:8500"
  path    = "vault"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_cert_file = "/path/to/cert.pem"
  tls_key_file  = "/path/to/key.pem"
}

seal "awskms" {
  region = "us-east-1"
  kms_key_id = "alias/vault-key"
}
```

**应用集成Vault：**

```javascript
import vault from 'node-vault';

const vaultClient = vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN
});

async function getSecret(path) {
  const result = await vaultClient.read(`secret/data/${path}`);
  return result.data.data;
}

const dbConfig = await getSecret('database');
const jwtConfig = await getSecret('jwt');
```

### 4. AWS Secrets Manager集成

**从Secrets Manager获取配置：**

```javascript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManager({
  region: process.env.AWS_REGION
});

async function getSecret(secretId) {
  const response = await secretsManager.getSecretValue({
    SecretId: secretId
  });
  
  return JSON.parse(response.SecretString);
}

const dbSecrets = await getSecret('prod/database');
const jwtSecrets = await getSecret('prod/jwt');
```

## 五、配置验证

### 1. 配置Schema验证

**文件路径：** `src/config/schema.js`

```javascript
import { z } from 'zod';

const configSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    port: z.number().min(1).max(65535),
    env: z.enum(['development', 'test', 'staging', 'production'])
  }),
  
  server: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    cors: z.object({
      enabled: z.boolean(),
      origins: z.array(z.string()),
      methods: z.array(z.string()),
      credentials: z.boolean()
    }),
    rateLimit: z.object({
      enabled: z.boolean(),
      windowMs: z.number().positive(),
      maxRequests: z.number().positive()
    })
  }),
  
  database: z.object({
    type: z.string(),
    host: z.string(),
    port: z.number().min(1).max(65535),
    name: z.string(),
    username: z.string(),
    password: z.string().min(8),
    charset: z.string(),
    pool: z.object({
      min: z.number().positive(),
      max: z.number().positive()
    })
  }),
  
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string(),
    refreshExpiresIn: z.string()
  }),
  
  log: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    format: z.enum(['json', 'pretty'])
  })
});

export function validateConfig(config) {
  return configSchema.parse(config);
}
```

### 2. 启动时配置验证

```javascript
import config from './config';
import { validateConfig } from './config/schema';

try {
  validateConfig(config);
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Invalid configuration:', error.errors);
  process.exit(1);
}
```

## 六、配置热更新

### 1. 配置监听

```javascript
import fs from 'fs';
import yaml from 'js-yaml';

class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.loadConfig();
    this.watchConfig();
  }
  
  loadConfig() {
    const fileContents = fs.readFileSync(this.configPath, 'utf8');
    return yaml.load(fileContents);
  }
  
  watchConfig() {
    fs.watchFile(this.configPath, (curr, prev) => {
      console.log('Config file changed, reloading...');
      try {
        const newConfig = this.loadConfig();
        this.config = newConfig;
        this.emit('config-reloaded', newConfig);
      } catch (error) {
        console.error('Failed to reload config:', error);
      }
    });
  }
  
  get(key) {
    return key.split('.').reduce((obj, k) => obj && obj[k], this.config);
  }
}

export default new ConfigManager('config/production.yml');
```

### 2. Kubernetes ConfigMap热更新

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  namespace: production
data:
  config.yml: |
    app:
      env: production
    log:
      level: info
```

**自动重载配置：**

```bash
kubectl create configmap backend-config \
  --from-file=config.yml=config/production.yml \
  -n production

kubectl rollout restart deployment/backend -n production
```

## 七、配置最佳实践

### 1. 配置分离原则

- ✅ 代码与配置分离
- ✅ 敏感信息不入库
- ✅ 环境特定配置独立
- ✅ 配置变更可追溯

### 2. 安全原则

- ✅ 敏感配置加密存储
- ✅ 使用Secrets管理工具
- ✅ 最小权限原则
- ✅ 定期轮换密钥

### 3. 可维护性原则

- ✅ 配置文档化
- ✅ 配置版本化
- ✅ 配置验证
- ✅ 配置审计

## 八、配置注入方式对比

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 环境变量 | 简单、标准 | 不适合复杂配置 | 容器化部署 |
| 配置文件 | 结构化、可读性好 | 需要文件管理 | 传统部署 |
| ConfigMap | K8s原生、支持热更新 | 依赖K8s | Kubernetes部署 |
| Vault | 安全、动态、审计 | 复杂度高 | 企业级应用 |
| Secrets Manager | 云原生、自动轮换 | 云厂商锁定 | AWS云环境 |

## 九、配置检查清单

### 部署前检查

- [ ] 所有必需配置项已填写
- [ ] 敏感配置已加密
- [ ] 配置验证通过
- [ ] 配置文件权限正确
- [ ] 环境变量已设置
- [ ] Secrets已创建
- [ ] ConfigMap已更新

### 安全检查

- [ ] 无硬编码密码
- [ ] JWT密钥强度足够
- [ ] 数据库密码符合策略
- [ ] API密钥已轮换
- [ ] SSL证书有效
- [ ] CORS配置正确

### 性能检查

- [ ] 数据库连接池配置合理
- [ ] Redis连接数配置正确
- [ ] 日志级别适当
- [ ] 限流配置合理
