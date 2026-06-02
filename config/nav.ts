import {
  ArrowLeftRight,
  // ── 以下图标对应阶段性隐藏的菜单，后续分批开放时连同菜单一并恢复 ──
  BarChart3,
  Box,
  Building2,
  ClipboardList,
  // ClipboardCheck,
  // CreditCard,
  Database,
  DollarSign,
  FileText,
  FolderTree,
  // Hammer,
  Hash,
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
  Package,
  PackagePlus,
  // Layers,
  // PackageCheck,
  // PackageOpen,
  PackageSearch,
  Paintbrush,
  // Palette,
  PieChart,
  Printer,
  Ruler,
  Settings,
  // Receipt,
  // RotateCcw,
  // ShoppingCart,
  // TrendingUp,
  // Truck,
  // Undo2,
  // Users,
  UserCog,
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
  /** 对应权限模块（用于前端动态过滤不可见菜单） */
  permissionModule?: string
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
    permissionModule: 'dashboard',
  },
  // 基础数据（阶段性仅开放：物料 / 分类 / 单位）
  {
    titleKey: 'nav.baseData',
    href: '/materials',
    icon: Package,
    children: [
      { titleKey: 'nav.materials', href: '/materials', icon: Package, permissionModule: 'materials' },
      { titleKey: 'nav.categories', href: '/categories', icon: FolderTree, permissionModule: 'categories' },
      /* 阶段性隐藏，后续分批开放：
      { titleKey: 'nav.suppliers', href: '/suppliers', icon: Truck, permissionModule: 'suppliers' },
      { titleKey: 'nav.customers', href: '/customers', icon: Users, permissionModule: 'customers' },
      { titleKey: 'nav.warehouses', href: '/warehouses', icon: Warehouse, permissionModule: 'warehouses' },
      */
      { titleKey: 'nav.units', href: '/units', icon: Ruler, permissionModule: 'units' },
    ],
  },
  /* ── 阶段性隐藏（BOM），后续分批开放 ──
  {
    titleKey: 'nav.bom',
    href: '/bom',
    icon: Layers,
    permissionModule: 'bom',
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
        permissionModule: 'purchase_orders',
      },
      {
        titleKey: 'nav.purchaseReceipts',
        href: '/purchase-receipts',
        icon: PackageCheck,
        permissionModule: 'purchase_receipts',
      },
      {
        titleKey: 'nav.purchaseReturns',
        href: '/purchase-returns',
        icon: Undo2,
        permissionModule: 'purchase_returns',
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
      { titleKey: 'nav.salesOrders', href: '/sales-orders', icon: Receipt, permissionModule: 'sales_orders' },
      {
        titleKey: 'nav.salesDeliveries',
        href: '/sales-deliveries',
        icon: PackageOpen,
        permissionModule: 'sales_deliveries',
      },
      { titleKey: 'nav.salesReturns', href: '/sales-returns', icon: RotateCcw, permissionModule: 'sales_returns' },
    ],
  },
  */
  // 库存（阶段性仅开放：库存查询 / 自由出入库 / 出入库流水 / 库存盘点）
  {
    titleKey: 'nav.inventory',
    href: '/inventory',
    icon: Box,
    children: [
      { titleKey: 'nav.inventoryQuery', href: '/inventory', icon: Box, permissionModule: 'inventory' },
      {
        titleKey: 'nav.manualStockMovements',
        href: '/manual-stock-movements',
        icon: PackagePlus,
        permissionModule: 'manual_stock',
      },
      {
        titleKey: 'nav.stockMovements',
        href: '/stock-movements',
        icon: ArrowLeftRight,
        permissionModule: 'inventory',
      },
      {
        titleKey: 'nav.stockChecks',
        href: '/stock-checks',
        icon: ClipboardList,
        permissionModule: 'stock_checks',
      },
      /* 阶段性隐藏，后续分批开放：
      {
        titleKey: 'nav.stockTransfers',
        href: '/stock-transfers',
        icon: ClipboardCheck,
        permissionModule: 'stock_transfers',
      },
      */
    ],
  },
  /* ── 阶段性隐藏（定制单），后续分批开放 ──
  {
    titleKey: 'nav.customOrders',
    href: '/custom-orders',
    icon: Palette,
    permissionModule: 'custom_orders',
  },
  */
  /* ── 阶段性隐藏（生产工单），后续分批开放 ──
  {
    titleKey: 'nav.productionOrders',
    href: '/production-orders',
    icon: Hammer,
    permissionModule: 'production_orders',
  },
  */
  // 智能补货
  {
    titleKey: 'nav.replenishment',
    href: '/replenishment',
    icon: Lightbulb,
    permissionModule: 'replenishment',
  },
  /* ── 阶段性隐藏（财务：应付 / 应收），后续分批开放 ──
  {
    titleKey: 'nav.finance',
    href: '/finance/payables',
    icon: Wallet,
    children: [
      { titleKey: 'nav.payables', href: '/finance/payables', icon: Wallet, permissionModule: 'payables' },
      {
        titleKey: 'nav.receivables',
        href: '/finance/receivables',
        icon: CreditCard,
        permissionModule: 'receivables',
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
        permissionModule: 'reports',
      },
      {
        titleKey: 'nav.salesReport',
        href: '/reports/sales',
        icon: TrendingUp,
        permissionModule: 'reports',
      },
      */
      {
        titleKey: 'nav.inventoryReport',
        href: '/reports/inventory',
        icon: PieChart,
        permissionModule: 'reports',
      },
    ],
  },
  // 系统设置（阶段性仅开放：操作日志 / 外观设置）
  {
    titleKey: 'nav.settings',
    href: '/settings',
    icon: Settings,
    children: [
      { titleKey: 'nav.companyInfo', href: '/settings', icon: Building2, permissionModule: 'settings_general' },
      {
        titleKey: 'nav.encodingRules',
        href: '/settings/encoding-rules',
        icon: Hash,
        permissionModule: 'settings_general',
      },
      {
        titleKey: 'nav.inventoryRules',
        href: '/settings/inventory-rules',
        icon: PackageSearch,
        permissionModule: 'settings_general',
      },
      {
        titleKey: 'nav.printSettings',
        href: '/settings/print-settings',
        icon: Printer,
        permissionModule: 'settings_general',
      },
      {
        titleKey: 'nav.exchangeRate',
        href: '/settings/exchange-rate',
        icon: DollarSign,
        permissionModule: 'settings_general',
      },
      {
        titleKey: 'nav.dataManagement',
        href: '/settings/data-management',
        icon: Database,
        permissionModule: 'data_management',
      },
      {
        titleKey: 'nav.userManagement',
        href: '/settings/user-management',
        icon: UserCog,
        permissionModule: 'user_management',
      },
      {
        titleKey: 'nav.operationLogs',
        href: '/settings/operation-logs',
        icon: FileText,
        permissionModule: 'operation_logs',
      },
      {
        titleKey: 'nav.appearance',
        href: '/settings/appearance',
        icon: Paintbrush,
        permissionModule: 'settings_appearance',
      },
    ],
  },
]
