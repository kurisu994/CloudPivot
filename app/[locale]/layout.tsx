import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { AboutDialog } from '@/components/common/about-dialog'
import { NativeMenuBridge } from '@/components/common/native-menu-bridge'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthProvider } from '@/components/providers/auth-provider'
import { DisplayPreferencesProvider } from '@/components/providers/display-preferences-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { locales } from '@/i18n/config'

/**
 * 为 SSG 模式生成所有语言的静态页面
 */
export function generateStaticParams() {
  return locales.map(locale => ({ locale }))
}

/**
 * 带 i18n 的 Locale 布局
 *
 * 包含：
 * - next-intl Provider（注入翻译消息）
 * - ThemeProvider（主题切换）
 * - AuthProvider（认证上下文 + 路由守卫）
 * - DisplayPreferencesProvider（显示偏好：紧凑视图 / 大字体 / 侧边栏自动收起）
 * - AppLayout（侧边栏 + 顶栏 + 主内容区）
 */
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider>
        <AuthProvider>
          <DisplayPreferencesProvider>
            <AppLayout>{children}</AppLayout>
          </DisplayPreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
      <AboutDialog />
      <NativeMenuBridge />
      <Toaster />
    </NextIntlClientProvider>
  )
}
