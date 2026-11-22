# 第二课：动手写你的第一个 DSH 工具（record_expense）

> 老师：lead · 前情：第一课讲了 Cordis 5 概念；本课把它们变成"能跑、能落库"的真实工具。
> 产物：工作区 `ledger-bundle/` 里的 5 个文件，装进 profile 后就能用。

---

## 0. 本课目标 + 已验证的事实

**目标**：写出并安装第一个工具 `record_expense`，跑通「说一句 → 存一条」的闭环。

动手前我先替你验证好了（省你踩坑时间）：

| 事实 | 结论 |
|---|---|
| 当前 profile 挂载的存储 | `storage` + `storage-json` + `storage-domain`（默认 **json** 后端；无 sqlite） |
| 工具定义 API | `defineTool` 来自 `@deepseek-ai/dsh-tools` |
| 领域存储 API | `defineDomain` / `domainTable` 来自 `@deepseek-ai/dsh-storage-domain` |
| schema 库 | `zod`，版本 **4.6.6** |
| 依赖声明 | `@deepseek-ai/*` 由 dsh 安装解析、无需声明；`zod` 需声明 |

---

## 1. 一个 bundle 长什么样（4 类文件）

```
ledger-bundle/
├── package.json        # 声明 dsh.bundle.patch + 依赖
├── cordis.patch.yml    # 把插件"插"进 profile 的那一行
├── index.js            # 插件本体：apply(ctx)
└── locale/             # 标题与描述（插件管理器/设置页显示）
    ├── zh.json
    └── en.json
```

> bundle = 一个 package，通过 `dsh.bundle.patch` 指向 patch 文件，patch 用 `insert` 把插件行挂进 profile。

---

## 2. 逐段讲解 index.js

**① 声明领域（数据的"表结构"）**

```js
const expenseSchema = z.object({
  amount: z.number(), category: z.string(), note: z.string(), at: z.string(),
})
const ledgerSpec = defineDomain({
  name: 'ledger', version: 1,
  tables: { expenses: domainTable(expenseSchema) },
})
```

- `defineDomain` 是数据的"单一真源"：领域名 + 版本 + 用 zod 声明的表。
- 表记录结构用 zod 写，`domainTable` 把 schema 变成一张可读写的表。

**② 依赖注入**

```js
export const inject = ['tools', 'storageDomain']
```

- 声明本插件需要 `tools`（注册工具）和 `storageDomain`（存数据）两个服务，缺一就会 PENDING（第一课概念 3）。

**③ 用 Service 类做异步初始化（官方模式，重要）**

```js
class LedgerService extends Service {
  constructor(ctx) { super(ctx, 'ledgerAgent') }
  async [Service.init]() {
    const domain = await this.ctx.storageDomain.open(ledgerSpec)
    this.ctx.effect(() => () => domain.close())   // 卸载时自动关闭领域
    this.ctx.tools.register(defineTool({ ... }))
  }
}
export function apply(ctx) { ctx.plugin(LedgerService) }
```

- ⚠️ **DSH 不用 `async function apply` 做异步初始化**（我查过 `dsh-workspace` 真实源码确认）。异步初始化一律放在 **`Service` 子类的 `async [Service.init]()`** 里。
- 所以：函数插件 `apply` 保持同步，只负责 `ctx.plugin(LedgerService)`；`inject` 声明在函数插件上（第一课概念 3 的类形态）。
- `storageDomain.open(spec)` 是异步的，返回类型化的 `domain` 句柄；`ctx.effect` 返回的 disposer 在卸载时 `domain.close()`（第一课概念 5）。

**④ 工具本体**

```js
defineTool({
  name: 'record_expense',
  description: '记一笔支出…',
  parameters: { amount: { type: 'number', required: true, ... }, ... },
  output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
  async execute(args) {
    const id = Date.now().toString(36) + ...
    await domain.table('expenses').put(id, { amount: args.amount, ... })
    return `已记账：…`
  },
})
```

- `parameters` 自动变成模型可见的 JSON Schema，并自动校验模型给的参数。
- `execute` 里 `args` 已经是类型化、校验过的值。
- `output.schema` 声明返回的规范值（这里是个字符串）；`output.render` 把它变成模型看到的内容。
- 返回值/异常即结果：抛 `HarnessError` 才是错误，正常返回即成功。

---

## 3. 安装与验证

1. 确认 `ledger-bundle/` 的 5 个文件都在（已替你写好）。
2. 用 `plugin_manager` 的 `install_bundle`，`target` 填 `ledger-bundle` 的**绝对路径**。
3. 装完看返回的 `application`：`applied` 表示已生效（HMR 会热挂载）。
4. 开一个**新会话**，说：`记一笔：午饭 35 元，餐饮`
5. 期望：Agent 调用 `record_expense`，回你「已记账：餐饮 ¥35（午饭）」。

> ⚠️ 装进 profile 属于"改 DSH"操作，我会在得到你确认后再执行，并和你一起核对插件行、图标与标题。

---

## 4. 本课你学会的 DSH 真本领

- `defineTool` 完整约定：parameters 自动校验、output schema、execute 返回规范值。
- `defineDomain`/`domainTable`/`ctx.storageDomain`：DSH 官方持久化方式。
- `inject` + `ctx.effect`：依赖注入与资源回收。
- bundle 打包 + `install_bundle` 安装：以后你每个产品能力都是这个套路。

---

## 5. 待 build 时确认的 2 个点（诚实标注）

1. ~~`export async function apply(ctx)`~~ —— **已修正**：经查真实源码（`dsh-workspace`），异步初始化用 `Service` 子类的 `async [Service.init]()`，不用 async apply。代码已按此重写。
2. `zod` 依赖版本 4.6.6 与 dsh 一致，已规避冲突。

---

## 6. 实战踩坑记录（这次真实安装遇到的）

**坑 1 · 外部工作区链接的 bundle 解析不到 `@deepseek-ai/*`**
- 现象：`install_bundle` 后报 `ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/cordis'`。
- 原因：bundle 被"链接"到工作区（不是拷进 profile），Node 从工作区真实路径解析 import，但工作区没有 DSH 的依赖包；而 DSH 的依赖在 `app.asar` 里。
- 关键发现：**npm 上的 `@deepseek-ai/dsh-tools`/`dsh-storage-domain` 最新是 `0.0.1-rc.1`，与运行中的 `0.2.2-rc.5` 不一致**——所以不能从 npm 装，否则 API 对不上。
- 解法（dev 阶段）：用 Electron 的 ASAR 感知运行时，把运行中安装里的 **29 个包（依赖闭包，含 peer）** 复制成真实文件到 `ledger-bundle/node_modules/`。

**坑 2 · 依赖闭包要连 peer 一起跟**
- 现象：只跟 `dependencies` 时，`dsh-tools` 报缺 `dsh-llm`、`storage-domain` 报缺 `dsh-storage`。
- 原因：这些包在**运行时** import 了它们的 peer 依赖，而不只是类型。
- 解法：闭包 = `dependencies` ∪ `peerDependencies`。

> ⚠️ 这是「打包版 Desktop App + 外部工作区」下的 dev 工作流；真正的产品发布是另一套打包方式（后续再教）。

**验证结果**：`list_plugins` 显示 `include:ledger-agent` 的 `fiberPhase: active`，两个工具已注册。
