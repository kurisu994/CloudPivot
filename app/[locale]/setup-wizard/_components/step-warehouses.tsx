"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  BoxIcon,
  Wrench,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Step 2 表单数据 */
export interface Step2Data {
  rawName: string;
  rawManager: string;
  finishedName: string;
  finishedManager: string;
  semiName: string;
  semiManager: string;
}

interface StepWarehousesProps {
  data: Step2Data;
  onChange: (data: Step2Data) => void;
  onPrev: () => void;
  onNext: () => void;
  isLoading: boolean;
  errors: { raw?: string; finished?: string };
}

/**
 * 向导 Step 2 — 创建基础仓库
 *
 * 原材料仓（必填）+ 成品仓（必填）+ 半成品仓（可选）。
 * 视觉风格参考 gen/step2.html，使用 shadcn/ui 组件还原。
 */
export function StepWarehouses({
  data,
  onChange,
  onPrev,
  onNext,
  isLoading,
  errors,
}: StepWarehousesProps) {
  const t = useTranslations("setupWizard");

  return (
    <div className="w-full max-w-3xl">
      <Card className="overflow-hidden border-slate-200/80 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:shadow-slate-900/50">
        {/* 卡片头部 */}
        <header className="border-b border-slate-100 px-8 pt-8 pb-6 dark:border-slate-800">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#294985] shadow-inner">
                <Image
                  src="/cloudpivot_logo_dark.png"
                  alt="CloudPivot"
                  width={28}
                  height={28}
                  className="size-7 object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-[#294985] dark:text-blue-300">
                  {t("title")} —{" "}
                  {t("stepIndicator", { current: 2, total: 3 })}
                </h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {t("step2Header")}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="mb-2 text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                PROGRESS
              </span>
              <div className="flex gap-1.5">
                <div className="h-1.5 w-10 rounded-full bg-[#294985]" />
                <div className="h-1.5 w-10 rounded-full bg-[#294985]" />
                <div className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {t("step2Title")}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {t("step2Subtitle")}
            </p>
          </div>
        </header>

        {/* 表单区域 */}
        <CardContent className="space-y-6 p-8">
          {/* 原材料仓 */}
          <section className="relative grid grid-cols-1 gap-6 overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="absolute top-0 left-0 h-full w-1.5 bg-[#8B6914]" />
            <div className="col-span-full mb-1 flex items-center gap-2">
              <Package className="size-5 text-[#8B6914]" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                {t("rawWarehouse")}
              </h3>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t("rawWarehouseName")}
              </label>
              <Input
                value={data.rawName}
                onChange={(e) =>
                  onChange({ ...data, rawName: e.target.value })
                }
                placeholder={t("rawWarehouseDefault")}
                className="bg-slate-50/50 dark:bg-slate-800/50"
              />
              {errors.raw && (
                <p className="text-xs font-medium text-destructive">
                  {errors.raw}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t("warehouseManager")}
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={data.rawManager}
                  onChange={(e) =>
                    onChange({ ...data, rawManager: e.target.value })
                  }
                  placeholder={t("warehouseManagerPlaceholder")}
                  className="bg-slate-50/50 pl-10 dark:bg-slate-800/50"
                />
              </div>
            </div>
          </section>

          {/* 成品仓 */}
          <section className="relative grid grid-cols-1 gap-6 overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="absolute top-0 left-0 h-full w-1.5 bg-[#6B8E5A]" />
            <div className="col-span-full mb-1 flex items-center gap-2">
              <BoxIcon className="size-5 text-[#6B8E5A]" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                {t("finishedWarehouse")}
              </h3>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t("finishedWarehouseName")}
              </label>
              <Input
                value={data.finishedName}
                onChange={(e) =>
                  onChange({ ...data, finishedName: e.target.value })
                }
                placeholder={t("finishedWarehouseDefault")}
                className="bg-slate-50/50 dark:bg-slate-800/50"
              />
              {errors.finished && (
                <p className="text-xs font-medium text-destructive">
                  {errors.finished}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t("warehouseManager")}
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={data.finishedManager}
                  onChange={(e) =>
                    onChange({ ...data, finishedManager: e.target.value })
                  }
                  placeholder={t("warehouseManagerPlaceholder")}
                  className="bg-slate-50/50 pl-10 dark:bg-slate-800/50"
                />
              </div>
            </div>
          </section>

          {/* 半成品仓（可选） */}
          <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 dark:border-slate-600 dark:bg-slate-800/30">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="size-5 text-slate-400" />
                <h3 className="text-sm font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {t("semiWarehouse")}
                </h3>
              </div>
              <Badge
                variant="secondary"
                className="text-[10px] font-bold uppercase"
              >
                {t("optional")}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Input
                value={data.semiName}
                onChange={(e) =>
                  onChange({ ...data, semiName: e.target.value })
                }
                placeholder={t("configLater")}
                className="border-slate-300 bg-transparent italic dark:border-slate-600"
              />
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={data.semiManager}
                  onChange={(e) =>
                    onChange({ ...data, semiManager: e.target.value })
                  }
                  placeholder={t("warehouseManagerPlaceholder")}
                  className="border-slate-300 bg-transparent pl-10 dark:border-slate-600"
                />
              </div>
            </div>
          </section>
        </CardContent>

        {/* 操作按钮 */}
        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-8 py-5 dark:border-slate-800 dark:bg-slate-900/50">
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
            onClick={onNext}
            disabled={isLoading}
            className="gap-2 bg-[#294985] px-10 font-bold shadow-lg shadow-[#294985]/25 hover:bg-[#1e3a6e] dark:bg-[#3b5da0] dark:shadow-[#3b5da0]/25 dark:hover:bg-[#4a6db5]"
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                {t("nextStep")}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </footer>
      </Card>
    </div>
  );
}
