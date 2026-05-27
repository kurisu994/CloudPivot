import { SettingsTabNav } from './_components/settings-tab-nav'

/**
 * 系统设置模块共享布局 — Tab 导航栏 + 子页面内容
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-6">
      <SettingsTabNav />
      {children}
    </div>
  )
}
