"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  UserPlus,
  FileText,
  PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface StepCompleteProps {
  onPrev: () => void;
  onEnter: () => void;
  isLoading: boolean;
}

/** 推荐操作卡片 */
function ActionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}) {
  const router = useRouter();

  return (
    <div
      className="group cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 p-6 transition-all duration-300 hover:border-[#294985]/50 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-blue-500/50"
      onClick={() => router.push(href)}
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-[#294985]/10 text-[#294985] transition-colors group-hover:bg-[#294985] group-hover:text-white dark:bg-blue-500/10 dark:text-blue-400 dark:group-hover:bg-blue-500 dark:group-hover:text-white">
        <Icon className="size-5" />
      </div>
      <h3 className="mb-2 font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

/**
 * 向导 Step 3 — 配置完成
 *
 * 展示勾选成功动画、配置摘要和推荐下一步操作。
 * 视觉风格参考 gen/step3.html，使用 shadcn/ui 组件还原。
 */
export function StepComplete({
  onPrev,
  onEnter,
  isLoading,
}: StepCompleteProps) {
  const t = useTranslations("setupWizard");

  return (
    <div className="w-full max-w-4xl">
      <Card className="overflow-hidden border-slate-200/80 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:shadow-slate-900/50">
        {/* 头部区域 */}
        <div className="p-8 pb-0 text-center">
          <div className="mb-4 inline-flex size-16 items-center justify-center rounded-xl bg-[#294985] text-white shadow-inner">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-[#294985] dark:text-blue-300">
            {t("title")} — {t("stepIndicator", { current: 3, total: 3 })}
          </h1>
          {/* 进度条 */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="h-1.5 w-8 rounded-full bg-[#294985]/15 dark:bg-blue-400/20" />
            <div className="h-1.5 w-8 rounded-full bg-[#294985]/15 dark:bg-blue-400/20" />
            <div className="h-1.5 w-12 rounded-full bg-[#294985] dark:bg-blue-400" />
          </div>
        </div>

        <CardContent className="flex flex-col items-center px-8 pb-10 md:px-12">
          {/* 成功图标动画 */}
          <div className="relative mb-6 size-32">
            <div className="absolute inset-0 animate-pulse rounded-full bg-[#294985]/5 dark:bg-blue-400/5" />
            <div className="absolute inset-3 flex items-center justify-center rounded-full bg-[#294985]/10 dark:bg-blue-400/10">
              <CheckCircle2
                className="size-12 text-[#294985] dark:text-blue-400"
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* 状态说明 */}
          <div className="mb-10 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {t("step3Title")}
            </h2>
            <p className="text-lg leading-relaxed font-medium text-slate-500 dark:text-slate-400">
              {t("step3Subtitle")}
            </p>
          </div>

          {/* 推荐下一步 */}
          <div className="w-full">
            <div className="mb-8 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="px-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
                {t("recommendedNext")}
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <ActionCard
                icon={UserPlus}
                title={t("addSupplier")}
                description={t("addSupplierDesc")}
                href="/suppliers"
              />
              <ActionCard
                icon={FileText}
                title={t("newPurchaseOrder")}
                description={t("newPurchaseOrderDesc")}
                href="/purchase-orders"
              />
              <ActionCard
                icon={PackageOpen}
                title={t("importInventory")}
                description={t("importInventoryDesc")}
                href="/settings"
              />
            </div>
          </div>
        </CardContent>

        {/* 底部操作栏 */}
        <footer className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 px-8 py-6 md:flex-row dark:border-slate-800 dark:bg-slate-900/50">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={isLoading}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            {t("prevStep")}
          </Button>
          <Button
            onClick={onEnter}
            disabled={isLoading}
            className="gap-2 bg-[#294985] px-12 py-3 font-bold shadow-lg shadow-[#294985]/25 hover:bg-[#1e3a6e] dark:bg-[#3b5da0] dark:shadow-[#3b5da0]/25 dark:hover:bg-[#4a6db5]"
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                {t("enterSystem")}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </footer>
      </Card>
    </div>
  );
}
