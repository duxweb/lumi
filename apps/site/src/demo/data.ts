import type { AccessProvider, AuthProvider, DataProvider } from '@duxweb/lumi'

type Row = Record<string, unknown>

const customers = ['陈米亚', '林知远', '许嘉禾', '周书言', '韩青', '沈若溪', '顾辰', '叶闻笙']
const warehouses = ['杭州一号仓', '成都仓', '深圳仓', '上海前置仓']
const statuses = ['pending', 'paid', 'packed', 'shipped', 'shipped', 'paid', 'cancelled', 'shipped']

// Amounts are in USD because the sales dashboard page formats them that way.
const orders: Row[] = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  number: `ORD-${2018 + index}`,
  customer: customers[index % customers.length],
  warehouse: warehouses[index % warehouses.length],
  status: statuses[index % statuses.length],
  total: Math.round((48 + ((index * 73) % 410)) * 100) / 100,
}))

const tasks: Row[] = [
  { id: 1, status: 'todo', rank: 3072, title: '核对成都仓货架条码', description: '部分货架标签还是旧 SKU 格式', tags: [{ label: '仓储', tone: 'neutral' }], priority: 'low', dueDate: '2026-08-21' },
  { id: 2, status: 'todo', rank: 4096, title: '起草四季度快递合同', tags: [{ label: '财务', tone: 'info' }], assignee: { name: '陈米亚' }, priority: 'medium' },
  { id: 3, status: 'todo', rank: 1024, title: '更新秋季商品主图', tags: [{ label: '商品', tone: 'success' }], assignee: { name: '王立' }, priority: 'medium', dueDate: '2026-08-14' },
  { id: 4, status: 'todo', rank: 2048, title: '修复发票税额尾差', description: '超过十行的订单合计会差一分钱', tags: [{ label: '缺陷', tone: 'danger' }, { label: '财务', tone: 'info' }], assignee: { name: '林知远' }, priority: 'urgent', dueDate: '2026-08-08' },
  { id: 5, status: 'doing', rank: 1024, title: '迁移支付回调', description: '回调改走签名地址，下线旧路由', tags: [{ label: '后端', tone: 'warning' }], assignee: { name: '林知远' }, priority: 'high', dueDate: '2026-08-12' },
  { id: 6, status: 'doing', rank: 2048, title: '重写新客欢迎邮件', tags: [{ label: '内容', tone: 'success' }], assignee: { name: '陈米亚' }, priority: 'medium', dueDate: '2026-08-09' },
  { id: 7, status: 'doing', rank: 3072, title: '对账七月退款', assignee: { name: '王立' }, priority: 'medium', dueDate: '2026-08-11' },
  { id: 8, status: 'review', rank: 1024, title: '会员等级徽章', description: '周四发布前过一遍设计和文案', tags: [{ label: '设计', tone: 'info' }], assignee: { name: '周书言' }, priority: 'medium', dueDate: '2026-08-13' },
  { id: 9, status: 'done', rank: 1024, title: '订单导出 CSV', tags: [{ label: '后端', tone: 'warning' }], assignee: { name: '林知远' }, priority: 'high', dueDate: '2026-08-05' },
  { id: 10, status: 'done', rank: 2048, title: '归档六月活动', assignee: { name: '陈米亚' }, priority: 'low', dueDate: '2026-08-03' },
]

const events: Row[] = [
  { id: 1, title: '运营周会', start: '2026-08-10T09:30', end: '2026-08-10T10:30', tone: 'primary' },
  { id: 2, title: '快递合同电话', start: '2026-08-10T10:00', end: '2026-08-10T11:00', tone: 'info' },
  { id: 3, title: '支付回调切换', start: '2026-08-10T14:00', end: '2026-08-10T16:30', tone: 'warning' },
  { id: 4, title: '秋季商品拍摄', start: '2026-08-12', end: '2026-08-14', allDay: true, tone: 'success' },
  { id: 5, title: '设计评审', start: '2026-08-13T15:00', end: '2026-08-13T16:00', tone: 'info' },
  { id: 6, title: '支付通道维护', start: '2026-08-15T01:00', end: '2026-08-15T03:00', tone: 'danger' },
  { id: 7, title: '客服团队午餐', start: '2026-08-11T12:00', end: '2026-08-11T13:00', tone: 'neutral' },
  { id: 8, title: '月末结账', start: '2026-08-31', allDay: true, tone: 'warning' },
  { id: 9, title: '库存盘点', start: '2026-08-10', allDay: true, tone: 'neutral' },
  { id: 10, title: '发布规划', start: '2026-08-17T10:00', end: '2026-08-17T11:30', tone: 'primary' },
  { id: 11, title: '深圳快闪店', start: '2026-08-20', end: '2026-08-23', allDay: true, tone: 'success' },
]

const stores: Record<string, Row[]> = { orders, tasks, events }
const rows = (resource: string): Row[] => (stores[resource] ??= [])

function sorted(all: Row[], sorters: readonly { field: string, order: 'asc' | 'desc' }[] = []): Row[] {
  const [sorter] = sorters
  if (!sorter)
    return all
  const sign = sorter.order === 'desc' ? -1 : 1
  return [...all].sort((a, b) => (Number(a[sorter.field]) - Number(b[sorter.field])) * sign)
}

/** Everything the site's demo reads and writes stays in this browser tab. */
export const demoDataProvider = {
  getList: async ({ resource, pagination, sorters }) => {
    const all = sorted(rows(resource), sorters as never)
    const paging = pagination || undefined
    const page = paging?.page ?? 1
    const size = paging?.pageSize ?? all.length
    return { data: all.slice((page - 1) * size, page * size) as never[], total: all.length }
  },
  getOne: async ({ resource, id }) => ({ data: rows(resource).find(row => String(row.id) === String(id)) as never }),
  create: async ({ resource, variables }) => {
    const all = rows(resource)
    const row = { ...(variables as Row), id: all.length + 1 }
    all.push(row)
    return { data: row as never }
  },
  update: async ({ resource, id, variables }) => {
    const row = rows(resource).find(item => String(item.id) === String(id))
    if (row)
      Object.assign(row, variables)
    return { data: row as never }
  },
  deleteOne: async ({ resource, id }) => {
    const all = rows(resource)
    const index = all.findIndex(row => String(row.id) === String(id))
    const [row] = index >= 0 ? all.splice(index, 1) : []
    return { data: row as never }
  },
} satisfies DataProvider

/** The visitor is always signed in as the demo operator. */
export const demoAuthProvider: AuthProvider = {
  login: async () => ({ success: true }),
  logout: async () => ({ success: true }),
  check: async () => ({ authenticated: true }),
  getIdentity: async <T>() => ({ id: 1, name: '陈米亚', email: 'mia@example.com' }) as T,
}

export const demoAccessProvider: AccessProvider = { can: async () => ({ can: true }) }
