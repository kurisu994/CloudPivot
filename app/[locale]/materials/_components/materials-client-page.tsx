"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Plus,
  Upload,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaterialTable } from "./material-table";
import { MaterialFormDialog } from "./material-form-dialog";
import { invoke, isTauriEnv } from "@/lib/tauri";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/** 物料列表项（对应后端 MaterialListItem） */
export interface MaterialItem {
  id: number;
  code: string;
  name: string;
  material_type: string;
  category_id: number | null;
  category_name: string | null;
  spec: string | null;
  base_unit_id: number;
  unit_name: string | null;
  ref_cost_price: number;
  sale_price: number;
  safety_stock: number;
  max_stock: number;
  is_enabled: boolean;
  created_at: string | null;
}

/** 分类选项 */
export interface CategoryOption {
  id: number;
  name: string;
  code: string;
}

/** 单位选项 */
export interface UnitOption {
  id: number;
  name: string;
  name_en: string | null;
  name_vi: string | null;
}

/* ------------------------------------------------------------------ */
/*  Mock 数据 — Web 调试模式使用                                       */
/* ------------------------------------------------------------------ */

const MOCK_CATEGORIES: CategoryOption[] = [
  { id: 1, name: "木材", code: "WOOD" },
  { id: 2, name: "五金", code: "HARDWARE" },
  { id: 3, name: "客厅", code: "LIVING" },
  { id: 4, name: "餐厅", code: "DINING" },
];

const MOCK_UNITS: UnitOption[] = [
  { id: 1, name: "张", name_en: "Sheet", name_vi: "Tấm" },
  { id: 2, name: "个", name_en: "Piece", name_vi: "Cái" },
  { id: 3, name: "套", name_en: "Set", name_vi: "Bộ" },
  { id: 4, name: "米", name_en: "Meter", name_vi: "Mét" },
  { id: 5, name: "千克", name_en: "Kg", name_vi: "Kg" },
];

const MOCK_MATERIALS: MaterialItem[] = [
  { id: 1, code: "M-1002", name: "真皮三人沙发", material_type: "finished", category_id: 3, category_name: "客厅", spec: "2100×900", base_unit_id: 3, unit_name: "套", ref_cost_price: 0, sale_price: 175600, safety_stock: 10, max_stock: 50, is_enabled: true, created_at: "2024-01-15" },
  { id: 2, code: "M-0001", name: "白橡实木板", material_type: "raw", category_id: 1, category_name: "木材", spec: "2440×1220", base_unit_id: 1, unit_name: "张", ref_cost_price: 3850, sale_price: 0, safety_stock: 50, max_stock: 500, is_enabled: true, created_at: "2024-01-10" },
  { id: 3, code: "M-0002", name: "不锈钢铰链", material_type: "raw", category_id: 2, category_name: "五金", spec: "40mm", base_unit_id: 2, unit_name: "个", ref_cost_price: 48, sale_price: 0, safety_stock: 500, max_stock: 5000, is_enabled: true, created_at: "2024-01-12" },
  { id: 4, code: "M-1001", name: "北欧实木餐桌", material_type: "finished", category_id: 4, category_name: "餐厅", spec: "1400×800", base_unit_id: 3, unit_name: "套", ref_cost_price: 0, sale_price: 49000, safety_stock: 5, max_stock: 30, is_enabled: true, created_at: "2024-01-08" },
];

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export function MaterialsClientPage() {
  const t = useTranslations("materials");

  // 数据
  const [data, setData] = useState<MaterialItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 筛选
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [materialType, setMaterialType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 弹窗
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // 下拉选项
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

  /* 构建 Select items（base-ui 需要 items 以正确解析 SelectValue 显示文本） */
  const categoryItems = useMemo(() => [
    { value: "all", label: t("filters.categoryAll") },
    ...categories.map((c) => ({ value: c.id.toString(), label: c.name })),
  ], [categories, t]);

  const typeItems = useMemo(() => [
    { value: "all", label: t("filters.typeAll") },
    { value: "raw", label: t("filters.type.raw") },
    { value: "semi", label: t("filters.type.semi") },
    { value: "finished", label: t("filters.type.finished") },
  ], [t]);

  const statusItems = useMemo(() => [
    { value: "all", label: t("filters.statusAll") },
    { value: "active", label: t("filters.status.active") },
    { value: "inactive", label: t("filters.status.inactive") },
  ], [t]);

  /** 加载分类/单位下拉选项 */
  const fetchOptions = useCallback(async () => {
    if (!isTauriEnv()) {
      setCategories(MOCK_CATEGORIES);
      setUnits(MOCK_UNITS);
      return;
    }
    try {
      const [cat, uni] = await Promise.all([
        invoke<CategoryOption[]>("get_categories"),
        invoke<UnitOption[]>("get_units"),
      ]);
      setCategories(cat);
      setUnits(uni);
    } catch (e) {
      console.error("加载下拉选项失败", e);
    }
  }, []);

  /** 加载物料列表 */
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    if (!isTauriEnv()) {
      // Web 调试模式：使用 mock 数据
      await new Promise((r) => setTimeout(r, 300));
      let filtered = [...MOCK_MATERIALS];
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        filtered = filtered.filter(
          (m) => m.code.toLowerCase().includes(kw) || m.name.toLowerCase().includes(kw),
        );
      }
      if (categoryId !== "all") {
        filtered = filtered.filter((m) => m.category_id === parseInt(categoryId));
      }
      if (materialType !== "all") {
        filtered = filtered.filter((m) => m.material_type === materialType);
      }
      if (status !== "all") {
        filtered = filtered.filter((m) => (status === "active" ? m.is_enabled : !m.is_enabled));
      }
      setTotal(filtered.length);
      setData(filtered.slice((page - 1) * pageSize, page * pageSize));
      setLoading(false);
      return;
    }
    try {
      const res = await invoke<{ total: number; items: MaterialItem[] }>("get_materials", {
        filter: {
          keyword: keyword.trim() || null,
          category_id: categoryId === "all" ? null : parseInt(categoryId, 10),
          material_type: materialType === "all" ? null : materialType,
          is_enabled: status === "all" ? null : status === "active",
          page,
          page_size: pageSize,
        },
      });
      setData(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error(typeof e === "string" ? e : "加载物料失败");
    } finally {
      setLoading(false);
    }
  }, [keyword, categoryId, materialType, status, page, pageSize]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);
  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const handleReset = () => {
    setKeyword("");
    setCategoryId("all");
    setMaterialType("all");
    setStatus("all");
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    fetchMaterials();
  };

  const handleToggleStatus = async (id: number, currentEnabled: boolean) => {
    if (!isTauriEnv()) {
      toast.success(currentEnabled ? "已禁用" : "已启用");
      return;
    }
    try {
      await invoke("toggle_material_status", { id, isEnabled: !currentEnabled });
      toast.success(currentEnabled ? "已禁用" : "已启用");
      fetchMaterials();
    } catch (e) {
      toast.error(typeof e === "string" ? e : "操作失败");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {t("title")}
          <span className="ml-2 text-lg font-normal text-muted-foreground">{t("subtitle")}</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* 搜索过滤条 */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 items-center gap-4">
          {/* 搜索框 */}
          <div className="relative max-w-xs flex-1">
            <Search className="absolute top-2.5 left-3 size-[18px] text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder={t("searchPlaceholder")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          {/* 分类 */}
          <Select value={categoryId} onValueChange={setCategoryId} items={categoryItems}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 类型 */}
          <Select value={materialType} onValueChange={setMaterialType} items={typeItems}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 状态 */}
          <Select value={status} onValueChange={setStatus} items={statusItems}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>{t("actions.reset")}</Button>
          <Button onClick={handleSearch}>{t("actions.search")}</Button>
        </div>
      </div>

      {/* 操作按钮行 */}
      <div className="flex gap-2">
        <Button onClick={() => { setEditingId(null); setDialogOpen(true); }}>
          <Plus data-icon="inline-start" />
          {t("actions.add")}
        </Button>
        <Button variant="outline">
          <Upload data-icon="inline-start" />
          {t("actions.import")}
        </Button>
        <Button variant="outline">
          <Download data-icon="inline-start" />
          {t("actions.export")}
        </Button>
      </div>

      {/* 数据表格 + 分页 */}
      <MaterialTable
        data={data}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        onEdit={(id) => { setEditingId(id); setDialogOpen(true); }}
        onToggleStatus={handleToggleStatus}
      />

      {/* 新增/编辑弹窗 */}
      <MaterialFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        materialId={editingId}
        categories={categories}
        units={units}
        onSuccess={() => { setDialogOpen(false); fetchMaterials(); }}
      />
    </div>
  );
}
