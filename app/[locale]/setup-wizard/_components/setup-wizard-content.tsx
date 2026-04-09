"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { AppFooter } from "@/components/layout/app-footer";
import { useAuth } from "@/components/providers/auth-provider";
import {
  setSystemConfigs,
  setSystemConfig,
  setupCreateWarehouses,
  type WarehouseSetupItem,
} from "@/lib/tauri";
import { SystemConfigKeys } from "@/lib/types/system-config";
import { StepCompanyInfo, type Step1Data } from "./step-company-info";
import { StepWarehouses, type Step2Data } from "./step-warehouses";
import { StepComplete } from "./step-complete";

/**
 * 向导主组件
 *
 * 管理 3 步向导的状态切换和数据提交：
 * - Step 1: 企业信息 → setSystemConfigs
 * - Step 2: 仓库创建 → setupCreateWarehouses
 * - Step 3: 完成 → setSystemConfig('setup_completed', '1')
 */
export function SetupWizardContent() {
  const t = useTranslations("setupWizard");
  const router = useRouter();
  const { completeSetup } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 状态
  const [step1Data, setStep1Data] = useState<Step1Data>({
    companyName: "",
    defaultLanguage: "zh",
  });
  const [step1Error, setStep1Error] = useState("");

  // Step 2 状态
  const [step2Data, setStep2Data] = useState<Step2Data>({
    rawName: "",
    rawManager: "",
    finishedName: "",
    finishedManager: "",
    semiName: "",
    semiManager: "",
  });
  const [step2Errors, setStep2Errors] = useState<{
    raw?: string;
    finished?: string;
  }>({});

  /** Step 1 → Step 2：校验并保存企业信息 */
  const handleStep1Next = useCallback(async () => {
    // 校验
    if (!step1Data.companyName.trim()) {
      setStep1Error(t("companyNameRequired"));
      return;
    }
    setStep1Error("");

    setIsLoading(true);
    try {
      await setSystemConfigs([
        {
          key: SystemConfigKeys.COMPANY_NAME,
          value: step1Data.companyName.trim(),
        },
        {
          key: SystemConfigKeys.DEFAULT_LOCALE,
          value: step1Data.defaultLanguage,
        },
      ]);
      setCurrentStep(2);
    } catch (err) {
      console.error("[SetupWizard] Step 1 保存失败:", err);
      toast.error(t("saveFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [step1Data, t]);

  /** Step 2 → Step 3：校验并创建仓库 */
  const handleStep2Next = useCallback(async () => {
    // 校验必填
    const errors: { raw?: string; finished?: string } = {};
    const rawName = step2Data.rawName.trim() || t("rawWarehouseDefault");
    const finishedName =
      step2Data.finishedName.trim() || t("finishedWarehouseDefault");

    if (!rawName) errors.raw = t("rawRequired");
    if (!finishedName) errors.finished = t("finishedRequired");

    if (Object.keys(errors).length > 0) {
      setStep2Errors(errors);
      return;
    }
    setStep2Errors({});

    setIsLoading(true);
    try {
      // 构建仓库列表
      const warehouses: WarehouseSetupItem[] = [
        {
          name: rawName,
          warehouse_type: "raw" as const,
          manager: step2Data.rawManager.trim() || undefined,
        },
        {
          name: finishedName,
          warehouse_type: "finished" as const,
          manager: step2Data.finishedManager.trim() || undefined,
        },
      ];

      // 半成品仓（可选）
      const semiName = step2Data.semiName.trim();
      if (semiName) {
        warehouses.push({
          name: semiName,
          warehouse_type: "semi" as const,
          manager: step2Data.semiManager.trim() || undefined,
        });
      }

      await setupCreateWarehouses(warehouses);
      setCurrentStep(3);
    } catch (err) {
      console.error("[SetupWizard] Step 2 仓库创建失败:", err);
      toast.error(t("warehouseCreateFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [step2Data, t]);

  /** Step 3 — 进入系统 */
  const handleEnterSystem = useCallback(async () => {
    setIsLoading(true);
    try {
      await setSystemConfig(SystemConfigKeys.SETUP_COMPLETED, "1");
      completeSetup();
      router.push("/");
    } catch (err) {
      console.error("[SetupWizard] 完成向导失败:", err);
      toast.error(t("saveFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [completeSetup, router, t]);

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* 背景装饰（与登录页/改密页统一风格） */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#294985]/5 blur-3xl dark:bg-[#294985]/10" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#294985]/5 blur-3xl dark:bg-[#294985]/10" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #294985 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* 主内容区域 */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4">
        {currentStep === 1 && (
          <StepCompanyInfo
            data={step1Data}
            onChange={setStep1Data}
            onNext={handleStep1Next}
            isLoading={isLoading}
            error={step1Error}
          />
        )}

        {currentStep === 2 && (
          <StepWarehouses
            data={step2Data}
            onChange={setStep2Data}
            onPrev={() => setCurrentStep(1)}
            onNext={handleStep2Next}
            isLoading={isLoading}
            errors={step2Errors}
          />
        )}

        {currentStep === 3 && (
          <StepComplete
            onPrev={() => setCurrentStep(2)}
            onEnter={handleEnterSystem}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* 页脚 */}
      <AppFooter className="relative z-10" />
    </div>
  );
}
