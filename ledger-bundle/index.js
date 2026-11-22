// 家庭记账插件：第一个最小切片 —— 记账 + 月度洞察（两个工具）
// record_expense：把"记一笔：午饭 35，餐饮"落库
// spending_report：读流水、按类别汇总，供模型生成洞察

import { Service } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

export const name = 'ledger-agent'
// 依赖两个服务：tools（工具注册表）+ storageDomain（领域存储设施）
export const inject = ['tools', 'storageDomain']

// 1. 声明"账本"领域：一张 expenses 表，记录结构用 zod 声明
const expenseSchema = z.object({
  amount: z.number(),   // 金额（元）
  category: z.string(), // 类别：餐饮/交通/购物…
  note: z.string(),     // 备注
  at: z.string(),       // ISO 时间
})

const ledgerSpec = defineDomain({
  name: 'ledger',
  version: 1,
  tables: {
    expenses: domainTable(expenseSchema),
  },
})

// 2. 用 Service 类：异步初始化放在 [Service.init]（官方模式，非 async apply）
class LedgerService extends Service {
  constructor(ctx) {
    super(ctx, 'ledgerAgent')
  }

  async [Service.init]() {
    const domain = await this.ctx.storageDomain.open(ledgerSpec)
    // 卸载/HMR 时自动关闭领域（effect 的 disposer）
    this.ctx.effect(() => () => domain.close())

    // —— 工具 1：记账 ——
    this.ctx.tools.register(defineTool({
      name: 'record_expense',
      description: '记一笔支出。amount 是金额（单位元），category 是类别（餐饮/交通/购物/居住/医疗/其他），note 是可选备注。',
      parameters: {
        amount: { type: 'number', required: true, description: '金额，单位元' },
        category: { type: 'string', required: true, description: '类别，如 餐饮/交通/购物' },
        note: { type: 'string', description: '可选备注，如 午饭' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
        const record = {
          amount: args.amount,
          category: args.category ?? '其他',
          note: args.note ?? '',
          at: new Date().toISOString(),
        }
        await domain.table('expenses').put(id, record)
        return `已记账：${record.category} ¥${record.amount}${record.note ? '（' + record.note + '）' : ''}`
      },
    }))

    // —— 工具 2：月度洞察（读流水 + 分类汇总，模型据此生成洞察）——
    this.ctx.tools.register(defineTool({
      name: 'spending_report',
      description: '汇总支出流水。可选 month（格式 YYYY-MM，如 2026-11）过滤月份，不填则统计全部。返回按类别从高到低的金额汇总与总笔数。',
      parameters: {
        month: { type: 'string', description: '月份，格式 YYYY-MM；不填统计全部' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        const table = domain.table('expenses')
        let total = 0
        let count = 0
        const byCategory = new Map()
        for (const [, rec] of table.entries()) {
          if (args.month && !rec.at.startsWith(args.month)) continue
          total += rec.amount
          count += 1
          byCategory.set(rec.category, (byCategory.get(rec.category) ?? 0) + rec.amount)
        }
        const lines = [...byCategory.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([cat, sum]) => `${cat} ¥${sum.toFixed(2)}`)
        const header = args.month ? `${args.month} 月` : '全部'
        const body = lines.length ? lines.join('；') : '（暂无记录）'
        return `${header}共 ${count} 笔，合计 ¥${total.toFixed(2)}。分类：${body}`
      },
    }))
  }
}

// 3. 函数插件作为入口，挂载上面的 Service 类
export function apply(ctx) {
  ctx.plugin(LedgerService)
}
