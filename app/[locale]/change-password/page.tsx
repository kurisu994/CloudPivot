"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AppFooter } from "@/components/layout/app-footer";
import { useAuth } from "@/components/providers/auth-provider";

/**
 * 首次登录修改密码页面
 *
 * 对接 Rust 后端改密 API，支持：
 * - 密码强度校验（≥8位、不能与初始密码相同）
 * - 密码一致性校验
 * - 改密成功后登出并跳转登录页
 */
export default function ChangePasswordPage() {
  const t = useTranslations("changePassword");
  const router = useRouter();
  const { changePassword, logout } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  /** 密码校验 */
  const validate = (): boolean => {
    if (newPassword.length < 8) {
      setError(t("tooShort"));
      return false;
    }
    if (newPassword === "admin123") {
      setError(t("sameAsDefault"));
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError(t("mismatch"));
      return false;
    }
    setError("");
    return true;
  };

  /** 提交修改 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setError("");

    try {
      await changePassword(newPassword);
      // 改密成功 → 登出并跳转登录页
      logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("changeFailed");
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  /** 退出登录 */
  const handleLogout = () => {
    logout();
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* 背景装饰 */}
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

      {/* 主内容 */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <Card className="border-slate-200/80 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:shadow-slate-900/50">
            <CardContent className="px-8 py-10">
              {/* 图标 & 标题 */}
              <div className="mb-8 flex flex-col items-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#294985]/10 dark:bg-[#6b85c1]/15">
                  <ShieldCheck className="h-7 w-7 text-[#294985] dark:text-[#6b85c1]" />
                </div>
                <h1
                  className="text-xl font-extrabold tracking-tight text-[#294985] dark:text-slate-100"
                  style={{ fontFamily: "var(--font-noto-sans-sc), system-ui" }}
                >
                  {t("title")}
                </h1>
                <p className="text-muted-foreground mt-1.5 text-center text-sm">
                  {t("subtitle")}
                </p>
              </div>

              {/* 表单 */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 新密码 */}
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">
                    {t("newPassword")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setError("");
                      }}
                      placeholder={t("newPasswordPlaceholder")}
                      className="h-11 pr-11 pl-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 确认密码 */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">
                    {t("confirmPassword")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <ShieldCheck className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError("");
                      }}
                      placeholder={t("confirmPasswordPlaceholder")}
                      className={cn(
                        "h-11 pr-11 pl-10",
                        error &&
                          "border-destructive focus-visible:ring-destructive/20"
                      )}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {error && (
                    <p className="text-destructive text-xs font-medium">
                      {error}
                    </p>
                  )}
                </div>

                {/* 密码要求 */}
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 dark:border-blue-900/30 dark:bg-blue-950/30">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#294985] dark:text-[#6b85c1]" />
                  <p className="text-[13px] leading-relaxed text-[#294985] dark:text-[#8ba3d4]">
                    {t("requirement")}
                  </p>
                </div>

                {/* 按钮组 */}
                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLogout}
                    className="h-12 flex-1"
                  >
                    {t("logout")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="group h-12 flex-1 bg-[#294985] font-semibold shadow-lg shadow-[#294985]/25 hover:bg-[#1e3a6e] dark:bg-[#3b5da0] dark:shadow-[#3b5da0]/25 dark:hover:bg-[#4a6db5]"
                  >
                    {isLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <>
                        {t("submit")}
                        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 页脚 */}
      <AppFooter className="relative z-10" />
    </div>
  );
}
