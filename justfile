# CloudPivot IMS — 项目命令入口
# 使用 `just <command>` 运行

set dotenv-load

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

# 仅构建 Next.js 前端
build-web:
    pnpm build

# 构建 Debug 版本（含调试符号）
build-debug:
    pnpm tauri build --debug

# === 代码检查 ===

# 运行全部代码检查（前端 + 后端）
lint: lint-web lint-rust

# Biome check + TypeScript 类型检查
lint-web:
    pnpm lint
    pnpm typecheck

# cargo clippy
lint-rust:
    cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings

# 格式化全部代码（biome + cargo fmt）
fmt: fmt-web fmt-rust

# biome 格式化前端代码
fmt-web:
    pnpm format

# cargo fmt 格式化 Rust 代码
fmt-rust:
    cd src-tauri && cargo fmt --all

# === 测试 ===

# 运行全部测试（前端 + 后端）
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

# === 版本 & 发布 ===

# 同步更新所有配置文件的版本号
[no-exit-message]
version bump:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{bump}}" ]; then
        echo "Usage: just version <new_version>"
        echo "Example: just version 0.2.0"
        exit 1
    fi
    VERSION="{{bump}}"
    echo "Updating version to $VERSION..."
    # package.json
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json && rm package.json.bak
    # Cargo.toml
    sed -i.bak "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml && rm src-tauri/Cargo.toml.bak
    # tauri.conf.json
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json && rm src-tauri/tauri.conf.json.bak
    echo "✅ Version updated to $VERSION"

# 打包发布全流程（包含更新版本号、提交 Commit、推主干、打 Tag 并出包）
[no-exit-message]
release tag:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{tag}}" ]; then
        echo "Usage: just release <tag>"
        echo "Example: just release v0.2.0"
        exit 1
    fi
    
    TAG="{{tag}}"
    # 剥离前缀'v'用于修改内部配置的版本号
    VERSION="${TAG#v}"
    
    echo "🚀 开始基于版本 $TAG 构建发布流程..."
    
    echo "1️⃣ 更新配置文件的版本号 ($VERSION) ..."
    just version "$VERSION"
    
    echo "2️⃣ 自动更新 CHANGELOG.md..."
    if grep -q '## \[Unreleased\]' CHANGELOG.md; then
        TODAY=$(date +%Y-%m-%d)
        perl -i -pe "s/## \[Unreleased\]/## \[Unreleased\]\n\n---\n\n## [$VERSION] — $TODAY/" CHANGELOG.md
        echo "   ✅ CHANGELOG 已更新: [Unreleased] -> [$VERSION] — $TODAY"
    fi
    
    echo "3️⃣ 提交本次发布变更到 Git..."
    git add .
    git commit -m "🔖 release: $TAG" || echo "⚠️ 暂无变更需要提交，跳过 Commit"
    
    echo "4️⃣ 推送最新代码到当前远程分支..."
    git push origin HEAD
    
    echo "5️⃣ 创建并上传 $TAG 标签，准备触发云端构建流水线..."
    if git rev-parse "$TAG" >/dev/null 2>&1; then
        echo "⚠️ $TAG 标签已存在，将被跳过"
    else
        git tag -a "$TAG" -m "Release $TAG"
        git push origin "$TAG"
    fi
    
    echo "✅ 发布流程顺利结束！你可以去 GitHub Actions 查看最新的打包状态了。"

# === 工具 ===

# 安装 shadcn/ui 组件（示例：just ui button）
ui component:
    pnpm dlx shadcn@latest add {{component}}

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
      const locDir = path.join(dir, loc);
      const files = fs.readdirSync(locDir).filter(f => f.endsWith('.json'));
      let allKeys = [];
      for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(locDir, file), "utf-8"));
        allKeys.push(...flatKeys(data));
      }
      keyMap[loc] = new Set(allKeys);
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
        console.log(`⚠️  ${loc} 缺失（相对 ${base}）:`);
        missing.forEach(k => console.log(`  - ${k}`));
        hasIssue = true;
      }
      if (extra.length) {
        console.log(`⚠️  ${loc} 多余（相对 ${base}）:`);
        extra.forEach(k => console.log(`  + ${k}`));
        hasIssue = true;
      }
    }
    if (!hasIssue) {
      console.log("✅ 所有翻译文件 key 保持一致");
    }

# 基于 app-icon.png 生成全平台图标 (macOS/iOS/Android)
icon:
    pnpm tauri icon app-icon.png
