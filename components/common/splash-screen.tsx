"use client";

import Image from "next/image";

/**
 * 品牌级全屏闪屏组件
 *
 * 在认证状态恢复 / 路由守卫跳转期间展示，
 * 避免未授权页面闪烁，同时传递品牌形象。
 */
export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      {/* 背景装饰 — 与登录页风格统一 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* 右上光晕 */}
        <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-[#294985]/8 blur-3xl dark:bg-[#294985]/15 animate-[splash-glow_3s_ease-in-out_infinite]" />
        {/* 左下光晕 */}
        <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-[#294985]/8 blur-3xl dark:bg-[#294985]/15 animate-[splash-glow_3s_ease-in-out_infinite_1.5s]" />
        {/* 点阵纹理 */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #294985 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* 主内容 */}
      <div className="relative flex flex-col items-center animate-[splash-fade-in_0.6s_ease-out]">
        {/* Logo */}
        <div className="mb-5 animate-[splash-float_2.5s_ease-in-out_infinite]">
          {/* 浅色 logo */}
          <Image
            src="/cloudpivot_logo.png"
            alt="CloudPivot"
            width={64}
            height={56}
            className="h-14 w-auto object-contain dark:hidden"
            style={{ width: "auto" }}
            priority
          />
          {/* 深色 logo */}
          <Image
            src="/cloudpivot_logo_dark.png"
            alt="CloudPivot"
            width={64}
            height={56}
            className="hidden h-14 w-auto object-contain dark:block"
            style={{ width: "auto" }}
            priority
          />
        </div>

        {/* 品牌名称 */}
        <h1
          className="text-xl font-extrabold tracking-tight text-[#294985] dark:text-slate-100"
          style={{ fontFamily: "var(--font-noto-sans-sc), system-ui" }}
        >
          云枢{" "}
          <span
            className="font-bold"
            style={{ fontFamily: "var(--font-brand), system-ui" }}
          >
            CloudPivot
          </span>
        </h1>
        <p className="mt-1.5 text-xs tracking-widest text-muted-foreground uppercase">
          Inventory Management System
        </p>

        {/* 加载指示器 — 三段式脉冲进度条 */}
        <div className="mt-8 flex items-center gap-1.5">
          <div className="h-1 w-6 rounded-full bg-[#294985]/20 dark:bg-slate-700 overflow-hidden">
            <div className="h-full w-full rounded-full bg-[#294985] dark:bg-[#d4956a] animate-[splash-bar_1.4s_ease-in-out_infinite]" />
          </div>
          <div className="h-1 w-6 rounded-full bg-[#294985]/20 dark:bg-slate-700 overflow-hidden">
            <div className="h-full w-full rounded-full bg-[#294985] dark:bg-[#d4956a] animate-[splash-bar_1.4s_ease-in-out_infinite_0.2s]" />
          </div>
          <div className="h-1 w-6 rounded-full bg-[#294985]/20 dark:bg-slate-700 overflow-hidden">
            <div className="h-full w-full rounded-full bg-[#294985] dark:bg-[#d4956a] animate-[splash-bar_1.4s_ease-in-out_infinite_0.4s]" />
          </div>
        </div>
      </div>
    </div>
  );
}
