# 更新日志 (Changelog)

本文件记录 **云枢 (CloudPivot IMS)** 各版本的主要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### 新增

- **业务列表表格骨架**：新增 `BusinessListTableShell` 等公共薄封装，统一物料、供应商等业务列表的横向滚动、固定首列、分页栏、加载态和空态
  - 固定首列：统一 `BUSINESS_LIST_STICKY_HEAD_CLASS` / `BUSINESS_LIST_STICKY_CELL_CLASS`，避免各页面重复手写 sticky 样式
  - 状态行：新增 `BusinessListTableLoadingRows` / `BusinessListTableEmptyRow`，让加载态和空态保持在同一张表格结构内
  - 分页栏：新增 `BusinessListTableFooter`，统一小屏换行布局，避免分页控件独立溢出
- **供应商管理模块**：实现完整的供应商 CRUD 管理功能
  - 前端：列表筛选（关键词/国家/类别/等级）、分页、Sheet 抽屉表单（基本信息/结算/地址/银行四分区）
  - 后端：新增 `supplier.rs` IPC 命令模块（6 个命令），支持动态筛选、分页查询、编码自动生成
  - 编码规则：`SUP-YYYY-NNN` 格式，基于数据库 MAX(code) 自增避免冲突
  - 共享类型：将 `PaginatedResponse<T>` 提升为 `commands/mod.rs` 共享泛型
- **分类管理模块**：实现完整的分类树形管理功能
  - 前端：基于 react-arborist 实现交互式树形结构，支持拖拽排序、增删改查
  - 后端：新增 `category.rs` IPC 命令模块，实现分类 CRUD 和排序持久化
  - 表单验证：分类名称必填、编码唯一性校验、移动操作合法性验证
  - 交互优化：拖拽手柄独立、本地状态即时反馈、后端异步持久化

### 优化

- **业务列表小屏体验**：优化物料和供应商列表在小屏下的横向滚动与固定首列表现
  - 表格本体使用明确最小总宽度和稳定列宽，避免小屏下列被压缩却不能滚动
  - 修复主布局缺少 `min-w-0` 导致子级 `overflow-x-auto` 无法生效的问题
  - 将 sticky 首列背景改为不透明实底色，避免横向滚动时透出后方文字影子
- **代码格式化工具迁移**：从 Prettier 迁移至 Biome，统一 Rust 和 TypeScript 代码风格
  - 移除 `.prettierrc` 配置文件
  - 新增 `biome.json` 配置，统一单引号、导入排序、尾随逗号等规则
  - 排除 `next-env.d.ts` 类型声明文件

### 重构

- **分类树拖拽逻辑**：优化拖拽排序的本地状态更新与持久化逻辑
  - 重构 `handleMove` 函数，使用受控模式实现即时 UI 反馈
  - 新增 `removeNode` 和 `insertNode` 辅助函数，精确操作树节点
  - 优化后端持久化，避免不必要的 API 调用

---

## [0.1.1] — 2026-04-15

> 🚀 阶段一完成 & 阶段二启动：项目基础设施、系统设置、物料管理业务起步

### 新增

- **项目脚手架**：初始化 Next.js 16 + Tauri 2 + Tailwind CSS 4 + shadcn/ui（base-nova 风格）项目结构
- **国际化框架**：基于 next-intl 实现中/越/英三语支持，含 `login`、`changePassword`、`dashboard` 等翻译域
- **布局系统**：实现 AppLayout（可折叠侧边栏 + 顶栏 + 主内容区 + 页脚）、LocaleSwitcher 语言切换器
- **深浅主题**：CSS 变量 + next-themes，浅色蓝 / 深色暖橙双主题方案
- **首页看板**：7 个模块化子组件（KPI 指标卡、销售趋势图、库存环形图、热销 Top10、待办事项、采购趋势图、快捷操作），基于 Recharts + mock 数据
- **SQLite 数据库层**：sqlx 连接池（WAL 模式）、自管理迁移框架、45 张表 DDL + 种子数据
- **用户认证（全栈）**：
  - 前端：登录页、首次改密页、AuthProvider 路由守卫、localStorage 会话持久化
  - 后端：bcrypt 密码哈希、登录失败锁定（5 次/15 分钟）、首次登录强制改密、session_version 会话版本控制
- **IPC 通信**：`ping`、`get_db_version`、`login`、`change_password`、`get_user_info` 五个命令
- **前端工具库**：Tauri IPC 泛型封装（含非 Tauri 环境降级）、多币种格式化（VND/CNY/USD）、系统配置类型定义
- **品牌视觉**：应用图标资源（全平台）、侧边栏品牌设计
- **路由骨架**：23 个业务路由目录（PagePlaceholder 占位）
- **系统设置子页面**：完成 `appearance-content.tsx`（显示偏好设置）与 `company-info-content.tsx`（企业信息配置）的全量双向绑定开发及 UI 对齐
- **全局偏好引擎**：新增 `DisplayPreferencesProvider`，将如"紧凑列表、自动折叠侧栏、全局大字体"的前端设置项与后端 `system_config` 表及 css variables 打通
- **体验与开发流扩展**：在 `justfile` 中扩展支持生成完整 Apple HIG 等跨平台规范图标的 `icon` 快捷指令
- **看板深度多语言化**：首页仪表板中 7 个独立模块内所有写死文案全量重构至 i18n 集成翻译字典
- **首次使用向导**：完成系统首次使用向导前端集成与核心逻辑，为新用户引导基础配置
- **加载体验升级**：添加品牌闪屏（Splash Screen）加载动画组件，优化了 logo 宽度显示，提升开箱视觉体验
- **物料管理模块**：实现物料管理前端完整功能与逻辑，使用基础组件库对其表格等界面进行了全量重构对齐
- **CI/CD 流水线**：GitHub Actions 自动化 CI（ESLint + TypeScript + clippy + fmt + cargo test + 四平台构建验证），PR/push 到 main 自动触发
- **发布与安装包构建**：tag 触发的 Release 流水线，自动四平台（macOS arm64/x64、Linux x64、Windows x64）出包，含 Updater 签名与 CHANGELOG 提取；本地 `just release` 一键完成版本号同步、CHANGELOG 切版、打 tag 推送

### 优化

- **多语言管理**：将原单一庞杂的 i18n 多语言 JSON 字典文件重构为按业务模块拆分存放（如 `common`、`dashboard`、`auth`、`settings` 等）的层级目录结构。配合升级了 `request.ts` 以实现运行时的无缝合并加载，并同步更新了 `just i18n-check` 完整性校验脚本，大幅降低了后续多语言词条的维护及冲突负担。
- **系统组件层**：修复底层 `Select` 组件触发器因未自适应长度产生的多语言展示截断问题（扩展渲染宽度至 280px 级别）
- **工具导出层**：调整及修复 Tauri 工具函数中系统配置键枚举 `SystemConfigKeys` 的导出边界，确保所有前端模块稳定取用状态
- **代码依赖清理**：清除了项目中不再使用的冗余包（如 `react-hook-form`, `zod`, `zustand`, `shadcn` 等），配置了 pnpm `workspace` 化管理及版本锁定，加速后期构建处理
- **Bug 修复**：修复了配置向导默认语言选择器中缺少渲染选项的数据格式问题，并优化了页面的排版间距结构

### 重构

- 仪表盘拆分为 7 个独立子组件，提升可维护性
- 物料管理新增/编辑页面统一使用弹窗交互方式
- **系统设置模块交互重构**：
  - 规范化全部 `Select` 组件，通过 `items` 映射实现底层 API 值与前台多语言标签 (`label`) 的分离，确保数据一致性。
  - 完善外观设置页方案，新增独立的高斯模糊双拼色"跟随系统"卡片，并调整为所见即所得交互（移除保存/取消按钮）。
  - 修订全部设置页面的静态 UI 以对齐高保真原型。

### 文档

- 完成需求规格文档（12 大模块详细设计）
- 完成数据库设计文档（45 张表 DDL + ER 关系）
- 完成界面原型文档（30 个页面 wireframe + 交互规范）
- 完成开发计划文档（5 阶段任务清单）
- 多轮设计文档评审与修正（v1.0 → v1.5）
