/**
 * 打印单页容器（14×22cm 固定纸面）
 *
 * 仅负责"应用打印 CSS 类、限定单页边界"，业务渲染由 PrintRenderer 提供。
 * 屏幕上预览时容器尺寸 = 1:1，scale 由父组件控制（设计器实时预览缩放）。
 */
import type { ReactNode } from 'react'

interface PrintPageProps {
  children: ReactNode
  /** 仅供预览时使用的缩放比例（默认 1） */
  previewScale?: number
}

export function PrintPage({ children, previewScale = 1 }: PrintPageProps) {
  return (
    <div
      className="print-page"
      style={{
        // 14×22cm 物理尺寸
        width: '14cm',
        height: '22cm',
        transform: previewScale !== 1 ? `scale(${previewScale})` : undefined,
        transformOrigin: 'top left',
      }}
    >
      {children}
    </div>
  )
}
