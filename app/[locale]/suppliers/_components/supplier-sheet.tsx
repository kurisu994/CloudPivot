"use client";

import { Building2, CreditCard, Info, MapPin, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SaveSupplierParams } from "@/lib/tauri";
import { generateSupplierCode, getSupplierById, saveSupplier } from "@/lib/tauri";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, GRADE_OPTIONS, SETTLEMENT_TYPE_OPTIONS } from "./suppliers-content";

// ================================================================
// 表单本地类型（所有字段均为 string，保存时转换为 null）
// ================================================================

interface FormData {
  code: string;
  name: string;
  shortName: string;
  country: string;
  contactPerson: string;
  contactPhone: string;
  email: string;
  businessCategory: string;
  province: string;
  city: string;
  address: string;
  bankName: string;
  bankAccount: string;
  taxId: string;
  currency: string;
  settlementType: string;
  creditDays: number;
  grade: string;
  remark: string;
  isEnabled: boolean;
}

/** 空表单默认值 */
const EMPTY_FORM: FormData = {
  code: "",
  name: "",
  shortName: "",
  country: "VN",
  contactPerson: "",
  contactPhone: "",
  email: "",
  businessCategory: "",
  province: "",
  city: "",
  address: "",
  bankName: "",
  bankAccount: "",
  taxId: "",
  currency: "USD",
  settlementType: "cash",
  creditDays: 0,
  grade: "B",
  remark: "",
  isEnabled: true,
};

/** 将后端数据转换为表单数据 */
function paramsToForm(p: SaveSupplierParams): FormData {
  return {
    code: p.code,
    name: p.name,
    shortName: p.shortName ?? "",
    country: p.country,
    contactPerson: p.contactPerson ?? "",
    contactPhone: p.contactPhone ?? "",
    email: p.email ?? "",
    businessCategory: p.businessCategory ?? "",
    province: p.province ?? "",
    city: p.city ?? "",
    address: p.address ?? "",
    bankName: p.bankName ?? "",
    bankAccount: p.bankAccount ?? "",
    taxId: p.taxId ?? "",
    currency: p.currency,
    settlementType: p.settlementType,
    creditDays: p.creditDays,
    grade: p.grade,
    remark: p.remark ?? "",
    isEnabled: p.isEnabled,
  };
}

/** 将表单数据转换为保存参数（空字符串 → null） */
function formToParams(form: FormData, id: number | null): SaveSupplierParams {
  return {
    id: id ?? undefined,
    code: form.code,
    name: form.name,
    shortName: form.shortName || null,
    country: form.country,
    contactPerson: form.contactPerson || null,
    contactPhone: form.contactPhone || null,
    email: form.email || null,
    businessCategory: form.businessCategory || null,
    province: form.province || null,
    city: form.city || null,
    address: form.address || null,
    bankName: form.bankName || null,
    bankAccount: form.bankAccount || null,
    taxId: form.taxId || null,
    currency: form.currency,
    settlementType: form.settlementType,
    creditDays: form.creditDays,
    grade: form.grade,
    remark: form.remark || null,
    isEnabled: form.isEnabled,
  };
}

// ================================================================
// 子组件
// ================================================================

/** 表单分区标题 */
function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">
      <Icon className="text-primary size-4" />
      {title}
    </h3>
  );
}

/** 表单字段容器 */
function FormField({
  label,
  required,
  children,
  fullWidth,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <Label className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ================================================================
// 主组件
// ================================================================

interface SupplierSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑模式时传入供应商 ID，新增模式传 null */
  supplierId: number | null;
  /** 保存成功后的回调 */
  onSaved: () => void;
}

/** 供应商新增/编辑抽屉面板 */
export function SupplierSheet({ open, onOpenChange, supplierId, onSaved }: SupplierSheetProps) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const isEdit = supplierId !== null;

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<string>("basic");
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 打开时初始化表单数据
  const initForm = useCallback(async () => {
    setActiveTab("basic");
    if (supplierId !== null) {
      // 编辑模式：从后端加载完整数据
      setLoadingDetail(true);
      try {
        const detail = await getSupplierById(supplierId);
        setForm(paramsToForm(detail));
      } catch (err) {
        console.error("加载供应商详情失败", err);
        toast.error(t("loadError"));
      } finally {
        setLoadingDetail(false);
      }
    } else {
      // 新增模式：生成编码
      try {
        const code = await generateSupplierCode();
        setForm({ ...EMPTY_FORM, code });
      } catch (err) {
        console.error("生成编码失败", err);
        setForm({ ...EMPTY_FORM });
      }
    }
  }, [supplierId, t]);

  useEffect(() => {
    if (open) {
      initForm();
    }
  }, [open, initForm]);

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 提交保存 */
  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await saveSupplier(formToParams(form, supplierId));
      toast.success(t("saveSuccess"));
      onSaved();
    } catch (err) {
      console.error("保存供应商失败", err);
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  // 构建 Select 的 items 数组
  const countryItems = useMemo(() => COUNTRY_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })), [t]);
  const gradeItems = useMemo(() => GRADE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })), [t]);
  const currencyItems = useMemo(() => CURRENCY_OPTIONS.map((o) => ({ ...o })), []);
  const settlementItems = useMemo(
    () => SETTLEMENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-2xl" showCloseButton>
        {/* 头部 */}
        <SheetHeader>
          <SheetTitle>{isEdit ? t("editSupplier") : t("addSupplier")}</SheetTitle>
          <SheetDescription>{isEdit ? t("editDescription") : t("addDescription")}</SheetDescription>
        </SheetHeader>

        {/* 标签页 */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => val && setActiveTab(val as string)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList variant="line" className="shrink-0 px-4">
            <TabsTrigger value="basic">{t("basicInfo")}</TabsTrigger>
            <TabsTrigger value="materials">{t("supplyMaterials")}</TabsTrigger>
          </TabsList>

          {/* 基本信息 Tab */}
          <TabsContent value="basic" className="flex-1 overflow-y-auto px-4 pb-4">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-muted-foreground text-sm">{tc("loading")}...</p>
              </div>
            ) : (
              <div className="space-y-6 pt-4">
                {/* 基本信息 */}
                <div className="space-y-4">
                  <SectionTitle icon={Building2} title={t("basicInfo")} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={t("code")} required>
                      <Input value={form.code} readOnly className="bg-muted font-mono text-sm" />
                    </FormField>
                    <FormField label={t("name")} required>
                      <Input
                        value={form.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder={t("namePlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("shortName")}>
                      <Input
                        value={form.shortName}
                        onChange={(e) => updateField("shortName", e.target.value)}
                        placeholder={t("shortNamePlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("country")} required>
                      <Select
                        value={form.country}
                        onValueChange={(val) => val && updateField("country", val)}
                        items={countryItems}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countryItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label={t("businessCategory")}>
                      <Input
                        value={form.businessCategory}
                        onChange={(e) => updateField("businessCategory", e.target.value)}
                        placeholder={t("categoryPlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("contactPerson")}>
                      <Input
                        value={form.contactPerson}
                        onChange={(e) => updateField("contactPerson", e.target.value)}
                        placeholder={t("contactPersonPlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("contactPhone")}>
                      <Input
                        value={form.contactPhone}
                        onChange={(e) => updateField("contactPhone", e.target.value)}
                        placeholder={t("contactPhonePlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("email")}>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder={t("emailPlaceholder")}
                      />
                    </FormField>
                  </div>
                </div>

                {/* 结算信息 */}
                <div className="space-y-4">
                  <SectionTitle icon={CreditCard} title={t("settlementInfo")} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={t("grade")}>
                      <Select
                        value={form.grade}
                        onValueChange={(val) => val && updateField("grade", val)}
                        items={gradeItems}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gradeItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label={t("currency")} required>
                      <Select
                        value={form.currency}
                        onValueChange={(val) => val && updateField("currency", val)}
                        items={currencyItems}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label={t("settlementType")}>
                      <Select
                        value={form.settlementType}
                        onValueChange={(val) => val && updateField("settlementType", val)}
                        items={settlementItems}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {settlementItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label={t("creditDays")}>
                      <Input
                        type="number"
                        min={0}
                        value={form.creditDays}
                        onChange={(e) => updateField("creditDays", Number.parseInt(e.target.value) || 0)}
                        placeholder={t("creditDaysPlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("taxId")} fullWidth>
                      <Input
                        value={form.taxId}
                        onChange={(e) => updateField("taxId", e.target.value)}
                        placeholder={t("taxIdPlaceholder")}
                      />
                    </FormField>
                  </div>
                </div>

                {/* 地址信息 */}
                <div className="space-y-4">
                  <SectionTitle icon={MapPin} title={t("addressInfo")} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={t("province")}>
                      <Input
                        value={form.province}
                        onChange={(e) => updateField("province", e.target.value)}
                        placeholder={t("provincePlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("city")}>
                      <Input
                        value={form.city}
                        onChange={(e) => updateField("city", e.target.value)}
                        placeholder={t("cityPlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("address")} fullWidth>
                      <Input
                        value={form.address}
                        onChange={(e) => updateField("address", e.target.value)}
                        placeholder={t("addressPlaceholder")}
                      />
                    </FormField>
                  </div>
                </div>

                {/* 银行信息 */}
                <div className="space-y-4">
                  <SectionTitle icon={CreditCard} title={t("bankInfo")} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={t("bankName")}>
                      <Input
                        value={form.bankName}
                        onChange={(e) => updateField("bankName", e.target.value)}
                        placeholder={t("bankNamePlaceholder")}
                      />
                    </FormField>
                    <FormField label={t("bankAccount")}>
                      <Input
                        value={form.bankAccount}
                        onChange={(e) => updateField("bankAccount", e.target.value)}
                        placeholder={t("bankAccountPlaceholder")}
                      />
                    </FormField>
                  </div>
                </div>

                {/* 其他信息 */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={t("remark")} fullWidth>
                      <Input
                        value={form.remark}
                        onChange={(e) => updateField("remark", e.target.value)}
                        placeholder={t("remarkPlaceholder")}
                      />
                    </FormField>
                    <div className="col-span-2 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <Label className="text-sm font-medium">{t("isEnabled")}</Label>
                      <Switch checked={form.isEnabled} onCheckedChange={(val) => updateField("isEnabled", !!val)} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 供应物料 Tab */}
          <TabsContent value="materials" className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Package className="text-muted-foreground size-8" />
              </div>
              <p className="text-muted-foreground max-w-sm text-center text-sm">{t("noMaterials")}</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部操作栏 */}
        <SheetFooter className="border-t border-slate-200 dark:border-slate-800">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Info className="size-3.5" />
              {t("requiredHint")}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={handleSubmit} disabled={saving || loadingDetail}>
                {t("confirmSave")}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
