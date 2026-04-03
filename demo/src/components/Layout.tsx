import { Link, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useState } from 'react';

export default function Layout() {
  const location = useLocation();
  const [isPurchaseMenuOpen, setIsPurchaseMenuOpen] = useState(true);
  const [isBasicDataMenuOpen, setIsBasicDataMenuOpen] = useState(true);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      {/* SideNavBar */}
      <aside className="w-[260px] h-screen fixed left-0 top-0 bg-white border-r border-slate-100 flex flex-col z-50">
        <div className="h-16 flex-shrink-0 flex items-center px-6 border-b border-slate-50">
          <h1 className="text-xl font-bold tracking-tight text-[#4361be]">云枢 (CloudPivot IMS)</h1>
        </div>
        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-1">
          <Link
            to="/dashboard"
            className={clsx(
              "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-colors group",
              isActive('/dashboard') ? "bg-[#4c69c1] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <span className={clsx("material-symbols-outlined text-[20px]", isActive('/dashboard') ? "" : "text-slate-400 group-hover:text-slate-600")} style={{ fontVariationSettings: isActive('/dashboard') ? "'FILL' 1" : "" }}>grid_view</span>
            <span>首页</span>
          </Link>

          {/* Basic Data - Parent */}
          <div className="space-y-1">
            <button 
              onClick={() => setIsBasicDataMenuOpen(!isBasicDataMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-slate-400 group-hover:text-slate-600">database</span>
                <span>基础数据</span>
              </div>
              <span className="material-symbols-outlined text-sm text-slate-400">{isBasicDataMenuOpen ? 'expand_less' : 'expand_more'}</span>
            </button>
            {isBasicDataMenuOpen && (
              <div className="pl-10 space-y-1">
                <Link to="/materials" className={clsx("block py-2 text-sm font-medium flex items-center gap-3", isActive('/materials') ? "text-[#4c69c1] font-bold" : "text-slate-500 hover:text-[#4c69c1]")}>
                  <span className="material-symbols-outlined text-[18px]">category</span> 物料管理
                </Link>
                <a href="#" className="block py-2 text-sm text-slate-500 hover:text-[#4c69c1] font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">sell</span> 分类管理
                </a>
                <a href="#" className="block py-2 text-sm text-slate-500 hover:text-[#4c69c1] font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">corporate_fare</span> 供应商
                </a>
                <a href="#" className="block py-2 text-sm text-slate-500 hover:text-[#4c69c1] font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">group</span> 客户
                </a>
                <a href="#" className="block py-2 text-sm text-slate-500 hover:text-[#4c69c1] font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">warehouse</span> 仓库
                </a>
                <a href="#" className="block py-2 text-sm text-slate-500 hover:text-[#4c69c1] font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">straighten</span> 单位管理
                </a>
              </div>
            )}
          </div>

          <a href="#" className="flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold">
            <span className="material-symbols-outlined text-[20px] text-slate-400">account_tree</span>
            <span>BOM</span>
          </a>

          {/* Purchase Management - Parent */}
          <div className="space-y-1">
            <button 
              onClick={() => setIsPurchaseMenuOpen(!isPurchaseMenuOpen)}
              className={clsx(
                "w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors group",
                isActive('/purchase-orders') ? "text-slate-900 bg-slate-100 font-bold" : "text-slate-600 hover:bg-slate-50 font-semibold"
              )}
            >
              <div className="flex items-center gap-3">
                <span className={clsx("material-symbols-outlined text-[20px]", isActive('/purchase-orders') ? "text-[#294985]" : "text-slate-400 group-hover:text-slate-600")} style={{ fontVariationSettings: isActive('/purchase-orders') ? "'FILL' 1" : "" }}>shopping_cart</span>
                <span>采购管理</span>
              </div>
              <span className="material-symbols-outlined text-sm text-slate-400">{isPurchaseMenuOpen ? 'expand_less' : 'expand_more'}</span>
            </button>
            {isPurchaseMenuOpen && (
              <div className="pl-10 space-y-1">
                <Link to="/purchase-orders" className={clsx("block py-2 text-sm flex items-center gap-3", isActive('/purchase-orders') ? "text-[#4c69c1] font-bold" : "text-slate-500 hover:text-[#4c69c1] font-medium")}>
                  <span className="material-symbols-outlined text-[18px]">receipt</span> 采购单
                </Link>
                <a href="#" className="block py-2 text-sm text-slate-500 hover:text-[#4c69c1] font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">download</span> 采购入库
                </a>
                <a href="#" className="block py-2 text-sm text-slate-500 hover:text-[#4c69c1] font-medium flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">upload</span> 采购退货
                </a>
              </div>
            )}
          </div>

          {/* Sales Management - Parent */}
          <div className="space-y-1">
            <button className="w-full flex items-center justify-between px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors group">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-slate-400 group-hover:text-slate-600">wallet</span>
                <span>销售管理</span>
              </div>
              <span className="material-symbols-outlined text-sm text-slate-400">expand_more</span>
            </button>
          </div>

          {/* Inventory Management - Parent */}
          <div className="space-y-1">
            <button className="w-full flex items-center justify-between px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors group">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-slate-400 group-hover:text-slate-600">inventory_2</span>
                <span>库存管理</span>
              </div>
              <span className="material-symbols-outlined text-sm text-slate-400">expand_more</span>
            </button>
          </div>

          <a href="#" className="flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold">
            <span className="material-symbols-outlined text-[20px] text-slate-400">assignment</span>
            <span>定制订单</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold">
            <span className="material-symbols-outlined text-[20px] text-slate-400">factory</span>
            <span>生产工单</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold">
            <span className="material-symbols-outlined text-[20px] text-slate-400">reorder</span>
            <span>智能补货</span>
          </a>

          {/* Finance Management - Parent */}
          <div className="space-y-1">
            <button className="w-full flex items-center justify-between px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors group">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-slate-400 group-hover:text-slate-600">payments</span>
                <span>财务管理</span>
              </div>
              <span className="material-symbols-outlined text-sm text-slate-400">expand_more</span>
            </button>
          </div>

          <a href="#" className="flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold">
            <span className="material-symbols-outlined text-[20px] text-slate-400">assessment</span>
            <span>报表统计</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold">
            <span className="material-symbols-outlined text-[20px] text-slate-400">settings</span>
            <span>系统设置</span>
          </a>
        </nav>
      </aside>

      {/* TopNavBar */}
      <header className="fixed top-0 right-0 left-[260px] h-16 z-40 bg-white border-b border-slate-100 flex items-center justify-between px-8">
        <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
          <button className="text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>menu</span></button>
          <div className="flex items-center gap-2">
            {isActive('/dashboard') && <span className="text-slate-900">首页</span>}
            {isActive('/materials') && (
              <>
                <span>基础数据</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-900">物料管理</span>
              </>
            )}
            {isActive('/purchase-orders') && (
              <>
                <span>采购管理</span>
                <span className="text-slate-300">/</span>
                <span className={location.pathname === '/purchase-orders' ? "text-slate-900" : ""}>采购单</span>
                {location.pathname !== '/purchase-orders' && (
                  <>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-900">PO-20260326-001</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-slate-400">
            <button className="hover:text-primary transition-colors"><span className="material-symbols-outlined">language</span></button>
            <div className="relative">
              <button className="hover:text-primary transition-colors"><span className="material-symbols-outlined">notifications</span></button>
              <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
            </div>
            <button className="hover:text-primary transition-colors"><span className="material-symbols-outlined">help</span></button>
          </div>
          <div className="border-l border-slate-200 h-6"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold leading-none">Admin User</p>
              <p className="text-[10px] text-slate-400 uppercase mt-1">Super Administrator</p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>account_circle</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="ml-[260px] pt-16 pb-24 px-8 min-h-screen bg-white">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-[260px] right-0 py-4 bg-[#fafafa] border-t border-slate-100 flex justify-between items-center px-8 z-[60]">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400">© 2024 云枢 (CloudPivot IMS) v2.4.0. 保留所有权利。</p>
        <div className="flex gap-6">
          <a href="#" className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 hover:text-[#294985] transition-colors">服务条款</a>
          <a href="#" className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 hover:text-[#294985] transition-colors">隐私政策</a>
          <a href="#" className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 hover:text-[#294985] transition-colors">Support</a>
        </div>
      </footer>
    </div>
  );
}
