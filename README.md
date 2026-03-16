# 电气研发设计管理系统

## 🛠 技术栈
- Frontend: React + Vite + Ant Design
- Backend: Node.js + Express + Prisma
- Database: MySQL 8.0

## 🚀 启动指南 (How to Run)
1. 确保 Docker Desktop 已启动。
2. 在项目根目录执行：`docker compose up --build`
3. 等待容器初始化完成后访问系统。

## 🔗 服务地址 (Services)
- Frontend: http://localhost:31267
- Backend API: http://localhost:18267/api
- Backend Health: http://localhost:18267/api/health
- Database: localhost:33367 (user: root / pass: root)

## 🧪 测试账号
- 管理员: `admin / 123456`
- 项目经理: `manager / 123456`
- 工程师: `engineer / 123456`
- 审核员: `reviewer / 123456`

## 📦 已实现模块
- 用户与权限管理（JWT + RBAC）
- 项目管理（状态、负责人、成员）
- 设计图纸与文档管理（真实文件上传 + 项目关联）
- BOM 管理（条目维护 + 图纸关联）
- 元器件库管理（分类、规格、价格等）
- 设计协同审批流程（发起审批、通过/驳回）

## ⚙️ 说明
- 所有业务数据均来自 MySQL，未使用 Mock 数据。
- 所有前端文案均为中文。
- 删除操作均使用 UI 二次确认提示。

## 📦 轻量打包
- 本项目打包不执行自动化测试。
- 执行：`./scripts/package_release.sh`
- 打包文件输出至 `release/` 目录。
- 打包时自动剔除：`node_modules`、`venv/.venv`、`target`、`.git`、`*.py`、测试目录与测试脚本等无关文件。
