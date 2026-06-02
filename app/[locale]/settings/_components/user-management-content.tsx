'use client'

import { KeyRound, Lock, LockOpen, Pencil, Plus, Search, Shield, ShieldAlert, Trash2, UserCog, Users2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PaginationControls } from '@/components/common/pagination'
import { useAuth } from '@/components/providers/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/error'
import {
  createUser,
  deleteUser,
  getRoles,
  getUsers,
  type RoleInfo,
  resetUserPassword,
  type SaveUserRequest,
  toggleUserStatus,
  type UserListItem,
  unlockUser,
  updateUser,
} from '@/lib/tauri/user-management'
import { cn } from '@/lib/utils'

/** 用户管理主页面 */
export function UserManagementContent() {
  const t = useTranslations('settings.userManagement')
  const tc = useTranslations('common')
  const { user: currentUser } = useAuth()

  // 列表状态
  const [users, setUsers] = useState<UserListItem[]>([])
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  // 弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [saving, setSaving] = useState(false)

  // 表单状态
  const [formUsername, setFormUsername] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formRoleId, setFormRoleId] = useState<number | null>(null)
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRemark, setFormRemark] = useState('')

  // 确认弹窗
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'delete' | 'reset' | 'toggle' | 'unlock'
    userId: number
    userName: string
    extra?: boolean
  }>({ open: false, type: 'delete', userId: 0, userName: '' })

  /** 获取角色列表 */
  useEffect(() => {
    void getRoles().then(setRoles).catch(console.error)
  }, [])

  /** 角色 Select items */
  const roleFilterOptions = [{ value: '', label: tc('all') }, ...roles.map(r => ({ value: r.code, label: getRoleLabel(r.code, t) }))]

  const roleFormOptions = roles.map(r => ({ value: String(r.id), label: getRoleLabel(r.code, t) }))

  /** 获取用户列表 */
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUsers({
        keyword: keyword || undefined,
        role: roleFilter || undefined,
        page,
        pageSize,
      })
      setUsers(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error('查询用户失败:', e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, roleFilter])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  /** 打开新建弹窗 */
  const openCreateDialog = () => {
    setEditingUser(null)
    setFormUsername('')
    setFormDisplayName('')
    setFormRoleId(roles.find(r => r.code === 'operator')?.id ?? roles[0]?.id ?? null)
    setFormEmail('')
    setFormPhone('')
    setFormRemark('')
    setDialogOpen(true)
  }

  /** 打开编辑弹窗 */
  const openEditDialog = (user: UserListItem) => {
    setEditingUser(user)
    setFormUsername(user.username)
    setFormDisplayName(user.displayName)
    setFormRoleId(user.roleId)
    setFormEmail(user.email ?? '')
    setFormPhone(user.phone ?? '')
    setFormRemark('')
    setDialogOpen(true)
  }

  /** 保存用户 */
  const handleSave = async () => {
    if (!formUsername.trim() || !formDisplayName.trim() || !formRoleId) {
      toast.error(t('fieldRequired'))
      return
    }

    setSaving(true)
    try {
      const request: SaveUserRequest = {
        id: editingUser?.id,
        username: formUsername.trim(),
        displayName: formDisplayName.trim(),
        roleId: formRoleId,
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        remark: formRemark.trim() || null,
      }

      if (editingUser) {
        await updateUser(request)
        toast.success(t('updateSuccess'))
      } else {
        await createUser(request)
        toast.success(t('createSuccess'))
      }
      setDialogOpen(false)
      void fetchUsers()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  /** 确认操作 */
  const handleConfirmAction = async () => {
    const { type, userId, extra } = confirmDialog
    try {
      switch (type) {
        case 'delete':
          await deleteUser(userId)
          toast.success(t('deleteSuccess'))
          break
        case 'reset':
          await resetUserPassword(userId)
          toast.success(t('resetSuccess'))
          break
        case 'toggle':
          await toggleUserStatus(userId, !!extra)
          toast.success(extra ? t('enableSuccess') : t('disableSuccess'))
          break
        case 'unlock':
          await unlockUser(userId)
          toast.success(t('unlockSuccess'))
          break
      }
      setConfirmDialog({ ...confirmDialog, open: false })
      void fetchUsers()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users2 className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('title')}</h2>
            <p className="text-xs text-slate-500">{t('description')}</p>
          </div>
        </div>
        <Button className="gap-2 font-bold" onClick={openCreateDialog}>
          <Plus className="size-4" />
          {t('createUser')}
        </Button>
      </div>

      {/* 筛选区 */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder={t('searchPlaceholder')} value={keyword} onChange={e => setKeyword(e.target.value)} className="h-9 pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={v => setRoleFilter(v ?? '')} items={roleFilterOptions}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder={t('allRoles')} />
          </SelectTrigger>
          <SelectContent>
            {roleFilterOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 用户列表 */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                <TableHead className="px-6 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('username')}</TableHead>
                <TableHead className="px-6 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('displayName')}</TableHead>
                <TableHead className="px-6 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('role')}</TableHead>
                <TableHead className="px-6 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('status')}</TableHead>
                <TableHead className="px-6 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t('lastLoginAt')}</TableHead>
                <TableHead className="px-6 py-3.5 text-right text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  {tc('actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                    {tc('loading')}
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                    {tc('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                users.map(u => (
                  <TableRow
                    key={u.id}
                    className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    {/* 用户名 */}
                    <TableCell className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {u.displayName.slice(0, 1)}
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{u.username}</span>
                      </div>
                    </TableCell>
                    {/* 显示名 */}
                    <TableCell className="px-6 py-3.5 text-sm text-slate-700 dark:text-slate-300">{u.displayName}</TableCell>
                    {/* 角色 */}
                    <TableCell className="px-6 py-3.5">
                      <RoleBadge role={u.role} t={t} />
                    </TableCell>
                    {/* 状态 */}
                    <TableCell className="px-6 py-3.5">
                      <StatusBadge isEnabled={u.isEnabled} isLocked={u.isLocked} t={t} />
                    </TableCell>
                    {/* 最后登录 */}
                    <TableCell className="px-6 py-3.5 text-sm text-slate-500">{u.lastLoginAt?.replace('T', ' ').slice(0, 16) ?? '--'}</TableCell>
                    {/* 操作列 */}
                    <TableCell className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* 编辑 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 text-slate-500 hover:text-primary"
                          onClick={() => openEditDialog(u)}
                          title={t('editUser')}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {/* 启禁用 */}
                        {u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'size-8 p-0',
                              u.isEnabled ? 'text-slate-500 hover:text-amber-600' : 'text-slate-500 hover:text-emerald-600',
                            )}
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                type: 'toggle',
                                userId: u.id,
                                userName: u.displayName,
                                extra: !u.isEnabled,
                              })
                            }
                            title={u.isEnabled ? t('disableUser') : t('enableUser')}
                          >
                            {u.isEnabled ? <ShieldAlert className="size-3.5" /> : <Shield className="size-3.5" />}
                          </Button>
                        )}
                        {/* 重置密码 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 text-slate-500 hover:text-orange-600"
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              type: 'reset',
                              userId: u.id,
                              userName: u.displayName,
                            })
                          }
                          title={t('resetPassword')}
                        >
                          <KeyRound className="size-3.5" />
                        </Button>
                        {/* 解锁（仅锁定时显示） */}
                        {u.isLocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-amber-500 hover:text-amber-700"
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                type: 'unlock',
                                userId: u.id,
                                userName: u.displayName,
                              })
                            }
                            title={t('unlockUser')}
                          >
                            <LockOpen className="size-3.5" />
                          </Button>
                        )}
                        {/* 删除 */}
                        {u.id !== 1 && u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-slate-500 hover:text-red-600"
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                type: 'delete',
                                userId: u.id,
                                userName: u.displayName,
                              })
                            }
                            title={t('deleteUser')}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <span className="text-xs font-bold text-slate-400">{tc('totalRecords', { count: total })}</span>
          <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
        </div>
      </section>

      {/* 创建/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-5" />
              {editingUser ? t('editUser') : t('createUser')}
            </DialogTitle>
            <DialogDescription>{editingUser ? t('editUserDesc') : t('createUserDesc')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* 用户名 */}
            <div className="grid gap-2">
              <Label>{t('username')}</Label>
              <Input
                value={formUsername}
                onChange={e => setFormUsername(e.target.value)}
                disabled={!!editingUser}
                placeholder={t('usernamePlaceholder')}
              />
            </div>
            {/* 显示名 */}
            <div className="grid gap-2">
              <Label>{t('displayName')}</Label>
              <Input value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} placeholder={t('displayNamePlaceholder')} />
            </div>
            {/* 角色 */}
            <div className="grid gap-2">
              <Label>{t('role')}</Label>
              <Select value={formRoleId ? String(formRoleId) : ''} onValueChange={v => setFormRoleId(v ? Number(v) : null)} items={roleFormOptions}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  {roleFormOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 邮箱 */}
            <div className="grid gap-2">
              <Label>{t('email')}</Label>
              <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} type="email" placeholder={t('emailPlaceholder')} />
            </div>
            {/* 电话 */}
            <div className="grid gap-2">
              <Label>{t('phone')}</Label>
              <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder={t('phonePlaceholder')} />
            </div>
            {/* 备注 */}
            <div className="grid gap-2">
              <Label>{t('remark')}</Label>
              <Input value={formRemark} onChange={e => setFormRemark(e.target.value)} placeholder={t('remarkPlaceholder')} />
            </div>

            {/* 初始密码提示（仅新建） */}
            {!editingUser && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
                <Lock className="size-3.5 shrink-0" />
                {t('initialPasswordHint')}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline">{tc('cancel')}</Button>} />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认操作 Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={open => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === 'delete' && t('confirmDeleteTitle')}
              {confirmDialog.type === 'reset' && t('confirmResetTitle')}
              {confirmDialog.type === 'toggle' && (confirmDialog.extra ? t('confirmEnableTitle') : t('confirmDisableTitle'))}
              {confirmDialog.type === 'unlock' && t('confirmUnlockTitle')}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'delete' && t('confirmDelete', { name: confirmDialog.userName })}
              {confirmDialog.type === 'reset' && t('confirmReset', { name: confirmDialog.userName })}
              {confirmDialog.type === 'toggle' &&
                (confirmDialog.extra ? t('confirmEnable', { name: confirmDialog.userName }) : t('confirmDisable', { name: confirmDialog.userName }))}
              {confirmDialog.type === 'unlock' && t('confirmUnlock', { name: confirmDialog.userName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">{tc('cancel')}</Button>} />
            <Button variant={confirmDialog.type === 'delete' ? 'destructive' : 'default'} onClick={handleConfirmAction}>
              {tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ================================================================
// 子组件
// ================================================================

/** 角色显示名 */
function getRoleLabel(role: string, t: ReturnType<typeof useTranslations>): string {
  const map: Record<string, string> = {
    admin: t('admin'),
    operator: t('operator'),
    viewer: t('viewer'),
  }
  return map[role] ?? role
}

/** 角色 Badge */
function RoleBadge({ role, t }: { role: string; t: ReturnType<typeof useTranslations> }) {
  const styles: Record<string, string> = {
    admin: 'bg-primary/10 text-primary border-primary/20',
    operator: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    viewer: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700',
  }
  return (
    <Badge variant="outline" className={cn('text-[11px] font-bold', styles[role] ?? styles.viewer)}>
      {getRoleLabel(role, t)}
    </Badge>
  )
}

/** 状态 Badge */
function StatusBadge({ isEnabled, isLocked, t }: { isEnabled: boolean; isLocked: boolean; t: ReturnType<typeof useTranslations> }) {
  if (isLocked) {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-[11px] font-bold text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
      >
        {t('locked')}
      </Badge>
    )
  }
  if (!isEnabled) {
    return (
      <Badge
        variant="outline"
        className="border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
      >
        {t('disabled')}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
    >
      {t('enabled')}
    </Badge>
  )
}
