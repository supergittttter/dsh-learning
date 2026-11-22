# DSH 能力全景与扩展点地图

> 老师：lead · 依据：DSH `0.2.2-rc.5` 安装内 `docs/architecture.zh.md`、`docs/capability-seams.zh.md`、`docs/subsystems/README.zh.md`
> 用途：你的产品需要任何能力时，查这张表就知道"该用什么机制、往哪个 `ctx.*` 挂"。

---

## 1. 心智模型（先记住 3 句话）

1. **一切皆插件**。运行中的 dsh 是一棵插件树，由 profile 的组合包（bundle）层层叠加而成；没有需要打补丁的"特权内核"。
2. **扩展 = 注册服务 / 监听事件 / 声明依赖**，全部是可逆副作用（effect），卸载/HMR 自动撤销。
3. **三个扩展域**：
   - **会话事件**（`session/event`）：持久事实，重载后仍存在 → 要"记录/回放"用它。
   - **Agent 事件**（`agent/*`）：观察/拦截"进行中的工作" → 要"干预正在发生的事"用它。
   - **能力事件**（`fs/*`、`tools/*`、`telemetry/*`）：给某个 seam 挂策略/适配器 → 要"给能力加规则"用它。

---

## 2. "我要做 X → 用什么机制"（产品落地速查表）

> 译自官方 architecture 的「新行为的归属位置」，换成了产品语言。

| 你的产品要… | 用这个机制 |
|---|---|
| 接入某个大模型厂商（如换成自己的模型服务） | 在 `ctx.llm` 注册**适配器** |
| 给 Agent 增加一个"面向模型的能力"（查数据/调接口） | 在 `ctx.tools` 注册；schema 自动进提示词 |
| 让不同会话/不同用户拥有不同能力集 | 组装 **agent preset**（`ctx.agentPresets`） |
| 执行 shell 命令 | 注册 `ctx.shell` 后端（本地经 `ctx.subprocess`） |
| 持久化终端 | 注册 `ctx.terminals` + `dsh-tool-terminal` |
| 加一个"用户命令"（不用走模型轮次） | 在 `ctx.commands` 注册 |
| 后台任务（定时/异步跑活） | 在 `ctx.jobs` 注册；`job_*` 工具读写 |
| 外部 webhook 触发会话（如接飞书/钉钉/GitHub） | 在 `ctx.webhookRuntime` 注册可信规则 + 适配器 |
| 文件系统访问或策略 | 注册 `ctx.fs` 提供方，或监听 `fs/*` 事件 |
| 限制能启动哪些进程/写哪些目录 | `ctx.sandbox` + `ctx.sandboxPolicy` |
| 拦截请求 / 工具 / 轮次 | 监听 `agent/*` 或 `tools/*` 事件；`agent/turn-stopping` 可停轮次 |
| 给模型注入额外上下文（知识库片段） | `agent.inject()`，落到下次获准请求 |
| 加 UI 或编辑器集成 | 驱动 `ctx.agents` 并从 `session/event` 渲染 |
| 加 Web 客户端 Chat 节点 | 注册 `ConversationNodeDefinition` + keyed renderer |
| 加持久会话状态 | 扩展 `SessionEventMap`，从日志渲染/回放 |
| 自动生成会话标题 | 注册唯一 `ctx.sessionTitle` 提供方 |
| 同会话目标（长任务跨轮推进） | `ctx.goals` |
| 轮次边界 fork 会话 | `ctx.agents.create({ sessionId, seed, … })` |
| 换会话存储后端（如存到你的数据库） | 实现 `SessionPersistence`（create/open/stat/list/export） |
| 把注册限定到单个 agent | 用该 agent 的 `agent.ctx` |

**核心包速查**（`ctx` 键 → 职责）：

| ctx 键 | 职责 |
|---|---|
| `ctx.sessions` | 仅追加的会话日志 + 内存存储 |
| `ctx.systemPrompt` | 提示词片段与工具 schema 组装 |
| `ctx.tools` | 作用域化工具注册表 + 带把关的执行流水线 |
| `ctx.agents` | Agent 接口、活跃 agent 注册表、`agent/*` 事件 |
| `ctx.agentLoop` | 实现 Agent 接口的默认驱动器 |
| `ctx.llm` | 消息/流式词汇表 + 适配器 seam |

---

## 3. 核心服务全景（按域分组，你的产品常用哪些一目了然）

**模型与推理**
- `ctx.llm`（seam）：LLM 适配器注册表 —— 接新模型厂商
- `ctx.agentDefaultModel`：默认模型选择
- `ctx.deepseekLlmApiExtensions`：官方 DeepSeek 请求扩展

**Agent 本体与编排**
- `ctx.agents` / `ctx.agentLoop`：Agent 与循环驱动器
- `ctx.agentPresets`：每会话的 agent 组合（**产品分角色/分租户的核心**）
- `ctx.subagents`（seam）：子代理提供方
- `ctx.agentTeams`：多代理任务 DAG
- `ctx.goals`：同会话长目标
- `ctx.planMode`：计划模式协作状态
- `ctx.workflowEngine`：工作流脚本引擎（批量编排）

**工具、技能、命令**
- `ctx.tools`：工具注册表
- `ctx.skills`：技能（skill）提供方注册表 —— **封装专业流程**
- `ctx.commands`：人类命令注册表
- `ctx.systemPrompt`：系统提示词组装

**会话与记忆**
- `ctx.sessions` / `ctx.sessionPersistence`（seam）：会话 + 持久化（默认 JSONL）
- `ctx.sessionQuery`：会话读取/搜索/全文检索
- `ctx.sessionProjections`：会话投影（自定义视图）
- `ctx.sessionTitle`：标题生成
- `ctx.compaction`（seam）：上下文压缩
- `ctx.tokenMeter`：token 计量
- `ctx.spillStore`（seam）：溢出存储

**执行、沙箱与安全（产品上线必读）**
- `ctx.shell` / `ctx.subprocess` / `ctx.terminals`：进程执行
- `ctx.fs`（seam）：文件系统
- `ctx.sandbox`（seam）+ `ctx.sandboxPolicy`：进程沙箱与策略
- `ctx.permissionPresets`：权限预设
- `ctx.approval`（seam）：一次性审批
- `ctx.workingDirectory`：会话工作目录
- `ctx.ptcRuntime`（seam）：PTC 执行（Python 等）

**外部集成**
- `ctx.mcpResources` / `ctx.mcpManager`：MCP 资源与服务器 —— **接企业数据/工具**
- `ctx.web`（seam）：web 搜索/抓取
- `ctx.webhookRuntime`：webhook 触发
- `ctx.ssh`：SSH 连接
- `ctx.browserUse` / `ctx.computerUse`：浏览器/计算机操作

**数据、存储、凭据**
- `ctx.storage` / `ctx.storageDomain`（seam）：非会话持久存储（JSON/SQLite）
- `ctx.credentials`（seam）：凭据（配置只存引用，绝不含值）
- `ctx.attachments`：附件存储
- `ctx.officeKit`：Office 渲染/转换/重算
- `ctx.jobs`：后台任务
- `ctx.schedule`：定时消息

**UI / 客户端**
- `ctx.clientModules` / `ctx.webApp` / `ctx.webServer` / `ctx.connection`：Web GUI 与客户端插件图
- `ctx.settings`：设置表单
- `ctx.actionCards`：操作卡片
- slot 机制（`slots.zh.md`）：类型化 Web UI 组合

**遥测 / 分析（商业化后观测成本与用量）**
- `ctx.sessionTelemetry` / `ctx.productTelemetry` / `ctx.otel` / `ctx.productAnalytics`

---

## 4. 事件域与轮次流程（知道在哪"下手"）

**三大事件域**（见第 1 节）。关键 waterfall 决策点：
- `agent/pre-step`：接纳/改写/拒绝拟议步骤
- `agent/request`：调整控制参数
- `llm/stream`：拦截流式输出
- `tools/pre-execute` / `tools/execute` / `tools/post-execute`：工具流水线把关

**一轮怎么跑**（简化）：
```
turn/start
  → 领取输入 → 组装提示词 + 工具 schema
  → agent/pre-step（waterfall，可拒绝/改写）
  → step/start → agent/request → llm/stream → assistant 消息
  → tool/call* → tools/* 流水线 → tool/result*
  → 若模型还要调工具 → 回到领取（下一步）
  → agent/turn-stopping（serial）
turn/end
```

**会话日志铁律**：「**模型可见即已记录**」——每个模型请求都能从日志重建。你要给模型加任何可见输入，都要走会话事件或 `agent.inject()`，不能绕开日志。

---

## 5. 对你商业化的三条直接结论

1. **你的产品 = 若干插件 + 一个 profile/preset 组合**。技能(skill)=专业流程、工具(tool)=接外部数据/API、MCP=接企业系统、agent preset=分角色/分租户、UI 插件=品牌界面。
2. **DSH 的 seam 机制让你"换一个提供方就换一个产品行为"**：把 `ctx.fs`/`ctx.subprocess` 指向远程沙箱，就把 bash/PTY/LSP 一起搬走了；把 `ctx.llm` 换成自己的模型网关，就掌控了成本与数据。这是做 B 端/SaaS 多租户的关键抓手。
3. **上线必碰的三件套**：`sandbox + sandboxPolicy + permissionPresets`（安全）、`credentials`（密钥绝不明文存）、`sessionTelemetry/productTelemetry`（用量与成本观测）。
