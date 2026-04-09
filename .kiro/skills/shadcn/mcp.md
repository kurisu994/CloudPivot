# shadcn MCP Server

CLI 中包含了一个 MCP (Model Context Protocol) 服务器，它允许 AI 助手从代码镜像源（registries）中搜索、浏览、查看和安装组件。

---

## 安装设置 (Setup)

```bash
shadcn mcp        # 启动 MCP 服务器 (stdio)
shadcn mcp init   # 为你的编辑器写入配置
```

编辑器配置文件位置：

| 编辑器 | 配置文件 |
|--------|------------|
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |
| VS Code | `.vscode/mcp.json` |
| OpenCode | `opencode.json` |
| Codex | `~/.codex/config.toml` (手动配置) |

---

## 工具方法 (Tools)

> **提示：** MCP 工具能够处理镜像源相关的操作（如：搜索、查看、安装）。如果涉及到项目自身配置查询（比如 aliases、框架类型、Tailwind 版本），请使用 CLI 的 `npx shadcn@latest info` 命令 —— 因为目前没有对应的 MCP 工具。

### `shadcn:get_project_registries`

返回读取自 `components.json` 中的镜像源名词。如果不存在 `components.json` 则会报错。

**输入 (Input):** 无

### `shadcn:list_items_in_registries`

列出一个或多个镜像源中的所有组件/元项。

**输入 (Input):** `registries` (string[]), `limit` (number, 可选), `offset` (number, 可选)

### `shadcn:search_items_in_registries`

跨镜像源模糊搜索。

**输入 (Input):** `registries` (string[]), `query` (string), `limit` (number, 可选), `offset` (number, 可选)

### `shadcn:view_items_in_registries`

查看项目的详情，包含完整的文件源代码。

**输入 (Input):** `items` (string[]) — 例：`["@shadcn/button", "@shadcn/card"]`

### `shadcn:get_item_examples_from_registries`

查找带有源代码的用法示例（examples）或演示（demos）。

**输入 (Input):** `registries` (string[]), `query` (string) — 例：`"accordion-demo"`, `"button example"`

### `shadcn:get_add_command_for_items`

返回运行 CLI 安装所需的添加命令。

**输入 (Input):** `items` (string[]) — 例：`["@shadcn/button"]`

### `shadcn:get_audit_checklist`

返回一份用于验证所安装组件是否正常的检查清单（包含 imports、deps 依赖、lint、TypeScript 等检查）。

**输入 (Input):** 无

---

## 镜像源配置 (Configuring Registries)

镜像源注册配置保存在 `components.json` 中。其中 `@shadcn` 内置镜像源始终可用。

```json
{
  "registries": {
    "@acme": "https://acme.com/r/{name}.json",
    "@private": {
      "url": "https://private.com/r/{name}.json",
      "headers": { "Authorization": "Bearer ${MY_TOKEN}" }
    }
  }
}
```

- 镜像源名称必须以 `@` 开始。
- URLs 参数中必须包含 `{name}` 模板参数。
- `${VAR}` 的写法会引用解析系统当中的环境变量。

社区镜像源索引：`https://ui.shadcn.com/r/registries.json`
