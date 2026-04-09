# 组件的结构拼装法则 (Component Composition)

## 目录

- 列表项子项目应始终确保放在专属属于它们的归属性质聚合群组 Group 里面
- 向用户进行的特别引文以及提醒反馈请动用 Alert
- 面对不存在的数据占位时动用纯正的 Empty 空态组件处理
- 小弹吐司通知采用 sonner 组件
- 当从各式花样重叠与覆盖式面板进行取舍与运用说明
- 警告！所有的类似于： Dialog , Sheet 还有那种 Drawer 都必定并且要带有能够表达 Title 意思的核心组件配合
- 对于卡片 Card 这类的基本组合准则
- 记得：我们提供的纯的 Button 就压根没有什么可以叫作 `isPending` 或者那什么 `isLoading` 自带属性
- TabsTrigger (选项卡那点控标) 它就万不可在 TabsList 的有效外圈跑丢
- 对于那个圆饼头像 Avatar , 它必不可少总要配置带有后备显示的 AvatarFallback

---

## 列表项子项目应始终确保放在专属属于它们的归属性质聚合群组 Group 里面

绝对不要把那些一个一个具体负责传参表达的细项条目就毫不掩饰地直接大撒把一般直接扔给了提供装取的外层底盘框内中去了。

**不良的错法示范:**

```tsx
<SelectContent>
  <SelectItem value="apple">Apple</SelectItem>
  <SelectItem value="banana">Banana</SelectItem>
</SelectContent>
```

**推荐标准姿势是这样的:**

```tsx
<SelectContent>
  <SelectGroup>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
  </SelectGroup>
</SelectContent>
```

这也同样推及与涵盖并适应了所有的那种类似下面这个列表当中所归属于其本身体系性质组合里所有对应的配套家族组件们：

| 具体的条目项目 (Item) | 该找的该包裹着它的组器 (Group) |
|------|-------|
| `SelectItem`, `SelectLabel` | `SelectGroup` |
| `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSub` | `DropdownMenuGroup` |
| `MenubarItem` | `MenubarGroup` |
| `ContextMenuItem` | `ContextMenuGroup` |
| `CommandItem` | `CommandGroup` |

---

## 向用户进行的特别引文以及提醒反馈请动用 Alert

```tsx
<Alert>
  <AlertTitle>提醒您有一项危险报警（Warning）</AlertTitle>
  <AlertDescription>请看下方这里有些麻烦需要您出面处理（Something needs attention.）</AlertDescription>
</Alert>
```

---

## 面对不存在的数据占位时动用纯正的 Empty 空态组件处理

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><FolderIcon /></EmptyMedia>
    <EmptyTitle>当前系统当中找不着这所谓的最新工程（No projects yet）</EmptyTitle>
    <EmptyDescription>你可以选择通过点击下方的创建钮作为新的一天起点！（Get started by creating a new project.）</EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>我要立刻新建这个超级无敌新工程！（Create Project）</Button>
  </EmptyContent>
</Empty>
```

---

## 小弹吐司通知采用 sonner 组件

```tsx
import { toast } from "sonner"

toast.success("成功搞定存储了。(Changes saved.)")
toast.error("出问题啦！这下全搞砸了！(Something went wrong.)")
toast("所选文件目前已被物理粉碎！处理完毕(File deleted.)", {
  action: { label: "给我后悔倒回去", onClick: () => undoDelete() },
})
```

---

## 当从各式花样重叠与覆盖式面板进行取舍与运用说明

| 您碰到的应用情形 | 对应配给的专门组件类 |
|----------|-----------|
| 对于某专门性质的操作需全情投入，高度专注并且一定需人去填写并给回一个明确的答复或者数据反馈的时候。 | `Dialog` 弹框 |
| 提供类似彻底核销数据之类能毁灭搞没重要资产类高危事项发出警号供做最郑重的明确裁定时。 | `AlertDialog` 危险强确认框 |
| 想调出一个能承载装有些复杂点细致入微的数据选项调节面或带有条件设置面板类的边角浮框处理 | `Sheet` 抽屉推板 |
| 一种特别注重提供适应那类专门为了针对手机之类小型屏设备的触滑手势做自底向上抬升操作体验的下置面板 | `Drawer` 底层收纳推滑板 |
| 短暂停靠掠过触发式地去拿取得到有关于目标物件快读情报与缩微简介 | `HoverCard` 悬游指触板 |
| 点触式的小范围、高精准依附点击物的弹现区域进行补充内容扩展 | `Popover` 上浮气泡板 |

---

## 警告！所有的类似于： Dialog , Sheet 还有那种 Drawer 都必定并且要带有能够表达 Title 意思的核心组件配合

这些带有能够被指明被识别到该框体本质与定位相关的像是： `DialogTitle`， `SheetTitle` 甚至 `DrawerTitle` 一类。之所以非逼着你添加它因为这是涉及到确保实现支持那所谓 A11y 等残障友好无障碍网页标准的底线。如果您仅仅从设计的观感审美眼光看来认为它的出现就是个败笔就死活也不愿意它展现破坏您的整体图画安排时候；这儿有招：您只需在这个东西外边包裹赋予它这么一句带有隐藏魔力的 CSS 通用暗语魔法：`className="sr-only"`。就能骗过外形视觉并同时通过掉这种无障碍硬性判定机制了！

```tsx
<DialogContent>
  <DialogHeader>
    <DialogTitle>这是进行自我面部管理（Edit Profile）</DialogTitle>
    <DialogDescription>赶紧修改一下你那落伍十年的用户简介！</DialogDescription>
  </DialogHeader>
  ...
</DialogContent>
```

---

## 对于卡片 Card 这类的基本组合准则

在做这卡相关的一整套功能编排工作之时请务必调用这套自带并且全面系统的零部件 —— 不允许你一脑门子热乎就将这一箩筐的包括那些什么破标题呀解释什么的一切杂碎东西不管不顾统统全填在这个可怜的那个 `CardContent` 里面装完这全套！

```tsx
<Card>
  <CardHeader>
    <CardTitle>这是俺们公司的精英队名册 (Team Members)</CardTitle>
    <CardDescription>这下面这里是专门管教整治你这帮精英用的后台（Manage your team.）。</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button>马上召集队伍！！ (Invite)</Button>
  </CardFooter>
</Card>
```

---

## 记得：我们提供的纯的 Button 就压根没有什么可以叫作 `isPending` 或者那什么 `isLoading` 自带属性的

如果您需要表达那种被在转盘打磨需要等等加载之状态：乖乖将组件：`Spinner` 加进，拼在它的里层，配合属性 `data-icon` 、外面的钮上加上一个带禁止特性的标志： `disabled` 联合组成实现吧：

```tsx
<Button disabled>
  <Spinner data-icon="inline-start" />
  稍安勿躁...我们正在全力帮您死命去保存着呢...（Saving...）
</Button>
```

---

## TabsTrigger 它就万不可在 TabsList 的有效外圈跑丢

绝不允许将一个光秃的 `TabsTrigger` 直接随随便便散落放到属于那个巨大外围组件叫做的所谓的： `Tabs` 外层里面不管了 —— 您只能并将它放在一个专门叫做 `TabsList` 盒子列表当中去收纳：

```tsx
<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">关于自我的账号数据 (Account)</TabsTrigger>
    <TabsTrigger value="password">那关于更改绝密门禁信息处 (Password)</TabsTrigger>
  </TabsList>
  <TabsContent value="account">...</TabsContent>
</Tabs>
```

---

## 对于那个圆饼头像 Avatar , 它必不可少总要配置带有后备显示的 AvatarFallback

永远不可为了图少事漏掉提供给那个备用占位用以预防哪天一旦出现目标拉取头像是获取失败崩塌从而显示破败图片情况发生时拿去做填档之用那个防线底盘子组件 `AvatarFallback`：

```tsx
<Avatar>
  <AvatarImage src="/avatar.png" alt="这是一用户" />
  <AvatarFallback>某个张三（JD）</AvatarFallback>
</Avatar>
```

---

## 尽量采用已经搭建配好包装提供的这系统本身相关内置成型好的组件进行表达应用； 不要妄加制造添加原生态的标签然后套自己涂写那各种没规矩样式的行为！

| 你这土气的坏习惯动作可能以前长这样 | 请从此将其取代成高贵体面的这东西 |
|---|---|
| `<hr>` 或者自己乱做个边缘粗粗带有 `<div className="border-t">` | `<Separator />` |
| `<div className="animate-pulse">` 然后乱加上各式自己发明的土嗨包装代码标签的 | `<Skeleton className="h-4 w-3/4" />` |
| 这个是去专门写上类似 `<span className="rounded-full bg-green-100 ...">` 这样的 | 而它只要用这：`<Badge variant="secondary">` |
