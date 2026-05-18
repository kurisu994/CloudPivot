'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect } from 'react'

/**
 * 关闭输入框的自动大写、自动纠错和拼写检查
 *
 * macOS / iOS 的 WebView 默认会对 input/textarea 启用首字母大写和拼写纠错，
 * 对于进销存系统的编码、数量等输入场景不适用。
 */
function disableTextInputAssistance(root: ParentNode): void {
  root.querySelectorAll('input, textarea').forEach(element => {
    element.setAttribute('autocapitalize', 'off')
    element.setAttribute('autocorrect', 'off')
    element.setAttribute('spellcheck', 'false')
  })
}

/**
 * 主题 Provider — 封装 next-themes
 *
 * 支持 light/dark/system 三种模式。
 * 同时全局禁用输入框的自动大写/纠错/拼写检查。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 监听动态添加的 input/textarea（Dialog、下拉等），统一关闭文本辅助
  useEffect(() => {
    disableTextInputAssistance(document)

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches('input, textarea')) {
            disableTextInputAssistance(node.parentElement ?? document)
          } else {
            disableTextInputAssistance(node)
          }
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
