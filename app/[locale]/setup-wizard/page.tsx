"use client";

import { SetupWizardContent } from "./_components/setup-wizard-content";

/**
 * 首次使用向导页面
 *
 * 用户完成首次改密后，若 setup_completed=0，自动跳转至此页面。
 * 独立布局（无侧边栏/顶栏），与登录/改密页风格一致。
 */
export default function SetupWizardPage() {
  return <SetupWizardContent />;
}
