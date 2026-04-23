'use client'

import { ArrowRight, Eye, EyeOff, Info, Lock, User } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { AppFooter } from '@/components/layout/app-footer'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { type Locale, localeFlags, localeNames, locales } from '@/i18n/config'
import { useRouter } from '@/i18n/navigation'

/**
 * 登录页面组件
 *
 * 对接 Rust 后端认证 API，支持：
 * - 用户名密码登录
 * - 记住我
 * - 语言选择
 * - 首次登录强制改密跳转
 * - 登录失败提示（含锁定信息）
 */
export default function LoginPage() {
  const t = useTranslations('login')
  const tc = useTranslations('common')
  const router = useRouter()
  const { login } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [selectedLocale, setSelectedLocale] = useState<Locale>('zh')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  /** 处理登录提交 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setIsLoading(true)

    try {
      const result = await login(username, password)

      if (result.success) {
        if (result.mustChangePassword) {
          // 首次登录 → 强制改密
          router.push('/change-password')
        } else {
          router.push('/')
        }
      } else {
        // 登录失败，显示错误
        setErrorMessage(result.error || t('loginFailed'))
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('loginFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#294985]/5 blur-3xl dark:bg-[#294985]/10" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#294985]/5 blur-3xl dark:bg-[#294985]/10" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
          style={{
            backgroundImage: 'radial-gradient(circle, #294985 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* 主内容区域 */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          {/* 登录卡片 */}
          <Card className="border-slate-200/80 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:shadow-slate-900/50">
            <CardContent className="px-8 py-10">
              {/* Logo & 标题 */}
              <div className="mb-8 flex flex-col items-center">
                <div className="mb-4">
                  <Image
                    src="/cloudpivot_logo.png"
                    alt="CloudPivot"
                    width={56}
                    height={48}
                    className="h-12 w-auto object-contain dark:hidden"
                    priority
                  />
                  <Image
                    src="/cloudpivot_logo_dark.png"
                    alt="CloudPivot"
                    width={56}
                    height={48}
                    className="hidden h-12 w-auto object-contain dark:block"
                    priority
                  />
                </div>
                <h1
                  className="text-xl font-extrabold tracking-tight text-[#294985] dark:text-slate-100"
                  style={{ fontFamily: 'var(--font-noto-sans-sc), system-ui' }}
                >
                  {tc('systemName').split(' ')[0]}{' '}
                  <span className="font-bold" style={{ fontFamily: 'var(--font-brand), system-ui' }}>
                    ({tc('systemName').substring(tc('systemName').indexOf(' ') + 1)})
                  </span>
                </h1>
                <p className="text-muted-foreground mt-1.5 text-sm">{t('welcome')}</p>
              </div>

              {/* 错误提示 */}
              {errorMessage && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/30 dark:text-red-400">
                  {errorMessage}
                </div>
              )}

              {/* 表单 */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 用户名 */}
                <div className="space-y-1.5">
                  <Label htmlFor="login-username">
                    {t('username')} <span className="text-muted-foreground font-normal">(Username)</span>
                  </Label>
                  <div className="relative">
                    <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={e => {
                        setUsername(e.target.value)
                        setErrorMessage('')
                      }}
                      placeholder={t('usernamePlaceholder')}
                      className="h-11 pl-10"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                {/* 密码 */}
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">
                    {t('password')} <span className="text-muted-foreground font-normal">(Password)</span>
                  </Label>
                  <div className="relative">
                    <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value)
                        setErrorMessage('')
                      }}
                      placeholder={t('passwordPlaceholder')}
                      className="h-11 pr-11 pl-10"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* 语言选择 */}
                <div className="space-y-1.5">
                  <Label htmlFor="login-language">
                    {t('language')} <span className="text-muted-foreground font-normal">(Language)</span>
                  </Label>
                  <Select value={selectedLocale} onValueChange={v => setSelectedLocale(v as Locale)}>
                    <SelectTrigger id="login-language" className="h-11 w-full">
                      <span className="flex items-center gap-2">
                        <span className="text-base leading-none">{localeFlags[selectedLocale]}</span>
                        {localeNames[selectedLocale]}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {locales.map(locale => (
                        <SelectItem key={locale} value={locale}>
                          <span className="text-base leading-none">{localeFlags[locale]}</span>
                          {localeNames[locale]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 记住我 */}
                <div className="flex items-center gap-2">
                  <Checkbox id="login-remember" checked={rememberMe} onCheckedChange={checked => setRememberMe(checked as boolean)} />
                  <Label htmlFor="login-remember" className="cursor-pointer font-normal">
                    {t('rememberMe')}
                  </Label>
                </div>

                {/* 登录按钮 */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="group h-12 w-full bg-[#294985] text-sm font-semibold shadow-lg shadow-[#294985]/25 hover:bg-[#1e3a6e] dark:bg-[#3b5da0] dark:shadow-[#3b5da0]/25 dark:hover:bg-[#4a6db5]"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      {t('submit')}
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 提示信息 */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3.5 dark:border-blue-900/30 dark:bg-blue-950/30">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#294985] dark:text-[#6b85c1]" />
            <p className="text-[13px] leading-relaxed text-[#294985] dark:text-[#8ba3d4]">
              {t('hint', {
                username: 'admin',
                password: 'admin123',
              })}
            </p>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <AppFooter className="relative z-10" />
    </div>
  )
}
