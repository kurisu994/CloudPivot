import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM && process.env.npm_lifecycle_event === 'build')

/**
 * Next.js 配置
 *
 * 注意：Tauri 生产构建需要 SSG（output: export），但开发模式不需要。
 * 构建时通过 package.json 的 build 脚本自动处理。
 */
const nextConfig: NextConfig = {
  // Tauri dev 同样注入 TAURI_ENV_PLATFORM，仅在构建脚本执行时启用 SSG
  output: isTauriBuild ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
}

export default withNextIntl(nextConfig)
