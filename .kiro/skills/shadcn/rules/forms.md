# 表单与输入框运用规范 (Forms & Inputs)

## 目录

- 关于普通表单拼装的套壳原则，必用： FieldGroup 配合 Field
- 使用 InputGroup 组件时，内部务必使用专属配搭好的：InputGroupInput/InputGroupTextarea
- 想在输入框内部置入各类控制按键？请走这套标准规： InputGroup 配合 InputGroupAddon
- 关于出现只有 2～7 选项的少量待选切项时，优先运用它：ToggleGroup
- 将相互有所逻辑关联控制字段选项合并为一个子域群请调用： FieldSet 加上 FieldLegend
- 表单项目其对内外自身所报送呈现校验有效废弃等状态管理（包含禁用）

---

## 表单拼接准则只用： FieldGroup 套 Field

无论何时建立表单组合一定只得用： `FieldGroup` 配合 `Field` 进行 —— 万万不能用自己原生手敲这等破烂： 用一个 `div` 带个 `space-y-*` 去处理：

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">电邮地址 (Email)</FieldLabel>
    <Input id="email" type="email" />
  </Field>
  <Field>
    <FieldLabel htmlFor="password">密码设置处 (Password)</FieldLabel>
    <Input id="password" type="password" />
  </Field>
</FieldGroup>
```

当您为了开发那种左右拉通类的后台配置表（settings pages）时：追加这个横配方向 `Field orientation="horizontal"`。要是嫌有字段标签视觉烦人，请给设上 `FieldLabel className="sr-only"` 那它就在展示画板中做到视觉上“人间蒸发”了。

**当你不知在这表单控件池里该挑啥子去填表时参考下表：**

- 只要能输入几行文本这等要求 → `Input`
- 需要有个框里点了拽下一堆早备选项让你挑 → `Select`
- 如果它还需要能在那堆能被拽出来一坨东西里自己还能同时输字找检索的 → `Combobox`
- 有人偏就固执非得要只依靠原生没有任何自己附加的带 JS 能力干涉干扰原生浏览器选择框情况 → `native-select`
- 处理一些代表“开/关”这种极简命题性质（一般处于配置设置面板里的） → `Switch` ，如果是属于正常收集打钩状态类表格中 → `Checkbox`
- 仅仅就零星少数几个固定选项供你来选并且就只许点个做决定的 → `RadioGroup`
- 两者乃至扩展到提供多达最多五个间的提供这这各种情况之间游走控制来去自如 → `ToggleGroup` 配合着使用其组类的部件： `ToggleGroupItem`
- 输入各种认证令牌核销校验密码类的动态核销码 → `InputOTP`
- 只要碰上需要填写这种连篇长跨了这起码好几行文案时 → `Textarea`

---

## InputGroup 配套使用条件为必然组合用专属部件: InputGroupInput / InputGroupTextarea

绝不要脑头顶发懵将平时用到的： `Input` 甚至乎 `Textarea` 也塞进去当作为 `InputGroup` 下头的子件！

**别这么去搭代码:**

```tsx
<InputGroup>
  <Input placeholder="输入点你想查点啥..." />
</InputGroup>
```

**对的搭配方式这般:**

```tsx
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput placeholder="输入点你想查点啥..." />
</InputGroup>
```

---

## 如果按键试图被插在那种诸这如输入框框内请运用这这等配套组合： InputGroup 搭 InputGroupAddon

永远不应该且不可以试图把这等如这一般的： `Button` 这直接放到了或是相连在同它那个一般的 `Input` 的并排一块里尝试试图去利用定位强制摆去。

**错误代码长成这幅样子:**

```tsx
<div className="relative">
  <Input placeholder="输入点啥字找找看..." className="pr-10" />
  <Button className="absolute right-0 top-0" size="icon">
    <SearchIcon />
  </Button>
</div>
```

**正规范的搭法范例是这样:**

```tsx
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput placeholder="输入点啥字找找看..." />
  <InputGroupAddon>
    <Button size="icon">
      <SearchIcon data-icon="inline-start" />
    </Button>
  </InputGroupAddon>
</InputGroup>
```

---

## 少量多定选集合 （限定在约：2 至 7 项目之间配置） 最好全全派上这种: ToggleGroup

永远不许去手捏这类似于 `Button` 配之结合自己这状态并挂套循环操作自己搞。

**错误之法如这般去造车轮:**

```tsx
const [selected, setSelected] = useState("daily")

<div className="flex gap-2">
  {["daily", "weekly", "monthly"].map((option) => (
    <Button
      key={option}
      variant={selected === option ? "default" : "outline"}
      onClick={() => setSelected(option)}
    >
      {option}
    </Button>
  ))}
</div>
```

**正确的引用是借助这个:**

```tsx
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

<ToggleGroup spacing={2}>
  <ToggleGroupItem value="daily">每天(Daily)</ToggleGroupItem>
  <ToggleGroupItem value="weekly">去他的一周一报！(Weekly)</ToggleGroupItem>
  <ToggleGroupItem value="monthly">每月(Monthly)</ToggleGroupItem>
</ToggleGroup>
```

若要把这些 Toggle 置放进了被附上了说明注签类外皮结构中： `Field` :

```tsx
<Field orientation="horizontal">
  <FieldTitle id="theme-label">主题配给</FieldTitle>
  <ToggleGroup aria-labelledby="theme-label" spacing={2}>
    <ToggleGroupItem value="light">刺眼！(Light)</ToggleGroupItem>
    <ToggleGroupItem value="dark">黑暗料理(Dark)</ToggleGroupItem>
    <ToggleGroupItem value="system">机器操控(System)</ToggleGroupItem>
  </ToggleGroup>
</Field>
```

> **有要点注意提醒:** 属这叫：`defaultValue` 与被名之为：`type`/并且 `multiple` 此几种挂属性等参数它们，如果这底层底源这如果这是建立在一个分别叫做这属于 `base` 又与在那个名为： `radix` 的基础环境下可有着他们分别的不同定义规范的区别，请仔细拜读和对照他们之不同: [base-vs-radix.md](./base-vs-radix.md#togglegroup)。

---

## 请去为了能管理合并具备有同套相关性选项将使用此套合并归纳组件: FieldSet 嵌搭使用搭配这: FieldLegend 去打组包装组合起来。

把这一众具有并关联控制管理作用特性的诸多属于它们（checkboxes, radios, or switches）统一给套用在这叫： `FieldSet` 打合配合着用这个名为: `FieldLegend` 而绝对不能靠你自己生拽个 div 加带标题来用它:

```tsx
<FieldSet>
  <FieldLegend variant="label">各类您所需要的个人癖好！ (Preferences)</FieldLegend>
  <FieldDescription>在此处统统能够把那些合你能对味的东西选给你的。 (Select all that apply.)</FieldDescription>
  <FieldGroup className="gap-3">
    <Field orientation="horizontal">
      <Checkbox id="dark" />
      <FieldLabel htmlFor="dark" className="font-normal">这就开启夜鬼专用暗间工作模式</FieldLabel>
    </Field>
  </FieldGroup>
</FieldSet>
```

---

## 包含字段的状态检验情况判定和失效断能等各种状态相关说明管理运用

无论是哪层哪一面他们俩这两兄弟等都是要同时这被带上一块出现——属于加用那叫：  `data-invalid`/ 或是叫 `data-disabled` 那属性都是只能和并且也只配上于套在其最那个大套在外圈控制壳结构上的这也就是指 (包括这个标壳它外带含有的文字和提示，例如该类下叫 `Field` 的这类), 于此相配对的则属于内部包含的真这真正这真正其下具体工作用的： `aria-invalid`/ 它以及包括 `disabled` 那这个它就是仅仅被用来配属其核心操作按板上的挂设属性用的。 

```tsx
// 没经过校验并处于无效的判定情况 (Invalid).
<Field data-invalid>
  <FieldLabel htmlFor="email">您的电邮箱：(Email)</FieldLabel>
  <Input id="email" aria-invalid />
  <FieldDescription>错报！！邮箱填成你妈的手机号啦瞎不瞎！</FieldDescription>
</Field>

// 这个完全被废掉停止功能响应时 (Disabled).
<Field data-disabled>
  <FieldLabel htmlFor="email">您的电邮箱：(Email)</FieldLabel>
  <Input id="email" disabled />
</Field>
```

这些适用及适用于所包括覆盖到如下： `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroupItem`, `Switch`, `Slider`, `NativeSelect`, 以及那个 `InputOTP` 系列全部这控制控件板全包含。
