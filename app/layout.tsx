import type { Metadata } from 'next'
import { Inter, Noto_Sans_SC, Raleway } from 'next/font/google'
import './globals.css'

/** 主字体 — Inter */
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
})

/** 中文回退字体 — Noto Sans SC */
const notoSansSC = Noto_Sans_SC({
  variable: '--font-noto-sans-sc',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

/** 品牌字体 — Raleway，用于 Logo 旁的品牌名称 */
const raleway = Raleway({
  variable: '--font-brand',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '云枢 CloudPivot IMS',
  description: '越南家具工厂进销存管理系统',
}

/**
 * 根布局 — 全局字体和 HTML 结构
 *
 * 只负责 HTML 壳子，不包含业务布局
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html suppressHydrationWarning className={`${inter.variable} ${notoSansSC.variable} ${raleway.variable} h-full antialiased`}>
      <head>
        {/* 主题初始化脚本：在 body 渲染前同步设置 class，避免闪烁。
            放在服务端组件的 <head> 中可消除 React 19 的 script 标签警告。 */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="h-full">{children}</body>
    </html>
  )
}
