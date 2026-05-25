-- ================================================================
-- CloudPivot IMS — 物料基础数据 (PostgreSQL · 功能沙发厂)
-- 真实物料 431 条(取自 酉昌进销存明细.xlsx) + 场景补充 15 条 = 446 条
-- 前置依赖: 先执行 seed_categories_pg.sql 与 002_seed_data.sql(预置单位)
-- category_id / base_unit_id 用按 code/name 子查询引用，不依赖具体主键值
-- 真实数据无价格 → ref_cost_price/sale_price 取默认 0；真实件 material_type 均为 raw
-- 重复执行安全: ON CONFLICT (code) DO NOTHING
-- 使用: psql "$DATABASE_URL" -f scripts/seed_materials_pg.sql
-- ================================================================

-- 如需重新导入，先取消注释下一行：
-- TRUNCATE materials RESTART IDENTITY CASCADE;

BEGIN;

-- 真实数据用到但 units 表缺失的「盒」单位(幂等补充)
INSERT INTO units (name, name_en, name_vi, symbol, decimal_places, sort_order)
VALUES ('盒','box','hộp','box',0,55) ON CONFLICT (name) DO NOTHING;

INSERT INTO materials (code, name, material_type, category_id, spec, base_unit_id, remark)
VALUES

-- 【电机】 RAW-DRIVE-MOTOR
('101000950', 'ML18-017电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), '18-017', (SELECT id FROM units WHERE name='个'), NULL),
('101001524', 'ML19-017C电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101001876', 'ML18-003G电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101001950', 'ML18-017电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101002431', '162-206电机配5181铁架', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101002437', 'ML28-008电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101002438', 'ML28-009电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101002605', 'ML19-236A电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101002649', 'ML20-167A电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101002929', 'ML20-167D电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('101003295', '头枕电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), 'ML20-167J', (SELECT id FROM units WHERE name='个'), NULL),
('101003949', 'ML18-450B电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217010816', '配6281铁架电机', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-MOTOR'), '电机', (SELECT id FROM units WHERE name='个'), NULL),

-- 【控制盒/控制器】 RAW-DRIVE-CTRL
('105002501', 'CB048-A12-05S控制开关', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-CTRL'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('105003168', 'CB048-A12-16SA控制盒', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-CTRL'), '气囊控制盒', (SELECT id FROM units WHERE name='个'), NULL),

-- 【电源/变压器】 RAW-DRIVE-POWER
('106000007', 'TR011电源', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-POWER'), 'TR011', (SELECT id FROM units WHERE name='个'), NULL),
('106000079', '电源', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-POWER'), 'TR011', (SELECT id FROM units WHERE name='个'), NULL),

-- 【拉手/开关】 RAW-DRIVE-SWITCH
('105001702', '金属拉手开关', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-SWITCH'), '通用', (SELECT id FROM units WHERE name='个'), NULL),
('105001848', '塑料黑色方形拉手', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-SWITCH'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217003066', 'L拉手开关', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-SWITCH'), '4318', (SELECT id FROM units WHERE name='个'), NULL),
('217003067', 'R拉手开关', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-SWITCH'), '4318', (SELECT id FROM units WHERE name='个'), NULL),
('217005541', 'L拉手支架', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-SWITCH'), '4181', (SELECT id FROM units WHERE name='个'), NULL),
('217005542', 'R拉手支架', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-SWITCH'), '4181', (SELECT id FROM units WHERE name='个'), NULL),
('226000175', '4181-1带摆（左单边）金属拉手', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-SWITCH'), '4181-1', (SELECT id FROM units WHERE name='套'), NULL),

-- 【线束/连接线】 RAW-DRIVE-CABLE
('105002717', 'HC-204-ONO-OU-01延长线', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-CABLE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('111000008', '电源线', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-CABLE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('EX-LED-STRIP', 'LED氛围灯带', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-CABLE'), '场景补充·常见缺漏件', (SELECT id FROM units WHERE name='米'), '场景补充示例'),

-- 【驱动控制配件】 RAW-DRIVE-PART
('101001501', 'ML18-017A', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '电机', (SELECT id FROM units WHERE name='个'), NULL),
('101002751', 'ML6-001B', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '电机', (SELECT id FROM units WHERE name='个'), NULL),
('103000132', 'TJ004A', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '430MM', (SELECT id FROM units WHERE name='个'), NULL),
('103000145', 'TJ004A', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '630MM', (SELECT id FROM units WHERE name='个'), NULL),
('103000279', 'MLTJ004A-685', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('103000308', 'TJ004A', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '540MM', (SELECT id FROM units WHERE name='个'), NULL),
('103000525', 'ML-H120040A-C-05(02)', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '音响电源', (SELECT id FROM units WHERE name='个'), NULL),
('103000551', '6281-2', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('105000026', 'MLSK5-A', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '手控器', (SELECT id FROM units WHERE name='个'), NULL),
('105001651', 'SK-14E1', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '手控器', (SELECT id FROM units WHERE name='个'), NULL),
('105001737', 'AC108-2MA-2UQ03', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '手控器', (SELECT id FROM units WHERE name='个'), NULL),
('105001824', 'FSK004-A18', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '手控器', (SELECT id FROM units WHERE name='个'), NULL),
('105002075', 'AC014-1M-1U02', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '手控器', (SELECT id FROM units WHERE name='个'), NULL),
('105002115', 'AC069-1M-2UQ03', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('105002714', 'HC-204-OMO-OU01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('105003111', 'HC091-2MIL0-1U01-A', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '弹线手控器', (SELECT id FROM units WHERE name='个'), NULL),
('105003112', 'HO91-1MZO-1UQ01-A', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '手控器', (SELECT id FROM units WHERE name='个'), NULL),
('106000324', 'ML-H290020A-C-04C(03)', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '直头电源', (SELECT id FROM units WHERE name='个'), NULL),
('106000334', 'DC-29-12-10-01-Y25-01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '电源插座', (SELECT id FROM units WHERE name='个'), NULL),
('106000368', 'ML-H290020A-C-04C(07)', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '弯头电源', (SELECT id FROM units WHERE name='个'), NULL),
('106000607', 'ML-H240030-A-03(01)', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('106000636', 'ML-H12010A-C-01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('108000437', 'DTC12-B05-01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('109000122', 'DCP23-04-N-01-02', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '插座', (SELECT id FROM units WHERE name='个'), NULL),
('109000249', 'CZ005-A10-2UQ02', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '电源盒', (SELECT id FROM units WHERE name='个'), NULL),
('109000275', 'IUIQC29-10-05', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('109000292', 'WC010B-2UQ12-01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('109000303', 'MLCZ0014', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('109000320', '1U1QC29-10-09', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '手控器', (SELECT id FROM units WHERE name='个'), NULL),
('109000330', '1UIQC29-10-09', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('111000028', 'OP1400200KD', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), 'Y线', (SELECT id FROM units WHERE name='个'), NULL),
('111000118', 'OP1500KS', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '电源线', (SELECT id FROM units WHERE name='个'), NULL),
('111000171', 'YC-0904B01-01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('111000172', 'YC-0505B01-01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('111000525', 'YC-127-01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('113000011', 'JRD003', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('113001126', 'ZD016-12C0-N-01', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('113001127', 'ZD16-12CO-N-02', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('113001128', 'ZD016-12CO-N-03', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('113001129', 'ZD016-12CO-N-04', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('113001130', 'JRD003', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('113001317', 'MLJRD003', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '加热垫', (SELECT id FROM units WHERE name='个'), NULL),
('EX-USB-MOD', '双USB充电模块', 'raw', (SELECT id FROM categories WHERE code='RAW-DRIVE-PART'), '场景补充·常见缺漏件', (SELECT id FROM units WHERE name='个'), '场景补充示例'),

-- 【铁架】 RAW-FRAME-IRON
('103000195', '125铁架-687电动', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217002865', '5318铁架(L)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217002866', '5318铁架(R)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217002870', '4318铁架(L)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217002875', '4318铁架(R)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217003121', '5181铁架（L）', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217003122', '5181铁架（R）', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217003123', '4318H铁架(L)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217003124', '4318H铁架(R)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217005537', '4181铁架（L）', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217005538', '4181铁架（R）', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217007170', '5396铁架(L)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217007171', '5396铁架(R)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217008359', '5318Z铁架(L)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217008361', '5318Z铁架(R)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('230000010', '5318C（L）左片', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('230000011', '5318C(R)右片', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('230000028', '5397S铁架（L)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('230000029', '5397S铁架（R)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('230000036', '6281铁架（L)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('230000037', '6281铁架（R)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301090225', 'TJ018左片', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301090226', 'TJ018右片', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301090417', 'TJ018B左片', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301090418', 'TJ018B右片', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-IRON'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【底连杆】 RAW-FRAME-LINK
('217002184', '5318-2底连杆单人位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '463.55MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002827', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '680MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002832', '-10分体底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '803MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002834', '-12底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '854.4MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002898', '4318单人位底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '45.8MM', (SELECT id FROM units WHERE name='个'), NULL),
('217007710', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1650MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001012', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1650MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001013', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1360MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001014', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1600MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001015', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1590MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001016', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1380MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001017', '无筋底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1660MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001018', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1658MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001020', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '675MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001021', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '610MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001022', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '677MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001023', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '680MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001024', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1830MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001027', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '535MM', (SELECT id FROM units WHERE name='个'), NULL),
('228000247', '带筋底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1660MM', (SELECT id FROM units WHERE name='个'), NULL),
('228000258', '底连杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-LINK'), '1420MM', (SELECT id FROM units WHERE name='个'), NULL),

-- 【驱动管/方管】 RAW-FRAME-TUBE
('21700144', '电动转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '563.6MM-7', (SELECT id FROM units WHERE name='个'), NULL),
('217002122', '稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '365.3MM-0', (SELECT id FROM units WHERE name='个'), NULL),
('217002123', '-稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '390MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002124', '-2稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '416.1MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002127', '-5稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '492.3MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002129', '稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '679.4MM-7', (SELECT id FROM units WHERE name='个'), NULL),
('217002132', '-10稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '619.3MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002134', '-12稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '670.4MM-12', (SELECT id FROM units WHERE name='个'), NULL),
('217002137', '抗扭管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '385.8MM-0', (SELECT id FROM units WHERE name='个'), NULL),
('217002138', '-1抗扭管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '410MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002139', '-2抗扭管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '436.6MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002142', '-5抗扭管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '512.8MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002147', '-10抗扭管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '639.8MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002149', '抗扭管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '690.6MM-12', (SELECT id FROM units WHERE name='个'), NULL),
('217002167', '电动转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '501.6MM-0', (SELECT id FROM units WHERE name='个'), NULL),
('217002168', '-1电动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '527MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002169', '电动转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '-2', (SELECT id FROM units WHERE name='个'), NULL),
('217002172', '-5转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '628.6MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002177', '-10转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '755.6MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002179', '电动转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '806.4MM-12', (SELECT id FROM units WHERE name='个'), NULL),
('217002932', '手动转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '501.6MM-0', (SELECT id FROM units WHERE name='个'), NULL),
('217002933', '-1手动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '527MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002934', '手动转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217002939', '手动转动方管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '679.4MM-7', (SELECT id FROM units WHERE name='个'), NULL),
('217003563', '5397-14前驱管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '820MM', (SELECT id FROM units WHERE name='个'), NULL),
('217006641', '5396-7前驱杆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '587MM', (SELECT id FROM units WHERE name='个'), NULL),
('217007180', '5396-7后驱管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '500MM', (SELECT id FROM units WHERE name='个'), NULL),
('217008944', '5396-12后驱管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '802.9MM-12', (SELECT id FROM units WHERE name='个'), NULL),
('217008988', '5396-12前驱管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '715.9MM-12', (SELECT id FROM units WHERE name='个'), NULL),
('217010806', '6281后驱管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217010808', '6281稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217010815', '6281前驱管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217011157', '6281梯形后管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217011159', '6281梯形前管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('221001028', '短方管配件', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '135MM*15MM', (SELECT id FROM units WHERE name='个'), NULL),
('221001029', '5181-2后驱管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('221001030', '5181-2稳定管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('221001031', '5181-2抗扭管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('228000056', '5397-14后驱管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), '680MM', (SELECT id FROM units WHERE name='个'), NULL),
('228000250', '6281后驱弯管', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-TUBE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【单元位组件】 RAW-FRAME-SEAT
('217002067', 'KD卡', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217003915', '中间靠背件', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), '大刀片', (SELECT id FROM units WHERE name='个'), NULL),
('217004535', '侧边安装KD卡1', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217004622', '侧边安装KD卡2', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217005293', '4318-0左边位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217005295', '4318-2左边位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), '4318-2', (SELECT id FROM units WHERE name='套'), NULL),
('217005300', '4318-7单边位左边', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217005310', '4318-0右边位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217005312', '4318-2右边位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), '4318-2', (SELECT id FROM units WHERE name='套'), NULL),
('217005602', '4181-0左边位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('217006004', '5318-2单人位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), '5318-2', (SELECT id FROM units WHERE name='套'), NULL),
('217007533', '6281KD卡1', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), 'KD卡', (SELECT id FROM units WHERE name='个'), NULL),
('217007534', '6281KD卡2', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), 'KD卡', (SELECT id FROM units WHERE name='个'), NULL),
('226001268', '5318-5单人位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('22600134', '5396用KD卡(1)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('226001344', '5396用KD卡(2)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('226001345', '4318-1单人右边位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), '4318-1', (SELECT id FROM units WHERE name='套'), NULL),
('226001446', '4318单人位左边位', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('226001447', '4318-7单人位右边', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-SEAT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【连接结构件】 RAW-FRAME-CONNECT
('212003601', '扶手插片', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '40*120', (SELECT id FROM units WHERE name='个'), NULL),
('212003602', '扶手插片', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), 'Bass 18cm', (SELECT id FROM units WHERE name='个'), NULL),
('212003604', '蝴蝶插销', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('212003605', '塑料储备盒', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '30MM*260MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002152', '转动角铁', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '349.2MM-0', (SELECT id FROM units WHERE name='个'), NULL),
('217002153', '-1转动角铁', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '375.MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002154', '5318-2转动角铁', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '400MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002157', '-5转动角铁', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '476.2MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002162', '-10转动角铁', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '603.2MM', (SELECT id FROM units WHERE name='个'), NULL),
('217002164', '转动角铁', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '654MM-12', (SELECT id FROM units WHERE name='个'), NULL),
('217002200', '电动连接组件(L)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '5318连接组件', (SELECT id FROM units WHERE name='个'), NULL),
('217002204', '电动连接组件(R)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '5318连接组件', (SELECT id FROM units WHERE name='个'), NULL),
('217003077', 'B扣带槽挂件', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), 'AB扣', (SELECT id FROM units WHERE name='个'), NULL),
('217004330', '底框', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '摆椅底框-0', (SELECT id FROM units WHERE name='个'), NULL),
('217004331', '-2方框(5181)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '5181-2框', (SELECT id FROM units WHERE name='个'), NULL),
('217004332', '-2方框', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '4181框', (SELECT id FROM units WHERE name='个'), NULL),
('217005604', '4181-2带摆', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '4181-2', (SELECT id FROM units WHERE name='套'), NULL),
('217010827', '6281底框', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '底框', (SELECT id FROM units WHERE name='个'), NULL),
('226001006', '5318Z-10', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301010700', '斜角挂扣组件(ACE-MP00957)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('380010048', '夹吗扣', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('65000001', 'COC NHUA 90MM*35MM', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000011', 'Bass 18cm', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000012', 'Bass BUOM', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000013', 'KHAY 300*260*90', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000014', 'COC SAT 85MM*35MM', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000015', 'COC NHUA 90MM*35MM', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000016', 'COC NHUA 90MM*65MM', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000017', 'COC SAT 85MM*55MM', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000019', 'BASS THUY LUC', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000020', 'BASS CONG (1014)', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000021', 'GIO GA', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650010011', 'Bass 18cm', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650010012', 'Bass BUOM', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650010013', 'KHAY 300*260*90', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('EX-CUP-HOLDER', '沙发扶手杯架', 'raw', (SELECT id FROM categories WHERE code='RAW-FRAME-CONNECT'), '场景补充·常见缺漏件', (SELECT id FROM units WHERE name='个'), '场景补充示例'),

-- 【弹簧】 RAW-SPRING-SPRING
('105002460', '中位有簧拉索', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), '813MM*117', (SELECT id FROM units WHERE name='个'), NULL),
('221001025', '钩簧', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('221001026', '钩簧', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), '380MM*615MM*115MM', (SELECT id FROM units WHERE name='个'), NULL),
('301010114', 'TJ006拉簧', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301010680', '红拉簧', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301010698', '弹簧5396铁架用', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), '弹簧', (SELECT id FROM units WHERE name='个'), NULL),
('301010711', '4181小弹簧', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301010788', '加强靠背簧', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301011186', '靠背弹簧', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('310010011', '弹簧包（480*480）1003用', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), '480*480', (SELECT id FROM units WHERE name='个'), NULL),
('310010012', 'TM-YYC506弹簧吧', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), '1032-2142用样品', (SELECT id FROM units WHERE name='个'), NULL),
('310010013', '钩簧4.0*520*10118R', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), '1032-2142样品', (SELECT id FROM units WHERE name='个'), NULL),
('380010047', '弹簧扣', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000022', 'MOC LOXO U2.8*45', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000023', 'MOC LO XO U 2.8*55', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000024', 'KEP LOXO (4 LO)', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000025', 'KHOA KEP LO XO (M66)', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-SPRING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【塑料/尼龙垫件】 RAW-SPRING-PAD
('302120061', '尼龙角垫', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-PAD'), '通用', (SELECT id FROM units WHERE name='个'), NULL),
('302120063', '白色塑料圆角4181用', 'raw', (SELECT id FROM categories WHERE code='RAW-SPRING-PAD'), '白色角垫', (SELECT id FROM units WHERE name='个'), NULL),

-- 【布艺面料】 RAW-COVER-FABRIC
('360010011', '酷布', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '酷布', (SELECT id FROM units WHERE name='米'), NULL),
('360010012', 'U203面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'U203', (SELECT id FROM units WHERE name='米'), NULL),
('360010013', 'HNA-BLACK面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'HNA-BLACK', (SELECT id FROM units WHERE name='米'), NULL),
('360010014', 'LN02PVC面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'LM02', (SELECT id FROM units WHERE name='米'), NULL),
('360010015', 'PX2142-HIGHLAND(1032)面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'PX2142-HIGHLAND(1032)', (SELECT id FROM units WHERE name='米'), NULL),
('360010016', '1008-SADDLE面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1008-SADDLE', (SELECT id FROM units WHERE name='米'), NULL),
('360010017', '1009-SABLE面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1009-SABLE', (SELECT id FROM units WHERE name='米'), NULL),
('360010018', '1014-CEAMEN面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1014-CEAMEN', (SELECT id FROM units WHERE name='米'), NULL),
('360010019', '1014-ELIPSE面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1014-ELIPSE', (SELECT id FROM units WHERE name='米'), NULL),
('360010020', '1014-SEAFOAM面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1014-SEAFOAM', (SELECT id FROM units WHERE name='米'), NULL),
('360010021', '1014-CHARCOAL面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1014-CHARCOAL', (SELECT id FROM units WHERE name='米'), NULL),
('360010022', '1005-19H23A面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1005-19H23A', (SELECT id FROM units WHERE name='米'), NULL),
('360010026', '1023(22-HL-11)灰色带绒布料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1023(22-HL-11)', (SELECT id FROM units WHERE name='米'), NULL),
('360010027', '1023 (22-HL-9)灰蓝色带绒布料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1023 (22-HL-9)', (SELECT id FROM units WHERE name='米'), NULL),
('360010028', '1023 (22-HL-2)棕色带绒布料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1023 (22-HL-2)', (SELECT id FROM units WHERE name='米'), NULL),
('360010029', 'PX2142(PVC)面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'PX2142(PVC)', (SELECT id FROM units WHERE name='米'), NULL),
('360010030', 'CHOCOLATE (MONG)面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'CHOCOLATE (MONG)', (SELECT id FROM units WHERE name='米'), NULL),
('360010031', 'CHOCOLATE(DAY)面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'CHOCOLATE(DAY)', (SELECT id FROM units WHERE name='米'), NULL),
('360010032', 'MOCHA面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'MOCHA', (SELECT id FROM units WHERE name='米'), NULL),
('360010033', 'TC布', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'TC', (SELECT id FROM units WHERE name='米'), NULL),
('360010036', 'ZYX64327-1面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'ZYX64327-1', (SELECT id FROM units WHERE name='米'), NULL),
('360010037', '1017L13PVC面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '1017L13PVC', (SELECT id FROM units WHERE name='米'), NULL),
('360010038', 'CHONG LONG VIT 面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'CHONG LONG VIT', (SELECT id FROM units WHERE name='米'), NULL),
('360010039', '6235(2139)棕双色PU NAU面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), '6235(2139)PU NAU', (SELECT id FROM units WHERE name='米'), NULL),
('360010040', 'CARO NAU面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'CARO NAU', (SELECT id FROM units WHERE name='米'), NULL),
('360010041', 'CARO XAM面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'CARO XAM', (SELECT id FROM units WHERE name='米'), NULL),
('360010048', 'COMBAT BLU', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('360010050', 'CAPUCHINO (DA THAT)1022', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('360010051', 'PX2142 (GOI OM )', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('360010052', '1040-5008EUREKAWIND面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('360010053', '1040-5008QUESANDSTONE面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('360010054', '1040-5008MONDAVIHEMP面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('360010055', '1038DAYTON-14棕色面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('360010056', '1038-DAYTON-17深棕色面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('360010057', '1046-2905面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('360010058', 'U1798-13MCH', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-FABRIC'), 'DHT1108-03', (SELECT id FROM units WHERE name='米'), NULL),

-- 【皮革】 RAW-COVER-LEATHER
('360010023', '1005-19H23B深咖啡色皮革', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-LEATHER'), '1005-19H23B', (SELECT id FROM units WHERE name='米'), NULL),
('360010024', '1006-6019-13B灰色皮革面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-LEATHER'), '1006-6019-13B', (SELECT id FROM units WHERE name='米'), NULL),
('360010025', '1006用，7993C-24灰色皮革面料', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-LEATHER'), '7993C-24存放在套子厂', (SELECT id FROM units WHERE name='米'), NULL),

-- 【无纺布/里布】 RAW-COVER-LINING
('360010034', 'TRANG 30G白色无纺布', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-LINING'), 'TRANG 30G', (SELECT id FROM units WHERE name='米'), NULL),
('360010035', 'TRANG 40G白色无纺布', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-LINING'), 'TRANG 40G', (SELECT id FROM units WHERE name='米'), NULL),
('360010047', '黑色无纺布70G', 'raw', (SELECT id FROM categories WHERE code='RAW-COVER-LINING'), '无纺布', (SELECT id FROM units WHERE name='米'), NULL),

-- 【针车线】 RAW-SEW-THREAD
('340010011', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2508047', (SELECT id FROM units WHERE name='个'), NULL),
('340010012', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-60589', (SELECT id FROM units WHERE name='个'), NULL),
('340010013', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-WHITE', (SELECT id FROM units WHERE name='个'), NULL),
('340010014', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3QH6025', (SELECT id FROM units WHERE name='个'), NULL),
('340010015', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2603053', (SELECT id FROM units WHERE name='个'), NULL),
('340010016', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-3714', (SELECT id FROM units WHERE name='个'), NULL),
('340010017', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-BLADC', (SELECT id FROM units WHERE name='个'), NULL),
('340010018', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2508033', (SELECT id FROM units WHERE name='个'), NULL),
('340010019', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2508043', (SELECT id FROM units WHERE name='个'), NULL),
('340010020', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2508078', (SELECT id FROM units WHERE name='个'), NULL),
('340010021', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-3730', (SELECT id FROM units WHERE name='个'), NULL),
('340010022', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2510175', (SELECT id FROM units WHERE name='个'), NULL),
('340010023', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2511044', (SELECT id FROM units WHERE name='个'), NULL),
('340010024', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-3249', (SELECT id FROM units WHERE name='个'), NULL),
('340010025', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-25110710', (SELECT id FROM units WHERE name='个'), NULL),
('340010026', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2603054', (SELECT id FROM units WHERE name='个'), NULL),
('340010027', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-3714', (SELECT id FROM units WHERE name='个'), NULL),
('340010028', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-QH4026', (SELECT id FROM units WHERE name='个'), NULL),
('340010029', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-3706', (SELECT id FROM units WHERE name='个'), NULL),
('340010030', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3', (SELECT id FROM units WHERE name='个'), NULL),
('340010031', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-3622', (SELECT id FROM units WHERE name='个'), NULL),
('340010032', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-2508043', (SELECT id FROM units WHERE name='个'), NULL),
('340010033', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-2507050', (SELECT id FROM units WHERE name='个'), NULL),
('340010034', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-2507051', (SELECT id FROM units WHERE name='个'), NULL),
('340010035', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-2508033', (SELECT id FROM units WHERE name='个'), NULL),
('340010036', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-WHITE', (SELECT id FROM units WHERE name='个'), NULL),
('340010037', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-2602070', (SELECT id FROM units WHERE name='个'), NULL),
('340010038', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/32603054', (SELECT id FROM units WHERE name='个'), NULL),
('340010039', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '500D/3-RBA-02', (SELECT id FROM units WHERE name='个'), NULL),
('340010040', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '100D/3-DYYC01', (SELECT id FROM units WHERE name='个'), NULL),
('340010041', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '100D/3-QH4026', (SELECT id FROM units WHERE name='个'), NULL),
('340010042', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-2508079', (SELECT id FROM units WHERE name='个'), NULL),
('340010043', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-HC60589', (SELECT id FROM units WHERE name='个'), NULL),
('340010044', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-WHITE', (SELECT id FROM units WHERE name='个'), NULL),
('340010045', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-6025', (SELECT id FROM units WHERE name='个'), NULL),
('340010046', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-3460', (SELECT id FROM units WHERE name='个'), NULL),
('340010047', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-2508033', (SELECT id FROM units WHERE name='个'), NULL),
('340010048', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-2510106P', (SELECT id FROM units WHERE name='个'), NULL),
('340010049', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-2508049', (SELECT id FROM units WHERE name='个'), NULL),
('340010050', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-2508043', (SELECT id FROM units WHERE name='个'), NULL),
('340010051', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-251104', (SELECT id FROM units WHERE name='个'), NULL),
('340010052', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/3-QH4026', (SELECT id FROM units WHERE name='个'), NULL),
('340010053', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-2603054', (SELECT id FROM units WHERE name='个'), NULL),
('340010054', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/3-RBA-02', (SELECT id FROM units WHERE name='个'), NULL),
('340010055', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-2603053', (SELECT id FROM units WHERE name='个'), NULL),
('340010056', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '300D/16-2603070', (SELECT id FROM units WHERE name='个'), NULL),
('340010057', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '101-2508047', (SELECT id FROM units WHERE name='个'), NULL),
('340010058', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '101-2508049', (SELECT id FROM units WHERE name='个'), NULL),
('340010059', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '101-2510175', (SELECT id FROM units WHERE name='个'), NULL),
('340010060', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '101-2510176', (SELECT id FROM units WHERE name='个'), NULL),
('340010061', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '101-2510177', (SELECT id FROM units WHERE name='个'), NULL),
('340010062', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '840/3-2511071D', (SELECT id FROM units WHERE name='个'), NULL),
('340010063', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('340010073', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '20/3-2512101', (SELECT id FROM units WHERE name='个'), NULL),
('340010074', '针车线', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-THREAD'), '10#-2512101', (SELECT id FROM units WHERE name='个'), NULL),

-- 【拉链】 RAW-SEW-ZIPPER
('360010043', '拉链', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-ZIPPER'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('360010044', '拉链头', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-ZIPPER'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【魔术贴】 RAW-SEW-VELCRO
('360010045', '魔术贴绒面', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-VELCRO'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('360010046', '魔术贴刺面', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-VELCRO'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【棉绳/松紧带】 RAW-SEW-CORD
('360010042', '棉绳', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-CORD'), NULL, (SELECT id FROM units WHERE name='米'), NULL),
('650000030', '绿色松紧带', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-CORD'), '50MM', (SELECT id FROM units WHERE name='米'), NULL),

-- 【填充棉/海绵】 RAW-SEW-FILLING
('650000037', '7D公仔棉', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-FILLING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000038', 'GON 15D 公仔棉', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-FILLING'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000042', '丝棉', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-FILLING'), '200G*106M', (SELECT id FROM units WHERE name='千克'), NULL),
('EX-FOAM-HD', '高密度定型海绵', 'raw', (SELECT id FROM categories WHERE code='RAW-SEW-FILLING'), '场景补充·常见缺漏件', (SELECT id FROM units WHERE name='个'), '场景补充示例'),

-- 【螺丝】 RAW-FAST-SCREW
('301010507', '7*13螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), 'M7*13', (SELECT id FROM units WHERE name='个'), NULL),
('301010531', 'M7*30螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301010622', '1/4*38螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*38', (SELECT id FROM units WHERE name='个'), NULL),
('301010641', 'M7*23螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301010646', '7*18螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), 'M7*18', (SELECT id FROM units WHERE name='个'), NULL),
('301010667', '1/4*38外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('301010757', '1/4*16外六角螺栓', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('380010011', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*13', (SELECT id FROM units WHERE name='个'), NULL),
('380010012', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*15', (SELECT id FROM units WHERE name='个'), NULL),
('380010013', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*20', (SELECT id FROM units WHERE name='个'), NULL),
('380010014', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*12', (SELECT id FROM units WHERE name='个'), NULL),
('380010015', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*30', (SELECT id FROM units WHERE name='个'), NULL),
('380010016', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*35', (SELECT id FROM units WHERE name='个'), NULL),
('380010017', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*40', (SELECT id FROM units WHERE name='个'), NULL),
('380010018', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*45', (SELECT id FROM units WHERE name='个'), NULL),
('380010019', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*50', (SELECT id FROM units WHERE name='个'), NULL),
('380010020', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*60', (SELECT id FROM units WHERE name='个'), NULL),
('380010021', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*70', (SELECT id FROM units WHERE name='个'), NULL),
('380010022', '外六角螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '1/4*70*5*13', (SELECT id FROM units WHERE name='个'), NULL),
('380010023', '5*55螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '5*55', (SELECT id FROM units WHERE name='个'), NULL),
('380010024', '5*70螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '5*70', (SELECT id FROM units WHERE name='个'), NULL),
('380010025', '8*75螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '8*75', (SELECT id FROM units WHERE name='个'), NULL),
('380010026', '5*50螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '5*50', (SELECT id FROM units WHERE name='个'), NULL),
('380010027', '3*20螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '3*20', (SELECT id FROM units WHERE name='个'), NULL),
('380010040', '4*15(DEN)螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '4*15(DEN)', (SELECT id FROM units WHERE name='个'), NULL),
('380010041', '4*20螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '4*20', (SELECT id FROM units WHERE name='个'), NULL),
('380010042', '4*25螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '4*25', (SELECT id FROM units WHERE name='个'), NULL),
('380010043', '4*30螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '4*30', (SELECT id FROM units WHERE name='个'), NULL),
('380010044', '4*50 (DEN)螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '4*50 (DEN)', (SELECT id FROM units WHERE name='个'), NULL),
('380010045', '4*50 (VANG)螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '4*50 (VANG)', (SELECT id FROM units WHERE name='个'), NULL),
('380010046', '4*15 (TRANG)螺丝', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-SCREW'), '4*15 (TRANG)', (SELECT id FROM units WHERE name='个'), NULL),

-- 【螺母/垫片】 RAW-FAST-NUT
('301010623', '1/4螺母', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NUT'), '1/4', (SELECT id FROM units WHERE name='个'), NULL),
('301010668', '1/4防滑螺母', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NUT'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('380010028', 'LONG DEN DEN垫片（黑色）', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NUT'), 'LONG DEN DEN', (SELECT id FROM units WHERE name='个'), NULL),
('380010029', 'LONG DEN TRANG 垫片白色', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NUT'), 'LONG DEN TRANG', (SELECT id FROM units WHERE name='个'), NULL),

-- 【钉类】 RAW-FAST-NAIL
('212003603', '四爪钉', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NAIL'), '1/4*20', (SELECT id FROM units WHERE name='个'), NULL),
('217003075', 'A扣带钉挂件', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NAIL'), 'AB扣', (SELECT id FROM units WHERE name='个'), NULL),
('390000011', 'DINH DU铜钉', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NAIL'), 'DINH DU', (SELECT id FROM units WHERE name='个'), NULL),
('390000012', 'N15枪钉', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NAIL'), 'N15', (SELECT id FROM units WHERE name='箱'), NULL),
('390000013', 'N17枪钉', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NAIL'), 'N17', (SELECT id FROM units WHERE name='箱'), NULL),
('390000014', '1013J枪钉', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NAIL'), '1013J', (SELECT id FROM units WHERE name='箱'), NULL),
('390000015', '1010F枪钉', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NAIL'), '1010F', (SELECT id FROM units WHERE name='箱'), NULL),
('390000016', '438K马钉', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-NAIL'), '438', (SELECT id FROM units WHERE name='箱'), NULL),

-- 【合页/铰链】 RAW-FAST-HINGE
('650000018', '合页H96', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-HINGE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650010018', '合页H96', 'raw', (SELECT id FROM categories WHERE code='RAW-FAST-HINGE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【纸护角】 RAW-PKG-CORNER
('350010011', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '460*50*50', (SELECT id FROM units WHERE name='个'), NULL),
('350010012', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '440*40*40', (SELECT id FROM units WHERE name='个'), NULL),
('350010013', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '350*40*40', (SELECT id FROM units WHERE name='个'), NULL),
('350010014', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '600*50*50', (SELECT id FROM units WHERE name='个'), NULL),
('350010015', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '740*50*50', (SELECT id FROM units WHERE name='个'), NULL),
('350010016', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '78*50*50', (SELECT id FROM units WHERE name='个'), NULL),
('350010017', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '750*40*40', (SELECT id FROM units WHERE name='个'), NULL),
('350010018', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '400*40*40', (SELECT id FROM units WHERE name='个'), NULL),
('350010019', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '500*40*40', (SELECT id FROM units WHERE name='个'), NULL),
('350010020', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '650*40*40', (SELECT id FROM units WHERE name='个'), NULL),
('350010021', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '800*50*5MM', (SELECT id FROM units WHERE name='个'), NULL),
('350010022', '纸护角', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-CORNER'), '320*40*40', (SELECT id FROM units WHERE name='个'), NULL),

-- 【胶带/缠绕膜】 RAW-PKG-TAPE
('650000034', 'BANG KEO TRONG', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-TAPE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000035', 'BANG KEO 2 MAT 双面胶', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-TAPE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650010034', '透明胶带', 'raw', (SELECT id FROM categories WHERE code='RAW-PKG-TAPE'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【手动工具】 RAW-TOOL-HAND
('330000013', 'VIT NAY DINH 起钉器', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-HAND'), 'VIT NAY DINH', (SELECT id FROM units WHERE name='个'), NULL),
('330000015', 'KEM 斜口钳', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-HAND'), 'KEM', (SELECT id FROM units WHERE name='个'), NULL),
('330000016', '刀片', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-HAND'), 'LUOI DAO', (SELECT id FROM units WHERE name='盒'), NULL),
('650000026', 'KEM BOC GIAY (CUON)', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-HAND'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000027', 'KEM BOC GIAY 550', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-HAND'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000028', 'KEM BOC GIAY 440', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-HAND'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000041', 'KEM BOC GIAY 450纸包钢丝', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-HAND'), NULL, (SELECT id FROM units WHERE name='个'), NULL),

-- 【气动/电动工具】 RAW-TOOL-POWER
('330000012', 'PH2-S2-200凤批头', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-POWER'), 'PH2-S2-200', (SELECT id FROM units WHERE name='个'), NULL),
('330000014', 'SUNG BAN TEM胶枪', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-POWER'), 'SUNG BAN TEM', (SELECT id FROM units WHERE name='个'), NULL),
('330000017', 'PIN CAM TAY 手电钻电池', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-POWER'), 'PIN CAM TAY', (SELECT id FROM units WHERE name='个'), NULL),
('330000020', 'DAU VIT 1/4*65 PH2凤批头', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-POWER'), 'DAU VIT 1/4*65 PH2', (SELECT id FROM units WHERE name='个'), NULL),
('330000021', '1/4*65 H8凤批头', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-POWER'), '1/4*65 H8', (SELECT id FROM units WHERE name='个'), NULL),
('330000022', '1/4*65 H6.0凤批头', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-POWER'), '1/4*65 H6.0', (SELECT id FROM units WHERE name='个'), NULL),
('330000023', '1/4*65 H4凤批头', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-POWER'), '1/4*65 H4', (SELECT id FROM units WHERE name='个'), NULL),
('330000024', '4*65凤批头', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-POWER'), '4*65', (SELECT id FROM units WHERE name='个'), NULL),

-- 【耗材/胶粘】 RAW-TOOL-CONSUM
('330000011', 'CO油漆刷', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'CO', (SELECT id FROM units WHERE name='个'), NULL),
('330000018', 'CO MAY', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'CO MAY', (SELECT id FROM units WHERE name='个'), NULL),
('330000019', 'KEO CAT CHI 小剪刀', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'KEO CAT CHI', (SELECT id FROM units WHERE name='个'), NULL),
('330000025', 'DAU BU 8MM', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'DAU BU 8MM', (SELECT id FROM units WHERE name='个'), NULL),
('330000026', 'DAU BU 14MM', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'DAU BU 14MM', (SELECT id FROM units WHERE name='个'), NULL),
('330000027', 'CHAN VIT', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'CHAN VIT', (SELECT id FROM units WHERE name='个'), NULL),
('330000028', 'DAO KEO KEO', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'DAO KEO KEO', (SELECT id FROM units WHERE name='个'), NULL),
('330000029', 'HOT RAC', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'HOT RAC', (SELECT id FROM units WHERE name='个'), NULL),
('330000030', 'CHOI QUET NHA', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), 'CHOI QUET NHA', (SELECT id FROM units WHERE name='个'), NULL),
('650000036', 'GON 100胶', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000039', 'KEO PHUN 200KG 胶', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000040', 'KEO THUNG 20KG胶', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('EX-GLUE-SPRAY', '环保喷胶', 'raw', (SELECT id FROM categories WHERE code='RAW-TOOL-CONSUM'), '场景补充·常见缺漏件', (SELECT id FROM units WHERE name='桶'), '场景补充示例'),

-- 【钢丝件】 RAW-MISC-WIRE
('650010027', '纸包钢丝S形弯', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-WIRE'), '550MM', (SELECT id FROM units WHERE name='个'), NULL),
('650010041', '纸包钢丝 S形弯', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-WIRE'), '450MM', (SELECT id FROM units WHERE name='个'), NULL),

-- 【网布/床网件】 RAW-MISC-NET
('650010025', '床网夹', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-NET'), '17*14*0.7', (SELECT id FROM units WHERE name='个'), NULL),

-- 【杂项辅料】 RAW-MISC-OTHER
('650000029', 'CHONG AM', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-OTHER'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000031', 'DAY RUT 8*300', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-OTHER'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000032', 'DAY RUT 4*200', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-OTHER'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650000033', 'DAY RUT 5*500', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-OTHER'), NULL, (SELECT id FROM units WHERE name='个'), NULL),
('650010014', '不绣钢烟灰钢', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-OTHER'), '85MM*35MM', (SELECT id FROM units WHERE name='个'), NULL),
('650010015', '黑色塑料烟灰钢', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-OTHER'), '90MM*35MM', (SELECT id FROM units WHERE name='个'), NULL),
('650010016', '黑色塑料烟灰钢', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-OTHER'), '90MM*65MM', (SELECT id FROM units WHERE name='个'), NULL),
('650010017', '不绣钢烟灰钢', 'raw', (SELECT id FROM categories WHERE code='RAW-MISC-OTHER'), '85mm*55mm', (SELECT id FROM units WHERE name='米'), NULL),

-- 【焊接框架总成】 SEMI-FRAME
('SEMI-FRAME-ASSY', '焊接框架总成', 'semi', (SELECT id FROM categories WHERE code='SEMI-FRAME'), '半成品·框架', (SELECT id FROM units WHERE name='个'), '场景补充示例'),

-- 【缝制沙发套】 SEMI-COVER
('SEMI-COVER-S', '缝制沙发套(单人位)', 'semi', (SELECT id FROM categories WHERE code='SEMI-COVER'), '半成品·沙发套', (SELECT id FROM units WHERE name='套'), '场景补充示例'),

-- 【铺棉坐垫/靠背】 SEMI-CUSHION
('SEMI-CUSHION-ASSY', '铺棉坐垫总成', 'semi', (SELECT id FROM categories WHERE code='SEMI-CUSHION'), '半成品·坐垫', (SELECT id FROM units WHERE name='个'), '场景补充示例'),

-- 【手动单人位】 FIN-SINGLE-MANUAL
('FG-SF-S-M', '手动单人功能沙发', 'finished', (SELECT id FROM categories WHERE code='FIN-SINGLE-MANUAL'), '成品·手动单人位', (SELECT id FROM units WHERE name='套'), '场景补充示例'),

-- 【电动单人位】 FIN-SINGLE-ELEC
('FG-SF-S-E', '电动单人功能沙发', 'finished', (SELECT id FROM categories WHERE code='FIN-SINGLE-ELEC'), '成品·电动单人位', (SELECT id FROM units WHERE name='套'), '场景补充示例'),

-- 【双人位】 FIN-MULTI-DOUBLE
('FG-SF-2-E', '电动双人位功能沙发', 'finished', (SELECT id FROM categories WHERE code='FIN-MULTI-DOUBLE'), '成品·电动双人位', (SELECT id FROM units WHERE name='套'), '场景补充示例'),

-- 【三人位】 FIN-MULTI-TRIPLE
('FG-SF-3-E', '电动三人位功能沙发', 'finished', (SELECT id FROM categories WHERE code='FIN-MULTI-TRIPLE'), '成品·电动三人位', (SELECT id FROM units WHERE name='套'), '场景补充示例'),

-- 【L型转角】 FIN-COMBO-LSHAPE
('FG-SF-L', '电动L型转角功能沙发', 'finished', (SELECT id FROM categories WHERE code='FIN-COMBO-LSHAPE'), '成品·转角组合', (SELECT id FROM units WHERE name='套'), '场景补充示例'),

-- 【套装组合】 FIN-COMBO-SET
('FG-SF-SET123', '1+2+3 功能沙发套装', 'finished', (SELECT id FROM categories WHERE code='FIN-COMBO-SET'), '成品·套装组合', (SELECT id FROM units WHERE name='套'), '场景补充示例'),

-- 【沙发凳/脚踏】 FIN-ACCESSORY-OTTOMAN
('FG-SF-OTTO', '沙发脚踏凳', 'finished', (SELECT id FROM categories WHERE code='FIN-ACCESSORY-OTTOMAN'), '成品·配套', (SELECT id FROM units WHERE name='个'), '场景补充示例')
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- 自检(可选):
-- SELECT c.name AS 分类, count(*) AS 物料数 FROM materials m JOIN categories c ON m.category_id=c.id GROUP BY c.name ORDER BY 2 DESC;
-- SELECT material_type, count(*) FROM materials GROUP BY material_type;
