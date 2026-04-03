export default function Dashboard() {
  return (
    <>
      {/* Dashboard Header */}
      <div className="flex justify-between items-center mt-6 mb-6">
        <h2 className="text-2xl font-bold text-on-surface">首页看板</h2>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-base">refresh</span>
            刷新数据
          </button>
        </div>
      </div>

      {/* Row 1: Primary KPIs */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-slate-500 tracking-wider">今日销售额</span>
            <span className="text-emerald-600 text-xs font-bold flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">+5.2% <span className="material-symbols-outlined text-[14px] ml-0.5">trending_up</span></span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface">$125,800</h3>
          <p className="text-[10px] text-slate-400 mt-2">较昨日上涨</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-slate-500 tracking-wider">本月累计销售</span>
            <span className="text-emerald-600 text-xs font-bold flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">+12.8% <span className="material-symbols-outlined text-[14px] ml-0.5">trending_up</span></span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface">$3,582,000</h3>
          <p className="text-[10px] text-slate-400 mt-2">进度：85% (目标 $4.2M)</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-slate-500 tracking-wider">今日采购额</span>
            <span className="text-rose-600 text-xs font-bold flex items-center bg-rose-50 px-2 py-0.5 rounded-full">-3.1% <span className="material-symbols-outlined text-[14px] ml-0.5">trending_down</span></span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface">$83,200</h3>
          <p className="text-[10px] text-slate-400 mt-2">主要为木材原材料</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm border-l-4 border-secondary">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-slate-500 tracking-wider">库存预警</span>
            <span className="text-secondary text-xs font-bold flex items-center bg-orange-50 px-2 py-0.5 rounded-full">+3 <span className="material-symbols-outlined text-[14px] ml-0.5">warning</span></span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface">12 项</h3>
          <p className="text-[10px] text-slate-400 mt-2">低于安全库存水位</p>
        </div>
      </div>

      {/* Row 2: Secondary KPIs */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-50 p-4 rounded-lg flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">待收款 (A/R)</p>
            <p className="text-lg font-bold text-on-surface">$865,000</p>
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">payments</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">待付款 (A/P)</p>
            <p className="text-lg font-bold text-on-surface">$423,000</p>
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">autorenew</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">补货项 (Pending)</p>
            <p className="text-lg font-bold text-on-surface">8 项目</p>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="mb-8 p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary/60">bolt</span>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">快捷操作 Quick Actions</span>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#294985] text-white rounded-lg text-sm font-semibold shadow-md hover:opacity-90 transition-all active:scale-95">
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            新建采购单
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white text-on-surface border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-primary">receipt_long</span>
            新建销售单
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white text-on-surface border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-secondary">move_to_inbox</span>
            采购入库
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white text-on-surface border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-secondary">outbox</span>
            销售出库
          </button>
        </div>
      </div>

      {/* Row 3: Sales Trend & Inventory Distribution */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        {/* Sales Trend */}
        <div className="col-span-8 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-on-surface">近30天销售趋势 (Sales Trend)</h4>
            <span className="text-xs text-slate-400">单位: USD</span>
          </div>
          <div className="h-64 flex items-end gap-2 px-2">
            <div className="flex-1 bg-slate-100 h-[25%] rounded-t-sm transition-all hover:bg-primary-container/20"></div>
            <div className="flex-1 bg-slate-100 h-[40%] rounded-t-sm transition-all hover:bg-primary-container/20"></div>
            <div className="flex-1 bg-slate-100 h-[35%] rounded-t-sm transition-all hover:bg-primary-container/20"></div>
            <div className="flex-1 bg-primary-container h-[65%] rounded-t-sm transition-all hover:bg-primary"></div>
            <div className="flex-1 bg-primary h-[85%] rounded-t-sm transition-all"></div>
            <div className="flex-1 bg-primary-container h-[70%] rounded-t-sm transition-all hover:bg-primary"></div>
            <div className="flex-1 bg-slate-100 h-[45%] rounded-t-sm transition-all hover:bg-primary-container/20"></div>
            <div className="flex-1 bg-primary h-[95%] rounded-t-sm transition-all"></div>
            <div className="flex-1 bg-slate-100 h-[30%] rounded-t-sm transition-all hover:bg-primary-container/20"></div>
            <div className="flex-1 bg-slate-200 h-[55%] rounded-t-sm transition-all hover:bg-primary-container/40"></div>
          </div>
          <div className="flex justify-between mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-t pt-2">
            <span>Week 1</span>
            <span>Week 2</span>
            <span>Week 3</span>
            <span>Week 4</span>
          </div>
        </div>

        {/* Inventory Distribution */}
        <div className="col-span-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-bold text-on-surface mb-6">库存分布 (Inventory Distribution)</h4>
          <div className="relative flex flex-col items-center justify-center">
            <div className="w-40 h-40 rounded-full border-[18px] border-slate-100 relative">
              <div className="absolute inset-[-18px] rounded-full border-[18px] border-primary" style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 100%, 70% 100%)' }}></div>
              <div className="absolute inset-[-18px] rounded-full border-[18px] border-primary-container" style={{ clipPath: 'polygon(50% 50%, 70% 100%, 0 100%, 0 40%)' }}></div>
              <div className="absolute inset-[-18px] rounded-full border-[18px] border-secondary" style={{ clipPath: 'polygon(50% 50%, 0 40%, 0 0, 100% 0)' }}></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-slate-400 font-medium">总库存</span>
                <span className="text-lg font-bold">100%</span>
              </div>
            </div>
            <div className="mt-6 w-full space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-primary"></span>实木板材 (35%)</div>
                <span className="font-medium">$1.2M</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-primary-container"></span>成品家具 (28%)</div>
                <span className="font-medium">$980K</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-secondary"></span>五金配件 (22%)</div>
                <span className="font-medium">$750K</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300"></span>其他耗材 (15%)</div>
                <span className="font-medium">$520K</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Top 10 Best Sellers & Pending Tasks */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        {/* Best Sellers */}
        <div className="col-span-8 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-bold text-on-surface mb-6">热销产品 TOP 10 (Best Sellers)</h4>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-700">橡木A级板材 (Oak Wood Panel A-Grade)</span>
                <span className="text-primary font-bold">842 Units</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[92%] rounded-full"></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-700">45mm 不锈钢支架 (Steel Bracket 45mm)</span>
                <span className="text-primary font-bold">756 Units</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[81%] rounded-full"></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-700">标准餐桌套装 (Standard Dining Table Set)</span>
                <span className="text-primary font-bold">620 Units</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[65%] rounded-full"></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-700">工业胶水 X2 (Industrial Adhesive X2)</span>
                <span className="text-primary font-bold">544 Units</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[58%] rounded-full"></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-700">皮革沙发套装 (Leather Sofa Set)</span>
                <span className="text-primary font-bold">410 Units</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[44%] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="col-span-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-bold text-on-surface mb-6 uppercase tracking-wider text-sm border-b pb-3">待办事项 (Pending Tasks)</h4>
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded flex items-center gap-3">
              <span className="material-symbols-outlined text-red-600">inventory</span>
              <div>
                <p className="text-xs font-bold text-red-900">12项库存安全预警</p>
                <p className="text-[10px] text-red-700">库存低于最低水位，请尽快补货</p>
              </div>
            </div>
            <div className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded flex items-center gap-3">
              <span className="material-symbols-outlined text-orange-600">rule</span>
              <div>
                <p className="text-xs font-bold text-orange-900">3笔采购单待审核</p>
                <p className="text-[10px] text-orange-700">来自采购部，预计总额 $45,000</p>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-600">local_shipping</span>
              <div>
                <p className="text-xs font-bold text-blue-900">5笔出库确认</p>
                <p className="text-[10px] text-blue-700">待仓库管理人员核对装车单</p>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-l-4 border-slate-400 rounded flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-600">error_outline</span>
              <div>
                <p className="text-xs font-bold text-slate-900">2笔超期应收账款</p>
                <p className="text-[10px] text-slate-600">账龄已超过45天，请及时跟催</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: Full Width Purchase Trend */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-6">
          <h4 className="font-bold text-on-surface">近30天采购趋势 (Purchase Trend)</h4>
          <span className="text-xs text-slate-400">单位: 越南盾 (₫)</span>
        </div>
        <div className="relative h-64 w-full">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
            <defs>
              <linearGradient id="purchaseGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#944a00', stopOpacity: 0.2 }}></stop>
                <stop offset="100%" style={{ stopColor: '#944a00', stopOpacity: 0 }}></stop>
              </linearGradient>
            </defs>
            <path d="M0,35 L10,32 L20,38 L30,25 L40,28 L50,15 L60,18 L70,5 L80,12 L90,8 L100,20" fill="none" stroke="#944a00" strokeWidth="0.75" vectorEffect="non-scaling-stroke"></path>
            <path d="M0,35 L10,32 L20,38 L30,25 L40,28 L50,15 L60,18 L70,5 L80,12 L90,8 L100,20 V40 H0 Z" fill="url(#purchaseGrad)"></path>
          </svg>
          <div className="absolute top-[10%] left-[68%] -translate-x-1/2 p-2 bg-on-surface text-white text-[10px] rounded shadow-xl">
            <p className="font-bold">2024-03-15</p>
            <p>采购: 4,250,000,000 ₫</p>
          </div>
        </div>
        <div className="flex justify-between mt-4 text-[10px] text-slate-400 font-bold">
          <span>03-01</span>
          <span>03-08</span>
          <span>03-15</span>
          <span>03-22</span>
          <span>03-31</span>
        </div>
      </div>
    </>
  );
}
