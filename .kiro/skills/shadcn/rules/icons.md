# 图标库及运用法管理 (Icons)

**任何时候进行此项目的那些所有图标等元素挂件导入引入之际都需要强制地必须以我们系统当前环境中定义的那被命名的： `iconLibrary` 用其为主。** 所以一定在用前需到大环境上下文里核查对应配置此 `iconLibrary` 属性内容定性：若叫 `lucide` 那必定要求引用到： `lucide-react`，如标注它用的是 `tabler` 那么请向 `@tabler/icons-react` 解析调用等以此类推。不要瞎推测断定反正默认这它全是 `lucide-react`。

---

## 所有挂被布置属于放在带有 Button 按钮之内图标元素都需要全依靠带其专属调属性名也就是它: data-icon 去发指令运作

给它增加带有属于指： `data-icon="inline-start"` (它指将这个弄在那做开首引导字前) 或者也可叫它带有： `data-icon="inline-end"` (也就是后缀放置法) 置放入那属于其内部对应使用图标当中。不要试图企图在这里边自己加上带有硬改图标大小那这系列的任何控制 CSS 大小标签代码。

**绝对恶心难看的写错示范法:**

```tsx
<Button>
  <SearchIcon className="mr-2 size-4" />
  快来查！
</Button>
```

**只有如这般配才是真的好写:**

```tsx
<Button>
  <SearchIcon data-icon="inline-start"/>
  查询去！
</Button>

<Button>
  奔下一位
  <ArrowRightIcon data-icon="inline-end"/>
</Button>
```

---

## 不要企望而且绝对不允许内部包涵内部自带于这全套各式其组建内所使用调用之该内部标图里被人工添加这些带有 CSS 的各类设置关于配置图样这类的这些大小这系列标签命令。

既然在咱们该其组建系统中运行它，那么自是有关于设定这些包括着大小尺缩在内各项问题其皆全统统都归由它内部之所包含之 CSS 把它给全总包代理及完全控制承揽的干活去把调控！ 所以在您使用时就没必要且断然不能在此里加上如同这一类叫：`size-4`, 还有这种老写类法叫带有如： `w-4 h-4` 甚至别的各种只要是干着意图以试图越权重定篡改这组件本来之这尺寸这档事之各种诸此类推操作命令，无论这些图标被放入于这里头那些这这那那比如： `Button`, `DropdownMenuItem`, `Alert`, 以及还有诸类这如： `Sidebar*` 之内或者这系统别的等等。除非那人（提出要求那端的人）指名道姓非要定制硬调不可，要除外开去算。 

**违禁与错得离大谱举止:**

```tsx
<Button>
  <SearchIcon className="size-4" data-icon="inline-start" />
  查到底！
</Button>

<DropdownMenuItem>
  <SettingsIcon className="mr-2 size-4" />
  管理后台调教档
</DropdownMenuItem>
```

**这完全合法正确操作之典范:**

```tsx
<Button>
  <SearchIcon data-icon="inline-start" />
  全盘查底！
</Button>

<DropdownMenuItem>
  <SettingsIcon />
  总配置后置管理
</DropdownMenuItem>
```

---

## 您在利用将所调用来的某一个图标这玩类时给当所须填给传递那入参数之时，必须要它把当作一类完备对象（components objects）整体性来用以传输过去，却绝不对也不能给把它用仅仅作为一个只能被充成用作去被用作字符串字样的那这叫这什么值键（string keys）的东西随便拿给应付地糊弄着传发过去

一定要求如这套规规范写做这如这般： `icon={CheckIcon}`，绝不能而且没这可能搞给它是用来作为一个当用来去拿对应到它在后那大块索引集合数组查找时对应做搜的去配给匹配索引查询拿当纯字符串当索字的破玩法处理法。

**搞错把戏演示篇:**

```tsx
const iconMap = {
  check: CheckIcon,
  alert: AlertIcon,
}

function StatusBadge({ icon }: { icon: string }) {
  const Icon = iconMap[icon]
  return <Icon />
}

<StatusBadge icon="check" />
```

**合乎这套完美体制所要求的做大范文做表法:**

```tsx
// 从在这个专案底下已按所配预配置装妥那个其这指专门定这个这被称名叫: iconLibrary 也就是配置给这这套系统图库的地方如比像: lucide-react 里面或者它这也可以叫从那个啥: @tabler/icons-react 之类那儿引入这你要找要那要用之组件图来。
import { CheckIcon } from "lucide-react"

function StatusBadge({ icon: Icon }: { icon: React.ComponentType }) {
  return <Icon />
}

<StatusBadge icon={CheckIcon} />
```
