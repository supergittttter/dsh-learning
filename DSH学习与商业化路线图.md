# DeepSeek Harness（DSH）学习与商业化路线图

> 版本：v1（初版骨架，待根据你的背景微调深度与节奏）
> 老师：lead（本会话 AI 导师）
> 依据：当前安装的 DSH `0.2.2-rc.5`（Desktop 版，仓库 `github.com/deepseek-ai/deepseek-harness`，MIT 开源）

---

## 你的定制版路线（v1.1，按你的背景调整）

你的画像：**已熟 LLM/Agent · 每周 ≤3 小时 · 已有明确产品想法和目标用户 · 要边做边学**。

据此做出的四个关键调整：

1. **跳过 P1 的科普**——不再讲"什么是 Agent/tool/skill"，只补 DSH *特有*的机制（Cordis、profile 组合、slot 插槽、service/event）。
2. **压缩到"最短可建路径"**——理论只学"够用就动手"的 Cordis 核心，其余能力边用边查。
3. **一切反向锚定你的产品**——只学你产品真正需要的那几个 DSH 能力，不学无关的。
4. **第一课就动手**——第一课不是读文档，而是把你产品的"第一个最小切片"做成一个 DSH 插件/技能。

定制后的节奏（每周 ≤3 小时）：

| 周 | 内容 | 产出 |
|---|---|---|
| 第 1–2 周 | Cordis 极简核心（context / service / event / config / 组合）+ 把你的产品拆解成 DSH 能力清单 | 一份"产品 → DSH 能力映射表" |
| 第 3–6 周 | 动手做 MVP 最小闭环：1 个 skill + 1 个 tool/MCP + 1 个 agent preset | 一个能跑通"输入→处理→产出"的演示 |
| 之后 | 按产品需要逐个补：UI、schedule、persistence、权限预设、发行 | 逐项补齐到可收费 |

> 下一课的具体内容，取决于你的产品想法——请见导师当前提问。

---

## 0. 先建立正确认知（最重要的一课）

DSH 不是一个"套壳聊天工具"，而是一个**用插件组合起来的 AI Agent 运行时/开发框架**。

一句话本质：
> **一切皆插件（package/plugin），通过 profile（组合配置）拼装出一个 Agent 应用。**

关键事实：

1. **底层是 Cordis**（`@deepseek-ai/cordis ~4.1.0`）：一个 TypeScript 的依赖注入 / 插件框架。DSH 的所有能力（Agent、工具、技能、UI、LLM 适配器……）都是 Cordis 插件。
2. **Agent 能力的拼图**，从 `@deepseek-ai/dsh` 的依赖清单能直接看到：
   - **Agent 本体**：`dsh-agent`、`dsh-agent-loop`、`dsh-subagent`、`dsh-agent-team`
   - **工具**：`dsh-tool-bash`、`dsh-tool-fs`、`dsh-tool-web`、`dsh-tool-subagent`、`dsh-tool-workflow`、`dsh-tool-schedule`、`dsh-tool-goal`、`dsh-tool-jobs`、`dsh-tool-present`…
   - **技能**：`dsh-skill`、`dsh-skill-filesystem`、`dsh-skill-office`
   - **LLM**：`dsh-llm`、`dsh-llm-deepseek`、`dsh-llm-deepseek-account`、`dsh-llm-mock-server`…
   - **会话与记忆**：`dsh-session`、`dsh-session-persistence-jsonl`、`dsh-compaction-*`
   - **编排**：`dsh-plan-mode`、`dsh-goal`、`dsh-schedule`、`dsh-workflow-ptc`
   - **外部集成**：`dsh-mcp-client`、`dsh-http-proxy`、`dsh-webhook`
   - **界面**：`dsh-web-app`、`dsh-client-ui-*`（Client 模块 + slot 插槽机制）
3. **一个 profile = 一个应用**。你当前的 desktop profile 就是 `package.json` 里的 `dsh.profile.bundles`（装了 `dsh-base` + `dsh-web-app`）再叠加 `cordis.patch.yml` 的配置覆盖。
4. **商业化路径不是"改 DSH 源码卖"，而是"在 DSH 上做插件/技能/产品组合 + 独立发行"**。这是你最快、最合规、最可持续的路线。

---

## 阶段总览

| 阶段 | 主题 | 核心产出 | 大致周期（随投入浮动） |
|---|---|---|---|
| P1 | 使用层：熟练驾驭 DSH | 能用它完成真实复杂任务 | 1–2 周 |
| P2 | 原理层：架构 + Cordis | 能读懂任何插件的实现 | 2–4 周 |
| P3 | 扩展层：写插件/工具/技能/UI/MCP | 发布自己的第一个 DSH 插件 | 3–6 周 |
| P4 | 产品层：拼装成完整 Agent 产品 | 一个可演示的垂直 Agent MVP | 4–8 周 |
| P5 | 商业化：定位/定价/分发/合规 | 可上线的产品 + 收费方案 | 持续 |

---

## P1 · 使用层（先会用，建立体感）

**目标**：不是"点开聊天"，而是把 DSH 当成生产力武器，理解它能做什么。

学习内容：
- 阅读安装内 `docs/user/guide/quickstart`（我会帮你读并讲解）。
- 掌握两种 Agent 模式：**Standard**（默认）/ **Creator**（创作）。
- 亲手用一遍这些能力，并理解各自语义：
  - **Tool（工具）**：bash / fs / web / present / todo…
  - **Skill（技能）**：可复用的任务指令包（如 office、mcp-builder）。
  - **Subagent（子代理）**：把独立任务外包给子代理并行做。
  - **Workflow（工作流）**：用脚本编排大规模多代理任务。
  - **Goal（目标）**：长任务跨轮自动推进。
  - **Schedule（调度）**：定时任务。
  - **Plan mode（计划模式）**：先计划后执行。
  - **MCP**：接外部工具/数据源。
  - **沙箱与审批**：理解 workspace-write / danger-full-access 等文件策略与权限模型。

**实践作业**：选一个你真实场景的任务（比如"批量整理某个文件夹/爬取某信息并生成报告"），只用 DSH 完成，全程截图/记录卡点。

**验收**：你能向别人解释"为什么 DSH 不是聊天机器人，而是 Agent 框架"。

---

## P2 · 原理层（Cordis 是地基，必须吃透）

**目标**：看懂"为什么这么设计"，为写插件打基础。

前置技能自查（缺哪补哪）：
- TypeScript 基础（interface / class / decorator / 泛型）
- Node.js 基础（npm/pnpm、ESM、事件循环、异步）

学习内容（安装内文档，我逐篇带你读）：
- `docs/architecture.md` —— 整体架构分层。
- `docs/agent-lifecycle.md` —— Agent 一轮是怎么跑的。
- `docs/capability-seams.md` —— 有哪些"可插拔的缝"（扩展点）。
- `docs/cordis-primer.md` + `docs/cordis-tutorial/01–07` —— **核心中的核心**：
  1. 第一个插件
  2. 生命周期与副作用
  3. Service（服务注入）
  4. Event（事件）
  5. Config（配置 schema）
  6. 组合与 HMR
  7. 进入 Harness
- `docs/subsystems/` —— 逐个读关键子系统：session、sandbox、approval、goal、plan、schedule、persistence、filesystem、llm-streaming、compaction。

**实践作业**：从 `dsh-tool-bash` 或 `dsh-tool-fs` 的源码入手，画出"一个工具从定义到被 Agent 调用"的完整调用链（可以用文字/图）。

**验收**：给你一个陌生插件，你能说清它注册了哪些 Service、挂了哪些 Event、Config 长什么样。

---

## P3 · 扩展层（从 0 到 1 发布插件）

**目标**：能独立做出并发布 DSH 扩展，这是商业化的最小单元。

学习内容（安装内文档 + 模板）：
- `docs/cookbook/adding-a-tool.md` —— 加一个工具。
- `docs/cookbook/adding-an-llm-adapter.md` —— 接一个新模型厂商。
- `docs/cookbook/adding-a-settings-card.md` —— 加设置卡片。
- `docs/cookbook/adding-a-package.md` —— 新增一个包。
- `references/plugin-development.md`、`host-plugin.md`、`tool-design.md`、`mcp-bundle.md`、`ui-plugin.md`、`configuration.md`。
- 模板：`templates/decoration`（UI 插件）、`templates/mcp`（MCP bundle）。

**实践作业（递进）**：
1. 写一个自定义 Tool 插件（比如"汇率查询/公司信息查询"）。
2. 写一个 Skill（把某套专业流程固化下来）。
3. 接一个 MCP server（配置型 bundle）。
4. 做一个带设置卡片 + 图标的完整插件，用 `plugin_manager` 装进当前 profile。

**验收**：你的插件能在本 GUI 里稳定运行、可配置、有图标与说明页。

---

## P4 · 产品层（把能力拼成产品）

**目标**：做出一个"有人愿意用"的垂直 Agent 产品 MVP。

关键决策：**不要做"通用 AI 助手"**（那是跟大厂贴身肉搏），要做**垂直 + 有数据/流程壁垒**的 Agent。

候选思路（供启发，后续一起验证）：
- 垂直职业 Agent：简历/求职（如本会话已有的 skill：简历分析、JD 匹配、面试准备）。
- 垂直行业 Agent：法律文书、财税、医疗预问诊、跨境电商运营。
- 垂直办公 Agent：会议纪要→行动项→任务派发闭环。
- 开发者 Agent：代码审查、测试生成、文档生成。
- 数据/研究 Agent：行情监测、研报摘要、竞品追踪。

产品拼装清单（用 DSH 原生能力，尽量少写自有代码）：
- 核心能力 = Skill（专业流程）+ Tool（外部数据/API）+ MCP（企业数据源）。
- 交互 = Agent preset（角色/系统提示）+ UI 插件（品牌界面）。
- 记忆/状态 = session + persistence + 企业知识库（MCP resources）。
- 自动化 = schedule（定时）+ goal（长任务）+ workflow（批量）。
- 安全 = sandbox + permission presets（权限预设）。

**实践作业**：选定 1 个垂直方向，做出"输入→Agent 处理→产出"的完整可演示闭环，并找 3–5 个真实用户试用手写反馈。

**验收**：有 1 个真实用户说"愿意为此付费"。

---

## P5 · 商业化（从能用到能赚钱）

**目标**：把 MVP 变成可持续收入。

关键课题（逐个攻克）：
1. **定位与竞品**：一句话说清"给谁、解决什么、凭什么选你"。
2. **成本模型**：LLM token 成本、算力、运维；先算清楚毛利。
3. **定价**：订阅 / 按量 / 一次性；to C 还是 to B。
4. **分发**：官方 bundle/插件市场（DSH 生态内分发） vs 独立发行（自建渠道/私域）。
5. **多租户与计费**：DSH 原生 profile 组合能力是否够用，何时需要自建后端。
6. **合规**：数据隐私、API 使用条款、行业资质（如医疗/法律/金融）。
7. **壁垒**：专业数据、工作流 know-how、口碑 —— 技术本身壁垒很低，务必靠"行业流程 + 数据 + 交付质量"建壁垒。

**产出**：一页纸商业计划 + 一个可收费的付费验证（哪怕是 1 个付费用户）。

---

## 我作为老师的带教方式（建议）

1. **每次聚焦一个主题**：先讲概念 → 一起读源码/文档 → 做一个小任务 → 我 review。
2. **作业制**：每个阶段结束有可验收的产出，验收通过才进入下一阶段。
3. **以做带学**：尽快进入"写第一个插件"，在实战里补 TypeScript/Cordis 短板，而不是先学三个月理论。
4. **可随时打断提问**：任何一步卡住，直接问我。

---

## 当前机器信息（供参考）

- DSH 版本：`0.2.2-rc.5`（release candidate）
- Profile：`desktop`（`/Users/openclaw-01/.dsh/profiles/desktop`）
- 安装形态：Desktop 打包版，代码在 `app.asar` 内，需用 `ELECTRON_RUN_AS_NODE=1` 的运行时读取
- 仓库：<https://github.com/deepseek-ai/deepseek-harness>
- 文档：安装内 `docs/`（架构、Cordis 教程、cookbook、subsystems 等，非常完整）
