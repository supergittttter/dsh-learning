# 第一课：Cordis 极简核心（DSH 的地基）

> 老师：lead · 依据：DSH `0.2.2-rc.5` 安装内官方文档（`docs/cordis-primer.zh.md` + `docs/cordis-tutorial/01–07.zh.md`）
> 目标：用 5 个概念 + 1 个例子，让你能读懂 DSH 里任何插件，为"动手做产品"扫清地基。

---

## 为什么先啃这个？

因为 **DSH 的一切都是 Cordis 插件**——工具（tool）、技能（skill）、Agent、LLM 适配器、UI 卡片、MCP……没有一个例外。

不掌握下面 5 个概念，你读 DSH 任何源码都会迷路；掌握之后，你会突然发现整个 DSH 都能看懂了。

---

## 概念 1 · 插件（Plugin）

**定义**：插件就是"向框架贡献能力"的最小单元。三种形态等价，按需选用：

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

// ① 函数形态（最常用，够用就一直用它）
export function apply(ctx: Context) {}

// ② 对象形态
export const obj = { name: 'x', apply(ctx: Context) {} }

// ③ 类形态 = Service 子类（需要"对外提供服务"时用，见概念 3）
export class MyService extends Service {
  constructor(ctx: Context) { super(ctx, 'myService') }
}
```

一句话：**写 DSH 扩展 = 写 `apply(ctx)`**。

---

## 概念 2 · 上下文（Context）

**定义**：`ctx` 是"服务的容器"。每个服务占据一个稳定的 `ctx.<key>`。

- `ctx.tools`、`ctx.llm`、`ctx.sessions`、`ctx.agents` 都是服务。
- 插件**通过 key 查服务**，而不是 `import` 具体实现 → 所以配置里可以换提供方，消费方代码不用改。

这就是 DSH"一切可替换"的根源：**面向服务名编程，不面向实现编程**。

---

## 概念 3 · 服务（Service）+ 依赖注入（inject）

**提供服务**（提供方）：

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {        // 编译期：声明合并，让 ctx.greeter 有类型
  interface Context { greeter: GreeterService }
}

export class GreeterService extends Service {
  constructor(ctx: Context) { super(ctx, 'greeter') }  // 运行时：以 'greeter' 注册
  greet(who: string) { return `Hello, ${who}!` }
}

export function apply(ctx: Context) { ctx.plugin(GreeterService) }
```

**消费服务**（消费方）：

```ts
export const inject = ['greeter']              // 声明硬依赖
export function apply(ctx: Context) {
  console.log(ctx.greeter.greet('world'))      // apply 内保证 greeter 已就绪
}
```

三条关键规则：

1. **加载顺序由依赖决定，不由 YAML 里的先后决定**。
2. `inject` 是**硬依赖**：服务没就绪 → 插件停在 `PENDING`（不报错、不崩溃、静默等）。依赖的服务中途消失 → 消费方也被卸载，服务恢复后再重载。
3. 可选依赖用 `ctx.get('greeter')`（拿不到是 `undefined`，插件照跑）。

> ⚠️ 最常见的坑：**插件"没反应" = 它 PENDING 了**（缺某个依赖服务）。

---

## 概念 4 · 事件（Event）

服务是"直接调用"；事件是"广播，让不知名的插件来听"。**5 种分发模式**：

| 模式 | 调用 | 语义 |
|---|---|---|
| emit | `ctx.emit(name, ...args)` | 同步广播，不等、不收集返回值 |
| parallel | `await ctx.parallel(...)` | 所有监听器**并发**，一起等 |
| serial | `await ctx.serial(...)` | 按顺序等，**第一个非空返回值胜出**并停止 |
| bail | `ctx.bail(...)` | serial 的同步版 |
| waterfall | `ctx.waterfall(name, ...args, next)` | 环绕中间件，可**包装/短路** |

声明 + 监听（类型靠声明合并）：

```ts
declare module '@deepseek-ai/cordis' {
  interface Events { 'stats/report'(name: string, count: number): void }
}

ctx.on('stats/report', (name, count) => { /* ... */ })   // on 是 effect，卸载自动移除
```

**waterfall 是一条纪律**：只观察/标注的监听器**必须调 `next()`**；不调 `next()` 直接返回 = **故意短路**。DSH 用它做决策点，例如 `agent/pre-step`（插件可否决拟议步骤）、`approval/request`（策略可代用户作答）。

> 对你做产品最实用的一句话：**想"拦截/改造"现有行为 → 用事件（尤其 waterfall）；想"提供/调用能力" → 用服务。**

---

## 概念 5 · Effect + 生命周期

**所有注册都是"可逆副作用"**，卸载时自动撤销：

- `ctx.on(...)` → 监听器自动移除
- `ctx.plugin(child)` → 子插件随父卸载
- 服务注册、`ctx.tools.register(...)` 等 → 自动注销

Cordis 不管理的资源（定时器/连接/watcher）要自己包：

```ts
ctx.effect(() => {
  const timer = setInterval(() => {}, 200)
  return () => clearInterval(timer)   // disposer：卸载/HMR 时自动调用
})
```

**Fiber 状态机**（每个已加载插件都有一个）：

```
PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED
                ↘ FAILED
```

记住：**PENDING 是"插件没输出"的头号原因**；HMR（热重载）就是"先卸载（回卷 effect）→ 再加载"。

---

## 桥 · 进入 DSH：注册一个真正的工具

把上面所有概念串起来——向 DSH 的 `tools` 服务注册一个模型可调用的工具：

```ts
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'greet-tool'
export const inject = ['tools']          // 概念3：等 tools 服务就绪

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({        // 概念5：注册是 effect，卸载自动注销
    name: 'greet',
    description: 'Greet the named person.',
    parameters: { name: { type: 'string', required: true, description: 'Who to greet' } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args) { return `Hello, ${args.name}!` },
  }))
}
```

再看一眼 DSH 的真实 agent：**LLM 适配器 + agent loop + 持久化 + 应用入口 + 一堆这样的工具/技能插件**，组合在一起而已。

---

## 这 5 个概念 → 你的产品（商业化映射）

| Cordis 概念 | 对你产品的意义 |
|---|---|
| 插件 | 你产品的每个能力 = 一个或多个插件 |
| 服务（Service） | 你能"注入/替换"的**能力槽位** |
| 事件（Event） | 你能"拦截/观察"的**决策点与钩子** |
| inject | 声明"我的产品依赖 DSH 哪些能力" |
| effect | 资源管理，让你能热重载、干净卸载 |

---

## 动手作业（等产品想法确定后立即做）

**把"你产品的第一个最小切片"做成一个 tool 插件**（就像上面的 `greet`）：

1. 定义它叫什么、接收什么参数、产出什么。
2. 用 `defineTool` 写 `execute`。
3. 用一个 `tools/result` 监听器观察它被调用。
4. 跑通"输入 → 处理 → 产出"。

这一件做完，你就已经从"会读"跨到"会做"了——这正是我们下一课要开工的第一件事。
