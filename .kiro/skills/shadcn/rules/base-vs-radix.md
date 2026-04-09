# Base 与 Radix 之间差异 (Base vs Radix)

展示关于基于 `base` (也即 `@base-ui/react`) 和 `radix` (也即 `@radix-ui/react` 系列) 组件在 API 调用层面的不同。请先通过执行命令 `npx shadcn@latest info` 在返回的信息中查明您当前的系统是属于哪个 `base` 级。

## 目录

- 组合特性：asChild 对比 render
- 按钮 / 触发器本身如果是一个非 `button` 元素时
- 选择器 Select (涉及 props, placeholder, 定位, multiple 多选, object 等传值处理)
- 切按组 ToggleGroup (关于 type 还是 multipe 设置判断)
- 滑块 Slider (单值 scalar 与 数组 array 型比较)
- 展开面板 Accordion (关于 type 以及 defaultValue 差异)

---

## 组合: asChild (radix 专有) 与 render (base 专有) 的对比

Radix 使用 `asChild` 属性将默认的直接下级元素代替为此组件本身。而 Base 方面则需使用 `render`。切勿将各种“触发器（triggers）”外层再次无端包装额外废元素标签。

**错误示范:**

```tsx
<DialogTrigger>
  <div>
    <Button>Open</Button>
  </div>
</DialogTrigger>
```

**正确的做法 (radix 方案):**

```tsx
<DialogTrigger asChild>
  <Button>Open</Button>
</DialogTrigger>
```

**正确的做法 (base 方案):**

```tsx
<DialogTrigger render={<Button />}>Open</DialogTrigger>
```

上面这套做法同样可以推行套用给其它一切属于触发型与关闭类的组件：`DialogTrigger`, `SheetTrigger`, `AlertDialogTrigger`, `DropdownMenuTrigger`, `PopoverTrigger`, `TooltipTrigger`, `CollapsibleTrigger`, `DialogClose`, `SheetClose`, `NavigationMenuLink`, `BreadcrumbLink`, `SidebarMenuButton`, `Badge`, `Item`。

---

## 按钮 / 作为非按钮元素承载的触发体 (仅仅只适应于 base 层适用)

当你在 Base 中调用 `render` 参数将其元素转变为了一个实际上并不是 Button 属性的东西时 (如 `<a>`, `<span>` 等等)，记得在此同时再额外增添一条配置项 `nativeButton={false}`。

**错误示范 (在 base 使用时):** 在下方缺失了附加指令 `nativeButton={false}`。

```tsx
<Button render={<a href="/docs" />}>Read the docs</Button>
```

**正确的做法 (base 方案):**

```tsx
<Button render={<a href="/docs" />} nativeButton={false}>
  Read the docs
</Button>
```

**正确的做法 (radix 方案):**

```tsx
<Button asChild>
  <a href="/docs">Read the docs</a>
</Button>
```

同样的约束规则适用于任何在 `render` 参数中并未装填一个 `Button` 时触发使用组件的情景:

```tsx
// base 中的案例。
<PopoverTrigger render={<InputGroupAddon />} nativeButton={false}>
  Pick date
</PopoverTrigger>
```

---

## 数据选择类 (Select)

**items 属性参数 (针对 base)。** Base 的 Select 非常强调需在其根节点部配设带上一个叫 `items` 的数据传入参量。 Radix 则相反，全程只推崇凭借内在写死式的内嵌式 JSX 来生成。

**错误示范 (针对 base 适用):**

```tsx
<Select>
  <SelectTrigger><SelectValue placeholder="选择一种水果" /></SelectTrigger>
</Select>
```

**正确的写法 (base 对应方案):**

```tsx
const items = [
  { label: "请选择一样水果", value: null },
  { label: "苹果", value: "apple" },
  { label: "香蕉", value: "banana" },
]

<Select items={items}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      {items.map((item) => (
        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
```

**正确的写法 (radix 方案):**

```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="请选择一样水果" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectItem value="apple">苹果</SelectItem>
      <SelectItem value="banana">香蕉</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

**关于 Placeholder（提示文盲）。** Base 中采用将数组里的某一项指定成 `{ value: null }` 以作模拟提示。Radix 中则是规范运用 `<SelectValue placeholder="...">` 的属性值方案解决。

**关于内部列表出现与对齐的位置。** Base 中是通过使用属性配置 `alignItemWithTrigger` 来办到。而在 Radix 里靠控制 `position` 即可。

```tsx
// 对于 base 环境。
<SelectContent alignItemWithTrigger={false} side="bottom">

// 对于 radix 环境。
<SelectContent position="popper">
```

---

## 数据选择类 (Select) — 对支持复选功能和传输对象数据的处理比较 (仅 base 支持)

当前 Base 底包环境下支持赋予 Select `multiple` 这个多选性质标记、在 `SelectValue` 配置通过渲染函数接受并反馈 child 行为数据内容、以及还有允许给通过设定 `itemToStringValue` 来传输具备完整 Object 型向的值能力等等。相比下 Radix 则只允许单一类型选择并且值的表现上强制规定被限制到仅存在字符串格式上（string）。

**正确示范 (针对于 base —— 实现多选):**

```tsx
<Select items={items} multiple defaultValue={[]}>
  <SelectTrigger>
    <SelectValue>
      {(value: string[]) => value.length === 0 ? "请选择水果" : `当前共选了 ${value.length} 个`}
    </SelectValue>
  </SelectTrigger>
  ...
</Select>
```

**正确示范 (针对 base — 传递对象型值类型):**

```tsx
<Select defaultValue={plans[0]} itemToStringValue={(plan) => plan.name}>
  <SelectTrigger>
    <SelectValue>{(value) => value.name}</SelectValue>
  </SelectTrigger>
  ...
</Select>
```

---

## 组态化 Toggle (ToggleGroup)

在这部分底包 Base 做法里它只需一个布尔值名字叫 `multiple` 属性值作为标识而已。对于底包是在 Radix 情况，必须通过手动填写完整指定类似于：`type="single"` 还是 `type="multiple"` 标识符作为明牌区别。

**错误示范 (当处在 base 下):**

```tsx
<ToggleGroup type="single" defaultValue="daily">
  <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
</ToggleGroup>
```

**正确的写法示范 (应对 base 层):**

```tsx
// 当它为单选框性质要求下的情况 (这里不再写什么外挂标识参数)，这里注意其内部设定的基础传出预值默认被以必定为带包裹“数组阵列阵型”传递了。
<ToggleGroup defaultValue={["daily"]} spacing={2}>
  <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
  <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
</ToggleGroup>

// 遇到处理复选多项选项情况。
<ToggleGroup multiple>
  <ToggleGroupItem value="bold">粗体</ToggleGroupItem>
  <ToggleGroupItem value="italic">斜体</ToggleGroupItem>
</ToggleGroup>
```

**正确示范做法 (环境落在 radix 时):**

```tsx
// 想要单独只有一面值选要求时, 注意里面预写 default 的就老老实实是个普通纯字串。
<ToggleGroup type="single" defaultValue="daily" spacing={2}>
  <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
  <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
</ToggleGroup>

// 要求产生为多选取状态情况时。
<ToggleGroup type="multiple">
  <ToggleGroupItem value="bold">粗体</ToggleGroupItem>
  <ToggleGroupItem value="italic">斜体</ToggleGroupItem>
</ToggleGroup>
```

**有关进行强行被绑管干预传出控制方式区别:**

```tsx
// 对于 base 环境 —— 切记有这种对于这所接收的单点字符外层的这个 Array [] 空阵外壳随时有“套上/剥去”这一动作特性注意点发生。
const [value, setValue] = React.useState("normal")
<ToggleGroup value={[value]} onValueChange={(v) => setValue(v[0])}>

// 对于 radix 环境 — 简单纯粹地原汁原位去处理该被对应这文字 string 即行。
const [value, setValue] = React.useState("normal")
<ToggleGroup type="single" value={value} onValueChange={setValue}>
```

---

## 滑条滑块组件 (Slider)

当表示这只挂一个控制单点点的最一般情况下，Base 支持以一种简单地数字填入格式作承载， 但是若是面对的是 Radix 它永远并雷打不动总是非叫你给出的是这种处于包裹在一个“阵列类”当中的式样形态进行传递表达不可！

**错例 (指存在于 base):**

```tsx
<Slider defaultValue={[50]} max={100} step={1} />
```

**对的做法 (base 型):**

```tsx
<Slider defaultValue={50} max={100} step={1} />
```

**对的做法 (radix 专适用):**

```tsx
<Slider defaultValue={[50]} max={100} step={1} />
```

如果要做首位皆具的这种双头点位游走设定滑套时大家都一致要求都用上了这个数组法了，但这其中有一点不同，Base 的它若是加上受外界调控状态模式使用，其中在内部改变传出的时候常常必须硬挂个强行类属判断转型 (cast) 才有效。

```tsx
// 对 base 版。
const [value, setValue] = React.useState([0.3, 0.7])
<Slider value={value} onValueChange={(v) => setValue(v as number[])} />

// 对 radix 版适用。
const [value, setValue] = React.useState([0.3, 0.7])
<Slider value={value} onValueChange={setValue} />
```

---

## 折手风琴类型折叠展合 (Accordion)

Radix 对其规定务必要有这种 `type="single"` 或是设定属于 `type="multiple"` 此这类型指令并且可追加像带这样的：`collapsible` 协同配饰功能属性一块用。 其 `defaultValue` 的设定传接型被视为单体性质里的字符串字样格式而已。相对应的，在另一边 Base 没用到什么称作叫 `type` 的额外配置，反向替代是用那种简单的标位名称带个布尔值像： `multiple` 就搞明白完指示了。但有一点：它被所需要塞进去关于设定初始首值传报的那种形式，向来只会统一接轨给到了这个阵列型即为 “数组” 的状态内里方可作数。

**错误的写法示例 (base中禁止这样干):**

```tsx
<Accordion type="single" collapsible defaultValue="item-1">
  <AccordionItem value="item-1">...</AccordionItem>
</Accordion>
```

**对于采用 base 才是合理合法的写法:**

```tsx
<Accordion defaultValue={["item-1"]}>
  <AccordionItem value="item-1">...</AccordionItem>
</Accordion>

// 涉及到可展开多级面板的多项复选支持。
<Accordion multiple defaultValue={["item-1", "item-2"]}>
  <AccordionItem value="item-1">...</AccordionItem>
  <AccordionItem value="item-2">...</AccordionItem>
</Accordion>
```

**给采用到 radix 那方阵内时正确做法:**

```tsx
<Accordion type="single" collapsible defaultValue="item-1">
  <AccordionItem value="item-1">...</AccordionItem>
</Accordion>
```
