-- ================================================================
-- CloudPivot IMS — 物料分类预置数据 (PostgreSQL · 功能沙发厂)
-- 适配「酉昌」功能沙发(电动/手动可调躺椅沙发)零部件制造场景
-- 分类体系由真实进销存数据(酉昌进销存明细.xlsx)的编码规律归纳而来
-- 使用: psql "$DATABASE_URL" -f scripts/seed_categories_pg.sql
-- 仅用于空 categories 表初始化；level/path 由末尾递归 CTE 自动回填
-- ================================================================

BEGIN;

-- 如需重新导入，先取消注释下一行：
-- TRUNCATE categories RESTART IDENTITY CASCADE;

INSERT INTO categories (id, parent_id, name, code, sort_order, remark) VALUES
(1000, NULL, '原材料', 'RAW', 1, '采购入库的原料与零部件'),
(1100, 1000, '驱动与控制系统', 'RAW-DRIVE', 1, '功能沙发电动驱动与控制'),
(1110, 1100, '电机', 'RAW-DRIVE-MOTOR', 1, NULL),
(1120, 1100, '控制盒/控制器', 'RAW-DRIVE-CTRL', 2, NULL),
(1130, 1100, '电源/变压器', 'RAW-DRIVE-POWER', 3, NULL),
(1140, 1100, '拉手/开关', 'RAW-DRIVE-SWITCH', 4, NULL),
(1150, 1100, '线束/连接线', 'RAW-DRIVE-CABLE', 5, NULL),
(1160, 1100, '驱动控制配件', 'RAW-DRIVE-PART', 6, NULL),
(1200, 1000, '金属框架与结构件', 'RAW-FRAME', 2, '沙发机械框架与结构件'),
(1210, 1200, '铁架', 'RAW-FRAME-IRON', 1, NULL),
(1220, 1200, '底连杆', 'RAW-FRAME-LINK', 2, NULL),
(1230, 1200, '驱动管/方管', 'RAW-FRAME-TUBE', 3, NULL),
(1240, 1200, '单元位组件', 'RAW-FRAME-SEAT', 4, NULL),
(1250, 1200, '连接结构件', 'RAW-FRAME-CONNECT', 5, '角码/支架/插片/插销等'),
(1300, 1000, '弹簧与垫件', 'RAW-SPRING', 3, NULL),
(1310, 1300, '弹簧', 'RAW-SPRING-SPRING', 1, NULL),
(1320, 1300, '塑料/尼龙垫件', 'RAW-SPRING-PAD', 2, NULL),
(1400, 1000, '面料与皮革', 'RAW-COVER', 4, NULL),
(1410, 1400, '布艺面料', 'RAW-COVER-FABRIC', 1, NULL),
(1420, 1400, '皮革', 'RAW-COVER-LEATHER', 2, NULL),
(1430, 1400, '无纺布/里布', 'RAW-COVER-LINING', 3, NULL),
(1500, 1000, '缝纫与软体辅料', 'RAW-SEW', 5, NULL),
(1510, 1500, '针车线', 'RAW-SEW-THREAD', 1, NULL),
(1520, 1500, '拉链', 'RAW-SEW-ZIPPER', 2, NULL),
(1530, 1500, '魔术贴', 'RAW-SEW-VELCRO', 3, NULL),
(1540, 1500, '棉绳/松紧带', 'RAW-SEW-CORD', 4, NULL),
(1550, 1500, '填充棉/海绵', 'RAW-SEW-FILLING', 5, NULL),
(1600, 1000, '五金紧固件', 'RAW-FAST', 6, NULL),
(1610, 1600, '螺丝', 'RAW-FAST-SCREW', 1, NULL),
(1620, 1600, '螺母/垫片', 'RAW-FAST-NUT', 2, NULL),
(1630, 1600, '钉类', 'RAW-FAST-NAIL', 3, '枪钉/马钉/铜钉/四爪钉'),
(1640, 1600, '合页/铰链', 'RAW-FAST-HINGE', 4, NULL),
(1700, 1000, '包装材料', 'RAW-PKG', 7, NULL),
(1710, 1700, '纸护角', 'RAW-PKG-CORNER', 1, NULL),
(1720, 1700, '纸箱', 'RAW-PKG-CARTON', 2, NULL),
(1730, 1700, '胶带/缠绕膜', 'RAW-PKG-TAPE', 3, NULL),
(1740, 1700, '标签/唛头', 'RAW-PKG-LABEL', 4, NULL),
(1800, 1000, '生产工具与耗材', 'RAW-TOOL', 8, NULL),
(1810, 1800, '手动工具', 'RAW-TOOL-HAND', 1, '钳/刀片/起钉器等'),
(1820, 1800, '气动/电动工具', 'RAW-TOOL-POWER', 2, '胶枪/批头/电钻等'),
(1830, 1800, '耗材/胶粘', 'RAW-TOOL-CONSUM', 3, '胶水/油漆刷等'),
(1900, 1000, '其他辅料', 'RAW-MISC', 9, NULL),
(1910, 1900, '钢丝件', 'RAW-MISC-WIRE', 1, NULL),
(1920, 1900, '网布/床网件', 'RAW-MISC-NET', 2, NULL),
(1930, 1900, '杂项辅料', 'RAW-MISC-OTHER', 3, '扎带/防潮剂/烟灰缸等'),
(2000, NULL, '半成品', 'SEMI', 2, '车间在制与待装配总成'),
(2100, 2000, '焊接框架总成', 'SEMI-FRAME', 1, NULL),
(2200, 2000, '缝制沙发套', 'SEMI-COVER', 2, NULL),
(2300, 2000, '铺棉坐垫/靠背', 'SEMI-CUSHION', 3, NULL),
(3000, NULL, '成品', 'FIN', 3, '可销售出库的功能沙发'),
(3100, 3000, '单人功能沙发', 'FIN-SINGLE', 1, NULL),
(3110, 3100, '手动单人位', 'FIN-SINGLE-MANUAL', 1, NULL),
(3120, 3100, '电动单人位', 'FIN-SINGLE-ELEC', 2, NULL),
(3200, 3000, '多人位功能沙发', 'FIN-MULTI', 2, NULL),
(3210, 3200, '双人位', 'FIN-MULTI-DOUBLE', 1, NULL),
(3220, 3200, '三人位', 'FIN-MULTI-TRIPLE', 2, NULL),
(3300, 3000, '沙发组合', 'FIN-COMBO', 3, NULL),
(3310, 3300, 'L型转角', 'FIN-COMBO-LSHAPE', 1, NULL),
(3320, 3300, '套装组合', 'FIN-COMBO-SET', 2, NULL),
(3400, 3000, '配套产品', 'FIN-ACCESSORY', 4, NULL),
(3410, 3400, '沙发凳/脚踏', 'FIN-ACCESSORY-OTTOMAN', 1, NULL);

-- 回填 level 与 path（按 parent_id 递归；顶级 level=1、path="id"，与 category.rs 一致）
WITH RECURSIVE tree AS (
    SELECT id, 1 AS lvl, id::TEXT AS pth FROM categories WHERE parent_id IS NULL
  UNION ALL
    SELECT c.id, t.lvl+1, t.pth||'/'||c.id::TEXT FROM categories c JOIN tree t ON c.parent_id=t.id
)
UPDATE categories AS c SET level=tree.lvl, path=tree.pth, updated_at=NOW() FROM tree WHERE c.id=tree.id;

-- 重置自增序列，避免应用后续新增分类主键冲突
SELECT setval(pg_get_serial_sequence('categories','id'), (SELECT MAX(id) FROM categories));

COMMIT;

-- 自检(可选): SELECT repeat('  ',level-1)||name AS tree, code, level FROM categories ORDER BY path;
