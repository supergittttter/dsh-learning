// 家庭记账插件：记账 + 月度洞察 + 预算（三个工具）
// record_expense：记一笔支出
// spending_report：读流水、按类别汇总，并对比预算（超支/剩余）
// set_budget：设置某类别的月度预算

import { Service } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

export const name = 'ledger-agent'
export const inject = ['tools', 'storageDomain']

// 支出记录结构
const expenseSchema = z.object({
  amount: z.number(),
  category: z.string(),
  note: z.string(),
  at: z.string(),
})

// 预算记录结构（key = 类别）
const budgetSchema = z.object({
  amount: z.number(),
  note: z.string(),
})

// 账本领域：expenses + budgets 两张表
const ledgerSpec = defineDomain({
  name: 'ledger',
  version: 1,
  tables: {
    expenses: domainTable(expenseSchema),
    budgets: domainTable(budgetSchema),
  },
})

class LedgerService extends Service {
  constructor(ctx) {
    super(ctx, 'ledgerAgent')
  }

  async [Service.init]() {
    const domain = await this.ctx.storageDomain.open(ledgerSpec)
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

    // —— 工具 2：月度汇总（含预算对比）——
    this.ctx.tools.register(defineTool({
      name: 'spending_report',
      description: '汇总支出流水。可选 month（格式 YYYY-MM，如 2026-11）过滤月份，不填则统计全部。返回按类别从高到低的金额汇总、总笔数，以及设置了预算的类别的超支/剩余情况。',
      parameters: {
        month: { type: 'string', description: '月份，格式 YYYY-MM；不填统计全部' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        const expenses = domain.table('expenses')
        const budgets = domain.table('budgets')
        let total = 0
        let count = 0
        const byCategory = new Map()
        for (const [, rec] of expenses.entries()) {
          if (args.month && !rec.at.startsWith(args.month)) continue
          total += rec.amount
          count += 1
          byCategory.set(rec.category, (byCategory.get(rec.category) ?? 0) + rec.amount)
        }
        const lines = [...byCategory.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([cat, sum]) => {
            const b = budgets.get(cat)
            let s = `${cat} ¥${sum.toFixed(2)}`
            if (b) {
              const diff = sum - b.amount
              s += diff > 0
                ? `（预算 ¥${b.amount}，超支 ¥${diff.toFixed(2)}）`
                : `（预算 ¥${b.amount}，剩余 ¥${(-diff).toFixed(2)}）`
            }
            return s
          })
        const header = args.month ? `${args.month} 月` : '全部'
        const body = lines.length ? lines.join('；') : '（暂无记录）'
        return `${header}共 ${count} 笔，合计 ¥${total.toFixed(2)}。分类：${body}`
      },
    }))

    // —— 工具 3：设置预算 ——
    this.ctx.tools.register(defineTool({
      name: 'set_budget',
      description: '设置某类别的月度预算。category 是类别（如 餐饮/交通），amount 是月预算金额（单位元）。重复设置同类别会覆盖旧值。',
      parameters: {
        category: { type: 'string', required: true, description: '类别，如 餐饮' },
        amount: { type: 'number', required: true, description: '月预算金额，单位元' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        await domain.table('budgets').put(args.category, { amount: args.amount, note: '' })
        return `已设置「${args.category}」月度预算 ¥${args.amount}`
      },
    }))
  }
}

export function apply(ctx) {
  ctx.plugin(LedgerService)
}
