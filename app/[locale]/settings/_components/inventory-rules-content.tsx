"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Warehouse, QrCode } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * 默认仓映射设置
 */
function DefaultWarehouseMapping() {
  const t = useTranslations("settings.inventoryRules");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <Warehouse className="size-5 text-primary" />
        <h2 className="font-bold text-slate-800 dark:text-slate-100">
          {t("defaultWarehouseMapping")}
        </h2>
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/50 text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
              <th className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                {t("materialType")}
              </th>
              <th className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                {t("defaultWarehouse")}
              </th>
              <th className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                {t("description")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {/* 原材料 */}
            <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                {t("rawMaterials")}
              </td>
              <td className="px-6 py-4">
                <Select defaultValue="raw" items={[
                  { value: "raw", label: "原材料仓" },
                  { value: "outsource", label: "委外仓" }
                ]}>
                  <SelectTrigger className="w-full max-w-[240px] h-10 bg-slate-50 dark:bg-slate-900/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">原材料仓</SelectItem>
                    <SelectItem value="outsource">委外仓</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                {t("rawMaterialsDesc")}
              </td>
            </tr>
            {/* 半成品 */}
            <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                {t("semiFinished")}
              </td>
              <td className="px-6 py-4">
                <Select defaultValue="semi" items={[
                  { value: "semi", label: "半成品仓" },
                  { value: "workshop", label: "车间仓" }
                ]}>
                  <SelectTrigger className="w-full max-w-[240px] h-10 bg-slate-50 dark:bg-slate-900/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semi">半成品仓</SelectItem>
                    <SelectItem value="workshop">车间仓</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                {t("semiFinishedDesc")}
              </td>
            </tr>
            {/* 成品 */}
            <tr className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                {t("finishedGoods")}
              </td>
              <td className="px-6 py-4">
                <Select defaultValue="finished" items={[
                  { value: "finished", label: "成品仓" },
                  { value: "inspect", label: "待检仓" }
                ]}>
                  <SelectTrigger className="w-full max-w-[240px] h-10 bg-slate-50 dark:bg-slate-900/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finished">成品仓</SelectItem>
                    <SelectItem value="inspect">待检仓</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                {t("finishedGoodsDesc")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * 批次策略设置
 */
function BatchStrategySection() {
  const t = useTranslations("settings.inventoryRules");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <QrCode className="size-5 text-primary" />
        <h2 className="font-bold text-slate-800 dark:text-slate-100">
          {t("batchStrategy")}
        </h2>
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
          {/* 批次编号规则 */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("batchNumberRule")}
            </Label>
            <Input
              defaultValue="LOT-YYYYMMDD-XXX"
              className="bg-slate-50 dark:bg-slate-900/50 h-10"
            />
            <p className="text-[11px] text-slate-400">{t("batchNumberRuleHint")}</p>
          </div>

          {/* 出库分配策略 */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("outboundStrategy")}
            </Label>
            <Select defaultValue="fifo" items={[
              { value: "fifo", label: t("fifo") },
              { value: "lifo", label: t("lifo") },
              { value: "fefo", label: t("fefo") }
            ]}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fifo">{t("fifo")}</SelectItem>
                <SelectItem value="lifo">{t("lifo")}</SelectItem>
                <SelectItem value="fefo">{t("fefo")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 预留批次策略 */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("reservedBatchStrategy")}
            </Label>
            <Select defaultValue="fifo_reserve" items={[
              { value: "fifo_reserve", label: t("fifoReserve") },
              { value: "manual_reserve", label: t("manualReserve") }
            ]}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fifo_reserve">{t("fifoReserve")}</SelectItem>
                <SelectItem value="manual_reserve">{t("manualReserve")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 单据仓库模式 */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("documentWarehouseMode")}
            </Label>
            <Input
              readOnly
              value={t("orderLevelSingleWarehouse")}
              className="bg-slate-100 text-slate-500 cursor-not-allowed h-10 dark:bg-slate-900/30 dark:text-slate-500"
            />
          </div>
        </div>

        {/* 必填批次入库限制开关 */}
        <div className="mt-8 border-t border-slate-50 pt-8 dark:border-slate-800">
          <label className="group flex cursor-pointer items-start gap-3">
            <div className="relative flex items-center pt-0.5">
              <Checkbox defaultChecked className="h-5 w-5 rounded border-slate-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-700 transition-colors group-hover:text-primary dark:text-slate-300">
                {t("mandatoryBatchTitle")}
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("mandatoryBatchDesc")}
              </span>
            </div>
          </label>
        </div>
      </div>
    </section>
  );
}

/**
 * 底部操作按钮栏
 */
function ActionButtons() {
  const t = useTranslations("settings.inventoryRules");

  return (
    <div className="mt-4 flex items-center justify-end gap-3">
      <Button
        variant="outline"
        className="h-10 px-6 font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {t("cancel")}
      </Button>
      <Button className="h-10 px-10 font-bold bg-primary text-white hover:opacity-90 transition-opacity">
        {t("saveSettings")}
      </Button>
    </div>
  );
}

/** 库存规则设置主内容 */
export function InventoryRulesContent() {
  return (
    <div className="space-y-6">
      {/* 默认仓映射 */}
      <DefaultWarehouseMapping />

      {/* 批次策略 */}
      <BatchStrategySection />

      {/* 底部操作按钮 */}
      <ActionButtons />
    </div>
  );
}
