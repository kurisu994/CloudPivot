/**
 * Tauri IPC 通信封装
 *
 * 封装前端与 Rust 后端的通信接口。
 * 在浏览器环境下（开发模式无 Tauri）提供 mock 降级。
 */

// ================================================================
// 类型定义
// ================================================================

/** 用户信息（对应 Rust UserInfo） */
export interface UserInfo {
  id: number;
  username: string;
  display_name: string;
  role: "admin" | "operator";
  must_change_password: boolean;
  session_version: number;
}

/** 登录响应 */
export interface LoginResponse {
  user: UserInfo;
  must_change_password: boolean;
}

// ================================================================
// 底层通信
// ================================================================

/**
 * 判断是否运行在 Tauri 环境中
 */
export function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * 调用 Tauri IPC 命令
 *
 * @param command - 命令名称（对应 Rust #[tauri::command] 函数名）
 * @param args - 传递给命令的参数
 * @returns 命令返回值
 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnv()) {
    console.warn(`[Tauri] 非 Tauri 环境，跳过命令: ${command}`);
    throw new Error(`Command "${command}" is not available outside Tauri environment`);
  }

  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(command, args);
}

// ================================================================
// 通用命令
// ================================================================

/** ping 测试 — 验证前后端通信链路 */
export async function ping(): Promise<string> {
  return invoke<string>("ping");
}

/** 获取数据库版本号 */
export async function getDbVersion(): Promise<number> {
  return invoke<number>("get_db_version");
}

// ================================================================
// 认证命令
// ================================================================

/** 用户登录 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  return invoke<LoginResponse>("login", {
    request: { username, password },
  });
}

/** 修改密码 */
export async function changePassword(userId: number, newPassword: string): Promise<void> {
  return invoke<void>("change_password", {
    request: { user_id: userId, new_password: newPassword },
  });
}

/** 获取用户信息 */
export async function getUserInfo(userId: number): Promise<UserInfo> {
  return invoke<UserInfo>("get_user_info", { user_id: userId });
}

// ================================================================
// 系统配置命令
// ================================================================

/** 系统配置记录 */
export interface SystemConfigRecord {
  key: string;
  value: string;
  remark?: string;
}

/** localStorage 中系统配置的存储键前缀（web 调试模式降级用） */
const CONFIG_STORAGE_PREFIX = "cloudpivot_config_";

/**
 * 批量获取系统配置
 *
 * Tauri 环境调用后端 IPC；web 调试模式从 localStorage 读取。
 */
export async function getSystemConfigs(keys: string[]): Promise<SystemConfigRecord[]> {
  if (isTauriEnv()) {
    return invoke<SystemConfigRecord[]>("get_system_configs", { keys });
  }

  // Web 调试模式：从 localStorage 降级读取
  const records: SystemConfigRecord[] = [];
  for (const key of keys) {
    const stored = localStorage.getItem(CONFIG_STORAGE_PREFIX + key);
    if (stored !== null) {
      records.push({ key, value: stored });
    }
  }
  return records;
}

/**
 * 设置单个系统配置（upsert）
 *
 * Tauri 环境调用后端 IPC；web 调试模式写入 localStorage。
 */
export async function setSystemConfig(key: string, value: string): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>("set_system_config", { key, value });
  }

  // Web 调试模式：写入 localStorage
  localStorage.setItem(CONFIG_STORAGE_PREFIX + key, value);
}

/**
 * 批量设置系统配置
 *
 * Tauri 环境调用后端 IPC；web 调试模式写入 localStorage。
 */
export async function setSystemConfigs(configs: { key: string; value: string }[]): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>("set_system_configs", { configs });
  }

  // Web 调试模式：写入 localStorage
  for (const { key, value } of configs) {
    localStorage.setItem(CONFIG_STORAGE_PREFIX + key, value);
  }
}

// ================================================================
// 仓库命令（向导专用）
// ================================================================

/** 向导：仓库创建参数 */
export interface WarehouseSetupItem {
  name: string;
  warehouse_type: "raw" | "semi" | "finished";
  manager?: string;
}

/**
 * 向导：批量创建仓库并生成默认仓映射
 *
 * Tauri 环境调用后端 IPC；web 调试模式写入 localStorage 模拟。
 */
export async function setupCreateWarehouses(warehouses: WarehouseSetupItem[]): Promise<void> {
  if (isTauriEnv()) {
    return invoke<void>("setup_create_warehouses", { warehouses });
  }

  // Web 调试模式：模拟仓库创建
  const existing = localStorage.getItem("cloudpivot_warehouses");
  const list = existing ? JSON.parse(existing) : [];
  for (const wh of warehouses) {
    list.push({ ...wh, id: Date.now() + Math.random() });
  }
  localStorage.setItem("cloudpivot_warehouses", JSON.stringify(list));
}

