"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Layers,
  Zap,
  CalendarDays,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Mock 日志数据（匹配设计稿 6 列结构） */
const mockLogs = [
  {
    time: "2026-03-27 11:42",
    user: "admin",
    initials: "AD",
    avatarColor: "bg-primary/10 text-primary",
    module: "exchangeRate",
    moduleBadge:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    action: "actionUpdate",
    actionColor: "text-amber-700 dark:text-amber-400",
    target: "USD",
    summary: {
      type: "change",
      field: "汇率",
      oldVal: "25,300",
      newVal: "25,500",
    },
  },
  {
    time: "2026-03-27 10:06",
    user: "张三",
    initials: "ZS",
    avatarColor:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    module: "stockCheck",
    moduleBadge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    action: "actionCreate",
    actionColor: "text-primary",
    target: "SC-20260327-002",
    summary: { type: "text", text: "创建盘点范围: 原材料仓 / 木材分类" },
  },
  {
    time: "2026-03-27 09:18",
    user: "admin",
    initials: "AD",
    avatarColor: "bg-primary/10 text-primary",
    module: "purchaseOrder",
    moduleBadge: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    action: "actionAudit",
    actionColor: "text-emerald-600 dark:text-emerald-400",
    target: "PO-20260327-001",
    summary: {
      type: "change",
      field: "状态",
      oldVal: "草稿",
      newVal: "已审核",
    },
  },
];

/** 模块名映射 */
const MODULE_LABELS: Record<string, string> = {
  exchangeRate: "汇率设置",
  stockCheck: "库存盘点",
  purchaseOrder: "采购单",
};

/** 筛选面板 */
function FilterPanel() {
  const t = useTranslations("settings.operationLogs");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/* 第一行：三列筛选器 */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="flex items-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            <User className="mr-1 size-3.5" />
            {t("user")}
          </Label>
          <Select
            defaultValue="all"
            items={[
              { value: "all", label: t("allUsers") },
              { value: "admin", label: "admin" },
              { value: "zhangsan", label: "张三" },
              { value: "lisi", label: "李四" },
            ]}
          >
            <SelectTrigger className="h-10 w-full bg-slate-50 dark:bg-slate-900/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allUsers")}</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="zhangsan">张三</SelectItem>
              <SelectItem value="lisi">李四</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            <Layers className="mr-1 size-3.5" />
            {t("module")}
          </Label>
          <Select
            defaultValue="all"
            items={[
              { value: "all", label: t("allModules") },
              { value: "purchase", label: "采购单" },
              { value: "stockCheck", label: "库存盘点" },
              { value: "exchangeRate", label: "汇率设置" },
            ]}
          >
            <SelectTrigger className="h-10 w-full bg-slate-50 dark:bg-slate-900/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allModules")}</SelectItem>
              <SelectItem value="purchase">采购单</SelectItem>
              <SelectItem value="stockCheck">库存盘点</SelectItem>
              <SelectItem value="exchangeRate">汇率设置</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            <Zap className="mr-1 size-3.5" />
            {t("actionType")}
          </Label>
          <Select
            defaultValue="all"
            items={[
              { value: "all", label: t("allTypes") },
              { value: "create", label: t("actionCreate") },
              { value: "update", label: t("actionUpdate") },
              { value: "audit", label: t("actionAudit") },
              { value: "delete", label: t("actionDelete") },
            ]}
          >
            <SelectTrigger className="h-10 w-full bg-slate-50 dark:bg-slate-900/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="create">{t("actionCreate")}</SelectItem>
              <SelectItem value="update">{t("actionUpdate")}</SelectItem>
              <SelectItem value="audit">{t("actionAudit")}</SelectItem>
              <SelectItem value="delete">{t("actionDelete")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 第二行：日期范围 + 操作按钮 */}
      <div className="flex items-end gap-6 border-t border-slate-50 pt-6 dark:border-slate-800">
        <div className="max-w-md flex-1 space-y-1.5">
          <Label className="flex items-center text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            <CalendarDays className="mr-1 size-3.5" />
            {t("dateRange")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              defaultValue="2026-03-20"
              className="h-10 bg-slate-50 dark:bg-slate-900/50"
            />
            <span className="text-slate-300">~</span>
            <Input
              type="date"
              defaultValue="2026-03-27"
              className="h-10 bg-slate-50 dark:bg-slate-900/50"
            />
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 gap-2 font-bold">
            <Download className="size-4" />
            {t("exportData")}
          </Button>
          <Button className="h-10 gap-2 px-8 font-bold">
            <Search className="size-4" />
            {t("query")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** 变更摘要渲染 */
function ChangeSummary({
  summary,
}: {
  summary: {
    type: string;
    field?: string;
    oldVal?: string;
    newVal?: string;
    text?: string;
  };
}) {
  if (summary.type === "text") {
    return (
      <span className="text-slate-500 dark:text-slate-400">{summary.text}</span>
    );
  }
  return (
    <span className="text-slate-500 dark:text-slate-400">
      {summary.field}:{" "}
      <span className="text-slate-300 line-through dark:text-slate-600">
        {summary.oldVal}
      </span>{" "}
      → <span className="text-primary font-bold">{summary.newVal}</span>
    </span>
  );
}

/** 日志表格 */
function LogsTable() {
  const t = useTranslations("settings.operationLogs");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
              <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                {t("time")}
              </TableHead>
              <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                {t("user")}
              </TableHead>
              <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                {t("module")}
              </TableHead>
              <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                {t("action")}
              </TableHead>
              <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                {t("target")}
              </TableHead>
              <TableHead className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                {t("changeSummary")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockLogs.map((log, idx) => (
              <TableRow
                key={idx}
                className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-900/50"
              >
                {/* 时间 */}
                <TableCell className="px-6 py-4 text-sm font-medium whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {log.time}
                </TableCell>
                {/* 用户（头像 + 名称） */}
                <TableCell className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                        log.avatarColor
                      )}
                    >
                      {log.initials}
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {log.user}
                    </span>
                  </div>
                </TableCell>
                {/* 模块（彩色徽章） */}
                <TableCell className="px-6 py-4">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      log.moduleBadge
                    )}
                  >
                    {MODULE_LABELS[log.module] ?? log.module}
                  </span>
                </TableCell>
                {/* 操作（彩色文字） */}
                <TableCell
                  className={cn("px-6 py-4 text-sm font-bold", log.actionColor)}
                >
                  {t(log.action)}
                </TableCell>
                {/* 对象 */}
                <TableCell className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {log.target}
                </TableCell>
                {/* 变更摘要 */}
                <TableCell className="px-6 py-4 text-sm">
                  <ChangeSummary summary={log.summary} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-xs font-bold text-slate-400">
          {t("showingRange", { from: 1, to: 10, total: "1,248" })}
        </p>
        <div className="flex items-center gap-1">
          <button className="flex size-8 items-center justify-center rounded border border-slate-200 text-slate-400 transition-colors hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">
            <ChevronLeft className="size-4" />
          </button>
          <button className="bg-primary flex size-8 items-center justify-center rounded text-xs font-bold text-white">
            1
          </button>
          {[2, 3].map((n) => (
            <button
              key={n}
              className="flex size-8 items-center justify-center rounded border border-slate-200 text-xs font-bold text-slate-600 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {n}
            </button>
          ))}
          <span className="px-2 text-xs text-slate-300 dark:text-slate-600">
            ...
          </span>
          <button className="flex size-8 items-center justify-center rounded border border-slate-200 text-xs font-bold text-slate-600 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            125
          </button>
          <button className="flex size-8 items-center justify-center rounded border border-slate-200 text-slate-400 transition-colors hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function OperationLogsContent() {
  return (
    <div className="flex w-full flex-col gap-6">
      <FilterPanel />
      <LogsTable />
    </div>
  );
}
