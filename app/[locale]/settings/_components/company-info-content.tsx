"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

/**
 * Mock 数据 — 后续替换为 Tauri IPC 调用
 *
 * 对应 system_config 表中企业信息相关的配置项
 */
const mockCompanyData = {
  companyName:
    "云枢工业解决方案有限公司 (CloudPivot Industrial Solutions)",
  taxId: "91310115MA1K3AXXXX",
  address: "中国（上海）自由贸易试验区科技创新大厦 800 室",
  businessType: "工业制造",
  contactName: "阮文安 (Nguyen Van A)",
  phone: "+86 138 0000 0000",
  email: "contact@cloudpivot-ims.com",
  defaultLanguage: "简体中文 (Chinese Simplified)",
  baseCurrency: "美元 (USD $)",
  timezone: "UTC+8 (北京, 上海, 香港)",
  logo: null as string | null,
};

// ================================================================
// 子组件
// ================================================================

/** 基本信息卡片 */
function BasicInfoCard() {
  const t = useTranslations("settings.companyInfo");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Building2 className="size-5 text-primary" />
          {t("basicInfo")}
        </h2>
        <Button variant="default" size="sm" className="gap-1.5 shadow-sm">
          <Pencil className="size-3.5" />
          {t("editProfile")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
        {/* 企业名称 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {t("companyName")}
          </label>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100">
            {mockCompanyData.companyName}
          </div>
        </div>

        {/* 统一社会信用代码 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {t("taxId")}
          </label>
          <div className="font-mono text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {mockCompanyData.taxId}
          </div>
        </div>

        {/* 企业地址 */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {t("companyAddress")}
          </label>
          <div className="flex items-start gap-2 text-base font-medium text-slate-900 dark:text-slate-100">
            <MapPin className="mt-0.5 size-[18px] shrink-0 text-slate-300" />
            <span>{mockCompanyData.address}</span>
          </div>
        </div>

        {/* 业务类型 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {t("businessType")}
          </label>
          <div className="pt-1">
            <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
              {mockCompanyData.businessType}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 系统默认值行 */
function DefaultRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-slate-400" />
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
          {label}
        </span>
      </div>
      <span className="text-sm font-bold text-primary">{value}</span>
    </div>
  );
}

/** 系统默认值卡片 */
function SystemDefaultsCard() {
  const t = useTranslations("settings.companyInfo");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-8 flex items-center gap-2">
        <Settings2 className="size-5 text-primary" />
        <h2 className="text-lg font-bold">{t("systemDefaults")}</h2>
      </div>
      <div className="space-y-3">
        <DefaultRow
          icon={Globe}
          label={t("defaultLanguage")}
          value={mockCompanyData.defaultLanguage}
        />
        <DefaultRow
          icon={Coins}
          label={t("baseCurrency")}
          value={mockCompanyData.baseCurrency}
        />
        <DefaultRow
          icon={Clock}
          label={t("timezone")}
          value={mockCompanyData.timezone}
        />
      </div>
    </section>
  );
}

/** 联系人信息项 */
function ContactItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-10 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-primary dark:border-slate-800 dark:bg-slate-900">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {label}
        </div>
        <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
          {value}
        </div>
      </div>
    </div>
  );
}

/** 联系人信息卡片 */
function ContactInfoCard() {
  const t = useTranslations("settings.companyInfo");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h2 className="mb-8 flex items-center gap-2 text-lg font-bold">
        <Contact className="size-5 text-primary" />
        {t("contactInfo")}
      </h2>
      <div className="space-y-8">
        <ContactItem
          icon={User}
          label={t("contactName")}
          value={mockCompanyData.contactName}
        />
        <ContactItem
          icon={Phone}
          label={t("phone")}
          value={mockCompanyData.phone}
        />
        <ContactItem
          icon={Mail}
          label={t("email")}
          value={mockCompanyData.email}
        />
      </div>
    </section>
  );
}

/** 品牌资产卡片 */
function BrandAssetsCard() {
  const t = useTranslations("settings.companyInfo");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h2 className="mb-8 flex items-center gap-2 text-lg font-bold">
        <ImageIcon className="size-5 text-primary" />
        {t("brandAssets")}
      </h2>
      <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-8 dark:border-slate-700 dark:bg-slate-900/30">
        {/* Logo 预览框 */}
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ImageIcon className="size-14 text-slate-300/40" />
        </div>

        {/* 标题和提示 */}
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

        {/* 更换按钮 */}
        <button className="w-full rounded-lg border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
          {t("changeLogo")}
        </button>
      </div>
    </section>
  );
}

// ================================================================
// 主组件
// ================================================================

/**
 * 企业信息页面 — 展示企业基本信息、系统默认值、联系人和品牌资产
 */
export function CompanyInfoContent() {
  const t = useTranslations("settings.companyInfo");

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧栏：基本信息 + 系统默认值 */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <BasicInfoCard />
          <SystemDefaultsCard />
        </div>

        {/* 右侧栏：联系人信息 + 品牌资产 */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <ContactInfoCard />
          <BrandAssetsCard />
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end pt-2">
        <Button size="lg" className="gap-2 px-10 py-4 font-bold shadow-lg">
          <Save className="size-4" />
          {t("saveChanges")}
        </Button>
      </div>
    </div>
  );
}
