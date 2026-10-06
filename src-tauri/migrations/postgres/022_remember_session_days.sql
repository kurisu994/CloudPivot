-- 022_remember_session_days.sql
-- 记住我会话天数与实现对齐为 7 天。
--
-- 002 种子曾写入 30，且该迁移已在现有库执行过，改种子文件不会回头更新。
-- 只改仍停留在旧默认值 30 的行，管理员后来手工改过的天数保持不动。

UPDATE system_config
SET value = '7',
    updated_at = NOW()
WHERE key = 'remember_session_days'
  AND value = '30';
