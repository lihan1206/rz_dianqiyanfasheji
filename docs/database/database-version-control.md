# 数据库版本控制设计文档

## 一、版本控制工具选型

本项目使用 **Prisma Migrate** 作为数据库版本控制工具，同时提供 **Flyway** 和 **Liquibase** 的配置示例。

### 工具对比

| 特性 | Prisma Migrate | Flyway | Liquibase |
|------|---------------|--------|-----------|
| 语言支持 | Node.js | Java | Java |
| 迁移格式 | Prisma Schema | SQL/Java | XML/YAML/JSON/SQL |
| 学习曲线 | 低 | 中 | 高 |
| 回滚支持 | 有限 | 付费版 | 支持 |
| 多环境支持 | 优秀 | 优秀 | 优秀 |
| 团队协作 | 优秀 | 优秀 | 优秀 |

## 二、Prisma Migrate 配置

### 1. Prisma Schema文件

**文件路径：** `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int       @id @default(autoincrement())
  username  String    @unique @db.VarChar(50)
  password  String    @db.VarChar(255)
  realName  String?   @map("real_name") @db.VarChar(50)
  email     String?   @db.VarChar(100)
  phone     String?   @db.VarChar(20)
  role      String    @default("engineer") @db.VarChar(20)
  status    Int       @default(1)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  
  projects  Project[]
  boms      Bom[]
  reviews   Review[]
  
  @@map("users")
}

model Project {
  id          Int       @id @default(autoincrement())
  projectCode String    @unique @map("project_code") @db.VarChar(50)
  name        String    @db.VarChar(200)
  description String?   @db.Text
  status      String    @default("draft") @db.VarChar(20)
  startDate   DateTime? @map("start_date")
  endDate     DateTime? @map("end_date")
  managerId   Int       @map("manager_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  manager     User      @relation(fields: [managerId], references: [id])
  boms        Bom[]
  drawings    Drawing[]
  reviews     Review[]
  
  @@index([managerId])
  @@index([status])
  @@map("projects")
}

model Component {
  id              Int       @id @default(autoincrement())
  componentCode   String    @unique @map("component_code") @db.VarChar(100)
  name            String    @db.VarChar(200)
  category        String    @db.VarChar(50)
  brand           String?   @db.VarChar(100)
  model           String?   @db.VarChar(100)
  package         String?   @db.VarChar(50)
  specification   String?   @db.Text
  parameters      Json?
  price           Decimal?  @db.Decimal(10, 2)
  stock           Int       @default(0)
  minStock        Int       @default(0) @map("min_stock")
  lifecycleStatus String?   @map("lifecycle_status") @db.VarChar(20)
  supplier        String?   @db.VarChar(200)
  datasheet       String?   @db.VarChar(500)
  image           String?   @db.VarChar(500)
  status          Int       @default(1)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  
  bomItems        BomItem[]
  
  @@index([category])
  @@index([brand])
  @@index([lifecycleStatus])
  @@map("components")
}

model Bom {
  id          Int       @id @default(autoincrement())
  bomCode     String    @unique @map("bom_code") @db.VarChar(50)
  projectId   Int       @map("project_id")
  version     String    @default("1.0") @db.VarChar(20)
  name        String    @db.VarChar(200)
  description String?   @db.Text
  status      String    @default("draft") @db.VarChar(20)
  creatorId   Int       @map("creator_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  project     Project   @relation(fields: [projectId], references: [id])
  creator     User      @relation(fields: [creatorId], references: [id])
  items       BomItem[]
  
  @@index([projectId])
  @@index([status])
  @@map("boms")
}

model BomItem {
  id           Int      @id @default(autoincrement())
  bomId        Int      @map("bom_id")
  componentId  Int      @map("component_id")
  quantity     Int
  reference    String?  @db.VarChar(200)
  remark       String?  @db.VarChar(500)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  
  bom          Bom      @relation(fields: [bomId], references: [id], onDelete: Cascade)
  component    Component @relation(fields: [componentId], references: [id])
  
  @@unique([bomId, componentId])
  @@index([bomId])
  @@index([componentId])
  @@map("bom_items")
}

model Drawing {
  id          Int       @id @default(autoincrement())
  projectId   Int       @map("project_id")
  name        String    @db.VarChar(200)
  version     String    @default("1.0") @db.VarChar(20)
  filePath    String    @map("file_path") @db.VarChar(500)
  fileSize    Int       @map("file_size")
  fileType    String    @map("file_type") @db.VarChar(50)
  uploaderId  Int       @map("uploader_id")
  status      String    @default("pending") @db.VarChar(20)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  project     Project   @relation(fields: [projectId], references: [id])
  
  @@index([projectId])
  @@index([status])
  @@map("drawings")
}

model Review {
  id          Int       @id @default(autoincrement())
  projectId   Int       @map("project_id")
  type        String    @db.VarChar(50)
  reviewerId  Int       @map("reviewer_id")
  status      String    @default("pending") @db.VarChar(20)
  comment     String?   @db.Text
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  
  project     Project   @relation(fields: [projectId], references: [id])
  reviewer    User      @relation(fields: [reviewerId], references: [id])
  
  @@index([projectId])
  @@index([reviewerId])
  @@index([status])
  @@map("reviews")
}

model MigrationHistory {
  id          Int      @id @default(autoincrement())
  version     String   @unique @db.VarChar(100)
  name        String   @db.VarChar(200)
  description String?  @db.Text
  executedAt  DateTime @default(now()) @map("executed_at")
  executionTime Int    @map("execution_time")
  checksum    String?  @db.VarChar(64)
  
  @@map("migration_history")
}
```

### 2. 迁移脚本示例

**创建初始迁移：**

```bash
npx prisma migrate dev --name init
```

**生成的迁移文件：** `backend/prisma/migrations/20260401100000_init/migration.sql`

```sql
-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `real_name` VARCHAR(50) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'engineer',
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    
    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `manager_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    
    UNIQUE INDEX `projects_project_code_key`(`project_code`),
    INDEX `projects_manager_id_idx`(`manager_id`),
    INDEX `projects_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
```

### 3. 增量迁移示例

**添加新字段：**

```bash
npx prisma migrate dev --name add_user_avatar
```

**迁移文件：** `backend/prisma/migrations/20260401110000_add_user_avatar/migration.sql`

```sql
-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatar` VARCHAR(500) NULL;
ALTER TABLE `users` ADD COLUMN `department` VARCHAR(100) NULL;

-- CreateIndex
CREATE INDEX `users_department_idx` ON `users`(`department`);
```

### 4. 数据迁移脚本

**文件路径：** `backend/prisma/migrations/20260401120000_migrate_user_roles/migration.sql`

```sql
-- 数据迁移：更新用户角色
UPDATE `users` SET `role` = 'admin' WHERE `username` IN ('admin', 'root');

-- 数据迁移：创建默认管理员
INSERT INTO `users` (`username`, `password`, `real_name`, `role`, `status`)
VALUES ('admin', '$2a$10$encrypted_password_here', '系统管理员', 'admin', 1)
ON DUPLICATE KEY UPDATE `role` = 'admin';

-- 数据迁移：更新项目状态
UPDATE `projects` SET `status` = 'archived' 
WHERE `end_date` < DATE_SUB(NOW(), INTERVAL 1 YEAR) AND `status` = 'completed';
```

## 三、Flyway配置（备选方案）

### 1. Flyway配置文件

**文件路径：** `backend/flyway.conf`

```properties
flyway.url=jdbc:mysql://localhost:3306/electrical_rnd?useSSL=false&serverTimezone=Asia/Shanghai
flyway.user=root
flyway.password=root
flyway.driver=com.mysql.cj.jdbc.Driver
flyway.locations=classpath:db/migration
flyway.table=schema_history
flyway.baselineOnMigrate=true
flyway.baselineVersion=0
flyway.encoding=UTF-8
flyway.validateOnMigrate=true
flyway.outOfOrder=false
```

### 2. Flyway迁移脚本命名规范

```
V{版本号}__{描述}.sql

示例：
V1.0.0__init_database.sql
V1.0.1__add_user_table.sql
V1.1.0__add_project_module.sql
V1.1.1__add_bom_management.sql
V2.0.0__major_refactor.sql
```

### 3. Flyway迁移脚本示例

**文件路径：** `backend/src/main/resources/db/migration/V1.0.0__init_database.sql`

```sql
-- ============================================
-- 版本: V1.0.0
-- 描述: 初始化数据库结构
-- 作者: System
-- 日期: 2026-04-01
-- ============================================

-- 创建用户表
CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名',
    `password` VARCHAR(255) NOT NULL COMMENT '密码',
    `real_name` VARCHAR(50) NULL COMMENT '真实姓名',
    `email` VARCHAR(100) NULL COMMENT '邮箱',
    `phone` VARCHAR(20) NULL COMMENT '手机号',
    `role` VARCHAR(20) NOT NULL DEFAULT 'engineer' COMMENT '角色',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用，0-禁用',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 创建项目表
CREATE TABLE IF NOT EXISTS `projects` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '项目ID',
    `project_code` VARCHAR(50) NOT NULL COMMENT '项目编号',
    `name` VARCHAR(200) NOT NULL COMMENT '项目名称',
    `description` TEXT NULL COMMENT '项目描述',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态',
    `start_date` DATE NULL COMMENT '开始日期',
    `end_date` DATE NULL COMMENT '结束日期',
    `manager_id` BIGINT NOT NULL COMMENT '项目经理ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_project_code` (`project_code`),
    KEY `idx_manager_id` (`manager_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_project_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目表';
```

**文件路径：** `backend/src/main/resources/db/migration/V1.0.1__add_user_avatar.sql`

```sql
-- ============================================
-- 版本: V1.0.1
-- 描述: 添加用户头像和部门字段
-- 作者: System
-- 日期: 2026-04-02
-- ============================================

-- 添加头像字段
ALTER TABLE `users` 
ADD COLUMN `avatar` VARCHAR(500) NULL COMMENT '头像URL' AFTER `phone`,
ADD COLUMN `department` VARCHAR(100) NULL COMMENT '部门' AFTER `avatar`;

-- 添加索引
CREATE INDEX `idx_department` ON `users` (`department`);

-- 更新历史数据
UPDATE `users` SET `department` = '研发部' WHERE `role` = 'engineer' AND `department` IS NULL;
```

**文件路径：** `backend/src/main/resources/db/migration/V1.1.0__add_bom_management.sql`

```sql
-- ============================================
-- 版本: V1.1.0
-- 描述: 添加BOM管理模块
-- 作者: System
-- 日期: 2026-04-05
-- ============================================

-- 创建元器件表
CREATE TABLE IF NOT EXISTS `components` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '元器件ID',
    `component_code` VARCHAR(100) NOT NULL COMMENT '元器件编号',
    `name` VARCHAR(200) NOT NULL COMMENT '元器件名称',
    `category` VARCHAR(50) NOT NULL COMMENT '分类',
    `brand` VARCHAR(100) NULL COMMENT '品牌',
    `model` VARCHAR(100) NULL COMMENT '型号',
    `package` VARCHAR(50) NULL COMMENT '封装',
    `specification` TEXT NULL COMMENT '规格说明',
    `parameters` JSON NULL COMMENT '参数JSON',
    `price` DECIMAL(10,2) NULL COMMENT '单价',
    `stock` INT NOT NULL DEFAULT 0 COMMENT '库存',
    `min_stock` INT NOT NULL DEFAULT 0 COMMENT '最小库存',
    `lifecycle_status` VARCHAR(20) NULL COMMENT '生命周期状态',
    `supplier` VARCHAR(200) NULL COMMENT '供应商',
    `datasheet` VARCHAR(500) NULL COMMENT '数据手册URL',
    `image` VARCHAR(500) NULL COMMENT '图片URL',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_component_code` (`component_code`),
    KEY `idx_category` (`category`),
    KEY `idx_brand` (`brand`),
    KEY `idx_lifecycle_status` (`lifecycle_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='元器件表';

-- 创建BOM表
CREATE TABLE IF NOT EXISTS `boms` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'BOM ID',
    `bom_code` VARCHAR(50) NOT NULL COMMENT 'BOM编号',
    `project_id` BIGINT NOT NULL COMMENT '项目ID',
    `version` VARCHAR(20) NOT NULL DEFAULT '1.0' COMMENT '版本',
    `name` VARCHAR(200) NOT NULL COMMENT 'BOM名称',
    `description` TEXT NULL COMMENT '描述',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态',
    `creator_id` BIGINT NOT NULL COMMENT '创建人ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bom_code` (`bom_code`),
    KEY `idx_project_id` (`project_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_bom_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_bom_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='BOM表';

-- 创建BOM明细表
CREATE TABLE IF NOT EXISTS `bom_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '明细ID',
    `bom_id` BIGINT NOT NULL COMMENT 'BOM ID',
    `component_id` BIGINT NOT NULL COMMENT '元器件ID',
    `quantity` INT NOT NULL COMMENT '数量',
    `reference` VARCHAR(200) NULL COMMENT '位号',
    `remark` VARCHAR(500) NULL COMMENT '备注',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bom_component` (`bom_id`, `component_id`),
    KEY `idx_bom_id` (`bom_id`),
    KEY `idx_component_id` (`component_id`),
    CONSTRAINT `fk_bom_item_bom` FOREIGN KEY (`bom_id`) REFERENCES `boms` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_bom_item_component` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='BOM明细表';
```

## 四、Liquibase配置（备选方案）

### 1. Liquibase配置文件

**文件路径：** `backend/liquibase.properties`

```properties
changeLogFile=src/main/resources/db/changelog/db.changelog-master.yaml
url=jdbc:mysql://localhost:3306/electrical_rnd?useSSL=false&serverTimezone=Asia/Shanghai
username=root
password=root
driver=com.mysql.cj.jdbc.Driver
databaseChangeLogTableName=databasechangelog
databaseChangeLogLockTableName=databasechangeloglock
```

### 2. Liquibase主配置文件

**文件路径：** `backend/src/main/resources/db/changelog/db.changelog-master.yaml`

```yaml
databaseChangeLog:
  - include:
      file: db/changelog/changes/001-init-database.yaml
      relativeToChangelogFile: false
  - include:
      file: db/changelog/changes/002-add-user-fields.yaml
      relativeToChangelogFile: false
  - include:
      file: db/changelog/changes/003-add-bom-management.yaml
      relativeToChangelogFile: false
```

### 3. Liquibase变更集示例

**文件路径：** `backend/src/main/resources/db/changelog/changes/001-init-database.yaml`

```yaml
databaseChangeLog:
  - changeSet:
      id: 001-create-users-table
      author: system
      comment: 创建用户表
      changes:
        - createTable:
            tableName: users
            remarks: 用户表
            columns:
              - column:
                  name: id
                  type: BIGINT
                  autoIncrement: true
                  constraints:
                    primaryKey: true
                    nullable: false
              - column:
                  name: username
                  type: VARCHAR(50)
                  remarks: 用户名
                  constraints:
                    nullable: false
                    unique: true
              - column:
                  name: password
                  type: VARCHAR(255)
                  remarks: 密码
                  constraints:
                    nullable: false
              - column:
                  name: real_name
                  type: VARCHAR(50)
                  remarks: 真实姓名
              - column:
                  name: email
                  type: VARCHAR(100)
                  remarks: 邮箱
              - column:
                  name: phone
                  type: VARCHAR(20)
                  remarks: 手机号
              - column:
                  name: role
                  type: VARCHAR(20)
                  remarks: 角色
                  defaultValue: engineer
                  constraints:
                    nullable: false
              - column:
                  name: status
                  type: TINYINT
                  remarks: 状态
                  defaultValueNumeric: 1
                  constraints:
                    nullable: false
              - column:
                  name: created_at
                  type: DATETIME
                  remarks: 创建时间
                  defaultValueComputed: CURRENT_TIMESTAMP
                  constraints:
                    nullable: false
              - column:
                  name: updated_at
                  type: DATETIME
                  remarks: 更新时间
                  defaultValueComputed: CURRENT_TIMESTAMP
                  constraints:
                    nullable: false
        - createIndex:
            indexName: idx_status
            tableName: users
            columns:
              - column:
                  name: status

  - changeSet:
      id: 002-create-projects-table
      author: system
      comment: 创建项目表
      changes:
        - createTable:
            tableName: projects
            remarks: 项目表
            columns:
              - column:
                  name: id
                  type: BIGINT
                  autoIncrement: true
                  constraints:
                    primaryKey: true
                    nullable: false
              - column:
                  name: project_code
                  type: VARCHAR(50)
                  remarks: 项目编号
                  constraints:
                    nullable: false
                    unique: true
              - column:
                  name: name
                  type: VARCHAR(200)
                  remarks: 项目名称
                  constraints:
                    nullable: false
              - column:
                  name: description
                  type: TEXT
                  remarks: 项目描述
              - column:
                  name: status
                  type: VARCHAR(20)
                  remarks: 状态
                  defaultValue: draft
                  constraints:
                    nullable: false
              - column:
                  name: start_date
                  type: DATE
                  remarks: 开始日期
              - column:
                  name: end_date
                  type: DATE
                  remarks: 结束日期
              - column:
                  name: manager_id
                  type: BIGINT
                  remarks: 项目经理ID
                  constraints:
                    nullable: false
              - column:
                  name: created_at
                  type: DATETIME
                  defaultValueComputed: CURRENT_TIMESTAMP
                  constraints:
                    nullable: false
              - column:
                  name: updated_at
                  type: DATETIME
                  defaultValueComputed: CURRENT_TIMESTAMP
                  constraints:
                    nullable: false
        - createIndex:
            indexName: idx_manager_id
            tableName: projects
            columns:
              - column:
                  name: manager_id
        - createIndex:
            indexName: idx_status
            tableName: projects
            columns:
              - column:
                  name: status
        - addForeignKeyConstraint:
            baseTableName: projects
            baseColumnNames: manager_id
            constraintName: fk_project_manager
            referencedTableName: users
            referencedColumnNames: id
            onDelete: RESTRICT
            onUpdate: CASCADE
```

**文件路径：** `backend/src/main/resources/db/changelog/changes/002-add-user-fields.yaml`

```yaml
databaseChangeLog:
  - changeSet:
      id: 003-add-user-avatar
      author: system
      comment: 添加用户头像和部门字段
      changes:
        - addColumn:
            tableName: users
            columns:
              - column:
                  name: avatar
                  type: VARCHAR(500)
                  remarks: 头像URL
                  afterColumn: phone
              - column:
                  name: department
                  type: VARCHAR(100)
                  remarks: 部门
                  afterColumn: avatar
        - createIndex:
            indexName: idx_department
            tableName: users
            columns:
              - column:
                  name: department
        - update:
            tableName: users
            columns:
              - column:
                  name: department
                  value: 研发部
            where: role = 'engineer' AND department IS NULL
```

## 五、多环境管理策略

### 1. 环境配置

**开发环境：**
```bash
DATABASE_URL="mysql://root:root@localhost:3306/electrical_rnd_dev"
```

**测试环境：**
```bash
DATABASE_URL="mysql://root:password@test-db:3306/electrical_rnd_test"
```

**预发布环境：**
```bash
DATABASE_URL="mysql://user:password@staging-db:3306/electrical_rnd_staging"
```

**生产环境：**
```bash
DATABASE_URL="mysql://user:password@prod-db:3306/electrical_rnd_prod"
```

### 2. 环境迁移脚本

**文件路径：** `scripts/migrate.sh`

```bash
#!/bin/bash

ENV=$1

case $ENV in
  dev)
    DATABASE_URL="mysql://root:root@localhost:3306/electrical_rnd_dev"
    ;;
  test)
    DATABASE_URL="mysql://root:password@test-db:3306/electrical_rnd_test"
    ;;
  staging)
    DATABASE_URL="mysql://user:password@staging-db:3306/electrical_rnd_staging"
    ;;
  prod)
    DATABASE_URL="mysql://user:password@prod-db:3306/electrical_rnd_prod"
    ;;
  *)
    echo "Usage: $0 {dev|test|staging|prod}"
    exit 1
    ;;
esac

export DATABASE_URL

echo "Running migrations for $ENV environment..."
npx prisma migrate deploy

echo "Running seed..."
npx prisma db seed

echo "Migration completed for $ENV environment!"
```

### 3. CI/CD集成

**GitHub Actions集成：**

```yaml
- name: 运行数据库迁移
  run: |
    cd backend
    npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL_STAGING }}
```

### 4. 迁移执行顺序

```
开发环境
    ↓ 测试通过
测试环境
    ↓ 测试通过
预发布环境
    ↓ 审批通过
生产环境
```

### 5. 回滚策略

**Prisma Migrate回滚：**
```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

**Flyway回滚：**
```bash
flyway undo
```

**Liquibase回滚：**
```bash
liquibase rollback <tag>
```

## 六、迁移最佳实践

### 1. 迁移原则

- ✅ 每个迁移只做一件事
- ✅ 迁移脚本必须可重复执行
- ✅ 向后兼容，先添加字段再删除
- ✅ 大表变更分批执行
- ✅ 迁移前备份数据

### 2. 命名规范

```
V{major}.{minor}.{patch}__{description}.sql

示例：
V1.0.0__init_database.sql
V1.0.1__add_user_avatar_field.sql
V1.1.0__add_bom_management_module.sql
V2.0.0__refactor_user_permissions.sql
```

### 3. 版本号规则

- **主版本号**：重大架构变更
- **次版本号**：新功能模块
- **补丁版本号**：小修复、字段调整

### 4. 变更记录

每个迁移文件必须包含：
- 版本号
- 变更描述
- 作者信息
- 变更日期
- 变更原因

## 七、数据库备份策略

### 1. 自动备份脚本

**文件路径：** `scripts/backup-db.sh`

```bash
#!/bin/bash

BACKUP_DIR="/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="electrical_rnd"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"

mkdir -p $BACKUP_DIR

mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  $DB_NAME | gzip > $BACKUP_FILE

find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

### 2. 备份策略

- **全量备份**：每天凌晨2点
- **增量备份**：每小时
- **保留周期**：30天
- **异地备份**：每周同步到云存储

## 八、监控与告警

### 1. 迁移监控指标

- 迁移执行时间
- 迁移成功率
- 数据库版本一致性
- 迁移队列长度

### 2. 告警规则

- 迁移失败立即告警
- 迁移执行时间超过阈值告警
- 环境版本不一致告警
