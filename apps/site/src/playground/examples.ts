import type { Spec } from '@json-render/core'
import boards from '../../../admin/public/pages/boards.json'
import sales from '../../../admin/public/pages/dashboard-sales.json'
import forms from '../../../admin/public/pages/form-elements.json'

export interface PlaygroundExample {
  id: string
  label: string
  document: Spec
}

/** Starting points, from a single card to the demo admin's own pages. */
export const PLAYGROUND_EXAMPLES: PlaygroundExample[] = [
  { id: 'overview', label: '卡片与动作', document: {
    root: 'overview',
    state: { message: '改一改左边的 JSON，这里马上更新。' },
    elements: {
      overview: { type: 'Card', props: { title: '订单概览', description: '一张卡片、一个徽标、一条提示和一个按钮。' }, children: ['badge', 'alert', 'continue'] },
      badge: { type: 'Badge', props: { label: '在线', tone: 'success', appearance: 'soft' }, children: [] },
      alert: { type: 'Alert', props: { title: '提示', message: { $state: '/message' }, tone: 'info' }, children: [] },
      continue: { type: 'Button', props: { label: '点我', appearance: 'solid' }, on: { press: { action: 'setState', params: { statePath: '/message', value: '按钮的 press 事件改写了页面状态。' } } }, children: [] },
    },
  } },
  { id: 'form', label: '表单与校验', document: {
    root: 'form',
    state: { profile: { name: '陈米亚', plan: 'pro', enabled: true }, saved: false },
    elements: {
      form: { type: 'Form', props: {}, children: ['name', 'plan', 'enabled', 'actions', 'saved'], on: { submit: { action: 'setState', params: { statePath: '/saved', value: true } } } },
      name: { type: 'FormField', props: { name: 'name', label: '姓名', value: { $bindState: '/profile/name' }, checks: [{ type: 'required', message: '请填写姓名' }] }, children: [] },
      plan: { type: 'FormField', props: { name: 'plan', label: '套餐', fieldType: 'enum', widget: 'Select', value: { $bindState: '/profile/plan' }, options: [{ label: '免费版', value: 'free' }, { label: '专业版', value: 'pro' }] }, children: [] },
      enabled: { type: 'FormField', props: { name: 'enabled', label: '启用', fieldType: 'boolean', widget: 'Switch', value: { $bindState: '/profile/enabled' } }, children: [] },
      actions: { type: 'Stack', props: { direction: 'horizontal', justify: 'end' }, children: ['save'] },
      save: { type: 'Button', props: { label: '保存', type: 'submit', appearance: 'solid' }, children: [] },
      saved: { type: 'Alert', props: { message: '已保存。', tone: 'success' }, visible: { $state: '/saved' }, children: [] },
    },
  } },
  { id: 'query', label: '读取远程数据', document: {
    root: 'page',
    state: { pagination: { page: 1, pageSize: 5 } },
    elements: {
      'page': { type: 'Stack', props: {}, children: ['orders-query', 'orders', 'pager'] },
      'orders-query': { type: 'Query', props: { resource: 'orders', operation: 'list', pagination: { $state: '/pagination' }, resultPath: '/orders' }, children: [] },
      'orders': { type: 'Table', props: { rows: { $state: '/orders/data' }, loading: { $state: '/orders/loading' }, columns: [{ field: 'number', label: '订单号' }, { field: 'customer', label: '客户' }, { field: 'warehouse', label: '仓库' }, { field: 'status', label: '状态' }] }, children: [] },
      'pager': { type: 'Pagination', props: { page: { $bindState: '/pagination/page' }, pageSize: { $bindState: '/pagination/pageSize' }, total: { $state: '/orders/total' } }, children: [] },
    },
  } },
  { id: 'dashboard', label: '销售分析页', document: sales as Spec },
  { id: 'boards', label: '看板与日程', document: boards as Spec },
  { id: 'forms', label: '全部表单控件', document: forms as Spec },
]
