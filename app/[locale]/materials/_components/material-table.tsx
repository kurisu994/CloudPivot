"use client";

import { useTranslations } from "next-intl";
import { formatAmount } from "@/lib/currency";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { MaterialItem } from "./materials-client-page";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MaterialTableProps {
  data: MaterialItem[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onEdit: (id: number) => void;
  onToggleStatus: (id: number, currentEnabled: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  CSS for sticky columns                                             */
/* ------------------------------------------------------------------ */

const stickyStyles = `
  .sticky-col-1 { position: sticky; left: 0; z-index: 10; }
  .sticky-col-2 { position: sticky; left: 52px; z-index: 10; }
  .sticky-col-header { z-index: 20 !important; }
  .sticky-shadow::after {
    content: ""; position: absolute; right: 0; top: 0; bottom: 0;
    width: 4px; pointer-events: none;
    box-shadow: inset -4px 0 4px -4px rgba(0,0,0,0.1);
  }
`;

/* ------------------------------------------------------------------ */
/*  物料类型标签颜色                                                    */
/* ------------------------------------------------------------------ */

function TypeBadge({ type, label }: { type: string; label: string }) {
  const colorMap: Record<string, string> = {
    raw: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    semi: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    finished: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${colorMap[type] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export function MaterialTable({
  data,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onToggleStatus,
}: MaterialTableProps) {
  const t = useTranslations("materials");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* 分页器渲染 */
  const renderPages = () => {
    const pages: (number | "...")[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) {
      pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <>
      <style>{stickyStyles}</style>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* 表格区 */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                <th className="sticky-col-1 sticky-col-header w-[52px] bg-muted/50 px-4 py-4">
                  <input type="checkbox" className="rounded border-border" />
                </th>
                <th className="sticky-col-2 sticky-col-header sticky-shadow w-[150px] bg-muted/50 px-3 py-4">
                  {t("table.codeName")}
                </th>
                <th className="px-3 py-4">{t("table.type")}</th>
                <th className="px-3 py-4">{t("table.category")}</th>
                <th className="px-3 py-4">{t("table.spec")}</th>
                <th className="px-3 py-4">{t("table.unit")}</th>
                <th className="px-3 py-4 text-right">{t("table.refCost")}</th>
                <th className="px-3 py-4 text-right">{t("table.salePrice")}</th>
                <th className="px-3 py-4 text-center">{t("table.stock")}</th>
                <th className="px-3 py-4 text-center">{t("table.status")}</th>
                <th className="px-4 py-4 text-right">{t("table.operations")}</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-foreground">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td colSpan={11} className="px-4 py-4">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-muted-foreground">
                    No results.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-b border-border/50 transition-colors hover:bg-muted/30"
                  >
                    <td className="sticky-col-1 bg-card group-hover:bg-muted/30 px-4 py-4">
                      <input type="checkbox" className="rounded border-border" />
                    </td>
                    <td className="sticky-col-2 sticky-shadow bg-card group-hover:bg-muted/30 px-3">
                      <div className="font-mono text-[10px] text-muted-foreground">{row.code}</div>
                      <div className="font-bold text-foreground">{row.name}</div>
                    </td>
                    <td className="px-3">
                      <TypeBadge
                        type={row.material_type}
                        label={t(`filters.type.${row.material_type}` as any)}
                      />
                    </td>
                    <td className="px-3">{row.category_name || "—"}</td>
                    <td className="px-3 text-xs text-muted-foreground">{row.spec || "—"}</td>
                    <td className="px-3">{row.unit_name || "—"}</td>
                    <td className="px-3 text-right">
                      {row.ref_cost_price > 0 ? (
                        <span className="font-bold">{formatAmount(row.ref_cost_price, "USD")}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 text-right">
                      {row.sale_price > 0 ? (
                        <span className="font-bold">{formatAmount(row.sale_price, "USD")}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 text-center">
                      {/* 库存值暂未从后端返回，先显示占位 */}
                      <span>0</span>
                    </td>
                    <td className="px-3 text-center">
                      {row.is_enabled ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <span className="size-2 rounded-full bg-emerald-500" />
                          {t("table.active")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-full bg-muted-foreground/40" />
                          {t("table.inactive")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 text-right whitespace-nowrap">
                      <button
                        className="mr-4 font-bold text-primary hover:underline"
                        onClick={() => onEdit(row.id)}
                      >
                        {t("actions.edit")}
                      </button>
                      {row.material_type === "finished" || row.material_type === "semi" ? (
                        <button className="font-bold text-amber-600 dark:text-amber-400 hover:underline">
                          {t("actions.bom")}
                        </button>
                      ) : (
                        <button
                          className="font-bold text-muted-foreground transition-colors hover:text-destructive"
                          onClick={() => onToggleStatus(row.id, row.is_enabled)}
                        >
                          {row.is_enabled ? t("actions.disable") : t("actions.enable")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页栏 */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 text-sm font-medium text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              {t("table.totalRecords", { total: String(total) })}
            </span>
            <select
              className="rounded border border-border bg-card px-2 py-1 text-xs outline-none"
              value={pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
            >
              <option value="20">{t("table.perPage", { count: "20" })}</option>
              <option value="50">{t("table.perPage", { count: "50" })}</option>
              <option value="100">{t("table.perPage", { count: "100" })}</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="size-[18px]" />
            </button>
            {renderPages().map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="px-2 text-muted-foreground/50">…</span>
              ) : (
                <button
                  key={p}
                  className={`flex size-8 items-center justify-center rounded-lg font-bold transition-colors ${
                    page === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => onPageChange(p as number)}
                >
                  {p}
                </button>
              ),
            )}
            <button
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="size-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
