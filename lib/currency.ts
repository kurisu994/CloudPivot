/**
 * 多币种格式化工具
 *
 * 所有金额在数据库中以最小货币单位的整数值存储：
 * - VND（越南盾）：无小数，1 VND = 1
 * - CNY（人民币）：精确到分，1 元 = 100
 * - USD（美元）：精确到分，1 美元 = 100
 *
 * 此模块提供金额的格式化与解析能力。
 */

/** 支持的币种类型 */
export type Currency = "VND" | "CNY" | "USD";

/** 币种配置 */
interface CurrencyConfig {
  /** 精度系数（数据库值 / 系数 = 实际金额） */
  factor: number;
  /** 小数位数 */
  decimalPlaces: number;
  /** 币种符号 */
  symbol: string;
  /** 符号位置 */
  symbolPosition: "prefix" | "suffix";
  /** 千分位分隔符 */
  thousandsSeparator: string;
  /** 小数分隔符 */
  decimalSeparator: string;
}

/** 币种配置表 */
const CURRENCY_CONFIGS: Record<Currency, CurrencyConfig> = {
  VND: {
    factor: 1,
    decimalPlaces: 0,
    symbol: "₫",
    symbolPosition: "suffix",
    thousandsSeparator: ".",
    decimalSeparator: ",",
  },
  CNY: {
    factor: 100,
    decimalPlaces: 2,
    symbol: "¥",
    symbolPosition: "prefix",
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  USD: {
    factor: 100,
    decimalPlaces: 2,
    symbol: "$",
    symbolPosition: "prefix",
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
};

/**
 * 将数据库存储的整数金额转换为实际金额
 *
 * @param amount - 数据库中的整数金额（最小货币单位）
 * @param currency - 币种
 * @returns 实际金额（浮点数）
 */
export function toDisplayAmount(amount: number, currency: Currency): number {
  const config = CURRENCY_CONFIGS[currency];
  return amount / config.factor;
}

/**
 * 将实际金额转换为数据库存储的整数金额
 *
 * @param displayAmount - 实际金额
 * @param currency - 币种
 * @returns 数据库整数金额（最小货币单位）
 */
export function toStorageAmount(
  displayAmount: number,
  currency: Currency
): number {
  const config = CURRENCY_CONFIGS[currency];
  return Math.round(displayAmount * config.factor);
}

/**
 * 格式化金额为显示字符串
 *
 * @param amount - 数据库中的整数金额（最小货币单位）
 * @param currency - 币种
 * @param options - 格式化选项
 * @returns 格式化后的金额字符串（如 "$1,200.00"、"¥280.50"、"29,250,000₫"）
 */
export function formatAmount(
  amount: number,
  currency: Currency,
  options?: {
    /** 是否显示币种符号，默认 true */
    showSymbol?: boolean;
    /** 是否显示千分位分隔符，默认 true */
    showThousands?: boolean;
  }
): string {
  const config = CURRENCY_CONFIGS[currency];
  const showSymbol = options?.showSymbol ?? true;
  const showThousands = options?.showThousands ?? true;

  // 转换为实际金额
  const displayAmount = amount / config.factor;

  // 格式化数字部分
  const [intPart, decPart] = displayAmount
    .toFixed(config.decimalPlaces)
    .split(".");

  // 添加千分位分隔符
  let formattedInt = intPart;
  if (showThousands) {
    formattedInt = intPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      config.thousandsSeparator
    );
  }

  // 拼接小数部分
  let result = formattedInt;
  if (config.decimalPlaces > 0 && decPart) {
    result += config.decimalSeparator + decPart;
  }

  // 添加币种符号
  if (showSymbol) {
    if (config.symbolPosition === "prefix") {
      result = config.symbol + result;
    } else {
      result = result + config.symbol;
    }
  }

  return result;
}

/**
 * 获取币种配置
 */
export function getCurrencyConfig(currency: Currency): CurrencyConfig {
  return CURRENCY_CONFIGS[currency];
}

/**
 * 所有支持的币种列表
 */
export const SUPPORTED_CURRENCIES: Currency[] = ["VND", "CNY", "USD"];
