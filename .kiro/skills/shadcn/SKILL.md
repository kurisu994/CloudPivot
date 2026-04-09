---
name: shadcn
description: 管理 shadcn 组件与项目 —— 添加、搜索、修复、调试、样式调整及 UI 组合。提供项目上下文、组件文档及使用示例。在处理 shadcn/ui、组件镜像源、预设(--preset) 标识，或任何拥有 components.json 文件的项目时适用。遇到诸如 "shadcn init"、"带 --preset 参数创建 app" 或 "切换至 --preset" 等请求时亦可触发。
user-invocable: false
allowed-tools: Bash(npx shadcn@latest *), Bash(pnpm dlx shadcn@latest *), Bash(bunx --bun shadcn@latest *)
---

# shadcn/ui

一个用于构建用户界面、组件及设计系统的框架。其中的组件通常作为源码通过 CLI 安装至用户的项目中。

> **重要提示：** 请始终使用项目所使用的包管理器来运行所有的 CLI 命令，例如：`npx shadcn@latest`, `pnpm dlx shadcn@latest`, 或 `bunx --bun shadcn@latest` —— 根据项目的 `packageManager` 配置而定。下文的示例均使用 `npx shadcn@latest`，但在实际操作时请替换为正确的包管理器命令。

## 当前项目上下文 (Current Project Context)

```json
!`npx shadcn@latest info --json`
```

上面的 JSON 包含了项目的配和已安装的组件列表。使用 `npx shadcn@latest docs <component>` 获取任何组件的在线文档及演示(URL)。

## 原则 (Principles)

1. **优先使用现有组件。** 在尝试手写自定义 UI 前，请利用 `npx shadcn@latest search` 在镜像源（包括社区源）寻找。
2. **重在组合，切忌重复造轮子。** 比如设置页面 (Settings page) = Tabs + Card + Form Controls；面板 (Dashboard) = Sidebar + Card + Chart + Table。
3. **优先使用内置组件变体 (variants)。** 请使用已有的如 `variant="outline"`, `size="sm"` 等。
4. **使用语义化颜色（Tokens）。** 像 `bg-primary`, `text-muted-foreground` 等 —— 永远不要硬编码具体的颜色值（如 `bg-blue-500`）。

## 关键守则 (Critical Rules)

这些守总是会被 **严格执行**。每一项规则均链接至对应的正确/错误代码比对文件。

### 样式与 Tailwind → [styling.md](./rules/styling.md)

- **`className` 用作布局调整，不用作内部样式覆盖。** 请勿覆写组件的原有颜色和字体。
- **不用 `space-x-*` 或 `space-y-*`。** 尽量利用 `flex` 配合 `gap-*` 属性。纵向堆叠可使用 `flex flex-col gap-*`。
- **宽高一致时使用 `size-*`。** 应写 `size-10`，而非 `w-10 h-10`。
- **使用 `truncate` 速写。** 不要写又臭又长的 `overflow-hidden text-ellipsis whitespace-nowrap`。
- **禁止通过 `dark:` 手动覆写暗色控制。** 请使用语义变量 (`bg-background`, `text-muted-foreground`)。
- **使用 `cn()` 处理条件类名。** 不要手动编写大段的模板字符串加三元运算符。
- **避免在浮层组件中手动添加 `z-index`。** Dialog, Sheet, Popover 等组件会自动处理对应的层级堆叠。

### 表单与输入框 → [forms.md](./rules/forms.md)

- **表单布局使用 `FieldGroup` + `Field`。** 不要用纯净的 `div` 配合 `space-y-*` 或是 `grid gap-*`。
- **`InputGroup` 内配合使用 `InputGroupInput`/`InputGroupTextarea`。** 直接把纯 `Input`/`Textarea` 塞进 `InputGroup` 是不可取的。
- **输入框里内联按钮时，使用 `InputGroup` + `InputGroupAddon`。**
- **选项集（2~7 个选项）请使用 `ToggleGroup`。** 不要循环渲染 `Button` 并且手动控制其 active 选中态。
- **使用 `FieldSet` + `FieldLegend` 把相关的 checkboxes/radios 分组括起来。** 不要只在一个普通的 `div` 里面加个 `<h3>` 标题就算分组了。
- **字段验证信息状态应借助 `data-invalid` 和 `aria-invalid` 表达。** 在外层 `Field` 加 `data-invalid`，在它的内层控件加 `aria-invalid`。禁用状态也类似：外层 `data-disabled`，控件 `disabled`。

### 组件结构 → [composition.md](./rules/composition.md)

- **列表项应当一直包裹在它们的归属集合组件中。** 例：`SelectItem` → `SelectGroup`；`DropdownMenuItem` → `DropdownMenuGroup`；`CommandItem` → `CommandGroup`。
- **使用 `asChild` (如果基于 radix) 或 `render` (如果基于 base) 实现自定义触发器。** 请通过检查 `npx shadcn@latest info` 返回信息中的 `base` 字段确认使用哪个。（详见 → [base-vs-radix.md](./rules/base-vs-radix.md)）
- **Dialog, Sheet 和 Drawer 这种组件一定要有 Title。** 为了无障碍支持 (A11y)，需要 `DialogTitle`, `SheetTitle` 等组件。如果纯从视觉角度上您不想让它出现，加上 `className="sr-only"` 将它视觉隐藏。
- **构建 Card 请使用全套子组件拼接。** 遵循：`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`，而不是全丢进 `CardContent`。
- **Button 组件没有诸如 `isPending` 或 `isLoading` 的属性。** 如需此类状态组件，使用 `Spinner` 结合 `data-icon` 并同时施加 `disabled` 属性拼接而成。
- **`TabsTrigger` 必须放在 `TabsList` 里面。** 万万不可在 `Tabs` 下零散地随意挂几个触发器。
- **`Avatar` 一般总要同时引入 `AvatarFallback`**，以备图片加载失败时显示占位内容。

### 优先采用组件而非自定义 HTML Markup → [composition.md](./rules/composition.md)

- **当你想实现一个花样 DIV 之前，永远先检查是否存在可用组件。**
- **引言和警告信息 (Callouts) 请使用 `Alert` 组件。** 不要手动用样式的 `div` 搭。
- **内容空状态栏使用 `Empty`。** 没必要每次自己用定制化标签重构空列表视图。
- **使用 `sonner` 发送 Toast 消息。** 导入自 `sonner` 包，调用它的 `toast()` 方法即可。
- **分割线采用 `Separator` 组件。** 少写原生的 `<hr>` 标签，更不要使用带边框样式的 `<div className="border-t">`。
- **加载占位符首选 `Skeleton`。** 不要自己在 div 上手写 `animate-pulse` 等原生加载相关 css。
- **小徽章采用 `Badge`。** 而非定制的 `<span>` 。

### 图标集 → [icons.md](./rules/icons.md)

- **放置在 `Button` 上的图标使用 `data-icon`。** 可以填属性值为 `data-icon="inline-start"` 或 `data-icon="inline-end"` 以实现。
- **被用在组件里面的内部图标不要自己加 sizing css 属性设定。** 因为外层容器里的内部 CSS 通常已经接管了大小，不要硬写 `size-4` 或 `w-4 h-4` 这样的东西。
- **传递图标参数应将其当作为 Object对象 而并非字符串 Key。** 使用 `icon={CheckIcon}`，绝不在其中混入以 String 读取来找值的查询逻辑。

### 命令行工具 (CLI)

- **任何时候都不可以人为地用外部的方法提取或解构获取远端 preset 代码的内容代码**，您必须将所拿到的任何相关东西全封不动地带入给类似 `npx shadcn@latest init --preset <code>` 的指令。

## 高频代码范式 (Key Patterns)

这是正确使用 shadcn/ui 组件时最常出现的写法范式。如果您想查看关于特定细微边界状态处理说明，请跳转到上一章介绍的细分 markdown 说明文件中阅读。

```tsx
// 1. 表单内部结构拼接: FieldGroup + Field, 正确的做法绝不用普通的 div 包装 Label.
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" />
  </Field>
</FieldGroup>

// 2. 状态验证传递： 外层写出 data-invalid; 所属内部控件里用 aria-invalid
<Field data-invalid>
  <FieldLabel>Email</FieldLabel>
  <Input aria-invalid />
  <FieldDescription>无效的 email 格式。</FieldDescription>
</Field>

// 3. 将 Icon 镶嵌按钮内：引入 data-icon，移除无关 sizes 的设定。
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

// 4. 空隙排布问题：引入 gap-*; 禁止直接使用 space-y-*.
<div className="flex flex-col gap-4">  // 对的做法
<div className="space-y-4">            // 错的做法

// 5. 等宽等于等高的类名语法应用：使用 size-* 取代原本繁杂的 w-* h-*。
<Avatar className="size-10">   // 对
<Avatar className="w-10 h-10"> // 错

// 6. 状态用色: 应调用 Badge 组件对应的变体变量，或至少调用指定的语义化的 css token; 不要使用类似原生硬编码颜色色名。
<Badge variant="secondary">+20.1%</Badge>    // 正确
<span className="text-emerald-600">+20.1%</span> // 错误
```

## 组件适用场景图谱 (Component Selection)

| 用户目标需求               | 应该呼叫的组件                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 按钮及动作触发             | 按需求使用具备某特定变体的 `Button`                                                                                    |
| 对数据表单的处理交互       | `Input`, `Select`, `Combobox`, `Switch`, `Checkbox`, `RadioGroup`, `Textarea`, `InputOTP`, `Slider`                    |
| 2～5个之间的组合类单向选取 | `ToggleGroup` 结合内部包含子类的 `ToggleGroupItem`                                                                     |
| 用于大范围数据的直连展示   | `Table`, `Card`, `Badge`, `Avatar`                                                                                     |
| 网站应用内部架构级别导航   | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`, `Pagination`                                                        |
| 弹出类覆盖视图应用         | `Dialog` (对话弹窗), `Sheet` (边栏面板), `Drawer` (抽屉弹出), `AlertDialog` (危险警告确认)                             |
| 回馈用户的临时响应         | `sonner` (提供吐司冒泡), `Alert`, `Progress`, `Skeleton`, `Spinner`                                                    |
| 命令执行的模糊命令调用面板 | 将属于它的核心类 `Command` 嵌套并组装在 `Dialog` 弹出面板里面                                                          |
| 数据相关统计饼/曲线/柱形图 | `Chart` (该模块往往在背后封装自外部图表工具库例如 Recharts 的核心引擎)                                                 |
| 网站的内外部宏观结构性安排 | `Card`, `Separator` (分界条), `Resizable`, `ScrollArea` (自动包裹支持滑动区), `Accordion` (手风琴), `Collapsible` |
| 当数据没有可被展示出的时候 | 直接用空状态表示类：`Empty`                                                                                            |
| 对用户提供的复杂列表型菜单 | `DropdownMenu`, `ContextMenu` (鼠标右键提供列表), `Menubar`                                                            |
| 各种详细型/临时气泡悬停注  | `Tooltip`, `HoverCard`, `Popover`                                                                                      |

## 关键识别字段群组 (Key Fields)

本文开头所展示出的执行命令抓取来的项目当前基本配置详情。这些参数中具有高鉴别的字段涵义如下：

- **`aliases`** → 这告诉你需要引入哪些当前工作区专属路径首缀 （通常诸如 `@/`, `~/` 这类字眼，在使用 import 函数进行包含时禁止硬去写入预推判断的词头）
- **`isRSC`** → 每当该段返回值被确定为 `true` 的同时所包含被使用的那些 `useState`/ `useEffect` 以及所有包含着 event handlers 点击行为等等组件时：则一定要使用且始终在此文件的开头位置处带有 `"use client"` 这个声明指令字眼以示警告告知框架。如果您对其他相关问题回复代码提出解决意见，均应该记得并包含提及。
- **`tailwindVersion`** → 当返回为 `"v4"` 那就表明它主要将核心配置引入到了内部的 `@theme inline` 设定中， `"v3"` 是通过常见的普通类配置文件 `tailwind.config.js` 。
- **`tailwindCssFile`** → 定义着用户自行开发且配置各种个性自定义 CSS 的绝对全局主 CSS 样式设定代码总文档。必须并且绝对只在此文档之上覆盖而禁止试图强行为它另外重新添加一条独立的新类文档
- **`style`** → UI视觉效果与视觉主题选择方案指示标。例如采用类似 `nova`, `vega` 款式风格。
- **`base`** → UI最深层次支持和所依赖的架构包引擎类型指示。可以是 `radix` 或 `base`; 其对代码调用 API 方法甚至组件对外披露具备啥特殊方法传参接口有着根本影响。
- **`iconLibrary`** → 表明需要将哪些特定风格名称图标导入到项目中，举个例子比如如果要求载入的是像使用 `lucide` 的组件，对应就要被指向导入自 `lucide-react`； `tabler` 就指要从 `@tabler/icons-react` 解析； 绝对不允许你靠惯性思维猜测成只有一种 `lucide-react` 而已！
- **`resolvedPaths`** → 为那些各种乱七八糟路径提供了确定且真实反映在真实本地主机硬盘资源文件下的那些如 utils 函数, hooks 方法包 等绝对解析指向点
- **`framework`** → 具体在用的那个外侧容器型网站构筑开发引擎名称（用于说明它比如采用得到底是 基于 Next.js App Router 约定式规范 或是只基于 Vite 所构建出的典型那种纯单页面应用 SPA）。
- **`packageManager`** → 安装执行外部一切不是只局限于 shadcn/ui 系列本身所专有那套包体时 （举例：对于 date-fns 的引流 `pnpm add date-fns` 或者是按照 `npm install date-fns`。这部分请务必优先听从该选项的内容）。

详细的内容参见文档说明： [cli.md — `info` command](./cli.md) 获取更复杂的查阅。

## 组件文档获取、用法查询与样例阅读

执行指令 `npx shadcn@latest docs <component>` 。您可以拿到组件的使用说明文档（包含 example）的相关 URL 引用指向链接入口。拿到 URL 以后再提取其真正展示正文字面值。

```bash
npx shadcn@latest docs button dialog select
```

**当你试图做相关诸如对这种类型组件代码新增/纠正/解决潜在调试报错、亦或者只是刚摸清起步用法时，首先并且每次都务必请将该指引操作做为最优先项来获取其相应的 docs 。** 这是对该模块不靠瞎猜，并且永远保证拿到并根据官方正品规范写法提供的防身保险。

## 运作标准工作流 (Workflow)

1. **取得当前所在开发库上下文状况** — 就是你在前文文档那段命令得到的那里头内容，不够确定或是忘记就可以再多请求一次跑命令去获得。
2. **永远在使用前优先核对现有库内预存包内容组** — 这个主要特指你试图试图跑 `add` 前的操作之前一定要对比前一次在 context 或者列好包含于 `resolvedPaths.ui` 当内的东西里做重复过滤判断。对于已经加进去了的东西不再去加载；不要随意向没有装好的代码库直接就上乱导入命令调用代码的语句。
3. **搜包方法** — 请使用指令去搜索获得相关： `npx shadcn@latest search` 。
4. **得到 docs 以及代码 demo 的资源内容** — 当想查找但实际上本系统库没有预载它资源包东西前。你要先运行得到外部官方对于此名称的方法：`npx shadcn@latest docs <component>` 然后才进行查看内容的阅读（可以通过类似于 `npx shadcn@latest view` 预览那部分尚未引入的项目相关源文内容）； 当仅用来预览已经被载好且正在修改使用的那些，要换上这句 ：`npx shadcn@latest add --diff` 。
5. **添加下载 或进行版本的覆盖替换升级动作** — `npx shadcn@latest add`。在给原有的进行直接迭代前， 请老老实实的配合着 `--dry-run` 加上 `--diff` 先通过预演示步骤搞清有啥将会被变了再决定后续的事。 此流程参考本文后面会说的内容。[关于替换/升级内容的流程说明](#Updating-Components)。
6. **关于涉及非原生第三方类包库时引入项中修复其对于资源指向时错配问题** — 当你要去安装使用比如不限定在只来自于默认预处理体系提供的 `@shadcn`，如属于外链社区第三方提供的扩展 （比如 `@bundui`, 或者 `@magicui`）。添加完毕时请认真逐条审核这套外侧包导入本系统之后产生的 非纯UI资源内其他杂七杂八配置文件当中所写着导入的依赖：这类导入源绝大多数可能会被强写成带有非常主观意味死写的格式，比如带着 `@/components/ui/...` ；那么这类玩意儿在实际上通常绝对无法和你现在用的本地代码设置上的 alias 相兼容配合的（请使用之前所述方法提取到这具体真指的该别名前缀并替换好以确保路径的完全精确生效）。命令行自带的功能是已经完美内置解决这一些类对于其自己官方出产库依赖中相关替换纠正逻辑；但绝不一定会保证对外部外包源头提供方的同等包容，所以这个必须要留心并且修复调整好！
7. **给任何刚通过安装拉取代注入代码后，均需审核检查所装进去的所有成分内容的合规问题** — 特别声明在装好来自无论从哪提供的某部分新版构建包以后，**均需强制人为浏览代码全文并人工去认定有没有逻辑合规上的缺口**！这包含了比如子组件缺乏的情况 （类似说用到了选框组结构里头的 `SelectItem` 却没有对应带上装入必备配套包含组 `SelectGroup` 等逻辑缺项事件）、引错了源头包地址、使用场景方法搭配错误不当、严重反水无视本文说必须重视的：【[关键守则规则栏目说明](#Critical-Rules)】 内的诸多的要求禁止条件；此外必须核查并将这个刚刚所新加入源文件下内全部和显示呈现所相关有关 Icon 图标使用引用库名替换转正成为你的在项目中目前实际真正指配向的那种预定 Icon 环境：比如说该新上的源用的是来自 `lucide-react`，但其实您当前开发项目中被定义只能调用那什么叫 `hugeicons` 图库的时候。必须毫不犹豫地去切换替换纠正好相关的内部调用！并在真正解决完了以后才算准许通行结束这个操作项周期。
8. **需要声明并指向清楚它真正的资源挂载归属镜像主源（Registry）** — 只要面对客户向本机器要求说准备做添加某些新特定组件功能要求（比如：添加一个带有能显示登陆画面的业务模组出来），哪怕此时他嘴上的说辞中并未主动点名点姓这是不是必须来自于某个主镜像点（假设他没加上指明来自 `@shadcn`, 还是指来自于 `@tailark` 等等描述），此时也禁止凭空用您的脑补想当然去随便分配或默认处理，你应该追问或者给出确认的条件再处理，无论如何不可以靠代替做这越俎代庖的这种判定！。
9. **需要将一种类型的设定配置整个变幻调转至另类 (Switching presets)** — 事前需要对使用者发问，要决定该采信下面的哪种处理倾向方式来对待现在代码内的组建包体文件了？ 问他们是要打算： **重新对全部覆盖载入 (reinstall)**，还是 **仅仅对某些组件用智能的冲突融合 (merge)** 亦或干脆选择 **直接丢弃啥代码也别动 (skip)**？
    - **Reinstall (覆盖所有)**: `npx shadcn@latest init --preset <code> --force --reinstall`。这意味着用它原本附带样式重新来血洗冲刷重置代码包所有组件内容表现。
    - **Merge (缝补合并)**: 先这句 `npx shadcn@latest init --preset <code> --force --no-reinstall`，跑完了紧接着立即通过执行这句 `npx shadcn@latest info` 从中列表扒出来里面包含当前所有的装好了现存列表；然后对着它们每一个进行开启一次只针对那一个单独使用着加在尾部的诸如包含带有： `--dry-run` 与 `--diff` 的预跑命令让使用者自己评估去把有需求的东西挑拣下来人工智配和修补。[智能智配修补](#Updating-Components)。
    - **Skip (全部忽视不管)**: `npx shadcn@latest init --preset <code> --force --no-reinstall`。这里头啥功能都不覆盖原装好的代码里的本身样式设定；只针这系统的配置文件本身内容与所关联用到的核心基础 CSS variable 色彩控制变量参数作出其相关更新响应变化。
    - **关键要素 (Important)**: 执行预设命令行配置时，绝对要求被执行者处于且一定要在这个待配置使用用户目前项目的绝对真实所在根目录下面去敲击这种跑通指令！CLI 会高度优先聪明且自觉从你项目原配置文件 `components.json` 当内把那个最为初始也是最为重要（像基础框架是采用 `base` 还是 `radix` 等）的信息全部如样地继承接续使用下来！如果此时你受限定非要在诸如一个沙盒般的暂存路径里面操作跑下验证的话（为了去对付诸似仅出于拿一下做些比对差异报告等等缘故等使用诸似带有：`--dry-run` 的应用情形)，由于提取过来所谓的这种带密码锁般的只具备参数配置代表标识字符的那种 preset codes 参数它自身可是本身没有任何携带此类有关什么 base 所定下的底设属性说明记录在案的；所以这就导致你只能是且必须带上诸如以这种硬声明去追加强配好它的那个底色本源才不会出错：也就是要加好这种例如 `--base <这里填出应该的底源说明>` ！

## 如何去处理及解决后续出现的包体更新升级过程里的情况 （Updating Components）

如果你遇到用户向你请求希望将当前项目环境中所正在使用那些老组件版本从项目线上代码更新下载拿回它最新的变更源头的时候，同时还需要在这之上不要破坏它本地已经存在且发生经过更改的代码时：请优先并且一向都记得要祭出包含并加着这些带有诸如：`--dry-run` 结合着带上这种：`--diff` 后缀用法的指令句前去进行一番十分讲究且精妙不犯糊涂地拼缝缝组调配的流程！ **绝不可以用从 Github 等外站生硬又直接下载的动作来进行源头文件替顶方式搞法 —— 必须只依托用我们的 CLI 命令行实现整个拉回。**

1. 率先去执行带这种 `npx shadcn@latest add <对应那个需要更新掉的代码里的组件包的名字> --dry-run`，并借由这个过程来先将究竟将牵扯连带着到多大覆盖面所发生涉及变故的相关的文件先整个摸底搞懂一遍它的影响度。
2. 挨个针对那些出现变更涉事文件们里所有单独列个条目进行运行包含带这这部分 `npx shadcn@latest add <组件名称> --diff <特定的那一个具体该文件名名称>` 之类，来详细了解看清楚它到底是哪里线上相比他自个儿本地发生了多大变化和内容调整。
3. 把所有的比对拿出来细看一下。对具体每一份该怎样做做一些具体方案裁定并实施：
    - 如果这个文件相比之前没有什么改变化现象。→ 那它非常地稳定，覆盖过去即可！
    - 如果在这上面已经发现发生了改动变化痕迹了。→ 把属于此机器代码环境上面正存在有的该相应源码从读取出来，借由你这个带有智能识别的大脑思维给这比对差异处仔仔细细摸查弄清楚到底是干嘛后。通过运用这种高妙的操作手法将线上的那部分代码变更要事巧妙无缝隙嵌并融入带并留存在本地里所本该需要存在的那一部分不应丢失的变化细节身上，使其完整体现并且达到新旧同时作用而又不至于相互磨灭的结果。
    - 遇到一些十分蛮霸又随心所说的那种用户命令词诸如像是“甭废话我就想要立刻升级替换当前所能看到的这一切”等等。 → 直接丢过去加上诸如此种：`--overwrite` 这种覆写的暴力词。但这执行动作要落在必须跟对方进行了最绝对最清晰的指令重复确认的前提之后，它算是最后的保底的狠招。
4. **只要是不具备得到了对向明确授意并且给出了确实的同意的担保的话，永远、绝对不准哪怕任何一条执行了这种带有 `--overwrite` 这种危险字眼的命令行词语！**

## 快捷使用参考速查向导 （Quick Reference）

```bash
# 构建创建崭新的基于这套规范要求的整版项目的命令组合。
npx shadcn@latest init --name my-app --preset base-nova
npx shadcn@latest init --name my-app --preset a2r6bw --template vite

# 创建适用于复杂大体系支持管理多包架构的系统。
npx shadcn@latest init --name my-app --preset base-nova --monorepo
npx shadcn@latest init --name my-app --preset base-nova --template next --monorepo

# 给已经被创立建设好有雏形的一个基本旧项目上面来用此规范来加入和同化进行初始化。
npx shadcn@latest init --preset base-nova
npx shadcn@latest init --defaults  # 它属于这样一串啰嗦动作指令的一个简写替代法： --template=next --preset=base-nova

# 下载并增设某些个组件。
npx shadcn@latest add button card dialog
npx shadcn@latest add @magicui/shimmer-button
npx shadcn@latest add --all

# 给它预设并以演习方式提前过过目和校验好你可能面临的代码改动，且并未实际动作发生写入代码行为的时候。
npx shadcn@latest add button --dry-run
npx shadcn@latest add button --diff button.tsx
npx shadcn@latest add @acme/form --view button.tsx

# 到资源里用字在其中找符合内容和组件要求的物品。
npx shadcn@latest search @shadcn -q "sidebar"
npx shadcn@latest search @tailark -q "stats"

# 取到有关于某此款件中能使用参考资料及其示例引用 URL 等内容的动作。
npx shadcn@latest docs button dialog select

# 在其还未真正加入并在被安装配置实施落地前这可以做为其对于其中一些有详情展示所需的内容以查看它的真实资料细节内容的这类型的需要的时候可用它：
npx shadcn@latest view @shadcn/button
```

**被明字标识确立好了的系统既定的命名预制款式名称（Named presets）：** `base-nova`, `radix-nova`
**系统预设自带的一些针对模板型选择体系的代号名（Templates）：** `next`, `vite`, `start`, `react-router`, `astro` (前边这全部几种模板环境的类型里都是包含了允许且兼容能够带有附加设置支持这种 `--monorepo` 分块处理属性特征要求的) 以及还有一个 `laravel` (但需留意该环境里现在是不容许用这个 monorepo 去做挂载配合设定环境用的)
**针对那串能起替代用它来简读预设环境信息代称代码值（Preset codes）：** 就必须符合类似这标准那种由 Base62 型加密打底算出来一串，开头头一个字符一定是受那带小写字母属性里头的头一位字符： `a` 牵头做打头引导使用的那样一串东西（这就仿佛像是诸如 `a2r6bw` 这类感觉一样），是从这个网络端口里头来生成的 [ui.shadcn.com](https://ui.shadcn.com)。

## 这些将通往一些有着更为翔实具体并极高度精准要求描述细则条例解释内文件 （Detailed References）

- [rules/forms.md](./rules/forms.md) — 了解一切有关这些类 FieldGroup, Field, InputGroup, ToggleGroup, FieldSet，以及那验证等相关联的规定。
- [rules/composition.md](./rules/composition.md) — 全部事关像 Groups, overlays, Card, Tabs, Avatar, Alert, Empty, Toast, Separator, Skeleton, Badge, Button 等使用状态或配置逻辑里要求的组合等准侧规范这类的细致说明。
- [rules/icons.md](./rules/icons.md) — 如何正统并专业处理使用对于 data-icon 的使用, 控制管理大小方法, 以把对象作为传递目标这之类的种种规范解释。
- [rules/styling.md](./rules/styling.md) — 语义级别的颜色色块系统规范运用说明, 对组件中 variants（配置体组合变体状态）这类的讲究, className, 空白排布逻辑设定, 形体的比例规格, `truncate` 截字属性运用规则, 涉及黑夜/纯暗风格, 对于合并计算并过滤拼合法 className 的那套专属功能函数 cn（）要求说明处理手段使用方法等。
- [rules/base-vs-radix.md](./rules/base-vs-radix.md) — 作为被替换了那些诸似像是：asChild 与 render 之间取舍选择所造成的关于比如对其中如 Select, ToggleGroup, Slider, Accordion 的关联问题说明差异化的使用讲究方法说明这块有关细部的要求。
- [cli.md](./cli.md) — 为这命令行中的 Commands 运行, 那些控制它的旗帜配置参数项控制法 (flags), 它所蕴含带着 presets 的概念方法含义， 以及 templates 选择说明及区别指南这块的东西做大讲解部分。
- [customization.md](./customization.md) — 是专设开去进行给自定义属于您风格特异化，及设置那种个性颜设皮肤所采用有关配置其在核心中调参配置在主宰这颜色里参数系统 (CSS variables) 参数，另外在它框架当中怎么把这类各种原本带有局限型框框里的原样式拓展出自定义发挥等各种这类的详述这块了。
