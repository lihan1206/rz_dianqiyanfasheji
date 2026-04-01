# 系统工程设计文档摘要

本系统采用**微服务架构**，包含项目管理、BOM管理、元器件库三大核心服务，服务间通过REST/gRPC通信。CI/CD流程基于Git Flow分支策略，集成自动化测试、镜像构建和Kubernetes滚动部署。数据库版本控制使用Liquibase管理多环境迁移。配置管理支持多环境隔离，通过Vault实现密钥加密。监控体系采用ELK日志采集与Prometheus+Grafana指标监控，覆盖API响应时间、数据库连接数等关键指标。部署方案基于Docker Compose，集成MySQL主从、Flask多实例和Nginx反向代理，支持基于Cookie/Header的灰度发布能力。

## 文件清单

| 模块 | 文件路径 | 说明 |
|-----|---------|-----|
| 系统架构 | `docs/system-architecture.md` | 微服务架构图和通信方式 |
| CI/CD | `ci-cd/Jenkinsfile` | Jenkins Pipeline配置 |
| CI/CD | `.github/workflows/ci-cd.yml` | GitHub Actions配置 |
| 数据库 | `db/changelog/db.changelog-master.xml` | Liquibase主配置 |
| 数据库 | `db/changelog/changesets/*.xml` | 数据库变更集 |
| 配置管理 | `config/application*.yml` | 多环境配置文件 |
| 监控 | `monitoring/prometheus/prometheus.yml` | Prometheus配置 |
| 监控 | `monitoring/filebeat/filebeat.yml` | Filebeat日志收集配置 |
| 部署 | `deploy/docker-compose.prod.yml` | 生产环境部署配置 |
| 部署 | `deploy/nginx/nginx.conf` | Nginx灰度发布配置 |
| 部署 | `deploy/scripts/canary-deploy.sh` | 灰度发布脚本 |
