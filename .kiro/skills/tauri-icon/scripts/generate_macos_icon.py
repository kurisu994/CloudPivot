#!/usr/bin/env python3
"""
为 Tauri 应用生成符合 Apple macOS HIG 规范的 squircle 圆角图标。

用法：
  python3 generate_macos_icon.py --source <源图标> [选项]

参数：
  --source         源图标路径（必需，PNG 或带透明背景的图片）
  --output         输出路径（默认：./app-icon-macos.png）
  --bg-color       背景色 R,G,B（如 213,218,222）。不指定则从源图四角自动采样
  --shape-scale    squircle 占画布比例（默认 0.80，Apple 标准）
  --content-scale  logo 内容占 squircle 比例（默认 0.70）
  --superellipse-n 超椭圆指数（默认 5.0，Apple squircle 标准值）
  --size           画布尺寸（默认 1024）
"""

import argparse
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageChops
except ImportError:
    print("❌ 需要安装 Pillow: pip3 install Pillow")
    sys.exit(1)


def sample_bg_color(img: Image.Image) -> tuple:
    """从图片四角采样背景色"""
    corners = [
        (5, 5),
        (5, img.height - 5),
        (img.width - 5, 5),
        (img.width - 5, img.height - 5),
    ]
    colors = [img.getpixel(c) for c in corners]
    # 取四角平均值
    r = sum(c[0] for c in colors) // 4
    g = sum(c[1] for c in colors) // 4
    b = sum(c[2] for c in colors) // 4
    return (r, g, b, 255)


def create_squircle_mask(
    size: int, shape_scale: float, n: float = 5.0
) -> Image.Image:
    """
    创建 macOS 风格的超椭圆蒙版（带抗锯齿）。

    参数：
      size: 画布尺寸
      shape_scale: squircle 占画布的比例（0.80 = Apple 标准）
      n: 超椭圆指数（5.0 = Apple squircle）
    """
    # 2x 超采样实现抗锯齿
    ss = 2
    large = size * ss
    mask = Image.new("L", (large, large), 0)
    pixels = mask.load()

    center = large / 2.0
    radius = large / 2.0 * shape_scale

    for y in range(large):
        cy = (y - center + 0.5) / radius
        cy_pow = abs(cy) ** n
        if cy_pow > 1.0:
            continue
        # 计算当前行 x 的边界以加速
        x_limit = radius * ((1.0 - cy_pow) ** (1.0 / n))
        x_min = int(center - x_limit)
        x_max = int(center + x_limit)
        for x in range(max(0, x_min), min(large, x_max + 1)):
            cx = (x - center + 0.5) / radius
            val = abs(cx) ** n + cy_pow
            if val <= 1.0:
                pixels[x, y] = 255

    # 缩小回原始尺寸（LANCZOS 抗锯齿）
    mask = mask.resize((size, size), Image.LANCZOS)
    return mask


def generate_macos_icon(
    source_path: str,
    output_path: str,
    bg_color: tuple | None = None,
    shape_scale: float = 0.80,
    content_scale: float = 0.70,
    superellipse_n: float = 5.0,
    icon_size: int = 1024,
):
    """
    生成符合 macOS HIG 规范的 squircle 圆角图标。

    参数：
      source_path: 源图标路径
      output_path: 输出路径
      bg_color: 背景色 (R, G, B, A)，None 则自动采样
      shape_scale: squircle 占画布比例（Apple 标准 0.80）
      content_scale: logo 占 squircle 比例（建议 0.70）
      superellipse_n: 超椭圆指数（Apple 标准 5.0）
      icon_size: 画布尺寸（标准 1024）
    """
    if not os.path.exists(source_path):
        print(f"❌ 源图标不存在: {source_path}")
        sys.exit(1)

    print(f"📥 读取源图标: {source_path}")
    source = Image.open(source_path).convert("RGBA")

    # 确保正方形
    if source.width != source.height:
        print(
            f"⚠️  源图标非正方形 ({source.width}x{source.height})，裁剪为正方形"
        )
        min_dim = min(source.width, source.height)
        left = (source.width - min_dim) // 2
        top = (source.height - min_dim) // 2
        source = source.crop((left, top, left + min_dim, top + min_dim))

    # 自动采样背景色
    if bg_color is None:
        bg_color = sample_bg_color(source)
        print(
            f"🎨 自动采样背景色: #{bg_color[0]:02x}{bg_color[1]:02x}{bg_color[2]:02x}"
        )
    else:
        print(
            f"🎨 使用指定背景色: #{bg_color[0]:02x}{bg_color[1]:02x}{bg_color[2]:02x}"
        )

    # 创建透明画布
    canvas = Image.new("RGBA", (icon_size, icon_size), (0, 0, 0, 0))

    # squircle 区域
    shape_size = int(icon_size * shape_scale)
    shape_offset = (icon_size - shape_size) // 2

    # 创建 squircle 背景
    shape_canvas = Image.new("RGBA", (shape_size, shape_size), bg_color)

    # 缩小 logo 并居中放置
    content_size = int(shape_size * content_scale)
    logo = source.resize((content_size, content_size), Image.LANCZOS)
    logo_offset = (shape_size - content_size) // 2
    shape_canvas.paste(logo, (logo_offset, logo_offset), logo)

    # 放置到画布中心
    canvas.paste(shape_canvas, (shape_offset, shape_offset))

    # 生成并应用 squircle 蒙版
    print(
        f"🔷 生成 squircle 蒙版（形状占画布 {int(shape_scale * 100)}%，"
        f"logo 占形状 {int(content_scale * 100)}%）..."
    )
    mask = create_squircle_mask(icon_size, shape_scale, superellipse_n)

    r, g, b, a = canvas.split()
    a = ImageChops.multiply(a, mask.convert("L"))
    result = Image.merge("RGBA", (r, g, b, a))

    result.save(output_path, "PNG")
    print(f"✅ macOS 圆角图标已保存: {output_path}")
    print(f"   尺寸: {result.width}x{result.height}")

    # 返回采样到的背景色十六进制值（供 Tauri CLI 使用）
    hex_color = f"#{bg_color[0]:02x}{bg_color[1]:02x}{bg_color[2]:02x}"
    print(f"   背景色: {hex_color}")
    return hex_color


def main():
    parser = argparse.ArgumentParser(
        description="生成符合 Apple macOS HIG 规范的 squircle 圆角图标"
    )
    parser.add_argument("--source", required=True, help="源图标路径（PNG）")
    parser.add_argument(
        "--output", default="./app-icon-macos.png", help="输出路径"
    )
    parser.add_argument(
        "--bg-color",
        default=None,
        help="背景色 R,G,B（如 213,218,222）。不指定则自动采样",
    )
    parser.add_argument(
        "--shape-scale",
        type=float,
        default=0.80,
        help="squircle 占画布比例（默认 0.80）",
    )
    parser.add_argument(
        "--content-scale",
        type=float,
        default=0.70,
        help="logo 占 squircle 比例（默认 0.70）",
    )
    parser.add_argument(
        "--superellipse-n",
        type=float,
        default=5.0,
        help="超椭圆指数（默认 5.0）",
    )
    parser.add_argument(
        "--size", type=int, default=1024, help="画布尺寸（默认 1024）"
    )

    args = parser.parse_args()

    bg_color = None
    if args.bg_color:
        parts = [int(x.strip()) for x in args.bg_color.split(",")]
        if len(parts) != 3:
            print("❌ --bg-color 格式错误，应为 R,G,B（如 213,218,222）")
            sys.exit(1)
        bg_color = (parts[0], parts[1], parts[2], 255)

    generate_macos_icon(
        source_path=args.source,
        output_path=args.output,
        bg_color=bg_color,
        shape_scale=args.shape_scale,
        content_scale=args.content_scale,
        superellipse_n=args.superellipse_n,
        icon_size=args.size,
    )


if __name__ == "__main__":
    main()
