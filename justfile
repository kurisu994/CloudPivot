# CloudPivot — 项目命令入口
# 使用 `just <command>` 运行

# 默认命令：显示帮助
default:
    @just --list

# === 开发 ===

# 启动 Tauri 开发模式（前端 + 后端热重载）
dev:
    pnpm tauri dev

# 仅启动 Next.js 前端开发服务器
dev-web:
    pnpm dev

# === 构建 ===

# 构建生产版本（Tauri 桌面应用）
build:
    pnpm tauri build

# 仅构建 Next.js 前端（SSG → out/）
build-web:
    pnpm build

# 构建 Debug 版本（含调试符号）
build-debug:
    pnpm tauri build --debug

# === 代码检查 ===

# 运行全部代码检查（前端 + 后端）
check: lint-web lint-rust

# ESLint 检查
lint-web:
    pnpm lint

# TypeScript 类型检查
typecheck:
    pnpm typecheck

# cargo clippy
lint-rust:
    cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings

# === 格式化 ===

# 格式化全部代码（prettier + cargo fmt）
fmt: fmt-web fmt-rust

# prettier 格式化前端代码（使用项目 .prettierrc 配置）
fmt-web:
    pnpm format

# cargo fmt 格式化 Rust 代码
fmt-rust:
    cd src-tauri && cargo fmt --all

# === 测试 ===

# 运行全部测试
test: test-rust

# cargo test
test-rust:
    cd src-tauri && cargo test --all-features

# === 依赖管理 ===

# 安装全部依赖（pnpm install + cargo fetch）
install:
    pnpm install
    cd src-tauri && cargo fetch

# 清理构建产物
clean:
    rm -rf out .next
    cd src-tauri && cargo clean

# === 工具 ===

# 安装 shadcn/ui 组件（示例：just ui button）
ui component:
    pnpm shadcn add {{component}}

# 检查翻译文件完整性（对比 zh / en / vi 的 key 是否一致）
i18n-check:
    #!/usr/bin/env node
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(process.cwd(), "messages");
    const locales = ["zh", "en", "vi"];
    // 递归提取所有叶子节点的 key 路径
    function flatKeys(obj, prefix = "") {
      return Object.entries(obj).flatMap(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        return typeof v === "object" && v !== null ? flatKeys(v, key) : [key];
      });
    }
    const keyMap = {};
    for (const loc of locales) {
      const file = path.join(dir, `${loc}.json`);
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      keyMap[loc] = new Set(flatKeys(data));
    }
    // 以 zh 为基准进行对比
    const base = "zh";
    const baseKeys = keyMap[base];
    let hasIssue = false;
    for (const loc of locales) {
      if (loc === base) continue;
      const missing = [...baseKeys].filter(k => !keyMap[loc].has(k));
      const extra = [...keyMap[loc]].filter(k => !baseKeys.has(k));
      if (missing.length) {
        console.log(`⚠️  ${loc}.json 缺失（相对 ${base}）:`);
        missing.forEach(k => console.log(`  - ${k}`));
        hasIssue = true;
      }
      if (extra.length) {
        console.log(`⚠️  ${loc}.json 多余（相对 ${base}）:`);
        extra.forEach(k => console.log(`  + ${k}`));
        hasIssue = true;
      }
    }
    if (!hasIssue) {
      console.log("✅ 所有翻译文件 key 保持一致");
    }
