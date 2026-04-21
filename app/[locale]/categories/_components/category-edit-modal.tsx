'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CategoryNode } from '@/lib/tauri'
import { createCategory, getCategoryTree, updateCategory } from '@/lib/tauri'

/* ------------------------------------------------------------------ */
/*  组件 Props                                                         */
/* ------------------------------------------------------------------ */

interface CategoryEditModalProps {
  /** 弹窗开启状态 */
  open: boolean
  /** 控制弹窗开关 */
  onOpenChange: (open: boolean) => void
  /** 编辑的分类数据，为 null 表示新增 */
  editingCategory: CategoryNode | null
  /** 保存/创建成功回调 */
  onSuccess: () => void
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export function CategoryEditModal({ open, onOpenChange, editingCategory, onSuccess }: CategoryEditModalProps) {
  const t = useTranslations('categories')
  const tc = useTranslations('common')

  // 表单状态
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [sortOrder, setSortOrder] = useState('0')
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)

  // 可选的父级分类列表
  const [allCategories, setAllCategories] = useState<CategoryNode[]>([])

  /** 加载全部分类（用于「上级分类」下拉） */
  useEffect(() => {
    if (open) {
      getCategoryTree().then(setAllCategories).catch(console.error)
    }
  }, [open])

  /** 编辑模式下回填表单 */
  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name)
      setParentId(editingCategory.parent_id ? editingCategory.parent_id.toString() : '')
      setSortOrder(editingCategory.sort_order.toString())
      setRemark(editingCategory.remark ?? '')
    } else {
      setName('')
      setParentId('')
      setSortOrder('0')
      setRemark('')
    }
  }, [editingCategory, open])

  /** 过滤掉当前编辑项自身及其子级（防止循环引用） */
  const parentOptions = useMemo(() => {
    if (!editingCategory) return allCategories

    const currentId = editingCategory.id
    const currentPath = editingCategory.path ?? currentId.toString()

    return allCategories.filter(cat => {
      if (cat.id === currentId) return false
      // 过滤掉子级：如果某个分类的 path 以当前分类的 path 开头
      if (cat.path && cat.path.startsWith(currentPath + '/')) return false
      return true
    })
  }, [allCategories, editingCategory])

  /** 构建 Select items（base-nova 要求传 items） */
  const parentSelectItems = useMemo(
    () => [
      { value: '', label: t('noParent') },
      ...parentOptions.map(c => ({
        value: c.id.toString(),
        label: `${'　'.repeat(c.level - 1)}${c.name}`,
      })),
    ],
    [parentOptions, t],
  )

  /** 提交表单 */
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t('nameRequired'))
      return
    }

    setSaving(true)
    try {
      if (editingCategory) {
        // 更新
        await updateCategory({
          id: editingCategory.id,
          name: name.trim(),
          parent_id: parentId ? parseInt(parentId) : null,
          sort_order: parseInt(sortOrder) || 0,
          remark: remark.trim() || undefined,
        })
      } else {
        // 创建
        await createCategory({
          name: name.trim(),
          parent_id: parentId ? parseInt(parentId) : null,
          sort_order: parseInt(sortOrder) || 0,
          remark: remark.trim() || undefined,
        })
      }
      toast.success(t('saveSuccess'))
      onSuccess()
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const isEdit = !!editingCategory

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editCategory') : t('addCategory')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* 分类名称 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">
              {t('categoryName')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('categoryName')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* 上级分类 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="parent-category">{t('parentCategory')}</Label>
            <Select value={parentId} onValueChange={value => setParentId(value ?? '')} items={parentSelectItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('noParent')} />
              </SelectTrigger>
              <SelectContent>
                {parentSelectItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 排序号 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sort-order">{t('sortOrder')}</Label>
            <Input id="sort-order" type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} placeholder="0" />
          </div>

          {/* 备注 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-remark">{t('remark')}</Label>
            <Input id="category-remark" value={remark} onChange={e => setRemark(e.target.value)} placeholder={t('remark')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? tc('loading') : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
