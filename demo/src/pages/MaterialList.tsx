import { useState } from 'react';
import clsx from 'clsx';

export default function MaterialList() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">物料管理</h2>
          <p className="text-sm text-slate-500 mt-1">管理所有基础物料数据 (Material Management)</p>
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
            新建物料
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
                placeholder="搜索物料编码、名称、规格..." 
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
              />
            </div>
            <button className="p-2 text-slate-500 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors border border-slate-200 bg-white">
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">分类:</span>
              <select className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-primary">
                <option>全部 (All)</option>
                <option>原材料 (Raw Materials)</option>
                <option>半成品 (Semi-Finished)</option>
                <option>成品 (Finished Goods)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">状态:</span>
              <select className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-primary">
                <option>全部 (All)</option>
                <option>启用 (Active)</option>
                <option>停用 (Inactive)</option>
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
                <th className="px-6 py-4 font-semibold sticky-col-1 sticky-shadow bg-slate-50 sticky-col-header">物料编码</th>
                <th className="px-6 py-4 font-semibold">物料名称</th>
                <th className="px-6 py-4 font-semibold">规格型号</th>
                <th className="px-6 py-4 font-semibold">分类</th>
                <th className="px-6 py-4 font-semibold">基本单位</th>
                <th className="px-6 py-4 font-semibold text-right">安全库存</th>
                <th className="px-6 py-4 font-semibold text-center">状态</th>
                <th className="px-6 py-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { id: 'MAT-2024-001', name: 'A级橡木实木板', spec: '2400x1200x18mm', category: '原材料', unit: '张', safeStock: 50, status: 'active' },
                { id: 'MAT-2024-002', name: '工业级环保胶水', spec: '20kg/桶', category: '辅料', unit: '桶', safeStock: 20, status: 'active' },
                { id: 'MAT-2024-003', name: '不锈钢隐藏式铰链', spec: '110度阻尼', category: '五金件', unit: '个', safeStock: 500, status: 'active' },
                { id: 'MAT-2024-004', name: '北欧风餐椅框架', spec: '白蜡木材质', category: '半成品', unit: '套', safeStock: 30, status: 'active' },
                { id: 'MAT-2024-005', name: '真皮沙发面料', spec: '头层牛皮 棕色', category: '原材料', unit: '平方米', safeStock: 100, status: 'warning' },
                { id: 'MAT-2024-006', name: '定制衣柜拉手', spec: '铝合金 哑光黑 200mm', category: '五金件', unit: '个', safeStock: 200, status: 'inactive' },
                { id: 'MAT-2024-007', name: '高密度海绵垫', spec: '45D 500x500x50mm', category: '原材料', unit: '块', safeStock: 150, status: 'active' },
                { id: 'MAT-2024-008', name: '包装纸箱', spec: '五层瓦楞 800x600x400mm', category: '包材', unit: '个', safeStock: 1000, status: 'active' },
              ].map((item, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-center">
                    <input type="checkbox" className="rounded border-slate-300 text-primary focus:ring-primary" />
                  </td>
                  <td className="px-6 py-4 font-medium text-primary sticky-col-1 sticky-shadow bg-white group-hover:bg-slate-50/80 transition-colors">
                    <a href="#" className="hover:underline">{item.id}</a>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                  <td className="px-6 py-4 text-slate-500">{item.spec}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">{item.category}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{item.unit}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-700">{item.safeStock}</td>
                  <td className="px-6 py-4 text-center">
                    {item.status === 'active' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>启用</span>}
                    {item.status === 'warning' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200/50"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>预警</span>}
                    {item.status === 'inactive' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>停用</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary-50 rounded transition-colors" title="编辑">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-error hover:bg-error-container/30 rounded transition-colors" title="删除">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
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
            显示 <span className="font-medium text-slate-900">1</span> 到 <span className="font-medium text-slate-900">8</span> 条，共 <span className="font-medium text-slate-900">124</span> 条
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
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 text-sm font-medium transition-colors">16</button>
            </div>
            <button className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 transition-colors bg-white shadow-sm">
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* New Material Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">新建物料 (New Material)</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">物料编码 <span className="text-error">*</span></label>
                    <input type="text" placeholder="系统自动生成或手动输入" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">物料名称 <span className="text-error">*</span></label>
                    <input type="text" placeholder="请输入物料名称" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">物料分类 <span className="text-error">*</span></label>
                    <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                      <option value="">请选择分类</option>
                      <option>原材料</option>
                      <option>半成品</option>
                      <option>成品</option>
                      <option>五金件</option>
                      <option>包材</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">规格型号</label>
                    <input type="text" placeholder="例如: 2400x1200x18mm" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">基本单位 <span className="text-error">*</span></label>
                    <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                      <option value="">请选择单位</option>
                      <option>件 (pcs)</option>
                      <option>个 (ea)</option>
                      <option>张 (sheet)</option>
                      <option>千克 (kg)</option>
                      <option>米 (m)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">安全库存</label>
                    <input type="number" placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">备注说明</label>
                  <textarea rows={3} placeholder="添加物料的详细描述或特殊要求..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"></textarea>
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="status" className="rounded border-slate-300 text-primary focus:ring-primary" defaultChecked />
                  <label htmlFor="status" className="text-sm text-slate-700 cursor-pointer">立即启用该物料</label>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                取消 (Cancel)
              </button>
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
                保存 (Save)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
