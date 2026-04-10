import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * 加载指定语言的所有翻译分片并合并为完整的 messages 对象。
 * 翻译文件按业务域拆分存储在 messages/{locale}/ 目录下，
 * 新增模块只需在该目录下添加对应 JSON 文件并在此处注册即可。
 */
async function loadMessages(locale: Locale) {
  const modules = await Promise.all([
    import(`../messages/${locale}/common.json`),
    import(`../messages/${locale}/dashboard.json`),
    import(`../messages/${locale}/auth.json`),
    import(`../messages/${locale}/settings.json`),
    import(`../messages/${locale}/setup-wizard.json`),
    import(`../messages/${locale}/materials.json`),
  ]);

  // 将所有分片的顶层键展开合并为一个扁平对象
  return modules.reduce(
    (merged, mod) => ({ ...merged, ...mod.default }),
    {} as Record<string, unknown>
  );
}

/** next-intl 请求级配置 — 动态加载翻译文件 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as Locale;

  if (!locale || !locales.includes(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
