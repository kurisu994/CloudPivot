"use client";

import { useTranslations } from "next-intl";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { PagePlaceholder } from "@/components/common/page-placeholder";
import { CompanyInfoTab } from "./company-info-tab";

/** 标签页配置 */
const SETTINGS_TABS = [
  { value: "company-info", titleKey: "settings.tabs.companyInfo" },
  { value: "encoding-rules", titleKey: "settings.tabs.encodingRules" },
  { value: "inventory-rules", titleKey: "settings.tabs.inventoryRules" },
  { value: "print-settings", titleKey: "settings.tabs.printSettings" },
  { value: "exchange-rate", titleKey: "settings.tabs.exchangeRate" },
  { value: "data-management", titleKey: "settings.tabs.dataManagement" },
  { value: "operation-logs", titleKey: "settings.tabs.operationLogs" },
  { value: "appearance", titleKey: "settings.tabs.appearance" },
] as const;

/**
 * 系统设置页面主容器 — 标签页导航 + 内容区
 */
export function SettingsContent() {
  const t = useTranslations();

  return (
    <div className="min-w-0 space-y-6 pb-8">
      <Tabs defaultValue="company-info" className="min-w-0">
        {/* 标签页导航栏 */}
        <TabsList className="flex h-auto group-data-horizontal/tabs:h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-card p-1.5 ring-1 ring-foreground/10">
          {SETTINGS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-auto flex-none rounded-lg px-4 py-2 text-sm data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none dark:data-active:bg-primary dark:data-active:text-primary-foreground dark:data-active:border-transparent"
            >
              {t(tab.titleKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 企业信息标签页 */}
        <TabsContent value="company-info" className="mt-4 min-w-0">
          <CompanyInfoTab />
        </TabsContent>

        {/* 其他标签页 — 占位 */}
        {SETTINGS_TABS.slice(1).map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            <PagePlaceholder titleKey={tab.titleKey} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
