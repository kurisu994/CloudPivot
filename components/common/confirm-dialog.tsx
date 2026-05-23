'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslations } from 'next-intl'

interface ConfirmDialogProps {
  /** 对话框是否打开 */
  open: boolean
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void
  /** 标题 */
  title: string
  /** 描述内容（可选，显示在标题下方） */
  description?: string
  /** 确认按钮文本 */
  confirmText?: string
  /** 取消按钮文本 */
  cancelText?: string
  /** 确认按钮是否为危险操作样式 */
  destructive?: boolean
  /** 确认按钮前的图标 */
  confirmIcon?: React.ReactNode
  /** 确认回调（支持异步，执行期间按钮会显示 loading 状态） */
  onConfirm: () => void | Promise<void>
}

/**
 * 通用确认对话框，替代 window.confirm()
 *
 * Tauri WebView 中原生 confirm() 不可靠，使用此组件确保一致的确认交互。
 * 风格对齐分类管理等已有删除确认弹窗。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  destructive = false,
  confirmIcon,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations('common')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // 错误由调用方在 onConfirm 中处理
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelText || t('cancel')}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={() => void handleConfirm()} disabled={loading}>
            {confirmIcon}
            {confirmText || t('confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
