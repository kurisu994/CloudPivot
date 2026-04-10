"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  CircleDollarSign,
  RefreshCw,
  Info,
  ListFilter,
  Download,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 实时汇率卡片 (VND & CNY)
 */
function CurrentRatesSection() {
  const t = useTranslations("settings.exchangeRate");

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          <CircleDollarSign className="text-primary size-6" />
          {t("currentRates")}
        </h2>
        <Button className="flex h-9 items-center gap-2 bg-[#4c69c1] px-4 font-bold text-white shadow-sm hover:bg-[#4c69c1]/90">
          <RefreshCw className="size-4" />
          {t("manualUpdate")}
        </Button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {/* VND Card */}
        <div className="hover:border-primary/20 flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-5 transition-all dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-start justify-between">
            <span className="rounded bg-blue-100/60 px-2.5 py-1 text-[10px] font-bold tracking-wider text-blue-700 uppercase dark:bg-blue-900/30 dark:text-blue-400">
              USD / VND
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              2026-03-27
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                25,300
              </span>
              <span className="text-sm font-bold text-slate-500">VND</span>
            </div>
            <div className="mt-1 text-[11px] font-medium text-slate-400">
              {t("vndDesc", { rate: "25,300" })}
            </div>
          </div>
        </div>

        {/* CNY Card */}
        <div className="hover:border-primary/20 flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-5 transition-all dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-start justify-between">
            <span className="rounded bg-red-100/60 px-2.5 py-1 text-[10px] font-bold tracking-wider text-red-700 uppercase dark:bg-red-900/30 dark:text-red-400">
              USD / CNY
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              2026-03-27
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                7.20
              </span>
              <span className="text-sm font-bold text-slate-500">CNY</span>
            </div>
            <div className="mt-1 text-[11px] font-medium text-slate-400">
              {t("cnyDesc", { rate: "7.20" })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 本位币提示卡片
 */
function BaseCurrencyCard() {
  const t = useTranslations("settings.exchangeRate");

  return (
    <section className="border-primary bg-primary relative flex flex-col justify-between overflow-hidden rounded-xl border p-6 text-white shadow-sm lg:col-span-1">
      <div className="relative z-10">
        <p className="mb-1 text-[10px] font-bold tracking-widest text-blue-200/80 uppercase">
          {t("systemBaseCurrency")}
        </p>
        <h3 className="mb-3 text-4xl font-black">USD ($)</h3>
        <p className="mb-4 text-[12px] leading-relaxed text-blue-100/80">
          {t("baseCurrencyDesc")}
        </p>
      </div>

      <div className="relative z-10 mt-auto flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
        <Info className="size-5 text-blue-300" />
        <div className="min-w-0">
          <p className="text-[9px] font-bold tracking-wider text-blue-200 uppercase">
            {t("lastSync")}
          </p>
          <p className="truncate text-[11px] font-medium">2026-03-27 09:00</p>
        </div>
      </div>

      {/* Decorative Icon Background */}
      <Coins
        className="pointer-events-none absolute -top-4 -right-4 text-white/5 opacity-50"
        size={160}
      />
    </section>
  );
}

/**
 * 汇率历史记录表格模块
 */
function RateHistoryTable() {
  const t = useTranslations("settings.exchangeRate");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <h3 className="font-bold text-slate-900 dark:text-slate-100">
          {t("historyTitle")}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-primary h-8 w-8 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ListFilter className="size-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-primary h-8 w-8 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="size-[18px]" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold tracking-widest text-slate-400 uppercase dark:border-slate-800 dark:bg-slate-900/50">
            <tr>
              <th className="px-6 py-4">{t("effectiveDate")}</th>
              <th className="px-6 py-4">{t("currencyType")}</th>
              <th className="px-6 py-4">{t("exchangeRateValue")}</th>
              <th className="px-6 py-4">{t("updatedBy")}</th>
              <th className="px-6 py-4">{t("remarks")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm font-medium dark:divide-slate-800">
            {/* Record 1 */}
            <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">
                2026-03-27
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {t("vndCurrency")}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 font-black text-slate-900 dark:text-slate-200">
                25,300
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[9px] font-bold text-slate-500 uppercase dark:border-slate-700 dark:bg-slate-800">
                    A
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">
                    admin
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-400 italic">
                {t("monthlyUpdate")}
              </td>
            </tr>

            {/* Record 2 */}
            <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">
                2026-03-27
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {t("cnyCurrency")}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 font-black text-slate-900 dark:text-slate-200">
                7.20
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[9px] font-bold text-slate-500 uppercase dark:border-slate-700 dark:bg-slate-800">
                    A
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">
                    admin
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-400 italic">
                {t("monthlyUpdate")}
              </td>
            </tr>

            {/* Record 3 */}
            <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">
                2026-03-20
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {t("cnyCurrency")}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 font-black text-slate-900 dark:text-slate-200">
                7.15
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[9px] font-bold text-slate-500 uppercase dark:border-slate-700 dark:bg-slate-800">
                    A
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">
                    admin
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-400 italic">
                {t("manualAdjustment")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/10 px-6 py-4 dark:border-slate-800">
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          {t("showingRecords", { count: 3 })}
        </span>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled
            className="h-8 px-3 text-[11px] font-bold text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-400"
          >
            {t("prevPage")}
          </Button>
          <Button
            size="sm"
            className="bg-primary h-8 px-3 text-[11px] font-bold text-white shadow-sm hover:opacity-90"
          >
            1
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {t("nextPage")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * 汇率管理内容主组件
 */
export function ExchangeRateContent() {
  return (
    <div className="flex flex-col gap-6">
      {/* 顶部：汇率信息板 */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-4">
        <CurrentRatesSection />
        <BaseCurrencyCard />
      </div>

      {/* 底部：汇率历史 */}
      <RateHistoryTable />
    </div>
  );
}
