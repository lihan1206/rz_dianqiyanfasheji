# 监控与日志方案设计文档

## 一、监控架构概述

本系统采用全栈可观测性方案，包含日志采集、指标监控、分布式追踪三大支柱。

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层 (Application)                     │
│         Backend Services  │  Frontend  │  Database          │
└─────────────────────────────────────────────────────────────┘
           ↓                    ↓                ↓
┌─────────────────────────────────────────────────────────────┐
│                    数据采集层 (Collection)                    │
│   Fluentd/Filebeat  │  Prometheus  │  Jaeger Agent          │
└─────────────────────────────────────────────────────────────┘
           ↓                    ↓                ↓
┌─────────────────────────────────────────────────────────────┐
│                    存储层 (Storage)                           │
│   Elasticsearch  │  Prometheus TSDB  │  Jaeger Backend      │
└─────────────────────────────────────────────────────────────┘
           ↓                    ↓                ↓
┌─────────────────────────────────────────────────────────────┐
│                    可视化层 (Visualization)                   │
│        Kibana      │    Grafana      │    Jaeger UI         │
└─────────────────────────────────────────────────────────────┘
```

## 二、日志采集方案（ELK Stack）

### 1. 架构设计

```
应用服务 → Filebeat → Logstash → Elasticsearch → Kibana
                ↓
            Redis (缓冲队列)
```

### 2. 应用日志配置

**日志配置文件：** `backend/src/config/logger.js`

```javascript
import pino from 'pino';
import pinoHttp from 'pino-http';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';

const transport = logFormat === 'pretty' 
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  : undefined;

const logger = pino({
  level: logLevel,
  transport,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'electrical-rnd-backend',
    env: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err
  }
});

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'response_time_ms'
  }
});

export { logger, httpLogger };
```

### 3. 结构化日志格式

**日志输出示例：**

```json
{
  "level": "INFO",
  "time": "2026-04-01T10:30:45.123Z",
  "service": "electrical-rnd-backend",
  "env": "production",
  "version": "1.0.0",
  "traceId": "abc123def456",
  "spanId": "span789",
  "request": {
    "method": "POST",
    "url": "/api/projects",
    "headers": {
      "content-type": "application/json",
      "authorization": "Bearer ***"
    },
    "remoteAddress": "192.168.1.100"
  },
  "response": {
    "statusCode": 201
  },
  "response_time_ms": 145.67,
  "userId": 123,
  "message": "POST /api/projects - 201"
}
```

### 4. Filebeat配置

**文件路径：** `monitoring/filebeat/filebeat.yml`

```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/app/*.log
    json.keys_under_root: true
    json.add_error_key: true
    json.message_key: message
    fields:
      app: electrical-rnd-backend
      env: production
    fields_under_root: true

  - type: container
    enabled: true
    paths:
      - /var/lib/docker/containers/*/*.log
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"
      - decode_json_fields:
          fields: ["message"]
          target: "json"
          overwrite_keys: true

processors:
  - add_host_metadata:
      when.not.contains.tags: forwarded
  - add_cloud_metadata: ~
  - add_docker_metadata: ~
  - add_fields:
      target: ''
      fields:
        service.name: electrical-rnd-backend
        service.version: 1.0.0

output.redis:
  hosts: ["redis:6379"]
  password: "${REDIS_PASSWORD}"
  key: "filebeat"
  db: 0
  timeout: 5

monitoring.enabled: true
monitoring.elasticsearch:
  hosts: ["http://elasticsearch:9200"]

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
  keepfiles: 7
  permissions: 0644
```

### 5. Logstash配置

**文件路径：** `monitoring/logstash/pipeline/logstash.conf`

```ruby
input {
  redis {
    host => "redis"
    port => 6379
    password => "${REDIS_PASSWORD}"
    key => "filebeat"
    data_type => "list"
    codec => json
  }
}

filter {
  if [level] {
    mutate {
      uppercase => [ "level" ]
    }
  }

  grok {
    match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:log_message}" }
  }

  date {
    match => [ "timestamp", "ISO8601" ]
    target => "@timestamp"
  }

  mutate {
    remove_field => [ "timestamp", "host" ]
  }

  if [request][url] {
    grok {
      match => { "[request][url]" => "/api/%{WORD:api_module}/%{GREEDYDATA:api_endpoint}" }
    }
  }

  if [response_time_ms] {
    ruby {
      code => "event.set('response_time_seconds', event.get('response_time_ms') / 1000.0)"
    }
  }
}

output {
  elasticsearch {
    hosts => ["http://elasticsearch:9200"]
    index => "electrical-rnd-%{[env]}-%{+YYYY.MM.dd}"
    user => "${ES_USER}"
    password => "${ES_PASSWORD}"
  }

  if [level] == "ERROR" {
    webhook {
      urls => ["${SLACK_WEBHOOK_URL}"]
      http_method => "post"
      content_type => "application/json"
      format => "json"
      message => {
        text => "Error in %{[service]}"
        attachments => [{
          color => "danger"
          fields => [{
            title => "Error"
            value => "%{message}"
            short => false
          }]
        }]
      }
    }
  }
}
```

### 6. Elasticsearch配置

**文件路径：** `monitoring/elasticsearch/elasticsearch.yml`

```yaml
cluster.name: electrical-rnd-logs
node.name: node-1
network.host: 0.0.0.0
http.port: 9200

discovery.type: single-node

path.data: /usr/share/elasticsearch/data
path.logs: /usr/share/elasticsearch/logs

xpack.security.enabled: true
xpack.security.enrollment.enabled: false

xpack.security.authc:
  anonymous:
    username: anonymous_user
    roles: superuser
    authz_exception: true

indices.query.bool.max_clause_count: 4096

action.destructive_requires_name: true
```

### 7. Kibana配置

**文件路径：** `monitoring/kibana/kibana.yml`

```yaml
server.host: "0.0.0.0"
server.port: 5601

elasticsearch.hosts: ["http://elasticsearch:9200"]
elasticsearch.username: "${ES_USER}"
elasticsearch.password: "${ES_PASSWORD}"

monitoring.ui.container.elasticsearch.enabled: true

xpack.security.enabled: true
xpack.encryptedSavedObjects.encryptionKey: "${ENCRYPTION_KEY}"
xpack.reporting.encryptionKey: "${ENCRYPTION_KEY}"
xpack.security.encryptionKey: "${ENCRYPTION_KEY}"

i18n.locale: "zh-CN"
```

### 8. 日志查询示例

**Kibana查询语法：**

```
level: ERROR AND service: electrical-rnd-backend
response_time_ms: >1000
api_module: projects
@timestamp: [now-1h TO now]
traceId: abc123def456
```

## 三、指标监控方案（Prometheus + Grafana）

### 1. Prometheus配置

**文件路径：** `monitoring/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'electrical-rnd-monitor'

rule_files:
  - /etc/prometheus/rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'backend'
    static_configs:
      - targets:
        - 'backend-1:9090'
        - 'backend-2:9090'
        - 'backend-3:9090'
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        regex: '([^:]+):\d+'
        replacement: '${1}'

  - job_name: 'mysql'
    static_configs:
      - targets: ['mysql-exporter:9104']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']

  - job_name: 'node-exporter'
    static_configs:
      - targets:
        - 'node-exporter-1:9100'
        - 'node-exporter-2:9100'

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
```

### 2. 应用指标暴露

**Prometheus指标配置：** `backend/src/metrics/index.js`

```javascript
import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestsInProgress = new client.Gauge({
  name: 'http_requests_in_progress',
  help: 'Number of HTTP requests in progress',
  labelNames: ['method', 'route']
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

const dbConnectionsActive = new client.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections'
});

const dbConnectionsIdle = new client.Gauge({
  name: 'db_connections_idle',
  help: 'Number of idle database connections'
});

const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_name']
});

const cacheMissesTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_name']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestsInProgress);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbConnectionsActive);
register.registerMetric(dbConnectionsIdle);
register.registerMetric(cacheHitsTotal);
register.registerMetric(cacheMissesTotal);

export {
  register,
  httpRequestDuration,
  httpRequestTotal,
  httpRequestsInProgress,
  dbQueryDuration,
  dbConnectionsActive,
  dbConnectionsIdle,
  cacheHitsTotal,
  cacheMissesTotal
};
```

### 3. 中间件集成

**指标收集中间件：** `backend/src/middleware/metrics.js`

```javascript
import {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestsInProgress
} from '../metrics';

export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  const route = req.route ? req.route.path : req.path;
  
  httpRequestsInProgress.inc({ method: req.method, route });
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode
      },
      duration
    );
    
    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });
    
    httpRequestsInProgress.dec({ method: req.method, route });
  });
  
  next();
}
```

### 4. 关键监控指标

#### 4.1 API性能指标

| 指标名称 | 说明 | 告警阈值 |
|---------|------|---------|
| http_request_duration_seconds | API响应时间 | P99 > 2s |
| http_requests_total | 请求总数 | - |
| http_requests_in_progress | 并发请求数 | > 1000 |
| http_request_error_rate | 错误率 | > 5% |

#### 4.2 数据库指标

| 指标名称 | 说明 | 告警阈值 |
|---------|------|---------|
| db_query_duration_seconds | 查询耗时 | P99 > 1s |
| db_connections_active | 活跃连接数 | > 80% pool |
| db_connections_idle | 空闲连接数 | < 5 |
| mysql_slow_queries | 慢查询数 | > 10/min |

#### 4.3 缓存指标

| 指标名称 | 说明 | 告警阈值 |
|---------|------|---------|
| cache_hit_rate | 缓存命中率 | < 80% |
| cache_latency_seconds | 缓存延迟 | > 10ms |
| redis_memory_usage_bytes | 内存使用 | > 80% |

#### 4.4 系统指标

| 指标名称 | 说明 | 告警阈值 |
|---------|------|---------|
| node_cpu_usage | CPU使用率 | > 80% |
| node_memory_usage | 内存使用率 | > 85% |
| node_disk_usage | 磁盘使用率 | > 85% |
| node_network_io | 网络IO | 异常峰值 |

### 5. 告警规则配置

**文件路径：** `monitoring/prometheus/rules/alerts.yml`

```yaml
groups:
  - name: api_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status_code=~"5.."}[5m])) 
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "高错误率告警"
          description: "API错误率超过5%，当前值: {{ $value | humanizePercentage }}"

      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.99, 
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API响应时间过长"
          description: "P99响应时间超过2秒，当前值: {{ $value | humanizeDuration }}"

      - alert: TooManyRequests
        expr: sum(http_requests_in_progress) > 1000
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "并发请求过多"
          description: "当前并发请求数: {{ $value }}"

  - name: database_alerts
    interval: 30s
    rules:
      - alert: HighDatabaseConnections
        expr: db_connections_active / db_connections_max > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "数据库连接数过高"
          description: "数据库连接使用率超过80%，当前值: {{ $value | humanizePercentage }}"

      - alert: SlowDatabaseQueries
        expr: |
          sum(rate(db_query_duration_seconds_bucket{le="1"}[5m])) 
          / sum(rate(db_query_duration_seconds_count[5m])) < 0.95
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "慢查询过多"
          description: "超过5%的查询耗时超过1秒"

      - alert: MySQLDown
        expr: mysql_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MySQL服务不可用"
          description: "MySQL实例 {{ $labels.instance }} 无法连接"

  - name: system_alerts
    interval: 30s
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU使用率过高"
          description: "实例 {{ $labels.instance }} CPU使用率超过80%，当前值: {{ $value | humanize }}%"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "内存使用率过高"
          description: "内存使用率超过85%，当前值: {{ $value | humanize }}%"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"}) * 100 < 15
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "磁盘空间不足"
          description: "磁盘 {{ $labels.mountpoint }} 剩余空间不足15%，当前值: {{ $value | humanize }}%"

  - name: cache_alerts
    interval: 30s
    rules:
      - alert: LowCacheHitRate
        expr: |
          sum(rate(cache_hits_total[5m])) 
          / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m]))) < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "缓存命中率过低"
          description: "缓存命中率低于80%，当前值: {{ $value | humanizePercentage }}"

      - alert: RedisDown
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis服务不可用"
          description: "Redis实例 {{ $labels.instance }} 无法连接"
```

### 6. Grafana Dashboard配置

**文件路径：** `monitoring/grafana/provisioning/dashboards/backend.json`

```json
{
  "dashboard": {
    "title": "Electrical R&D Backend Dashboard",
    "tags": ["backend", "api"],
    "timezone": "browser",
    "panels": [
      {
        "title": "请求速率",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (method)",
            "legendFormat": "{{method}}"
          }
        ],
        "yaxes": [
          { "format": "reqps" }
        ]
      },
      {
        "title": "响应时间分布",
        "type": "heatmap",
        "targets": [
          {
            "expr": "sum(rate(http_request_duration_seconds_bucket[5m])) by (le)",
            "format": "heatmap",
            "legendFormat": "{{le}}"
          }
        ]
      },
      {
        "title": "错误率",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))",
            "format": "percentunit"
          }
        ],
        "thresholds": "0.01,0.05"
      },
      {
        "title": "数据库连接数",
        "type": "graph",
        "targets": [
          {
            "expr": "db_connections_active",
            "legendFormat": "Active"
          },
          {
            "expr": "db_connections_idle",
            "legendFormat": "Idle"
          }
        ]
      },
      {
        "title": "缓存命中率",
        "type": "gauge",
        "targets": [
          {
            "expr": "sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))",
            "format": "percentunit"
          }
        ],
        "thresholds": "0.7,0.9"
      }
    ]
  }
}
```

## 四、分布式追踪方案

### 1. Jaeger配置

**文件路径：** `monitoring/jaeger/jaeger-config.yml`

```yaml
service:
  name: jaeger

collector:
  zipkin:
    http:
      hostPort: :9411

storage:
  type: elasticsearch
  elasticsearch:
    serverUrls: http://elasticsearch:9200
    username: "${ES_USER}"
    password: "${ES_PASSWORD}"
    indexPrefix: jaeger

sampling:
  type: probabilistic
  param: 0.1
```

### 2. 应用集成

**追踪中间件：** `backend/src/middleware/tracing.js`

```javascript
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { MySQLInstrumentation } from '@opentelemetry/instrumentation-mysql';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const provider = new NodeTracerProvider();

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
  serviceName: 'electrical-rnd-backend'
});

provider.addSpanProcessor(new SimpleSpanProcessor(jaegerExporter));
provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new MySQLInstrumentation()
  ]
});

const tracer = trace.getTracer('electrical-rnd-backend', '1.0.0');

export function tracingMiddleware(req, res, next) {
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.host': req.headers.host,
      'http.scheme': req.protocol,
      'http.user_agent': req.headers['user-agent']
    }
  });

  req.span = span;

  res.on('finish', () => {
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.status_text': res.statusMessage
    });
    span.end();
  });

  next();
}

export { tracer };
```

### 3. 追踪数据示例

```json
{
  "traceId": "abc123def456ghi789",
  "spanId": "span001",
  "parentSpanId": "",
  "operationName": "POST /api/projects",
  "startTime": "2026-04-01T10:30:45.123Z",
  "duration": 145.67,
  "tags": {
    "http.method": "POST",
    "http.url": "/api/projects",
    "http.status_code": 201,
    "user.id": 123
  },
  "logs": [
    {
      "timestamp": "2026-04-01T10:30:45.125Z",
      "fields": {
        "event": "database_query_start",
        "query": "INSERT INTO projects..."
      }
    },
    {
      "timestamp": "2026-04-01T10:30:45.200Z",
      "fields": {
        "event": "database_query_end",
        "duration": 75
      }
    }
  ]
}
```

## 五、告警通知配置

### 1. Alertmanager配置

**文件路径：** `monitoring/alertmanager/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@example.com'
  smtp_auth_username: 'alerts@example.com'
  smtp_auth_password: '${SMTP_PASSWORD}'

  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-email'
  routes:
    - match:
        severity: critical
      receiver: 'team-pagerduty'
      continue: true
    - match:
        severity: warning
      receiver: 'team-slack'

receivers:
  - name: 'team-email'
    email_configs:
      - to: 'team@example.com'
        send_resolved: true
        html: |
          <h2>{{ .Status | toUpper }} - {{ .CommonLabels.alertname }}</h2>
          {{ range .Alerts }}
          <p><strong>描述:</strong> {{ .Annotations.description }}</p>
          <p><strong>详情:</strong> {{ .Annotations.summary }}</p>
          <p><strong>开始时间:</strong> {{ .StartsAt }}</p>
          {{ end }}

  - name: 'team-slack'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: '{{ .Status | toUpper }} - {{ .CommonLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'

  - name: 'team-pagerduty'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        severity: critical
        description: '{{ .CommonLabels.alertname }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

## 六、监控最佳实践

### 1. 日志规范

- ✅ 使用结构化日志（JSON格式）
- ✅ 包含traceId便于追踪
- ✅ 记录关键业务事件
- ✅ 敏感信息脱敏处理
- ✅ 合理设置日志级别

### 2. 指标规范

- ✅ 使用标准命名规范
- ✅ 添加必要的标签
- ✅ 设置合理的告警阈值
- ✅ 定期审查指标有效性

### 3. 追踪规范

- ✅ 关键路径添加追踪
- ✅ 记录足够的上下文信息
- ✅ 合理设置采样率
- ✅ 跨服务传递traceId

## 七、监控检查清单

### 部署前检查

- [ ] 日志采集正常
- [ ] 指标暴露正常
- [ ] 追踪集成正常
- [ ] 告警规则配置
- [ ] Dashboard创建

### 运维检查

- [ ] 日志存储空间充足
- [ ] 指标数据完整
- [ ] 告警通知正常
- [ ] Dashboard数据准确
- [ ] 追踪链路完整
