---
name: tauri-icon
description: 为 Tauri 应用生成符合 Apple HIG 规范的全平台图标。处理 macOS squircle 圆角、iOS 多尺寸、Android 自适应图标等。当用户提到"生成图标"、"应用图标"、"app icon"、"icns"、"Dock 图标"等关键词时触发。
---

# Tauri 应用图标生成

## 适用场景

- 为 Tauri 桌面应用生成全平台图标
- 修复 macOS Dock 中图标显示为方块的问题
- 调整图标大小以匹配系统级图标规范

## Apple macOS 图标核心规范

### 形状：超椭圆 (Squircle)

- macOS Big Sur+ 使用超椭圆形状，公式：`|x/a|^n + |y/b|^n = 1`，`n ≈ 5`
- **macOS 不会自动为 `.icns` 图标应用圆角蒙版**
- 开发者必须在图标中内置 squircle 圆角，四角保持透明（alpha = 0）

### 尺寸与边距（关键参数）

```
1024×1024 画布（含透明边距）
  └─ ~824×824 squircle 形状（占画布 80%，带背景色 + 圆角）
       └─ ~577×577 logo 内容（占 squircle 的 70%，居中）
```

- `SHAPE_SCALE = 0.80`：squircle 占画布比例
- `CONTENT_SCALE = 0.70`：logo 占 squircle 比例
- `SUPERELLIPSE_N = 5.0`：超椭圆指数

### iOS 图标

- 必须是正方形、无透明、无圆角（系统自动加圆角）
- 背景色通过 `--ios-color` 参数指定

## 执行步骤

### 1. 确认源图标

源图标要求：
- 格式：PNG 或 SVG
- 尺寸：至少 1024×1024 像素
- 形状：正方形
- 建议带透明背景（如果有纯色背景，需采样精确背景色）

如果源图有纯色背景，采样背景色：

```python
python3 -c "
from PIL import Image
img = Image.open('<source_icon_path>').convert('RGBA')
corners = [(5,5), (5, img.height-5), (img.width-5, 5), (img.width-5, img.height-5)]
for c in corners:
    print(f'  {c}: {img.getpixel(c)}')
bg = img.getpixel((5,5))
print(f'背景色: #{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}')
"
```

### 2. 生成 macOS squircle 蒙版图标

运行本 skill 附带的 Python 脚本：

```bash
python3 .agents/skills/tauri-icon/scripts/generate_macos_icon.py \
  --source <源图标路径> \
  --output <输出路径> \
  --bg-color "R,G,B" \
  --shape-scale 0.80 \
  --content-scale 0.70
```

参数说明：
- `--source`：源图标路径（必需）
- `--output`：输出路径（默认：`./app-icon-macos.png`）
- `--bg-color`：背景色 RGB（如 `213,218,222`）。若不指定则自动从源图四角采样
- `--shape-scale`：squircle 占画布比例（默认 0.80）
- `--content-scale`：logo 占 squircle 比例（默认 0.70）

### 3. 用 Tauri CLI 生成全平台图标

```bash
npx -y @tauri-apps/cli icon --ios-color '<hex_bg_color>' <squircle蒙版图标路径>
```

输出到 `src-tauri/icons/`，包含：

| 平台 | 文件 |
|------|------|
| macOS | `icon.icns` |
| Windows | `icon.ico` |
| Linux | `32x32.png` / `128x128.png` / `128x128@2x.png` / `icon.png` |
| iOS | `ios/AppIcon-*.png` × 18 个 |
| Android | `android/mipmap-*/ic_launcher*.png` × 15 个 |
| Windows Store | `Square*.png` × 10 个 + `StoreLogo.png` |

### 4. 清理临时文件

```bash
rm <squircle蒙版图标路径>
```

### 5. 验证

- 运行 `pnpm tauri dev` 查看 Dock 中图标效果
- 图标应与其他 macOS 应用大小一致，带圆角，四角无方块

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Dock 中图标是方块 | `.icns` 缺少透明四角 | 用 squircle 蒙版处理源图后重新生成 |
| 图标比其他应用大 | squircle 填满整个画布 | 缩小 `SHAPE_SCALE` 到 0.80 |
| logo 太满没有呼吸感 | 内容填满 squircle 区域 | 缩小 `CONTENT_SCALE` 到 0.70 |
| logo 和背景间有色差框 | 背景色不精确 | 从源图四角采样精确 RGB 值 |

## tauri.conf.json 图标配置参考

```json
{
  "bundle": {
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```
