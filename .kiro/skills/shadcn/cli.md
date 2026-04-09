# shadcn CLI 参考指南

配置信息读取自 `components.json`。

> **重要：** 请始终使用项目对应的包管理器运行命令：`npx shadcn@latest`、`pnpm dlx shadcn@latest` 或 `bunx --bun shadcn@latest`。可以通过项目上下文中的 `packageManager` 来选择正确的命令。下面的示例统一使用 `npx shadcn@latest`，但请确保在实际项目中使用正确的运行器。

> **重要：** 仅使用下方列出的参数选项（flags）。不要凭空发明或猜测参数 —— 如果某个参数这里没有列出，那么它就不存在。CLI 会通过项目的 lockfile 自动检测包管理器；不存在 `--package-manager` 这个参数。

## 目录

- 命令：init, add (dry-run, smart merge), search, view, docs, info, build
- 模板 (Templates)：next, vite, start, react-router, astro
- 预设 (Presets)：命名预设、预设代码、URL 格式和字段
- 切换预设

---

## 命令

### `init` — 初始化或创建项目

```bash
npx shadcn@latest init [components...] [options]
```

在现有项目中初始化 shadcn/ui，或创建新项目（当提供 `--name` 参数时）。可以在此步骤中同时安装组件。

| 参数选项 | 简写 | 描述 | 默认值 |
| ----------------------- | ----- | --------------------------------------------------------- | ------- |
| `--template <template>` | `-t` | 模板 (next, start, vite, next-monorepo, react-router) | — |
| `--preset [name]` | `-p` | 预设配置（名称、代码或 URL） | — |
| `--yes` | `-y` | 跳过确认提示 | `true` |
| `--defaults` | `-d` | 使用默认选项 (`--template=next --preset=base-nova`) | `false` |
| `--force` | `-f` | 强制覆盖现有配置 | `false` |
| `--cwd <cwd>` | `-c` | 工作目录 | 当前 |
| `--name <name>` | `-n` | 新项目的名称 | — |
| `--silent` | `-s` | 静默输出 | `false` |
| `--rtl` | | 启用 RTL（从右到左阅读）支持 | — |
| `--reinstall` | | 重新安装已有的 UI 组件 | `false` |
| `--monorepo` | | 搭建一个 monorepo 项目 | — |
| `--no-monorepo` | | 跳过 monorepo 提示 | — |

`npx shadcn@latest create` 是 `npx shadcn@latest init` 的别名。

### `add` — 添加组件

> **重要：** 若要将本地组件与上游代码进行比较或预览更改，**始终**使用 `npx shadcn@latest add <component> --dry-run`、`--diff` 或 `--view`。**绝对不要**手动从 GitHub 或其他来源获取原始文件。CLI 会自动处理镜像源解析、文件路径和 CSS 差异比较。

```bash
npx shadcn@latest add [components...] [options]
```

支持组件名称、带有源前缀的组件（如 `@magicui/shimmer-button`）、URL 或本地路径。

| 参数选项 | 简写 | 描述 | 默认值 |
| --------------- | ----- | -------------------------------------------------------------------------------------------------------------------- | ------- |
| `--yes` | `-y` | 跳过确认提示 | `false` |
| `--overwrite` | `-o` | 覆盖现有文件 | `false` |
| `--cwd <cwd>` | `-c` | 工作目录 | 当前 |
| `--all` | `-a` | 添加所有可用的组件 | `false` |
| `--path <path>` | `-p` | 组件的目标安装路径 | — |
| `--silent` | `-s` | 静默输出 | `false` |
| `--dry-run` | | 预览所有更改（不实际写入文件） | `false` |
| `--diff [path]` | | 显示差异。如果不指定路径，显示前 5 个文件。如果指定路径，仅显示该文件（隐含 `--dry-run`） | — |
| `--view [path]` | | 显示文件内容。如果不指定路径，显示前 5 个文件。如果指定路径，仅显示该文件（隐含 `--dry-run`） | — |

#### Dry-Run 模式 (空跑模式)

使用 `--dry-run` 来预览 `add` 将执行的操作而不写入任何文件。`--diff` 和 `--view` 都隐含了 `--dry-run`。

```bash
# 预览所有更改
npx shadcn@latest add button --dry-run

# 显示所有文件的差异 (最多 5 个)
npx shadcn@latest add button --diff

# 显示指定文件的差异
npx shadcn@latest add button --diff button.tsx

# 显示所有文件的内容 (最多 5 个)
npx shadcn@latest add button --view

# 显示指定文件的完整内容
npx shadcn@latest add button --view button.tsx

# 也支持 URL
npx shadcn@latest add https://api.npoint.io/abc123 --dry-run

# CSS 差异比较
npx shadcn@latest add button --diff globals.css
```

**何时使用 dry-run：**

- 当用户问“这会添加哪些文件？”或“这会更改什么？”时 —— 使用 `--dry-run`。
- 在覆盖现有组件之前 —— 首先使用 `--diff` 预览更改。
- 当用户想要查看组件源码而不安装时 —— 使用 `--view`。
- 当检查将会对 `globals.css` 做出哪些 CSS 更改时 —— 使用 `--diff globals.css`。
- 当用户要求在安装前审查第三方源的代码时 —— 使用 `--view` 检查源码。

> **`npx shadcn@latest add --dry-run` 对比 `npx shadcn@latest view`：** 
当用户想要预览对其项目的更改时，优先使用 `npx shadcn@latest add --dry-run/--diff/--view` 而不是 `npx shadcn@latest view`。
`npx shadcn@latest view` 仅显示原始的镜像元数据。`npx shadcn@latest add --dry-run` 则显示在用户项目中将实际发生的具体操作：解析后的文件路径、与现有文件的差异以及 CSS 更新。仅当用户想脱离项目上下文浏览源信息时，才使用 `npx shadcn@latest view`。

#### 从上游智能合并 (Smart Merge)

完整的流程请参见 [SKILL.md 中的 Updating Components](./SKILL.md#updating-components)。

### `search` — 搜索镜像源 (registries)

```bash
npx shadcn@latest search <registries...> [options]
```

跨镜像源模糊搜索。也可以使用别名 `npx shadcn@latest list`。如果不加 `-q`，则列出所有项目。

| 参数选项 | 简写 | 描述 | 默认值 |
| ------------------- | ----- | ---------------------- | ------- |
| `--query <query>` | `-q` | 搜索关键词 | — |
| `--limit <number>` | `-l` | 每个镜像源的最大显示数 | `100` |
| `--offset <number>` | `-o` | 跳过的项数 | `0` |
| `--cwd <cwd>` | `-c` | 工作目录 | 当前 |

### `view` — 查看项目详情

```bash
npx shadcn@latest view <items...> [options]
```

显示包含文件内容在内的项目详情。示例：`npx shadcn@latest view @shadcn/button`。

### `docs` — 获取组件文档的 URLs

```bash
npx shadcn@latest docs <components...> [options]
```

输出组件文档、示例和 API 参考的解析后的 URL。支持一个或多个组件名。**你必须获取（fetch）这些 URL 才能得到实际文档内容。**

`npx shadcn@latest docs input button` 的输出示例：

```
base  radix

input
  docs      https://ui.shadcn.com/docs/components/radix/input
  examples  https://raw.githubusercontent.com/.../examples/input-example.tsx

button
  docs      https://ui.shadcn.com/docs/components/radix/button
  examples  https://raw.githubusercontent.com/.../examples/button-example.tsx
```

某些组件包含指向底层库（例如用于 commands 组件的 `cmdk`）的 `api` 链接。

### `diff` — 检查更新

**不要使用此命令。** 请改用 `npx shadcn@latest add --diff`。

### `info` — 项目信息

```bash
npx shadcn@latest info [options]
```

显示项目信息和 `components.json` 配置。**你应该首先运行此命令**，以发现项目的框架、路径别名、Tailwind 版本和解析后的文件路径。

| 参数选项 | 简写 | 描述 | 默认值 |
| ------------- | ----- | ----------------- | ------- |
| `--cwd <cwd>` | `-c` | 工作目录 | 当前 |

**项目信息字段 (Project Info fields)：**

| 字段 | 类型 | 含义 |
| -------------------- | --------- | ------------------------------------------------------------------ |
| `framework` | `string` | 检测到的框架 (`next`, `vite`, `react-router`, `start`, 等) |
| `frameworkVersion` | `string` | 框架版本 (如 `15.2.4`) |
| `isSrcDir` | `boolean` | 项目是否使用 `src/` 目录 |
| `isRSC` | `boolean` | 是否启用了 React Server Components (RSC) |
| `isTsx` | `boolean` | 项目是否使用 TypeScript |
| `tailwindVersion` | `string` | `"v3"` 或 `"v4"` |
| `tailwindConfigFile` | `string` | Tailwind 配置文件的路径 |
| `tailwindCssFile` | `string` | 全局 CSS 文件的路径 |
| `aliasPrefix` | `string` | 导入的路径别名前缀 (如 `@`, `~`, `@/`) |
| `packageManager` | `string` | 检测到的包管理器 (`npm`, `pnpm`, `yarn`, `bun`) |

**Components.json 字段：**

| 字段 | 类型 | 含义 |
| -------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `base` | `string` | 基础元件库 (`radix` 或 `base`) — 决定了组件的 API 和可用的 Props |
| `style` | `string` | 视觉风格 (如 `nova`, `vega`) |
| `rsc` | `boolean` | 来自配置的 RSC 标志 |
| `tsx` | `boolean` | TypeScript 标志 |
| `tailwind.config` | `string` | Tailwind 配置路径 |
| `tailwind.css` | `string` | 全局 CSS 路径 —— 这里是定义自定义 CSS 变量的地方 |
| `iconLibrary` | `string` | 图标库 —— 决定引入哪种图标包 (如 `lucide-react`, `@tabler/icons-react`) |
| `aliases.components` | `string` | 组件导入别名 (如 `@/components`) |
| `aliases.utils` | `string` | 工具函数导入别名 (如 `@/lib/utils`) |
| `aliases.ui` | `string` | UI 组件导入别名 (如 `@/components/ui`) |
| `aliases.lib` | `string` | Lib 包导入别名 (如 `@/lib`) |
| `aliases.hooks` | `string` | Hooks 导入别名 (如 `@/hooks`) |
| `resolvedPaths` | `object` | 每个别名在文件系统中的绝对路径 |
| `registries` | `object` | 预先配置好的自定义镜像源 (registries) |

**链接字段 (Links fields)：**

`info` 命令的输出包含一个 **Links** 区域，里面含有组件文档、源码和示例模板的网址。若要获得已经解析好的真实 URL 链接，请使用 `npx shadcn@latest docs <component>`。

### `build` — 构建自定义镜像源

```bash
npx shadcn@latest build [registry] [options]
```

将 `registry.json` 构建为分发用的各个 JSON 文件。默认输入：`./registry.json`，默认输出：`./public/r`。

| 参数选项 | 简写 | 描述 | 默认值 |
| ----------------- | ----- | ----------------- | ------------ |
| `--output <path>` | `-o` | 输出目录 | `./public/r` |
| `--cwd <cwd>` | `-c` | 工作目录 | 当前 |

---

## 模板 (Templates)

| 值 | 框架 | 支持 Monorepo 吗 |
| -------------- | -------------- | ---------------- |
| `next` | Next.js | 是 |
| `vite` | Vite | 是 |
| `start` | TanStack Start | 是 |
| `react-router` | React Router | 是 |
| `astro` | Astro | 是 |
| `laravel` | Laravel | 否 |

所有模板均支持通过 `--monorepo` 选项生成 monorepo 仓库。传递此参数时，CLI 使用特定于 monorepo 的模板目录（例如 `next-monorepo`，`vite-monorepo`）。如果不传递 `--monorepo` 和 `--no-monorepo`，CLI 将会交互式提示。Laravel 目前不支持 monorepo 搭建。

---

## 预设 (Presets)

有三种方式通过 `--preset` 参数指定预设：

1. **命名预设 (Named)：** `--preset base-nova` 或 `--preset radix-nova`
2. **代码预设 (Code)：** `--preset a2r6bw`（小写 `a` 开头的 base62 字符串）
3. **URL：** `--preset "https://ui.shadcn.com/init?base=radix&style=nova&..."`

> **重要：** 永远不要试图手动解析、获取或解析预设代码。预设代码是不透明的（opaque），直接将其原样传给 `npx shadcn@latest init --preset <code>`，让 CLI 处理解析即可。

## 切换预设 (Switching Presets)

先问用户：是要对现有组件进行 **重新安装 (reinstall)**，**合并 (merge)** 还是 **跳过 (skip)**？

- **重新安装 (Re-install)** → `npx shadcn@latest init --preset <code> --force --reinstall`。使用新预设样式完全覆盖所有组件文件。适用于用户未定制组件源代码的情况。
- **合并 (Merge)** → `npx shadcn@latest init --preset <code> --force --no-reinstall`，然后运行 `npx shadcn@latest info` 获取已安装组件列表，并使用 [智能合并流程 (smart merge workflow)](./SKILL.md#updating-components) 逐一更新它们以保留本地修改。适用于用户已经对组件有较多自定义修改的情况。
- **跳过 (Skip)** → `npx shadcn@latest init --preset <code> --force --no-reinstall`。这仅仅更新配置和 CSS 变量，保留已有的组件原封不动。

必须在用户的项目目录内执行 preset 命令。CLI 会自动保留 `components.json` 中的当前基础元件库（`base` 或是 `radix`）。如果您确实需要在临时抓取目录中模拟运行（比如用于 `--dry-run` 比较），则必须显式传递 `--base <current-base>` —— 因为 preset 代码里没有嵌入 base 属性。
