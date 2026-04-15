"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";

import { invoke, isTauriEnv } from "@/lib/tauri";
import { toast } from "sonner";
import type { CategoryOption, UnitOption } from "./materials-client-page";

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

interface MaterialFormData {
  id: number | null;
  code: string;
  name: string;
  material_type: string;
  category_id: number | null;
  spec: string;
  base_unit_id: number | null;
  aux_unit_id: number | null;
  conversion_rate: number | null;
  ref_cost_price: number;
  sale_price: number;
  safety_stock: number;
  max_stock: number;
  lot_tracking_mode: string;
  texture: string;
  color: string;
  surface_craft: string;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  barcode: string;
  remark: string;
}

const EMPTY_FORM: MaterialFormData = {
  id: null,
  code: "",
  name: "",
  material_type: "raw",
  category_id: null,
  spec: "",
  base_unit_id: null,
  aux_unit_id: null,
  conversion_rate: null,
  ref_cost_price: 0,
  sale_price: 0,
  safety_stock: 0,
  max_stock: 0,
  lot_tracking_mode: "none",
  texture: "",
  color: "",
  surface_craft: "",
  length_mm: null,
  width_mm: null,
  height_mm: null,
  barcode: "",
  remark: "",
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MaterialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: number | null;
  categories: CategoryOption[];
  units: UnitOption[];
  onSuccess: () => void;
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export function MaterialFormDialog({
  open,
  onOpenChange,
  materialId,
  categories,
  units,
  onSuccess,
}: MaterialFormDialogProps) {
  const t = useTranslations("materials");
  const [form, setForm] = useState<MaterialFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);

  /* 构建 Select items — base-ui 需要 items 以正确显示 SelectValue */
  const categoryItems = useMemo(
    () => categories.map((c) => ({ value: c.id.toString(), label: c.name })),
    [categories]
  );

  const unitItems = useMemo(
    () => units.map((u) => ({ value: u.id.toString(), label: u.name })),
    [units]
  );

  const auxUnitItems = useMemo(
    () => [
      { value: "none", label: "无" },
      ...units.map((u) => ({ value: u.id.toString(), label: u.name })),
    ],
    [units]
  );

  /** 更新单个字段 */
  const setField = useCallback(
    <K extends keyof MaterialFormData>(key: K, value: MaterialFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  /** 打开弹窗时加载数据 */
  useEffect(() => {
    if (!open) return;

    if (materialId) {
      setInitializing(true);
      if (!isTauriEnv()) {
        // Mock 模式
        setForm({
          ...EMPTY_FORM,
          id: materialId,
          code: "M-0001",
          name: "测试物料",
          material_type: "raw",
        });
        setInitializing(false);
        return;
      }
      invoke<MaterialFormData>("get_material_by_id", { id: materialId })
        .then((detail) => {
          setForm({
            ...detail,
            code: detail.code ?? "",
            spec: detail.spec ?? "",
            texture: detail.texture ?? "",
            color: detail.color ?? "",
            surface_craft: detail.surface_craft ?? "",
            barcode: detail.barcode ?? "",
            remark: detail.remark ?? "",
            lot_tracking_mode: detail.lot_tracking_mode ?? "none",
          });
        })
        .catch((e) => {
          toast.error("加载物料详情失败");
          console.error(e);
          onOpenChange(false);
        })
        .finally(() => setInitializing(false));
    } else {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  }, [open, materialId, onOpenChange]);

  /** 校验 */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t("validation.nameRequired");
    if (!form.material_type) errs.material_type = t("validation.typeRequired");
    if (!form.category_id) errs.category_id = t("validation.categoryRequired");
    if (!form.base_unit_id)
      errs.base_unit_id = t("validation.baseUnitRequired");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /** 提交 */
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    if (!isTauriEnv()) {
      await new Promise((r) => setTimeout(r, 500));
      toast.success(materialId ? "更新成功" : "创建成功");
      onSuccess();
      setLoading(false);
      return;
    }

    try {
      await invoke("save_material", { params: form });
      toast.success(materialId ? "更新成功" : "创建成功");
      onSuccess();
    } catch (e) {
      toast.error(typeof e === "string" ? e : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const isEdit = !!materialId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <Package className="text-primary size-5" />
            </div>
            <div>
              <DialogTitle>
                {isEdit ? t("form.editTitle") : t("form.addTitle")}
              </DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {initializing ? (
            <div className="text-muted-foreground flex items-center justify-center py-16">
              Loading...
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* ━━━ 基本信息 ━━━ */}
              <SectionTitle title={t("form.sectionBasic")} />
              <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  {/* 物料编码 */}
                  <Field>
                    <FieldLabel htmlFor="code">{t("form.code")}</FieldLabel>
                    <Input
                      id="code"
                      placeholder={t("form.codePlaceholder")}
                      value={form.code}
                      onChange={(e) => setField("code", e.target.value)}
                    />
                  </Field>

                  {/* 物料名称 * */}
                  <Field data-invalid={!!errors.name || undefined}>
                    <FieldLabel htmlFor="name">
                      {t("form.name")}{" "}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="name"
                      placeholder={t("form.namePlaceholder")}
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      aria-invalid={!!errors.name || undefined}
                    />
                    {errors.name && <FieldError>{errors.name}</FieldError>}
                  </Field>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {/* 物料类型 * */}
                  <Field data-invalid={!!errors.material_type || undefined}>
                    <FieldLabel>
                      {t("form.type")}{" "}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <RadioGroup
                      value={form.material_type}
                      onValueChange={(v) => setField("material_type", v)}
                      className="flex gap-4 pt-1"
                    >
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="raw" />
                        {t("filters.type.raw")}
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="semi" />
                        {t("filters.type.semi")}
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="finished" />
                        {t("filters.type.finished")}
                      </label>
                    </RadioGroup>
                  </Field>

                  {/* 所属分类 * */}
                  <Field data-invalid={!!errors.category_id || undefined}>
                    <FieldLabel>
                      {t("form.category")}{" "}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={form.category_id?.toString() ?? ""}
                      onValueChange={(v) =>
                        setField("category_id", v ? parseInt(v) : null)
                      }
                      items={categoryItems}
                    >
                      <SelectTrigger
                        aria-invalid={!!errors.category_id || undefined}
                      >
                        <SelectValue
                          placeholder={t("form.categoryPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category_id && (
                      <FieldError>{errors.category_id}</FieldError>
                    )}
                  </Field>

                  {/* 规格型号 */}
                  <Field>
                    <FieldLabel htmlFor="spec">{t("form.spec")}</FieldLabel>
                    <Input
                      id="spec"
                      placeholder={t("form.specPlaceholder")}
                      value={form.spec}
                      onChange={(e) => setField("spec", e.target.value)}
                    />
                  </Field>

                  {/* 计量单位 * */}
                  <Field data-invalid={!!errors.base_unit_id || undefined}>
                    <FieldLabel>
                      {t("form.baseUnit")}{" "}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={form.base_unit_id?.toString() ?? ""}
                      onValueChange={(v) =>
                        setField("base_unit_id", v ? parseInt(v) : null)
                      }
                      items={unitItems}
                    >
                      <SelectTrigger
                        aria-invalid={!!errors.base_unit_id || undefined}
                      >
                        <SelectValue
                          placeholder={t("form.baseUnitPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.base_unit_id && (
                      <FieldError>{errors.base_unit_id}</FieldError>
                    )}
                  </Field>
                </div>
              </FieldGroup>

              {/* ━━━ 价格信息 / 库存设置 ━━━ */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <SectionTitle title={t("form.sectionPrice")} />
                  <FieldGroup className="mt-3">
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="ref_cost">
                          {t("form.refCostPrice")}
                        </FieldLabel>
                        <div className="relative">
                          <span className="text-muted-foreground absolute top-2.5 left-3 text-sm">
                            ¥
                          </span>
                          <Input
                            id="ref_cost"
                            type="number"
                            step="0.01"
                            className="pl-7"
                            value={form.ref_cost_price || ""}
                            onChange={(e) =>
                              setField(
                                "ref_cost_price",
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="sale_price">
                          {t("form.salePrice")}
                        </FieldLabel>
                        <div className="relative">
                          <span className="text-muted-foreground absolute top-2.5 left-3 text-sm">
                            ¥
                          </span>
                          <Input
                            id="sale_price"
                            type="number"
                            step="0.01"
                            className="pl-7"
                            value={form.sale_price || ""}
                            onChange={(e) =>
                              setField(
                                "sale_price",
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                      </Field>
                    </div>
                  </FieldGroup>
                </div>

                <div>
                  <SectionTitle title={t("form.sectionStock")} />
                  <FieldGroup className="mt-3">
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="safety_stock">
                          {t("form.safetyStock")}
                        </FieldLabel>
                        <Input
                          id="safety_stock"
                          type="number"
                          placeholder={t("form.safetyStockPlaceholder")}
                          value={form.safety_stock || ""}
                          onChange={(e) =>
                            setField(
                              "safety_stock",
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="max_stock">
                          {t("form.maxStock")}
                        </FieldLabel>
                        <Input
                          id="max_stock"
                          type="number"
                          placeholder={t("form.maxStockPlaceholder")}
                          value={form.max_stock || ""}
                          onChange={(e) =>
                            setField(
                              "max_stock",
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </div>
              </div>

              {/* ━━━ 计量与追踪 ━━━ */}
              <SectionTitle title={t("form.sectionTracking")} />
              <FieldGroup>
                <div className="grid grid-cols-3 gap-4">
                  {/* 辅助单位 */}
                  <Field>
                    <FieldLabel>{t("form.auxUnit")}</FieldLabel>
                    <Select
                      defaultValue="none"
                      value={form.aux_unit_id?.toString() ?? "none"}
                      onValueChange={(v) =>
                        setField(
                          "aux_unit_id",
                          !v || v === "none" ? null : parseInt(v)
                        )
                      }
                      items={auxUnitItems}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">无</SelectItem>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* 换算比例 */}
                  <Field>
                    <FieldLabel htmlFor="conversion">
                      {t("form.conversionRate")}
                    </FieldLabel>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm whitespace-nowrap">
                        1辅 =
                      </span>
                      <Input
                        id="conversion"
                        type="number"
                        step="0.01"
                        placeholder={t("form.conversionRatePlaceholder")}
                        value={form.conversion_rate ?? ""}
                        onChange={(e) =>
                          setField(
                            "conversion_rate",
                            parseFloat(e.target.value) || null
                          )
                        }
                      />
                      <span className="text-muted-foreground text-sm whitespace-nowrap">
                        主单位
                      </span>
                    </div>
                  </Field>

                  {/* 批次追踪 */}
                  <Field>
                    <FieldLabel>{t("form.lotTrackingMode")}</FieldLabel>
                    <RadioGroup
                      value={form.lot_tracking_mode}
                      onValueChange={(v) => setField("lot_tracking_mode", v)}
                      className="flex gap-4 pt-1"
                    >
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="none" />
                        {t("form.lotTrackingModes.none")}
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="optional" />
                        {t("form.lotTrackingModes.optional")}
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <RadioGroupItem value="required" />
                        {t("form.lotTrackingModes.required")}
                      </label>
                    </RadioGroup>
                  </Field>
                </div>
              </FieldGroup>

              {/* ━━━ 家具属性 ━━━ */}
              <div className="bg-muted/40 rounded-lg p-5">
                <SectionTitle title={t("form.sectionFurniture")} accent />
                <FieldGroup className="mt-3">
                  <div className="grid grid-cols-3 gap-4">
                    <Field>
                      <FieldLabel htmlFor="texture">
                        {t("form.texture")}
                      </FieldLabel>
                      <Input
                        id="texture"
                        placeholder={t("form.texturePlaceholder")}
                        value={form.texture}
                        onChange={(e) => setField("texture", e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="color">{t("form.color")}</FieldLabel>
                      <Input
                        id="color"
                        placeholder={t("form.colorPlaceholder")}
                        value={form.color}
                        onChange={(e) => setField("color", e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="surface">
                        {t("form.surfaceCraft")}
                      </FieldLabel>
                      <Input
                        id="surface"
                        placeholder={t("form.surfaceCraftPlaceholder")}
                        value={form.surface_craft}
                        onChange={(e) =>
                          setField("surface_craft", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>{t("form.dimensions")}</FieldLabel>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative">
                        <Input
                          type="number"
                          value={form.length_mm ?? ""}
                          onChange={(e) =>
                            setField(
                              "length_mm",
                              parseFloat(e.target.value) || null
                            )
                          }
                          placeholder="0"
                        />
                        <span className="text-muted-foreground absolute top-2.5 right-3 text-xs">
                          {t("form.labelL")}
                        </span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={form.width_mm ?? ""}
                          onChange={(e) =>
                            setField(
                              "width_mm",
                              parseFloat(e.target.value) || null
                            )
                          }
                          placeholder="0"
                        />
                        <span className="text-muted-foreground absolute top-2.5 right-3 text-xs">
                          {t("form.labelW")}
                        </span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={form.height_mm ?? ""}
                          onChange={(e) =>
                            setField(
                              "height_mm",
                              parseFloat(e.target.value) || null
                            )
                          }
                          placeholder="0"
                        />
                        <span className="text-muted-foreground absolute top-2.5 right-3 text-xs">
                          {t("form.labelH")}
                        </span>
                      </div>
                    </div>
                  </Field>
                </FieldGroup>
              </div>

              {/* ━━━ 其他信息 ━━━ */}
              <SectionTitle title={t("form.sectionOther")} />
              <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="barcode">
                      {t("form.barcode")}
                    </FieldLabel>
                    <Input
                      id="barcode"
                      value={form.barcode}
                      onChange={(e) => setField("barcode", e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="remark">{t("form.remark")}</FieldLabel>
                    <Input
                      id="remark"
                      value={form.remark}
                      onChange={(e) => setField("remark", e.target.value)}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </div>
          )}
        </div>

        <DialogFooter className="m-0 flex items-center justify-between rounded-b-xl border-t bg-slate-50/50 px-6 py-4 sm:justify-between dark:bg-slate-900/50">
          <p className="text-muted-foreground text-xs">
            ℹ {t("form.requiredHint")}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "..." : t("actions.confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  分组标题 — 对应设计稿中带竖线的蓝色分组名                            */
/* ------------------------------------------------------------------ */

function SectionTitle({ title, accent }: { title: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-4 w-1 rounded-full ${accent ? "bg-amber-500" : "bg-primary"}`}
      />
      <span
        className={`text-sm font-bold ${accent ? "text-amber-600 dark:text-amber-400" : "text-primary"}`}
      >
        {title}
      </span>
    </div>
  );
}
