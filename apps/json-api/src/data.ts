export interface Role {
  id: number
  name: string
  code: string
  permissions: string[]
}

export interface User {
  id: number
  name: string
  email: string
  role: string
  active: boolean
  password?: string
}

export interface Category {
  id: number
  name: string
  parentId: number | null
  visible: boolean
}

export interface Customer {
  id: number
  name: string
  email: string
  tier: string
  spent: number
}

export interface Product {
  id: number
  name: string
  sku: string
  categoryId: number
  price: number
  status: string
  images: string[]
  content: string
  updatedAt: string
}

export interface OrderItem {
  sku: string
  qty: number
}

export interface Order {
  id: number
  number: string
  customerId: number
  status: string
  total: number
  items: OrderItem[]
  createdAt: string
}

export interface Article {
  id: number
  title: string
  summary: string
  category: string
  author: string
  tags: string[]
  updatedAt: string
}

export interface Project {
  id: number
  name: string
  description: string
  status: string
  owner: string
  progress: number
  budget: number
  dueAt: string
}

export interface Activity {
  id: number
  title: string
  actor: string
  description: string
  tone: string
  createdAt: string
}

export interface Seed {
  activities: Activity[]
  articles: Article[]
  categories: Category[]
  customers: Customer[]
  orders: Order[]
  products: Product[]
  projects: Project[]
  roles: Role[]
  users: User[]
}

export interface Store<Row> {
  rows: Row[]
  nextId: number
}

export type Stores = { [Name in keyof Seed]: Store<Seed[Name][number]> }

/** A row as the generic resource routes see it: an id plus whatever the client sent. */
export interface DynamicRow {
  id: number
  [field: string]: unknown
}

const now = Date.now()
const daysAgo = (days: number): string => new Date(now - days * 86400000).toISOString()

export const roles: Role[] = [
  { id: 1, name: 'Administrator', code: 'admin', permissions: ['*:*'] },
  { id: 2, name: 'Manager', code: 'manager', permissions: ['products:list', 'products:show', 'products:create', 'products:edit', 'categories:*', 'orders:list', 'orders:show', 'orders:edit', 'customers:*', 'articles:list', 'projects:list', 'activities:list'] },
  { id: 3, name: 'Support', code: 'support', permissions: ['orders:list', 'orders:show', 'orders:edit', 'customers:list', 'customers:show', 'articles:list', 'projects:list', 'activities:list'] },
]

export const users: User[] = [
  { id: 1, name: 'Ada Admin', email: 'ada@lumi.test', role: 'admin', active: true },
  { id: 2, name: 'Mina Manager', email: 'mina@lumi.test', role: 'manager', active: true },
  { id: 3, name: 'Sam Support', email: 'sam@lumi.test', role: 'support', active: true },
]

export const categories: Category[] = [
  { id: 1, name: 'Electronics', parentId: null, visible: true },
  { id: 2, name: 'Cameras', parentId: 1, visible: true },
  { id: 3, name: 'Audio', parentId: 1, visible: true },
  { id: 4, name: 'Home', parentId: null, visible: true },
  { id: 5, name: 'Kitchen', parentId: 4, visible: true },
  { id: 6, name: 'Lighting', parentId: 4, visible: false },
]

export const customers: Customer[] = [
  { id: 1, name: 'Northwind Studio', email: 'ops@northwind.test', tier: 'enterprise', spent: 18240 },
  { id: 2, name: 'Blue Pine Retail', email: 'buy@bluepine.test', tier: 'gold', spent: 7840 },
  { id: 3, name: 'Orchid Supply', email: 'team@orchid.test', tier: 'standard', spent: 2180 },
]

export const products: Product[] = Array.from({ length: 32 }, (_, index) => {
  const id = index + 1
  return { id, name: `Lumi Product ${id}`, sku: `SKU-${String(id).padStart(4, '0')}`, categoryId: (id % 5) + 1, price: 24 + id * 3, status: id % 5 === 0 ? 'archived' : id % 2 === 0 ? 'active' : 'draft', images: [`/uploads/product-${id}.jpg`], content: `<p>Product ${id} rich content</p>`, updatedAt: daysAgo(id / 3) }
})

export const orders: Order[] = Array.from({ length: 28 }, (_, index) => {
  const id = index + 1
  const status = ['pending', 'paid', 'packed', 'shipped', 'cancelled'][id % 5]!
  return { id, number: `ORD-${String(id).padStart(5, '0')}`, customerId: (id % 3) + 1, status, total: 120 + id * 19, items: [{ sku: `SKU-${String((id % 12) + 1).padStart(4, '0')}`, qty: (id % 3) + 1 }], createdAt: daysAgo(id) }
})

const articleCategories = ['Operations', 'Growth', 'Support', 'Finance', 'Security']
export const articles: Article[] = Array.from({ length: 24 }, (_, index) => {
  const id = index + 1
  const category = articleCategories[id % articleCategories.length]!
  return { id, title: `${category} playbook ${String(id).padStart(2, '0')}`, summary: `Operational guidance for ${category.toLowerCase()} workflows and follow-up.`, category, author: users[id % users.length]!.name, tags: ['runbook', category.toLowerCase(), id % 2 === 0 ? 'weekly' : 'priority'], updatedAt: daysAgo(id / 2).slice(0, 10) }
})

const projectNames = ['Atlas rollout', 'Mercury billing', 'Orion support', 'Nova catalog', 'Cedar logistics', 'Harbor launch', 'Summit renewal', 'Vertex insights', 'Signal risk', 'Prism onboarding', 'Beacon workflow', 'Copper audit']
export const projects: Project[] = projectNames.map((name, index) => ({ id: index + 1, name, description: `${name} coordinates product and operations teams.`, status: ['active', 'review', 'blocked', 'planned'][index % 4]!, owner: users[index % users.length]!.name, progress: 34 + (index * 7) % 61, budget: 18000 + index * 1250, dueAt: new Date(now + (index + 1) * 86400000).toISOString().slice(0, 10) }))

export const activities: Activity[] = Array.from({ length: 22 }, (_, index) => ({ id: index + 1, title: ['Capacity review', 'Catalog approval', 'Customer escalation', 'Billing reconciliation', 'Access audit'][index % 5]!, actor: users[index % users.length]!.name, description: 'Updated a work item with a concrete next action.', tone: ['info', 'success', 'warning'][index % 3]!, createdAt: new Date(now - index * 1800000).toISOString() }))

export const seed: Seed = { activities, articles, categories, customers, orders, products, projects, roles, users }

export function cloneSeed(): Stores {
  const stores = Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, { rows: structuredClone(rows), nextId: Math.max(0, ...rows.map((row: { id: number }) => Number(row.id) || 0)) }]))
  // Object.fromEntries forgets the key-to-row pairing that the seed object guarantees.
  return stores as unknown as Stores
}
