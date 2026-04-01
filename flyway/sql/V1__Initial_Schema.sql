-- V1: 初始化数据库Schema
-- 基于Prisma Schema创建基础表结构

-- 创建枚举类型（MySQL使用ENUM列定义）
CREATE TABLE IF NOT EXISTS `User` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN', 'ENGINEER', 'MANAGER', 'REVIEWER', 'PURCHASER') NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_username_key` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Project` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `status` ENUM('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'PLANNING',
  `startDate` DATETIME(3) NULL,
  `endDate` DATETIME(3) NULL,
  `managerId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `Project_code_key` (`code`),
  CONSTRAINT `Project_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProjectMember` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `projectId` INT NOT NULL,
  `userId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `ProjectMember_projectId_userId_key` (`projectId`, `userId`),
  CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ProjectMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Component` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `partNumber` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `specification` VARCHAR(191) NULL,
  `packageType` VARCHAR(191) NULL,
  `voltageRating` DECIMAL(10,2) NULL,
  `powerRating` DECIMAL(10,2) NULL,
  `price` DECIMAL(10,2) NULL,
  `manufacturer` VARCHAR(191) NULL,
  `datasheetUrl` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `Component_partNumber_key` (`partNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Bom` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `stage` VARCHAR(191) NOT NULL,
  `projectId` INT NOT NULL,
  `createdById` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  CONSTRAINT `Bom_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Bom_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BomItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bomId` INT NOT NULL,
  `componentId` INT NOT NULL,
  `quantity` INT NOT NULL,
  `unitPrice` DECIMAL(10,2) NULL,
  `supplier` VARCHAR(191) NULL,
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `BomItem_bomId_componentId_key` (`bomId`, `componentId`),
  CONSTRAINT `BomItem_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `Bom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BomItem_componentId_fkey` FOREIGN KEY (`componentId`) REFERENCES `Component`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Drawing` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `filePath` VARCHAR(191) NOT NULL,
  `fileType` VARCHAR(191) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `tags` VARCHAR(191) NULL,
  `projectId` INT NOT NULL,
  `uploadedById` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  CONSTRAINT `Drawing_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Drawing_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BomDrawing` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bomId` INT NOT NULL,
  `drawingId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `BomDrawing_bomId_drawingId_key` (`bomId`, `drawingId`),
  CONSTRAINT `BomDrawing_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `Bom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BomDrawing_drawingId_fkey` FOREIGN KEY (`drawingId`) REFERENCES `Drawing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DesignReview` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `drawingId` INT NOT NULL,
  `reviewerId` INT NOT NULL,
  `submitterId` INT NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `comment` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  CONSTRAINT `DesignReview_drawingId_fkey` FOREIGN KEY (`drawingId`) REFERENCES `Drawing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DesignReview_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DesignReview_submitterId_fkey` FOREIGN KEY (`submitterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
