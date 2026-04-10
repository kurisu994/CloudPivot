"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Database,
  UploadCloud,
  Download,
  Info,
  FileText,
  Upload,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

/** 备份历史数据 */
const mockBackupHistory = [
  { date: "2026-03-25 23:00:15", size: "12.3 MB", id: "1" },
  { date: "2026-03-24 23:00:08", size: "12.1 MB", id: "2" },
  { date: "2026-03-23 23:00:11", size: "11.9 MB", id: "3" },
];

/** 数据管理：左侧备份区域 */
function DataBackupSection() {
  const t = useTranslations("settings.dataManagement");
  const commonT = useTranslations("common");

  return (
    <div className="flex flex-col gap-6 lg:col-span-2">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <Database className="text-primary size-5" />
            {t("dataBackup")}
          </h2>
          <div className="flex gap-2">
            <Button className="flex items-center gap-2 rounded-lg bg-[#4c69c1] px-4 py-2 text-sm font-bold shadow-sm hover:bg-[#4c69c1]/90">
              <UploadCloud className="size-4" />
              {t("backupNow")}
            </Button>
            <Button
              variant="outline"
              className="rounded-lg px-4 py-2 text-sm font-bold"
            >
              {t("restoreBackup")}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              {t("dbLocation")}
            </div>
            <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
              /mnt/data/sql_db/prod_v2
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              {t("dbSize")}
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              1.28 GB
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              {t("lastBackupTime")}
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              2024-05-24 04:00:12
            </div>
          </div>
        </div>

        {/* Config Form */}
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {t("backupPath")}
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value="/storage/backups/industrial_ims/"
                className="flex-1 bg-slate-50 dark:bg-slate-900/50"
              />
              <Button variant="outline" className="font-bold">
                {t("selectPath")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/30 p-4 dark:border-slate-800/50 dark:bg-slate-900/30">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t("autoBackup")}
                </div>
                <div className="text-xs text-slate-400">
                  {t("autoBackupDesc")}
                </div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="mb-1 block text-[11px] font-bold text-slate-400 uppercase">
                  {t("backupCycle")}
                </Label>
                <Select
                  defaultValue="daily"
                  items={[
                    { value: "daily", label: "每天 (04:00)" },
                    { value: "weekly", label: "每周" },
                    { value: "monthly", label: "每月" },
                  ]}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天 (04:00)</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="mb-1 block text-[11px] font-bold text-slate-400 uppercase">
                  {t("retentionCount")}
                </Label>
                <Input type="number" defaultValue="30" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Backup History Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <h3 className="font-bold text-slate-900 dark:text-slate-100">
            {t("backupHistory")}
          </h3>
          <Button
            variant="link"
            className="text-primary h-auto p-0 text-xs font-bold"
          >
            {t("viewAllLogs")}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
              <tr>
                <th className="px-6 py-4">{t("backupDate")}</th>
                <th className="px-6 py-4">{t("fileSize")}</th>
                <th className="px-6 py-4 text-right">{commonT("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-medium dark:divide-slate-800/50">
              {mockBackupHistory.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
                    {item.date}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                    {item.size}
                  </td>
                  <td className="space-x-6 px-6 py-4 text-right">
                    <button className="text-primary font-bold hover:underline">
                      {t("restore")}
                    </button>
                    <button className="text-error font-bold hover:underline">
                      {commonT("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** 数据管理：右侧导入导出区域 */
function DataImportExportSection() {
  const t = useTranslations("settings.dataManagement");

  return (
    <div className="lg:col-span-1">
      <section className="sticky top-24 h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          <Upload className="text-primary size-5" />
          {t("dataImportExport")}
        </h2>

        <div className="space-y-4">
          <button className="group hover:border-primary flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition-all hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-900">
            <UploadCloud className="group-hover:text-primary size-5 text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              📥 {t("openImportWizard")}
            </span>
          </button>

          <div className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
            <Info className="size-[18px] shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-[11px] leading-relaxed font-bold text-amber-700 dark:text-amber-500">
              {t("importWarning")}
            </p>
          </div>

          <div className="border-t border-slate-50 pt-6 dark:border-slate-800">
            <div className="mb-2 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              {t("templateDownload")}
            </div>

            <div className="space-y-1">
              <a
                href="#"
                className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-slate-100 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  <FileText className="size-5 text-slate-400" />
                  {t("materialTemplate")}
                </span>
                <Download className="size-[18px] text-slate-400" />
              </a>

              <a
                href="#"
                className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-slate-100 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  <FileText className="size-5 text-slate-400" />
                  {t("inventoryTemplate")}
                </span>
                <Download className="size-[18px] text-slate-400" />
              </a>

              <a
                href="#"
                className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-slate-100 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  <FileText className="size-5 text-slate-400" />
                  {t("productionTemplate")}
                </span>
                <Download className="size-[18px] text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** 数据管理页面主体内容 */
export function DataManagementContent() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* 备份与还原区域 */}
      <DataBackupSection />

      {/* 导入导出区域 */}
      <DataImportExportSection />
    </div>
  );
}
