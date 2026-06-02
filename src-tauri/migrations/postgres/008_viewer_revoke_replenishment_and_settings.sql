-- 008_viewer_revoke_replenishment_and_settings.sql
-- 收回查看者（viewer）角色对「智能补货」以及除「外观设置」之外的设置类权限
--
-- 背景：
--   1. 智能补货涉及供应链决策建议，不应对只读角色开放。
--   2. 设置模块下查看者仅保留外观偏好（个人主题/语言等），其他通用设置一律不开放。

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'viewer')
  AND permission_id IN (
    SELECT id FROM permissions
    WHERE module = 'replenishment'
       OR module = 'settings_general'
  );
