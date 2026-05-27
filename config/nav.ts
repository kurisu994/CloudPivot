import {
  ArrowLeftRight,
  // ── 以下图标对应阶段性隐藏的菜单，后续分批开放时连同菜单一并恢复 ──
  BarChart3,
  Box,
  ClipboardList,
  FileText,
  FolderTree,
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
  Package,
  PackagePlus,
  Paintbrush,
  // Building2,
  // ClipboardCheck,
  // CreditCard,
  // Database,
  // DollarSign,
  // Hammer,
  // Hash,
  // Layers,
  // PackageCheck,
  // PackageOpen,
  // PackageSearch,
  // Palette,
  PieChart,
  Ruler,
  Settings,
  // Printer,
  // Receipt,
  // RotateCcw,
  // ShoppingCart,
  // TrendingUp,
  // Truck,
  // Undo2,
  // Users,
  // Wallet,
  // Warehouse,
} from 'lucide-react'

/** 侧边栏导航项类型 */
export interface NavItem {
  /** i18n 翻译键 */
  titleKey: string
  /** 路由路径 */
  href: string
  /** 图标组件 */
  icon: LucideIcon
  /** 子菜单 */
  children?: NavItem[]
}

/**
 * 侧边栏导航配置
 * 对应 UI 原型 §1.1 的 12 大模块
 *
 * 阶段性裁剪：当前仅开放 首页看板、物料管理、分类管理、单位管理、
 * 库存查询、自由出入库、出入库流水、库存盘点、智能补货、操作日志、外观设置。
 * 其余菜单用块注释暂时隐藏，后续分批开放时去掉对应注释（及顶部图标 import）即可。
 */
export const navConfig: NavItem[] = [
  // 首页看板
  {
    titleKey: 'nav.dashboard',
    href: '',
    icon: LayoutDashboard,
  },
  // 基础数据（阶段性仅开放：物料 / 分类 / 单位）
  {
    titleKey: 'nav.baseData',
    href: '/materials',
    icon: Package,
    children: [
      { titleKey: 'nav.materials', href: '/materials', icon: Package },
      { titleKey: 'nav.categories', href: '/categories', icon: FolderTree },
      /* 阶段性隐藏，后续分批开放：
      { titleKey: 'nav.suppliers', href: '/suppliers', icon: Truck },
      { titleKey: 'nav.customers', href: '/customers', icon: Users },
      { titleKey: 'nav.warehouses', href: '/warehouses', icon: Warehouse },
      */
      { titleKey: 'nav.units', href: '/units', icon: Ruler },
    ],
  },
  /* ── 阶段性隐藏（BOM），后续分批开放 ──
  {
    titleKey: 'nav.bom',
    href: '/bom',
    icon: Layers,
  },
  */
  /* ── 阶段性隐藏（采购），后续分批开放 ──
  {
    titleKey: 'nav.purchase',
    href: '/purchase-orders',
    icon: ShoppingCart,
    children: [
      {
        titleKey: 'nav.purchaseOrders',
        href: '/purchase-orders',
        icon: ShoppingCart,
      },
      {
        titleKey: 'nav.purchaseReceipts',
        href: '/purchase-receipts',
        icon: PackageCheck,
      },
      {
        titleKey: 'nav.purchaseReturns',
        href: '/purchase-returns',
        icon: Undo2,
      },
    ],
  },
  */
  /* ── 阶段性隐藏（销售），后续分批开放 ──
  {
    titleKey: 'nav.sales',
    href: '/sales-orders',
    icon: Receipt,
    children: [
      { titleKey: 'nav.salesOrders', href: '/sales-orders', icon: Receipt },
      {
        titleKey: 'nav.salesDeliveries',
        href: '/sales-deliveries',
        icon: PackageOpen,
      },
      { titleKey: 'nav.salesReturns', href: '/sales-returns', icon: RotateCcw },
    ],
  },
  */
  // 库存（阶段性仅开放：库存查询 / 自由出入库 / 出入库流水 / 库存盘点）
  {
    titleKey: 'nav.inventory',
    href: '/inventory',
    icon: Box,
    children: [
      { titleKey: 'nav.inventoryQuery', href: '/inventory', icon: Box },
      {
        titleKey: 'nav.manualStockMovements',
        href: '/manual-stock-movements',
        icon: PackagePlus,
      },
      {
        titleKey: 'nav.stockMovements',
        href: '/stock-movements',
        icon: ArrowLeftRight,
      },
      {
        titleKey: 'nav.stockChecks',
        href: '/stock-checks',
        icon: ClipboardList,
      },
      /* 阶段性隐藏，后续分批开放：
      {
        titleKey: 'nav.stockTransfers',
        href: '/stock-transfers',
        icon: ClipboardCheck,
      },
      */
    ],
  },
  /* ── 阶段性隐藏（定制单），后续分批开放 ──
  {
    titleKey: 'nav.customOrders',
    href: '/custom-orders',
    icon: Palette,
  },
  */
  /* ── 阶段性隐藏（生产工单），后续分批开放 ──
  {
    titleKey: 'nav.productionOrders',
    href: '/production-orders',
    icon: Hammer,
  },
  */
  // 智能补货
  {
    titleKey: 'nav.replenishment',
    href: '/replenishment',
    icon: Lightbulb,
  },
  /* ── 阶段性隐藏（财务：应付 / 应收），后续分批开放 ──
  {
    titleKey: 'nav.finance',
    href: '/finance/payables',
    icon: Wallet,
    children: [
      { titleKey: 'nav.payables', href: '/finance/payables', icon: Wallet },
      {
        titleKey: 'nav.receivables',
        href: '/finance/receivables',
        icon: CreditCard,
      },
    ],
  },
  */
  // 报表中心（阶段性仅开放：库存报表）
  {
    titleKey: 'nav.reports',
    href: '/reports/inventory',
    icon: BarChart3,
    children: [
      /* 阶段性隐藏，后续分批开放：
      {
        titleKey: 'nav.purchaseReport',
        href: '/reports/purchase',
        icon: BarChart3,
      },
      {
        titleKey: 'nav.salesReport',
        href: '/reports/sales',
        icon: TrendingUp,
      },
      */
      {
        titleKey: 'nav.inventoryReport',
        href: '/reports/inventory',
        icon: PieChart,
      },
    ],
  },
  // 系统设置（阶段性仅开放：操作日志 / 外观设置）
  {
    titleKey: 'nav.settings',
    href: '/settings',
    icon: Settings,
    children: [
      /* 阶段性隐藏，后续分批开放：
      { titleKey: 'nav.companyInfo', href: '/settings', icon: Building2 },
      {
        titleKey: 'nav.encodingRules',
        href: '/settings/encoding-rules',
        icon: Hash,
      },
      {
        titleKey: 'nav.inventoryRules',
        href: '/settings/inventory-rules',
        icon: PackageSearch,
      },
      {
        titleKey: 'nav.printSettings',
        href: '/settings/print-settings',
        icon: Printer,
      },
      {
        titleKey: 'nav.exchangeRate',
        href: '/settings/exchange-rate',
        icon: DollarSign,
      },
      {
        titleKey: 'nav.dataManagement',
        href: '/settings/data-management',
        icon: Database,
      },
      */
      {
        titleKey: 'nav.operationLogs',
        href: '/settings/operation-logs',
        icon: FileText,
      },
      {
        titleKey: 'nav.appearance',
        href: '/settings/appearance',
        icon: Paintbrush,
      },
    ],
  },
]
