"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  companyName: "云枢工业解决方案有限公司\n(CloudPivot Industrial Solutions)",
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          {t("basicInfo")}
        </CardTitle>
        <CardAction>
          <Button variant="default" size="sm" className="gap-1.5">
            <Pencil className="size-3.5" />
            {t("editProfile")}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 企业名称 + 统一社会信用代码 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-primary/70">
              {t("companyName")}
            </p>
            <p className="text-sm font-semibold leading-relaxed whitespace-pre-line">
              {mockCompanyData.companyName}
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-primary/70">
              {t("taxId")}
            </p>
            <p className="text-sm font-semibold">
              {mockCompanyData.taxId}
            </p>
          </div>
        </div>

        {/* 企业地址 */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-primary/70">
            {t("companyAddress")}
          </p>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm">{mockCompanyData.address}</p>
          </div>
        </div>

        {/* 业务类型 */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-primary/70">
            {t("businessType")}
          </p>
          <Badge variant="outline" className="text-primary border-primary/30">
            {mockCompanyData.businessType}
          </Badge>
        </div>
      </CardContent>
    </Card>
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
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm font-semibold text-primary">{value}</span>
    </div>
  );
}

/** 系统默认值卡片 */
function SystemDefaultsCard() {
  const t = useTranslations("settings.companyInfo");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-5 text-primary" />
          {t("systemDefaults")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
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
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

/** 联系人信息卡片 */
function ContactInfoCard() {
  const t = useTranslations("settings.companyInfo");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Contact className="size-5 text-primary" />
          {t("contactInfo")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
      </CardContent>
    </Card>
  );
}

/** 品牌资产卡片 */
function BrandAssetsCard() {
  const t = useTranslations("settings.companyInfo");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="size-5 text-primary" />
          {t("brandAssets")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {/* Logo 上传区域 */}
        <div className="flex h-40 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-colors hover:border-primary/40 hover:bg-muted/50">
          <ImageIcon className="mb-2 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            {t("companyLogo")}
          </p>
        </div>

        {/* 提示信息 */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{t("logoHintSize")}</p>
          <p className="text-xs text-muted-foreground">
            {t("logoHintFormat")}
          </p>
        </div>

        {/* 更换按钮 */}
        <Button variant="outline" size="sm" className="w-full max-w-[200px]">
          {t("changeLogo")}
        </Button>
      </CardContent>
    </Card>
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
    <div className="relative pb-20">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧栏：基本信息 + 系统默认值 */}
        <div className="space-y-6 lg:col-span-2">
          <BasicInfoCard />
          <SystemDefaultsCard />
        </div>

        {/* 右侧栏：联系人信息 + 品牌资产 */}
        <div className="space-y-6">
          <ContactInfoCard />
          <BrandAssetsCard />
        </div>
      </div>

      {/* 浮动保存按钮 */}
      <div className="fixed right-8 bottom-8 z-10">
        <Button size="lg" className="gap-2 shadow-lg">
          <Save className="size-4" />
          {t("saveChanges")}
        </Button>
      </div>
    </div>
  );
}
