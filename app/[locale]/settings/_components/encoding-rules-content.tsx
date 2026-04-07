"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 单据编码模拟数据 */
const mockDocumentRules = [
  { type: "采购订单 (Purchase Order)", prefix: "PO", dateFormat: "YYYYMMDD", seqLength: 3, preview: "PO-20240520-001" },
  { type: "采购入库 (Purchase Receipt)", prefix: "PI", dateFormat: "YYYYMMDD", seqLength: 3, preview: "PI-20240520-001" },
  { type: "销售订单 (Sales Order)", prefix: "SO", dateFormat: "YYYYMMDD", seqLength: 4, preview: "SO-20240520-0001" },
  { type: "销售发货 (Sales Dispatch)", prefix: "SD", dateFormat: "YYYYMMDD", seqLength: 4, preview: "SD-20240520-0001" },
];

/** 单据编码规则表 */
function DocumentRulesCard() {
  const t = useTranslations("settings.encodingRules");
  const commonT = useTranslations("common");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/* 卡片标题栏 */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1.5 rounded-full bg-primary" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t("documentRules")}
          </h2>
        </div>
        <Button size="sm" className="gap-1.5 px-4 text-xs font-bold shadow-sm">
          <Save className="size-3.5" />
          {t("saveSettings")}
        </Button>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-6 py-4">{t("documentType")}</th>
              <th className="px-6 py-4">{t("prefix")}</th>
              <th className="px-6 py-4">{t("dateFormat")}</th>
              <th className="px-6 py-4">{t("sequenceLength")}</th>
              <th className="px-6 py-4">{t("currentPreview")}</th>
              <th className="px-6 py-4 text-right">{commonT("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm font-medium dark:divide-slate-800/50">
            {mockDocumentRules.map((rule, idx) => (
              <tr
                key={idx}
                className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
              >
                <td className="px-6 py-4 text-slate-900 dark:text-slate-100">
                  {rule.type}
                </td>
                <td className="px-6 py-4 font-bold text-primary">
                  {rule.prefix}
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                  {rule.dateFormat}
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                  {rule.seqLength}
                </td>
                <td className="px-6 py-4">
                  <span className="rounded border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {rule.preview}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-xs font-bold text-primary hover:underline">
                    {commonT("edit")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 物料与批次编码设置（左半部分表单） */
function MaterialBatchForm() {
  const t = useTranslations("settings.encodingRules");

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/* 标题栏 - 使用 secondary 色指示条 */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="h-5 w-1.5 rounded-full bg-amber-600" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {t("materialBatchRules")}
        </h2>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-6">
        {/* 物料前缀 + 起始流水号 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("materialPrefix")}
            </Label>
            <Input
              defaultValue="MAT"
              className="bg-slate-50 dark:bg-slate-900/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("startSeqNo")}
            </Label>
            <Input
              defaultValue="10001"
              className="bg-slate-50 dark:bg-slate-900/50"
            />
          </div>
        </div>

        {/* 物料流水长度 */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {t("materialSeqLength")}
          </Label>
          <Select defaultValue="5" items={[
            { value: "5", label: `5 ${t("digits")}` },
            { value: "6", label: `6 ${t("digits")}` },
            { value: "8", label: `8 ${t("digits")}` }
          ]}>
            <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 {t("digits")}</SelectItem>
              <SelectItem value="6">6 {t("digits")}</SelectItem>
              <SelectItem value="8">8 {t("digits")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 批次编码规则 */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {t("batchRule")}
          </Label>
          <div className="flex gap-2">
            <Input
              defaultValue="LOT-YYYYMMDD-###"
              className="flex-1 bg-slate-50 font-mono dark:bg-slate-900/50"
            />
            <Button
              variant="outline"
              className="px-4 text-xs font-bold text-slate-600"
            >
              {t("validate")}
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            {t("batchRuleHint")}
          </p>
        </div>

        {/* 当前预览 */}
        <div className="mt-auto flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t("currentPreview")}
          </p>
          <p className="font-mono text-xl font-bold text-amber-600">
            LOT-20240520-001
          </p>
        </div>
      </div>
    </div>
  );
}

/** 智能编码建议卡（右侧蓝色卡片） */
function SmartSuggestionCard() {
  const t = useTranslations("settings.encodingRules");

  return (
    <div className="relative flex flex-col justify-center overflow-hidden rounded-xl bg-primary p-8 text-white shadow-sm">
      <div className="relative z-10">
        {/* 标题 */}
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-5 text-amber-400" />
          <h3 className="text-lg font-bold">{t("smartSuggestionTitle")}</h3>
        </div>

        {/* 描述 */}
        <p className="mb-6 text-sm leading-relaxed text-slate-200">
          {t("smartSuggestionDesc")}
        </p>

        {/* 建议卡片列表 */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 p-3">
            <CheckCircle2 className="size-5 shrink-0 text-amber-400" />
            <div className="text-xs">
              <p className="font-bold">{t("suggestionWood")}</p>
              <p className="mt-0.5 font-mono text-slate-300">WOD-YYYY-###</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 p-3">
            <CheckCircle2 className="size-5 shrink-0 text-amber-400" />
            <div className="text-xs">
              <p className="font-bold">{t("suggestionMetal")}</p>
              <p className="mt-0.5 font-mono text-slate-300">MET-YYYY-###</p>
            </div>
          </div>
        </div>

        {/* 启用按钮 */}
        <Button
          variant="secondary"
          className="w-full gap-2 bg-white py-3 font-bold text-primary shadow-lg transition-all hover:scale-[1.02] hover:bg-white/90 active:scale-[0.98]"
        >
          <span>{t("enableSuggestion")}</span>
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* 装饰元素 */}
      <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
    </div>
  );
}

/** 编码规则设置主内容 */
export function EncodingRulesContent() {
  return (
    <div className="flex w-full flex-col gap-6">
      {/* 上方：单据编码规则表 */}
      <DocumentRulesCard />

      {/* 下方：双列布局 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MaterialBatchForm />
        <SmartSuggestionCard />
      </div>
    </div>
  );
}
