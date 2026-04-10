"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  Pencil,
  MapPin,
  Globe,
  Coins,
  Clock,
  User,
  Phone,
  Mail,
  ImageIcon,
  Save,
  Settings2,
  Contact,
  X,
} from "lucide-react";
import {
  getSystemConfigs,
  setSystemConfigs,
} from "@/lib/tauri";
import { SystemConfigKeys } from "@/lib/types/system-config";

// 表单数据类型
interface CompanyFormData {
  companyName: string;
  taxId: string;
  address: string;
  businessType: string;
  contactName: string;
  phone: string;
  email: string;
  defaultLanguage: string;
  baseCurrency: string;
  timezone: string;
  logo: string | null;
}

// 默认值 (当没在数据库获取到时使用)
const DEFAULT_DATA: CompanyFormData = {
  companyName: "",
  taxId: "",
  address: "",
  businessType: "工业制造",
  contactName: "",
  phone: "",
  email: "",
  defaultLanguage: "zh",
  baseCurrency: "USD",
  timezone: "UTC+8",
  logo: null,
};

// ================================================================
// 子组件
// ================================================================

function BasicInfoCard({
  data,
  isEditing,
  onChange,
  onEditClick,
}: {
  data: CompanyFormData;
  isEditing: boolean;
  onChange: (key: keyof CompanyFormData, val: string) => void;
  onEditClick: () => void;
}) {
  const t = useTranslations("settings.companyInfo");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Building2 className="text-primary size-5" />
          {t("basicInfo")}
        </h2>
        {!isEditing && (
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 shadow-sm"
            onClick={onEditClick}
          >
            <Pencil className="size-3.5" />
            {t("editProfile")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
        {/* 企业名称 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            {t("companyName")}
          </label>
          {isEditing ? (
            <Input
              value={data.companyName}
              onChange={(e) => onChange("companyName", e.target.value)}
              placeholder={t("companyName")}
            />
          ) : (
            <div className="min-h-6 text-base font-bold text-slate-900 dark:text-slate-100">
              {data.companyName || "—"}
            </div>
          )}
        </div>

        {/* 统一社会信用代码 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            {t("taxId")}
          </label>
          {isEditing ? (
            <Input
              value={data.taxId}
              onChange={(e) => onChange("taxId", e.target.value)}
              placeholder={t("taxId")}
              className="font-mono"
            />
          ) : (
            <div className="min-h-6 font-mono text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {data.taxId || "—"}
            </div>
          )}
        </div>

        {/* 企业地址 */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            {t("companyAddress")}
          </label>
          {isEditing ? (
            <Input
              value={data.address}
              onChange={(e) => onChange("address", e.target.value)}
              placeholder={t("companyAddress")}
            />
          ) : (
            <div className="flex min-h-6 items-start gap-2 text-base font-medium text-slate-900 dark:text-slate-100">
              <MapPin className="mt-0.5 size-[18px] shrink-0 text-slate-300" />
              <span>{data.address || "—"}</span>
            </div>
          )}
        </div>

        {/* 业务类型 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            {t("businessType")}
          </label>
          {isEditing ? (
            <Input
              value={data.businessType}
              onChange={(e) => onChange("businessType", e.target.value)}
              placeholder={t("businessType")}
            />
          ) : (
            <div className="min-h-8 pt-1">
              <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                {data.businessType || "—"}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DefaultRow({
  icon: Icon,
  label,
  value,
  isEditing,
  options,
  onValueChange,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  isEditing: boolean;
  options?: { label: string; value: string }[];
  onValueChange?: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-slate-400" />
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
          {label}
        </span>
      </div>
      {isEditing && options && onValueChange ? (
        <Select disabled={disabled} value={value} onValueChange={(val) => val && onValueChange(val)} items={options}>
          <SelectTrigger className="h-8 w-[280px] bg-white dark:bg-slate-950">
            <SelectValue placeholder={<span className="text-muted-foreground">{value}</span>} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-primary text-sm font-bold">
          {options?.find((o) => o.value === value)?.label || value || "—"}
        </span>
      )}
    </div>
  );
}

function SystemDefaultsCard({
  data,
  isEditing,
  onChange,
}: {
  data: CompanyFormData;
  isEditing: boolean;
  onChange: (key: keyof CompanyFormData, val: string) => void;
}) {
  const t = useTranslations("settings.companyInfo");

  // 模拟可选列表，后续可以根据实际需求抽离或从i18n获取
  const localeOptions = [
    { label: "简体中文 (Chinese Simplified)", value: "zh" },
    { label: "Tiếng Việt (Vietnamese)", value: "vi" },
    { label: "English", value: "en" },
  ];

  const currencyOptions = [
    { label: "人民币 (CNY ¥)", value: "CNY" },
    { label: "越南盾 (VND ₫)", value: "VND" },
    { label: "美元 (USD $)", value: "USD" },
  ];

  const timezoneOptions = [
    { label: "UTC+8 (北京, 上海, 香港)", value: "UTC+8" },
    { label: "UTC+7 (胡志明市, 曼谷)", value: "UTC+7" },
    { label: "UTC+0 (伦敦)", value: "UTC+0" },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-8 flex items-center gap-2">
        <Settings2 className="text-primary size-5" />
        <h2 className="text-lg font-bold">{t("systemDefaults")}</h2>
      </div>
      <div className="space-y-3">
        <DefaultRow
          icon={Globe}
          label={t("defaultLanguage")}
          value={data.defaultLanguage}
          isEditing={isEditing}
          options={localeOptions}
          onValueChange={(val) => onChange("defaultLanguage", val)}
        />
        <DefaultRow
          icon={Coins}
          label={t("baseCurrency")}
          value={data.baseCurrency}
          isEditing={isEditing}
          options={currencyOptions}
          onValueChange={(val) => onChange("baseCurrency", val)}
          disabled={true}
        />
        <DefaultRow
          icon={Clock}
          label={t("timezone")}
          value={data.timezone}
          isEditing={isEditing}
          options={timezoneOptions}
          onValueChange={(val) => onChange("timezone", val)}
        />
      </div>
    </section>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  isEditing,
  onValueChange,
  type = "text",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  isEditing: boolean;
  onValueChange?: (val: string) => void;
  type?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="text-primary mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="pb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          {label}
        </div>
        {isEditing && onValueChange ? (
          <Input
            type={type}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="h-8"
          />
        ) : (
          <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
            {value || "—"}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactInfoCard({
  data,
  isEditing,
  onChange,
}: {
  data: CompanyFormData;
  isEditing: boolean;
  onChange: (key: keyof CompanyFormData, val: string) => void;
}) {
  const t = useTranslations("settings.companyInfo");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h2 className="mb-8 flex items-center gap-2 text-lg font-bold">
        <Contact className="text-primary size-5" />
        {t("contactInfo")}
      </h2>
      <div className="space-y-6">
        <ContactItem
          icon={User}
          label={t("contactName")}
          value={data.contactName}
          isEditing={isEditing}
          onValueChange={(val) => onChange("contactName", val)}
        />
        <ContactItem
          icon={Phone}
          label={t("phone")}
          value={data.phone}
          isEditing={isEditing}
          onValueChange={(val) => onChange("phone", val)}
        />
        <ContactItem
          icon={Mail}
          label={t("email")}
          type="email"
          value={data.email}
          isEditing={isEditing}
          onValueChange={(val) => onChange("email", val)}
        />
      </div>
    </section>
  );
}

function BrandAssetsCard() {
  const t = useTranslations("settings.companyInfo");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h2 className="mb-8 flex items-center gap-2 text-lg font-bold">
        <ImageIcon className="text-primary size-5" />
        {t("brandAssets")}
      </h2>
      <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-8 dark:border-slate-700 dark:bg-slate-900/30">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ImageIcon className="size-14 text-slate-300/40" />
        </div>

        <div className="text-center">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {t("companyLogo")}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
            {t("logoHintSize")}
            <br />
            {t("logoHintFormat")}
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full text-xs font-bold"
          onClick={() => {
            toast.info("图片上传功能即将上线");
          }}
        >
          {t("changeLogo")}
        </Button>
      </div>
    </section>
  );
}

// ================================================================
// 主组件
// ================================================================

export function CompanyInfoContent() {
  const t = useTranslations("settings.companyInfo");

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<CompanyFormData>(DEFAULT_DATA);

  // 初次加载配置
  useEffect(() => {
    async function loadData() {
      try {
        const keys = [
          SystemConfigKeys.COMPANY_NAME,
          SystemConfigKeys.COMPANY_TAX_ID,
          SystemConfigKeys.COMPANY_ADDRESS,
          SystemConfigKeys.COMPANY_BUSINESS_TYPE,
          SystemConfigKeys.COMPANY_CONTACT_NAME,
          SystemConfigKeys.COMPANY_PHONE,
          SystemConfigKeys.COMPANY_EMAIL,
          SystemConfigKeys.DEFAULT_LOCALE,
          SystemConfigKeys.BASE_CURRENCY,
          SystemConfigKeys.TIMEZONE,
        ];
        const configs = await getSystemConfigs(keys);

        const mergedData = { ...DEFAULT_DATA };
        configs.forEach((record) => {
          if (record.key === SystemConfigKeys.COMPANY_NAME)
            mergedData.companyName = record.value;
          if (record.key === SystemConfigKeys.COMPANY_TAX_ID)
            mergedData.taxId = record.value;
          if (record.key === SystemConfigKeys.COMPANY_ADDRESS)
            mergedData.address = record.value;
          if (record.key === SystemConfigKeys.COMPANY_BUSINESS_TYPE)
            mergedData.businessType = record.value;
          if (record.key === SystemConfigKeys.COMPANY_CONTACT_NAME)
            mergedData.contactName = record.value;
          if (record.key === SystemConfigKeys.COMPANY_PHONE)
            mergedData.phone = record.value;
          if (record.key === SystemConfigKeys.COMPANY_EMAIL)
            mergedData.email = record.value;
          if (record.key === SystemConfigKeys.DEFAULT_LOCALE)
            mergedData.defaultLanguage = record.value;
          if (record.key === SystemConfigKeys.BASE_CURRENCY)
            mergedData.baseCurrency = record.value;
          if (record.key === SystemConfigKeys.TIMEZONE)
            mergedData.timezone = record.value;
        });

        setData(mergedData);
      } catch (err) {
        console.error("加载企业配置失败:", err);
        toast.error("加载数据失败");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleChange = (key: keyof CompanyFormData, val: string) => {
    setData((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const updates = [
        { key: SystemConfigKeys.COMPANY_NAME, value: data.companyName },
        { key: SystemConfigKeys.COMPANY_TAX_ID, value: data.taxId },
        { key: SystemConfigKeys.COMPANY_ADDRESS, value: data.address },
        {
          key: SystemConfigKeys.COMPANY_BUSINESS_TYPE,
          value: data.businessType,
        },
        { key: SystemConfigKeys.COMPANY_CONTACT_NAME, value: data.contactName },
        { key: SystemConfigKeys.COMPANY_PHONE, value: data.phone },
        { key: SystemConfigKeys.COMPANY_EMAIL, value: data.email },
        { key: SystemConfigKeys.DEFAULT_LOCALE, value: data.defaultLanguage },
        { key: SystemConfigKeys.BASE_CURRENCY, value: data.baseCurrency },
        { key: SystemConfigKeys.TIMEZONE, value: data.timezone },
      ];
      await setSystemConfigs(updates);
      toast.success("配置保存成功");
      setIsEditing(false);
    } catch (err) {
      console.error("保存失败:", err);
      toast.error("保存失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isEditing && data.companyName === "") {
    return <div className="p-8 text-center text-slate-500">加载中...</div>;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧栏 */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <BasicInfoCard
            data={data}
            isEditing={isEditing}
            onChange={handleChange}
            onEditClick={() => setIsEditing(true)}
          />
          <SystemDefaultsCard
            data={data}
            isEditing={isEditing}
            onChange={handleChange}
          />
        </div>

        {/* 右侧栏 */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <ContactInfoCard
            data={data}
            isEditing={isEditing}
            onChange={handleChange}
          />
          <BrandAssetsCard />
        </div>
      </div>

      {/* 底部操作区 */}
      {isEditing && (
        <div className="flex justify-end gap-4 pt-2">
          <Button
            variant="outline"
            size="lg"
            className="gap-2 px-8 font-bold"
            onClick={() => {
              setIsEditing(false);
              // 由于取消时可能需要重置数据，如果是生产环境，需要在此处重新从后端或一个 backupState 恢复。这里简单做关闭。为了体验更好可以加暂存（可选）
            }}
            disabled={isLoading}
          >
            <X className="size-4" />
            取消
          </Button>
          <Button
            size="lg"
            className="gap-2 px-10 font-bold shadow-lg"
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="size-4" />
            {t("saveChanges")}
          </Button>
        </div>
      )}
    </div>
  );
}
