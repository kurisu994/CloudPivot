"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { ArrowRight, Building2, Globe, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

/** Step 1 表单数据 */
export interface Step1Data {
  companyName: string;
  defaultLanguage: string;
}

interface StepCompanyInfoProps {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  onNext: () => void;
  isLoading: boolean;
  error: string;
}

/**
 * 向导 Step 1 — 企业信息
 *
 * 输入企业名称、选择默认语言。核算币种固定 USD（只读）。
 * 视觉风格参考 gen/step1.html 静态 demo，使用项目 shadcn/ui 组件还原。
 */
export function StepCompanyInfo({
  data,
  onChange,
  onNext,
  isLoading,
  error,
}: StepCompanyInfoProps) {
  const t = useTranslations("setupWizard");

  const localeOptions = [
    { label: "中文", value: "zh" },
    { label: "English", value: "en" },
    { label: "Tiếng Việt", value: "vi" },
  ];

  return (
    <div className="w-full max-w-xl py-12">
      {/* 品牌头部 */}
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2.5">
          <Image
            src="/cloudpivot_logo.png"
            alt="CloudPivot"
            width={36}
            height={36}
            className="size-9 object-contain dark:hidden"
            priority
          />
          <Image
            src="/cloudpivot_logo_dark.png"
            alt="CloudPivot"
            width={36}
            height={36}
            className="hidden size-9 object-contain dark:block"
            priority
          />
          <span className="text-2xl font-black tracking-tight text-[#294985] uppercase dark:text-slate-100">
            CloudPivot IMS
          </span>
        </div>
        <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
          {t("title")} — {t("stepIndicator", { current: 1, total: 3 })}
        </p>
      </div>

      {/* 主卡片 */}
      <Card className="overflow-hidden border-slate-200/80 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:shadow-slate-900/50">
        {/* 顶部强调条 */}
        <div className="h-1.5 w-full bg-[#294985]" />

        <CardContent className="p-10">
          {/* 标题 */}
          <div className="mb-10">
            <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {t("welcome")}
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("step1Subtitle")}
            </p>
          </div>

          <div className="space-y-8">
            {/* 企业名称 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#294985] uppercase dark:text-blue-300">
                <Building2 className="size-4" />
                {t("companyName")}
              </label>
              <Input
                value={data.companyName}
                onChange={(e) =>
                  onChange({ ...data, companyName: e.target.value })
                }
                placeholder={t("companyNamePlaceholder")}
                className="h-12 bg-slate-50/50 font-medium dark:bg-slate-900/50"
              />
              {error && (
                <p className="text-xs font-medium text-destructive">{error}</p>
              )}
            </div>

            {/* 语言 + 币种 */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {/* 默认语言 */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#294985] uppercase dark:text-blue-300">
                  <Globe className="size-4" />
                  {t("defaultLanguage")}
                </label>
                <Select
                  value={data.defaultLanguage}
                  onValueChange={(val) =>
                    val && onChange({ ...data, defaultLanguage: val })
                  }
                >
                  <SelectTrigger className="h-12 bg-slate-50/50 font-medium dark:bg-slate-900/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {localeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 核算币种（固定） */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-[#294985] uppercase dark:text-blue-300">
                  <Lock className="size-3.5" />
                  {t("baseCurrency")}
                </label>
                <div className="flex h-12 w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-100/80 px-4 font-medium text-slate-500 select-none dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                  <span>{t("baseCurrencyFixed")}</span>
                  <Lock className="size-3.5 opacity-50" />
                </div>
              </div>
            </div>

            {/* 进度条 */}
            <div className="pt-4">
              <div className="mb-3 flex items-end justify-between">
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  {t("setupProgress")}
                </span>
                <span className="text-[10px] font-bold tracking-widest text-[#294985] uppercase dark:text-blue-300">
                  33% {t("complete")}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-[#294985]" />
                <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>

            {/* 下一步按钮 */}
            <div className="pt-4">
              <Button
                onClick={onNext}
                disabled={isLoading}
                className="group h-12 w-full bg-[#294985] font-bold shadow-lg shadow-[#294985]/25 hover:bg-[#1e3a6e] dark:bg-[#3b5da0] dark:shadow-[#3b5da0]/25 dark:hover:bg-[#4a6db5]"
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    {t("nextStep")}
                    <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>

        {/* 底部安全提示 */}
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/50 px-10 py-5 dark:border-slate-800 dark:bg-slate-900/50">
          <ShieldCheck className="size-4 text-[#294985] dark:text-blue-400" />
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
            {t("securityNote")}
          </p>
        </div>
      </Card>
    </div>
  );
}
