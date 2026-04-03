import { useParams, Link } from 'react-router-dom';

export default function PurchaseOrderDetail() {
  const { id } = useParams();

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link to="/purchase-orders" className="p-2 text-slate-400 hover:text-primary hover:bg-primary-50 rounded-full transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-on-surface flex items-center gap-3">
              采购单详情 
              <span className="text-lg font-normal text-slate-400">({id || 'PO-20260326-001'})</span>
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200/50">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>待审核 (Pending)
              </span>
              <span className="text-xs text-slate-500">创建时间: 2026-03-26 10:30:45</span>
              <span className="text-xs text-slate-500">创建人: 张建国</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors shadow-sm">
            <span className="material-symbols-outlined text-base">print</span>
            打印
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors shadow-sm">
            <span className="material-symbols-outlined text-base">edit</span>
            编辑
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-error rounded-lg transition-colors shadow-sm">
            <span className="material-symbols-outlined text-base">cancel</span>
            驳回
          </button>
          <button className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors shadow-sm">
            <span className="material-symbols-outlined text-base">check_circle</span>
            审核通过
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Details */}
        <div className="col-span-8 space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                基本信息 (Basic Info)
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">供应商 (Supplier)</p>
                  <p className="text-sm font-medium text-slate-900">越南木材进出口公司 (Vietnam Wood Import & Export Co.)</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">采购员 (Buyer)</p>
                  <p className="text-sm font-medium text-slate-900">张建国 (JianGuo Zhang)</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">单据日期 (PO Date)</p>
                  <p className="text-sm font-medium text-slate-900">2026-03-26</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">交货日期 (Delivery Date)</p>
                  <p className="text-sm font-medium text-slate-900">2026-04-10</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">结算方式 (Payment Terms)</p>
                  <p className="text-sm font-medium text-slate-900">月结30天 (Net 30)</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">币种 (Currency)</p>
                  <p className="text-sm font-medium text-slate-900">USD - 美元</p>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">备注说明 (Remarks)</p>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  请务必在4月10日前送达平阳省一号仓库。木材需提供FSC认证文件。
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">list_alt</span>
                采购明细 (Line Items)
              </h3>
              <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200">共 3 项物料</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold w-12 text-center">序号</th>
                    <th className="px-6 py-3 font-semibold">物料编码</th>
                    <th className="px-6 py-3 font-semibold">物料名称</th>
                    <th className="px-6 py-3 font-semibold">规格型号</th>
                    <th className="px-6 py-3 font-semibold text-center">单位</th>
                    <th className="px-6 py-3 font-semibold text-right">数量</th>
                    <th className="px-6 py-3 font-semibold text-right">单价 (USD)</th>
                    <th className="px-6 py-3 font-semibold text-right">金额 (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center text-slate-500">1</td>
                    <td className="px-6 py-4 font-medium text-primary">MAT-2024-001</td>
                    <td className="px-6 py-4 font-medium text-slate-900">A级橡木实木板</td>
                    <td className="px-6 py-4 text-slate-500">2400x1200x18mm</td>
                    <td className="px-6 py-4 text-center text-slate-500">张</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">500</td>
                    <td className="px-6 py-4 text-right text-slate-500">$45.00</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">$22,500.00</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center text-slate-500">2</td>
                    <td className="px-6 py-4 font-medium text-primary">MAT-2024-004</td>
                    <td className="px-6 py-4 font-medium text-slate-900">北欧风餐椅框架</td>
                    <td className="px-6 py-4 text-slate-500">白蜡木材质</td>
                    <td className="px-6 py-4 text-center text-slate-500">套</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">200</td>
                    <td className="px-6 py-4 text-right text-slate-500">$85.00</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">$17,000.00</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center text-slate-500">3</td>
                    <td className="px-6 py-4 font-medium text-primary">MAT-2024-007</td>
                    <td className="px-6 py-4 font-medium text-slate-900">高密度海绵垫</td>
                    <td className="px-6 py-4 text-slate-500">45D 500x500x50mm</td>
                    <td className="px-6 py-4 text-center text-slate-500">块</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">300</td>
                    <td className="px-6 py-4 text-right text-slate-500">$19.00</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">$5,700.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">合计数量:</span>
                  <span className="font-medium text-slate-900">1,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">不含税金额:</span>
                  <span className="font-medium text-slate-900">$45,200.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">税额 (0%):</span>
                  <span className="font-medium text-slate-900">$0.00</span>
                </div>
                <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-900">价税合计:</span>
                  <span className="text-xl font-bold text-primary">$45,200.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Summary */}
        <div className="col-span-4 space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
              单据汇总 (Summary)
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">总金额 (Total Amount)</p>
                  <p className="text-lg font-bold text-on-surface">$45,200.00</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">inventory_2</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">已入库数量 (Received)</p>
                  <p className="text-lg font-bold text-on-surface">0 / 1,000</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">receipt_long</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">已开票金额 (Invoiced)</p>
                  <p className="text-lg font-bold text-on-surface">$0.00</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">history</span>
              审批流程 (Approval Flow)
            </h3>
            <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-slate-100">
              
              <div className="relative">
                <div className="absolute -left-[25px] top-1 w-6 h-6 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center z-10">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                </div>
                <div className="pl-4">
                  <p className="text-sm font-bold text-slate-900">部门经理审批</p>
                  <p className="text-xs text-slate-500 mt-0.5">待处理 (Pending)</p>
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600">
                    <p className="font-medium text-slate-800 mb-1">当前审批人: 王经理 (Manager Wang)</p>
                    <p>等待审批中...</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-[25px] top-1 w-6 h-6 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center z-10">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">check</span>
                </div>
                <div className="pl-4">
                  <p className="text-sm font-bold text-slate-900">提交采购单</p>
                  <p className="text-xs text-slate-500 mt-0.5">2026-03-26 10:30:45</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-[10px] font-bold">张</div>
                    <span className="text-xs font-medium text-slate-700">张建国 (JianGuo Zhang)</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
