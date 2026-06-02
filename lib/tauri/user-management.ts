/**
 * 用户管理 IPC 封装
 *
 * 提供用户 CRUD、角色查询、权限获取等前端调用接口。
 */

import { invoke, type PaginatedResponse, type PermissionItem } from './core'

// ================================================================
// 类型定义
// ================================================================

/** 用户列表项 */
export interface UserListItem {
  id: number
  username: string
  displayName: string
  role: string
  roleId: number
  email: string | null
  phone: string | null
  isEnabled: boolean
  isLocked: boolean
  lastLoginAt: string | null
  createdAt: string
}

/** 用户详情 */
export interface UserDetail {
  id: number
  username: string
  displayName: string
  role: string
  roleId: number
  email: string | null
  phone: string | null
  remark: string | null
  isEnabled: boolean
  isLocked: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

/** 角色信息 */
export interface RoleInfo {
  id: number
  code: string
  name: string
  description: string | null
  isSystem: boolean
}

/** 用户列表筛选参数 */
export interface UserFilter {
  keyword?: string
  role?: string
  status?: string
  page: number
  pageSize: number
}

/** 创建/编辑用户请求 */
export interface SaveUserRequest {
  id?: number
  username: string
  displayName: string
  roleId: number
  email?: string | null
  phone?: string | null
  remark?: string | null
}

// ================================================================
// IPC 命令
// ================================================================

/** 获取用户列表 */
export async function getUsers(filter: UserFilter): Promise<PaginatedResponse<UserListItem>> {
  return invoke<PaginatedResponse<UserListItem>>('get_users', { filter })
}

/** 获取用户详情 */
export async function getUserDetail(userId: number): Promise<UserDetail> {
  return invoke<UserDetail>('get_user_detail', { userId })
}

/** 创建用户 */
export async function createUser(request: SaveUserRequest): Promise<number> {
  return invoke<number>('create_user', { request })
}

/** 编辑用户 */
export async function updateUser(request: SaveUserRequest): Promise<void> {
  return invoke<void>('update_user', { request })
}

/** 删除用户 */
export async function deleteUser(userId: number): Promise<void> {
  return invoke<void>('delete_user', { userId })
}

/** 启用/禁用用户 */
export async function toggleUserStatus(userId: number, isEnabled: boolean): Promise<void> {
  return invoke<void>('toggle_user_status', { userId, isEnabled })
}

/** 重置用户密码 */
export async function resetUserPassword(userId: number): Promise<void> {
  return invoke<void>('reset_user_password', { userId })
}

/** 解锁用户 */
export async function unlockUser(userId: number): Promise<void> {
  return invoke<void>('unlock_user', { userId })
}

/** 获取角色列表 */
export async function getRoles(): Promise<RoleInfo[]> {
  return invoke<RoleInfo[]>('get_roles')
}

/** 获取当前用户权限列表 */
export async function getCurrentUserPermissions(): Promise<PermissionItem[]> {
  return invoke<PermissionItem[]>('get_current_user_permissions')
}
