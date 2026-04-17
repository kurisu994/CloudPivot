'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invoke, isTauriEnv } from '@/lib/tauri'

interface BomCopyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceId: number | null
  onSuccess: () => void
}

/**
 * BOM 复制新版本弹窗
 */
export function BomCopyDialog({ open, onOpenChange, sourceId, onSuccess }: BomCopyDialogProps) {
  const t = useTranslations('bom')
  const [newVersion, setNewVersion] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCopy = async () => {
    if (!newVersion.trim()) return
    if (!sourceId) return

    setSaving(true)
    if (!isTauriEnv()) {
      await new Promise(r => setTimeout(r, 300))
      toast.success(t('notifications.copyBomSuccess'))
      setNewVersion('')
      onSuccess()
      setSaving(false)
      return
    }

    try {
      await invoke('copy_bom', { sourceId, newVersion: newVersion.trim() })
      toast.success(t('notifications.copyBomSuccess'))
      setNewVersion('')
      onSuccess()
    } catch (e) {
      toast.error(typeof e === 'string' ? e : t('notifications.copyBomFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('copyDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t('copyDialog.newVersion')}</Label>
            <Input
              placeholder={t('copyDialog.placeholder')}
              value={newVersion}
              onChange={e => setNewVersion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCopy()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleCopy} disabled={!newVersion.trim() || saving}>
            {saving ? '...' : t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
