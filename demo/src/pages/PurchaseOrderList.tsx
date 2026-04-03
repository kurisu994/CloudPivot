import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function PurchaseOrderList() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">采购单</h2>
          <p className="text-sm text-slate-500 mt-1">管理采购订单 (Purchase Orders)</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors shadow-sm">
            <span className="material-symbols-outlined text-base">download</span>
            导出
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            新建采购单
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="搜索单号、供应商、采购员..." 
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
              />
            </div>
            <button className="p-2 text-slate-500 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors border border-slate-200 bg-white">
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">日期:</span>
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-primary" />
              <span className="text-slate-400">-</span>
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">状态:</span>
              <select className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-primary">
                <option>全部状态 (All)</option>
                <option>待审核 (Pending)</option>
                <option>已审核 (Approved)</option>
                <option>部分入库 (Partial)</option>
                <option>已完成 (Completed)</option>
                <option>已取消 (Cancelled)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold w-12 text-center">
                  <input type="checkbox" className="rounded border-slate-300 text-primary focus:ring-primary" />
                </th>
                <th className="px-6 py-4 font-semibold sticky-col-1 sticky-shadow bg-slate-50 sticky-col-header">单据编号</th>
                <th className="px-6 py-4 font-semibold">单据日期</th>
                <th className="px-6 py-4 font-semibold">供应商</th>
                <th className="px-6 py-4 font-semibold text-right">总金额</th>
                <th className="px-6 py-4 font-semibold">采购员</th>
                <th className="px-6 py-4 font-semibold text-center">状态</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { id: 'PO-20260326-001', date: '2026-03-26', supplier: '越南木材进出口公司', amount: '$45,200.00', buyer: '张建国', status: 'pending' },
                { id: 'PO-20260325-002', date: '2026-03-25', supplier: '胡志明五金配件厂', amount: '$12,850.00', buyer: '李明', status: 'approved' },
                { id: 'PO-20260324-001', date: '2026-03-24', supplier: '环球包装材料有限公司', amount: '$3,400.00', buyer: '王芳', status: 'partial' },
                { id: 'PO-20260322-003', date: '2026-03-22', supplier: '东南亚皮革供应商', amount: '$28,600.00', buyer: '张建国', status: 'completed' },
                { id: 'PO-20260320-001', date: '2026-03-20', supplier: '越南木材进出口公司', amount: '$52,000.00', buyer: '李明', status: 'completed' },
                { id: 'PO-20260318-002', date: '2026-03-18', supplier: '化工原料厂', amount: '$8,500.00', buyer: '王芳', status: 'cancelled' },
              ].map((item, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-center">
                    <input type="checkbox" className="rounded border-slate-300 text-primary focus:ring-primary" />
                  </td>
                  <td className="px-6 py-4 font-medium text-primary sticky-col-1 sticky-shadow bg-white group-hover:bg-slate-50/80 transition-colors">
                    <Link to={`/purchase-orders/${item.id}`} className="hover:underline">{item.id}</Link>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{item.date}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{item.supplier}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-700">{item.amount}</td>
                  <td className="px-6 py-4 text-slate-500">{item.buyer}</td>
                  <td className="px-6 py-4 text-center">
                    {item.status === 'pending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200/50"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>待审核</span>}
                    {item.status === 'approved' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>已审核</span>}
                    {item.status === 'partial' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/50"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>部分入库</span>}
                    {item.status === 'completed' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>已完成</span>}
                    {item.status === 'cancelled' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>已取消</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/purchase-orders/${item.id}`} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary-50 rounded transition-colors" title="查看详情">
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </Link>
                      {item.status === 'pending' && (
                        <>
                          <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary-50 rounded transition-colors" title="编辑">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-error hover:bg-error-container/30 rounded transition-colors" title="删除">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-sm text-slate-500">
            显示 <span className="font-medium text-slate-900">1</span> 到 <span className="font-medium text-slate-900">6</span> 条，共 <span className="font-medium text-slate-900">48</span> 条
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" disabled>
              上一页
            </button>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-medium shadow-sm">1</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 text-sm font-medium transition-colors">2</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 text-sm font-medium transition-colors">3</button>
              <span className="text-slate-400 px-1">...</span>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 text-sm font-medium transition-colors">8</button>
            </div>
            <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 transition-colors bg-white shadow-sm">
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* New Purchase Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">新建采购单 (New Purchase Order)</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form className="space-y-8">
                {/* Header Info */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider border-b border-slate-100 pb-2">基本信息 (Basic Info)</h4>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">供应商 <span className="text-error">*</span></label>
                      <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                        <option value="">请选择供应商</option>
                        <option>越南木材进出口公司</option>
                        <option>胡志明五金配件厂</option>
                        <option>环球包装材料有限公司</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">单据日期 <span className="text-error">*</span></label>
                      <input type="date" defaultValue="2026-04-01" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">交货日期 <span className="text-error">*</span></label>
                      <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">采购员 <span className="text-error">*</span></label>
                      <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                        <option value="">请选择采购员</option>
                        <option>张建国</option>
                        <option>李明</option>
                        <option>王芳</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">结算方式</label>
                      <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                        <option>月结30天</option>
                        <option>款到发货</option>
                        <option>货到付款</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">币种</label>
                      <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                        <option>USD - 美元</option>
                        <option>VND - 越南盾</option>
                        <option>CNY - 人民币</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">采购明细 (Line Items)</h4>
                    <button type="button" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      添加物料
                    </button>
                  </div>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-10">序号</th>
                          <th className="px-4 py-3 font-semibold">物料编码/名称</th>
                          <th className="px-4 py-3 font-semibold">规格型号</th>
                          <th className="px-4 py-3 font-semibold w-24">单位</th>
                          <th className="px-4 py-3 font-semibold w-32 text-right">数量</th>
                          <th className="px-4 py-3 font-semibold w-32 text-right">单价</th>
                          <th className="px-4 py-3 font-semibold w-32 text-right">金额</th>
                          <th className="px-4 py-3 font-semibold w-12 text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-4 py-3 text-slate-500">1</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input type="text" placeholder="选择物料..." className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-primary" />
                              <button type="button" className="p-1 text-slate-400 hover:text-primary"><span className="material-symbols-outlined text-[18px]">search</span></button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">-</td>
                          <td className="px-4 py-3 text-slate-500">-</td>
                          <td className="px-4 py-3">
                            <input type="number" placeholder="0" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-primary" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" placeholder="0.00" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-primary" />
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">$0.00</td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" className="text-slate-400 hover:text-error"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                          </td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td colSpan={6} className="px-4 py-3 text-right font-semibold text-slate-700">合计金额 (Total Amount):</td>
                          <td className="px-4 py-3 text-right font-bold text-primary text-base">$0.00</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">备注说明 (Remarks)</label>
                  <textarea rows={3} placeholder="添加采购单备注..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"></textarea>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                取消 (Cancel)
              </button>
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-primary bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors">
                保存草稿 (Save Draft)
              </button>
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
                提交审核 (Submit)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
