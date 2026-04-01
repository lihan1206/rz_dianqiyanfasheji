# 微服务架构设计文档

## 一、架构概述

本系统采用微服务架构，将电气研发设计系统拆分为多个独立的服务单元，每个服务专注于特定的业务领域，通过标准化接口进行通信。

## 二、核心服务架构图（文字描述）

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端层 (Client Layer)                   │
│                    Web Browser / Mobile App                      │
└─────────────────────────────────────────────────────────────────┘
                                ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      网关层 (API Gateway)                         │
│                    Nginx / Kong API Gateway                      │
│         - 负载均衡  - SSL终止  - 限流  - 认证转发                 │
└─────────────────────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────┼───────────────────────┐
        ↓                       ↓                       ↓
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ 项目管理服务  │      │  BOM管理服务  │      │ 元器件库服务  │
│   Project    │      │     BOM      │      │  Component   │
│   Service    │      │   Service    │      │   Service    │
│              │      │              │      │              │
│ Port: 8217   │      │ Port: 8218   │      │ Port: 8219   │
│ REST API     │      │ REST API     │      │ REST API     │
└──────────────┘      └──────────────┘      └──────────────┘
        ↓                       ↓                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                      数据访问层 (Data Access Layer)               │
│                         Prisma ORM                               │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      数据存储层 (Data Storage Layer)              │
│     MySQL 8.0 (主数据库)  │  Redis (缓存)  │  MinIO (文件存储)   │
└─────────────────────────────────────────────────────────────────┘
```

## 三、核心服务详细说明

### 1. 项目管理服务

**职责范围：**
- 项目创建、编辑、删除、查询
- 项目状态管理（立项、进行中、已完成、已归档）
- 项目成员管理与权限分配
- 项目进度跟踪与里程碑管理
- 项目文档与图纸关联管理

**技术栈：**
- 框架：Express.js + Node.js 20
- 数据库：MySQL 8.0
- ORM：Prisma
- 端口：8217

**核心API端点：**
```
GET    /api/projects          # 获取项目列表
POST   /api/projects          # 创建新项目
GET    /api/projects/:id      # 获取项目详情
PUT    /api/projects/:id      # 更新项目信息
DELETE /api/projects/:id      # 删除项目
POST   /api/projects/:id/members  # 添加项目成员
```

### 2. BOM管理服务

**职责范围：**
- BOM清单创建与版本管理
- BOM结构树管理（多级BOM）
- BOM元器件用量统计
- BOM成本核算
- BOM导入导出（Excel/CSV）
- BOM变更历史追溯

**技术栈：**
- 框架：Express.js + Node.js 20
- 数据库：MySQL 8.0
- ORM：Prisma
- 端口：8218

**核心API端点：**
```
GET    /api/boms              # 获取BOM列表
POST   /api/boms              # 创建BOM
GET    /api/boms/:id          # 获取BOM详情
PUT    /api/boms/:id          # 更新BOM
POST   /api/boms/:id/version  # 创建BOM新版本
GET    /api/boms/:id/export   # 导出BOM
POST   /api/boms/import       # 导入BOM
```

### 3. 元器件库服务

**职责范围：**
- 元器件信息管理（参数、规格、封装）
- 元器件分类与标签管理
- 元器件供应商管理
- 元器件库存管理
- 元器件生命周期状态管理
- 元器件替代料管理

**技术栈：**
- 框架：Express.js + Node.js 20
- 数据库：MySQL 8.0
- ORM：Prisma
- 端口：8219

**核心API端点：**
```
GET    /api/components        # 获取元器件列表
POST   /api/components        # 创建元器件
GET    /api/components/:id    # 获取元器件详情
PUT    /api/components/:id    # 更新元器件
GET    /api/components/search # 元器件搜索
GET    /api/components/:id/alternates # 获取替代料
```

### 4. 辅助服务

**认证服务**
- 用户登录/注册
- JWT Token管理
- 权限验证
- 集成在各服务的中间件中

**图纸管理服务**
- 图纸上传与存储
- 图纸版本管理
- 图纸预览
- 图纸审批流程

**评审服务**
- 设计评审流程管理
- 评审意见记录
- 评审结果统计

## 四、服务间通信方式

### 1. 同步通信 - REST API

**适用场景：**
- 需要即时响应的请求
- 数据查询操作
- 简单的数据更新操作

**通信规范：**
```
协议：HTTP/1.1 或 HTTP/2
数据格式：JSON
认证方式：JWT Bearer Token
超时设置：30秒
重试策略：指数退避，最多3次
```

**服务调用示例：**
```javascript
// BOM服务调用元器件库服务获取元器件信息
const response = await fetch('http://component-service:8219/api/components/C001', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### 2. 异步通信 - 消息队列

**适用场景：**
- 跨服务的数据同步
- 异步任务处理
- 事件通知

**消息队列选型：**
- 开发环境：Redis Streams
- 生产环境：RabbitMQ / Apache Kafka

**事件示例：**
```
事件类型：component.updated
发布者：元器件库服务
订阅者：BOM管理服务、项目管理服务
消息体：
{
  "eventId": "evt_123456",
  "eventType": "component.updated",
  "timestamp": "2026-04-01T10:00:00Z",
  "data": {
    "componentId": "C001",
    "changes": ["price", "stock"]
  }
}
```

### 3. 服务发现与注册

**开发环境：**
- Docker内部DNS解析
- 服务名直接访问

**生产环境：**
- Kubernetes Service
- Consul / Nacos

**服务注册示例：**
```yaml
# Kubernetes Service定义
apiVersion: v1
kind: Service
metadata:
  name: project-service
spec:
  selector:
    app: project-service
  ports:
  - port: 8217
    targetPort: 8217
```

## 五、数据一致性策略

### 1. 分布式事务

**Saga模式：**
- 编排式Saga：由发起服务协调整个事务
- 协同式Saga：各服务通过事件驱动完成事务

**示例场景：创建BOM时扣减库存**
```
1. BOM服务创建BOM记录
2. 发布BOMCreated事件
3. 元器件库服务监听事件，扣减库存
4. 如果扣减失败，发布CompensateBOM事件
5. BOM服务回滚BOM记录
```

### 2. 最终一致性

**适用场景：**
- 跨服务的数据复制
- 统计数据更新
- 搜索索引更新

**实现方式：**
- 事件溯源
- CDC (Change Data Capture)

## 六、服务容错设计

### 1. 熔断器

**配置参数：**
```
失败阈值：50%
熔断时间窗口：60秒
半开状态请求数：5
```

**实现示例：**
```javascript
const circuitBreaker = new CircuitBreaker(serviceCall, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 60000
});
```

### 2. 降级策略

**降级规则：**
- 元器件库不可用：返回缓存数据或默认值
- BOM服务不可用：允许查看但禁止编辑
- 项目管理不可用：返回维护页面

### 3. 重试机制

**重试策略：**
```
初始延迟：100ms
最大延迟：10s
最大重试次数：3
重试因子：2（指数退避）
```

## 七、安全设计

### 1. 服务间认证

**方案：**
- 服务间通信使用双向TLS (mTLS)
- API调用使用JWT Token
- 内部服务使用Service Account

### 2. 数据加密

**传输加密：**
- 所有通信使用HTTPS/TLS 1.3
- 数据库连接使用SSL

**存储加密：**
- 敏感数据使用AES-256加密
- 密钥存储在Vault或KMS

### 3. 访问控制

**RBAC模型：**
```
角色：管理员、项目经理、工程师、查看者
权限：基于资源的细粒度权限控制
策略：ABAC（基于属性的访问控制）
```

## 八、性能优化

### 1. 缓存策略

**多级缓存：**
```
L1: 本地内存缓存 (Node-cache)
L2: 分布式缓存
L3: 数据库查询缓存
```

**缓存规则：**
- 元器件信息：TTL 1小时
- 项目列表：TTL 5分钟
- 用户权限：TTL 30分钟

### 2. 数据库优化

**读写分离：**
- 写操作：主库
- 读操作：从库

**分库分表：**
- 按项目ID分库
- 历史数据归档

### 3. API性能

**优化措施：**
- 响应压缩
- 分页查询
- 字段筛选
- 批量操作接口

## 九、部署架构

### 1. 容器化部署

**Docker镜像：**
- 基础镜像：node:20-alpine
- 镜像大小优化：多阶段构建
- 安全扫描：Trivy

### 2. Kubernetes部署

**资源限制：**
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

**自动扩缩容：**
```yaml
autoscaling:
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

### 3. 服务网格

**Istio配置：**
- 流量管理
- 熔断与重试
- 金丝雀发布
- 可观测性

## 十、技术选型总结

| 组件 | 技术选型 | 说明 |
|------|---------|------|
| 运行时 | Node.js 20 | LTS版本，性能优秀 |
| Web框架 | Express.js | 成熟稳定，生态丰富 |
| ORM | Prisma | 类型安全，迁移管理 |
| 数据库 | MySQL 8.0 | 事务支持，成熟稳定 |
| 缓存 | Redis | 高性能，支持多种数据结构 |
| 消息队列 | RabbitMQ | 可靠性高，支持多种协议 |
| 容器 | Docker | 标准化部署 |
| 编排 | Kubernetes | 自动化运维 |
| 服务网格 | Istio | 流量管理，可观测性 |
| API网关 | Kong/Nginx | 统一入口，安全防护 |
