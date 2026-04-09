# 定制化与主题 (Customization & Theming)

组件会引用语义化的 CSS 变量（tokens）。只要改变这些变量，就能改变所有组件的样式。

## 目录

- 工作原理 (CSS 变量 → Tailwind 工具类 → 组件)
- 颜色变量和 OKLCH 格式
- 暗色模式（Dark mode）设置
- 更改主题 (预设，CSS 变量)
- 添加自定义颜色 (Tailwind v3 和 v4)
- 边框圆角 (Border radius)
- 自定义组件 (变体 variants, className, 包装器 wrappers)
- 检查更新

---

## 工作原理

1. CSS 变量定义在 `:root`（浅色）和 `.dark`（暗色模式）中。
2. Tailwind 将它们映射到工具类（utilities）：`bg-primary`, `text-muted-foreground` 等。
3. 组件使用这些工具类 —— 更改一个变量，就会更改所有引用该变量的组件。

---

## 颜色变量

每个颜色都遵循 `name` / `name-foreground` 的命名约定。基础变量用于背景，`-foreground` 用于该背景上的文字或图标。

| 变量                                     | 用途                          |
| -------------------------------------------- | -------------------------------- |
| `--background` / `--foreground`              | 页面背景和默认文本 |
| `--card` / `--card-foreground`               | 卡片表面 |
| `--primary` / `--primary-foreground`         | 主要按钮和主要操作 |
| `--secondary` / `--secondary-foreground`     | 次要操作 |
| `--muted` / `--muted-foreground`             | 弱化/禁用状态 |
| `--accent` / `--accent-foreground`           | 悬停（Hover）和强调状态 |
| `--destructive` / `--destructive-foreground` | 错误和破坏性操作 |
| `--border`                                   | 默认边框颜色 |
| `--input`                                    | 表单输入框边框 |
| `--ring`                                     | 焦点环颜色 (Focus ring) |
| `--chart-1` 到 `--chart-5`              | 图表/数据可视化 |
| `--sidebar-*`                                | 侧边栏专属颜色 |
| `--surface` / `--surface-foreground`         | 次级表面层 |

颜色使用 OKLCH 格式：`--primary: oklch(0.205 0 0)`，其中的值分别代表亮度（Lightness，0–1）、色度（Chroma，0 = 灰色）和色相（Hue，0–360）。

---

## 暗色模式 (Dark Mode)

通过根元素上的 `.dark` 类（基于 class 的切换）来实现。在 Next.js 中，使用 `next-themes`：

```tsx
import { ThemeProvider } from "next-themes"

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

---

## 更改主题

```bash
# 应用来自 ui.shadcn.com 的预设代码。
npx shadcn@latest init --preset a2r6bw --force

# 切换到命名预设 (Named preset)。
npx shadcn@latest init --preset radix-nova --force
npx shadcn@latest init --reinstall  # 更新现有组件以匹配新预设

# 使用自定义主题的 URL。
npx shadcn@latest init --preset "https://ui.shadcn.com/init?base=radix&style=nova&theme=blue&..." --force
```

或者直接在 `globals.css` 中编辑 CSS 变量。

---

## 添加自定义颜色

在你通过 `npx shadcn@latest info` 获取到的 `tailwindCssFile` （通常是 `globals.css`）文件中添加变量。**绝对不要**为此创建一个新的 CSS 文件。

```css
/* 1. 在全局 CSS 文件中定义。 */
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}
.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}
```

```css
/* 2a. 使用 Tailwind v4 注册 (@theme inline)。 */
@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

如果 `tailwindVersion` 是 `"v3"`（可通过 `npx shadcn@latest info` 检查），请改为在 `tailwind.config.js` 中注册：

```js
// 2b. 使用 Tailwind v3 注册 (tailwind.config.js)。
module.exports = {
  theme: {
    extend: {
      colors: {
        warning: "oklch(var(--warning) / <alpha-value>)",
        "warning-foreground":
          "oklch(var(--warning-foreground) / <alpha-value>)",
      },
    },
  },
}
```

```tsx
// 3. 在组件中使用。
<div className="bg-warning text-warning-foreground">Warning</div>
```

---

## 边框圆角 (Border Radius)

`--radius` 全局控制边框的圆角大小。组件的圆角值由此推导而来（`rounded-lg` = `var(--radius)`，`rounded-md` = `calc(var(--radius) - 2px)`）。

---

## 自定义组件

另见：[rules/styling.md](./rules/styling.md) 获取 错误/正确 代码示例。

请按以下顺序优先采用这些方法：

### 1. 内置变体 (Built-in variants)

```tsx
<Button variant="outline" size="sm">Click</Button>
```

### 2. 通过 `className` 传递 Tailwind 类

```tsx
<Card className="max-w-md mx-auto">...</Card>
```

### 3. 添加新的变体

编辑组件源码，通过 `cva` 添加一个新的变体 (variant)：

```tsx
// components/ui/button.tsx
warning: "bg-warning text-warning-foreground hover:bg-warning/90",
```

### 4. 包装器组件 (Wrapper components)

将 shadcn/ui 的基础组件 (primitives) 组合成更高级的组件：

```tsx
export function ConfirmDialog({ title, description, onConfirm, children }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

## 检查更新

```bash
npx shadcn@latest add button --diff
```

要在更新之前准确预览将要发生的更改，请使用 `--dry-run` 和 `--diff`：

```bash
npx shadcn@latest add button --dry-run        # 查看所有受影响的文件
npx shadcn@latest add button --diff button.tsx # 查看特定文件的差异内容
```

完整的智能合并工作流，请参见 [SKILL.md 中的 Updating Components](./SKILL.md#updating-components)。
