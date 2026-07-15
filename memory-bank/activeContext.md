# Active Context

## 当前状态

项目处于 **功能完备、持续打磨** 阶段。当前版本 **v0.3.1**（2026-07-15 发布）。本轮（2026-07-15）完成了 **云枢 CloudPivot IMS 用户操作手册 (User Manual) 的全面生成**：
- 完成了 Next.js 独立运行模式（纯前端 Mock 降级策略下）的开发服务器启动和测试。
- 完成了 12 张核心界面 UI 截图的自动化/手动捕获并存盘至项目 `docs/user-manual/images/`。
- 将操作手册合理拆分为一个主索引文件与 15 个具体章节/附录的子文件，并为每一个页面和其细化的表单、按钮与业务公式编写了极其详尽的用户使用指引。

## 最近完成的工作

- **操作手册生成与 PDF 整合 (2026-07-15)**：
  - 编写并建立了操作手册主页 `docs/user-manual/README.md`，包含 22 个章节的详细索引目录，并专门添加了 macOS 首次打开时未配置 Apple Developer 代码签名和公证 (Notarization) 时的 Finder 右键打开以及使用 `xattr -cr` 修复“已损坏，无法打开”的具体命令行步骤。
  - **追加截图**：本轮累计追加截取并存盘 8 张高清核心界面截图。至此，全手册的插图总数已达 **26 张**，实现了业务流程的图文覆盖。
  - **状态说明标注**：在「定制单与生产工单」（第十章）和「财务管理」（第十二章）的文档顶部，明确添加了 **GFM 警告块说明当前版本中这些模块处于待定（暂未开放）阶段**。
  - **大白话极简润色全覆盖**：针对 30-50 岁没有太多电脑操作经验的工厂新手用户，对全部已开放章节进行了 **全面彻底的大白话润色**。
  - **合并与整合 PDF**：编写 Node.js 脚本，去除了目录文件的跳转外链，并注入了 `<div style="page-break-before: always;"></div>` 分页符。成功将 15 个子章节拼合生成为单文件 [all_in_one_manual.md](file:///Users/kurisu/develop/RustroverProjects/CloudPivot/docs/user-manual/all_in_one_manual.md)。
  - **PDF 成功生成**：调用 `markdown-pdf` 工具，成功将图文并茂的合并文档转成高品质 PDF 手册 [CloudPivot_IMS_User_Manual.pdf](file:///Users/kurisu/develop/RustroverProjects/CloudPivot/docs/user-manual/CloudPivot_IMS_User_Manual.pdf)，方便打印和传输。
  - 创建并编写了 `docs/user-manual/02-login-and-setup.md`（登录、密码校验锁定、强制改密、4步初始化向导）。
  - 创建并编写了 `docs/user-manual/03-layout.md`（侧边栏窄版折叠交互、Tooltip、选中高亮、头部栏切换与个人中心）。
  - 创建并编写了 `docs/user-manual/04-dashboard.md`（6个KPI卡片的计算口径、近30天销售采购折线趋势、饼图占比及代办卡片）。
  - 创建并编写了 `docs/user-manual/05-base-data.md`（物料管理筛选与导入导出预览、大型物料表单6大区块详解、分类树拖拽、供应商与客户信用额度校验）。
  - 创建并编写了 `docs/user-manual/06-bom.md`（BOM版本生效停用规则、子件用量损耗、需求展算和反查工具）。
  - 创建并编写了 `docs/user-manual/07-purchase.md`（采购单录入与费用计算、分批入库的 110% 溢量控制、多批次折扣/附加费用比例分摊与最后一笔倒挤算法、采购退货）。
  - 创建并编写了 `docs/user-manual/08-sales.md`（销售单折扣叠加、可用库存强制零库存拦截与信用度报警、出库 FIFO 分配与手动重排、出库标准/实际成本快照固化、退货成本溯源）。
  - 创建并编写了 `docs/user-manual/09-inventory.md`（库存查询三指标解析、批量自由出入库草稿、风控大额二确、单事务原子过账与缺口表格提示、流水、盘点及保护警告）。
  - 创建并编写了 `docs/user-manual/10-custom-and-production.md`（定制单加价、定制 BOM、原材料 FIFO 锁定、工单生命周期状态机、120% 超领拦截、完工实际成本计算与分配）。
  - 创建并编写了 `docs/user-manual/11-replenishment.md`（日均消耗与断货天数计算公式、四项策略控制参数、建议采购量算式以及一键拆单采购）。
  - 创建并编写了 `docs/user-manual/12-finance.md`（应付/应收账期到期红字报警、收付款登记字段、退货财务 return_offset 轧差冲减计算方法）。
  - 创建并编写了 `docs/user-manual/13-reports.md`（毛利双轨制口径切换算法、收发存勾稽关系、库龄饼图划分、滞销分析与数据下钻）。
  - 创建并编写了 `docs/user-manual/14-settings.md`（企业基本参数、编码前缀与流水预览、库存规则映射、双语组合打印、1 USD = N 外币汇率快照、SQL 物理备份与日志审计）。
  - 创建并编写了 `docs/user-manual/15-print-guide.md`（九种单据固定格式打印模板、Windows 打印服务器新建 14×22cm 自定义纸张、驱动首选项对齐走纸、偏移校调与故障自查）。
  - 创建并编写了 `docs/user-manual/appendix.md`（编码规则汇总对照、列表与表单快捷键、常见使用问题 FAQ 库以及进销存术语表）。

## 活跃文件

- `docs/user-manual/README.md` — 操作手册主索引
- `docs/user-manual/02-login-and-setup.md` — 登录与向导
- `docs/user-manual/03-layout.md` — 界面布局
- `docs/user-manual/04-dashboard.md` — 首页看板
- `docs/user-manual/05-base-data.md` — 基础数据
- `docs/user-manual/06-bom.md` — BOM 物料清单
- `docs/user-manual/07-purchase.md` — 采购管理
- `docs/user-manual/08-sales.md` — 销售管理
- `docs/user-manual/09-inventory.md` — 库存管理
- `docs/user-manual/10-custom-and-production.md` — 定制与工单
- `docs/user-manual/11-replenishment.md` — 智能补货
- `docs/user-manual/12-finance.md` — 财务辅助
- `docs/user-manual/13-reports.md` — 报表中心
- `docs/user-manual/14-settings.md` — 系统设置
- `docs/user-manual/15-print-guide.md` — 打印配置指南
- `docs/user-manual/appendix.md` — 附录与术语表
- `docs/user-manual/images/` — 12张核心界面高清截图备份

## 已做出的决策

- **操作手册拆分组织**：为防止单文件过大导致读取和渲染速度慢，将手册合理拆分为 1 个索引和 15 个独立子 Markdown。
- **突出实际业务与计算规则**：不仅讲解按钮如何点，还写入了系统后台的业务算法（如移动平均成本计算、双轨制毛利、多批次运费折后金额分摊倒挤、以及 FIFO 批次占扣等），提升了手册对业务人员的使用指导价值。

## 下一步

- 等待用户审阅最新生成的详尽版操作手册。
- 确认是否需要对操作手册进行多语言（如越南语、英语）翻译或做其他细节补充。
- TODOS.md 已全部清空，无遗留待办。

## 阻塞

- 无。

---

> **使用说明**：每次会话结束前，更新此文件中的「活跃文件」「已做出的决策」「下一步」「阻塞」部分。新会话开始时，AI 读取此文件即可快速同步上下文。

