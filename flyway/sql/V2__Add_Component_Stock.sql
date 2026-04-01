-- V2: 添加元器件库存字段和供应商表
-- 新增库存管理相关字段

-- 为Component表添加库存字段
ALTER TABLE `Component` 
ADD COLUMN `stockQuantity` INT NOT NULL DEFAULT 0 COMMENT '库存数量' AFTER `datasheetUrl`,
ADD COLUMN `minStock` INT NOT NULL DEFAULT 10 COMMENT '最低库存预警' AFTER `stockQuantity`,
ADD COLUMN `location` VARCHAR(100) NULL COMMENT '存放位置' AFTER `minStock`;

-- 创建供应商表
CREATE TABLE IF NOT EXISTS `Supplier` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `contact` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `address` VARCHAR(500) NULL,
  `remark` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 元器件供应商关联表（多对多）
CREATE TABLE IF NOT EXISTS `ComponentSupplier` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `componentId` INT NOT NULL,
  `supplierId` INT NOT NULL,
  `supplierPartNumber` VARCHAR(191) NULL,
  `price` DECIMAL(10,2) NULL,
  `leadTime` INT NULL COMMENT '交货周期(天)',
  `isPreferred` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `ComponentSupplier_componentId_supplierId_key` (`componentId`, `supplierId`),
  CONSTRAINT `ComponentSupplier_componentId_fkey` FOREIGN KEY (`componentId`) REFERENCES `Component`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ComponentSupplier_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
