-- V3: 添加索引和视图优化
-- 创建必要的索引和常用查询视图

-- 添加索引优化查询性能
CREATE INDEX `idx_project_status` ON `Project`(`status`);
CREATE INDEX `idx_project_manager` ON `Project`(`managerId`);
CREATE INDEX `idx_component_category` ON `Component`(`category`);
CREATE INDEX `idx_component_partNumber` ON `Component`(`partNumber`);
CREATE INDEX `idx_bom_project` ON `Bom`(`projectId`);
CREATE INDEX `idx_drawing_project` ON `Drawing`(`projectId`);
CREATE INDEX `idx_review_status` ON `DesignReview`(`status`);

-- 创建元器件库存视图
CREATE VIEW `View_Component_Stock` AS
SELECT 
    c.id,
    c.name,
    c.partNumber,
    c.category,
    c.stockQuantity,
    c.minStock,
    CASE 
        WHEN c.stockQuantity = 0 THEN 'OUT_OF_STOCK'
        WHEN c.stockQuantity < c.minStock THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END AS stockStatus,
    c.manufacturer,
    c.price
FROM `Component` c;

-- 创建项目概览视图
CREATE VIEW `View_Project_Summary` AS
SELECT 
    p.id,
    p.name,
    p.code,
    p.status,
    p.startDate,
    p.endDate,
    u.name AS managerName,
    COUNT(DISTINCT b.id) AS bomCount,
    COUNT(DISTINCT d.id) AS drawingCount,
    COUNT(DISTINCT pm.userId) AS memberCount
FROM `Project` p
LEFT JOIN `User` u ON p.managerId = u.id
LEFT JOIN `Bom` b ON p.id = b.projectId
LEFT JOIN `Drawing` d ON p.id = d.projectId
LEFT JOIN `ProjectMember` pm ON p.id = pm.projectId
GROUP BY p.id, p.name, p.code, p.status, p.startDate, p.endDate, u.name;
