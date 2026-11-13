import { handleAgentChat, handleAgentSessions, resetAgent } from './agent.ts'
import orderQueue from './pages/order-queue.json' with { type: 'json' }

export { configureAgent } from './agent.ts'

/**
 * The demo backend as one platform-neutral function over Web Fetch types:
 * `server.ts` serves it from Node, and the browser build calls it in-page.
 */

/** Parsed request JSON. Primitives are not rejected: reading a field off one yields undefined. */
type JsonBody = Record<string, unknown> | null
/** A filter value after normalization; also how row fields are compared against it. */
type FilterValue = string | number | boolean

interface Role {
  id: number
  name: string
  code: string
  permissions: string[]
}

interface User {
  id: number
  name: string
  email: string
  role: string
  active: boolean
  bio: string
  emailUpdates: boolean
  inApp: boolean
  digest: boolean
  orderUpdates: boolean
  inventoryAlerts: boolean
  language: string
  timezone: string
  dateFormat: string
  firstDay: string
  rememberTabs: boolean
  confirmLeave: boolean
  signInAlerts: boolean
  permissionAlerts: boolean
  exportAlerts: boolean
  phone: string
  team: string
  joinedAt: string
  lastSignInAt: string
  lastSignInFrom: string
  twoFactor: boolean
  sessions: number
  passwordChangedAt: string
}

interface Note {
  id: number
  title: string
  priority: 'low' | 'normal' | 'high'
}

interface Category {
  id: number
  name: string
  parentId: number | undefined
  visible: boolean
}

interface Customer {
  id: number
  name: string
  email: string
  tier: string
  spent: number
}

interface Product {
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

interface OrderLine {
  sku: string
  name: string
  variant: string
  image: string
  qty: number
}

interface Order {
  id: number
  number: string
  customerId: number
  customer: string
  searchText: string
  status: string
  overdueHours: number | null
  refunding: boolean
  watched: boolean
  paymentMethod: string
  warehouse: string
  product: string
  total: number
  discount: number
  /** JSON-encoded OrderLine[]. */
  items: string
  carrier: string
  recipient: string
  phone: string
  address: string
  customerNote: string | null
  internalNote: string | null
  createdAt: string
  placedAt: string
}

interface Article {
  id: number
  title: string
  summary: string
  category: string
  author: string
  tags: string
  status: 'published' | 'draft'
  updatedAt: string
}

interface Project {
  id: number
  name: string
  description: string
  status: string
  owner: string
  progress: number
  budget: number
  dueAt: string
}

interface Activity {
  id: number
  title: string
  actor: string
  project: string
  description: string
  tone: string
  createdAt: string
}

interface Store<Row> {
  rows: Row[]
  nextId: number
}

/** A row as the generic resource routes see it: an id plus whatever the client sent. */
interface DynamicRow {
  id: number
  [field: string]: unknown
}

type DynamicStores = Record<string, Store<DynamicRow>>

interface Upload {
  url: string
  name: string
  size: number
  type: string
  field: string
  contentType: string | undefined
}

interface ListResult<Row> {
  data: Row[]
  meta: { total: number, page: number, pageSize: number }
}

interface StatusCount {
  status: string
  count: number
}

interface Dashboard {
  data: {
    period: { days: number, start: string, end: string }
    totals: { products: number, orders: number, customers: number, revenue: number }
    deltas: { revenue: number | null, orders: number | null, customers: number | null }
    permissions: string[]
    charts: {
      revenue: { date: string, revenue: number, orders: number }[]
      annotations: { date: string, note: string }[]
      status: StatusCount[]
      products: StatusCount[]
    }
    recent: {
      orders: Pick<Order, 'id' | 'number' | 'customer' | 'product' | 'warehouse' | 'status' | 'total' | 'createdAt' | 'placedAt' | 'overdueHours'>[]
      products: Pick<Product, 'name' | 'sku' | 'status' | 'price'>[]
    }
    rankings: {
      payments: { method: string, count: number, revenue: number }[]
      customers: { name: string, tier: string, orders: number, spent: number }[]
    }
  }
}

interface OrderStats {
  total: number
  last28Days: number
  awaitingPayment: number
  toShip: number
  overdue: number
  refunding: number
  watching: number
  todayRevenue: number
}

const MOCK_NOW = Date.parse('2026-08-10T08:00:00.000Z')
const BEARER_RE = /^Bearer\s+/i
// A filter key is `field` or `field[operator]`.
const FILTER_KEY_RE = /^(.+)\[([a-z]+)\]$/
const MULTIPART_FILENAME_RE = /filename="([^"]+)"/
const MULTIPART_TYPE_RE = /Content-Type:\s*([^\r\n]+)/i
const MULTIPART_FIELD_RE = /name="([^"]+)"/
const SAFE_FILENAME_RE = /[^\w.-]+/g

const sessions = new Map<string, User>()
// Passwords set through sign-up or a reset link, by email; the rest stay `admin`.
const passwords = new Map<string, string>()
let uploadSeq = 0

const actionSet = ['list', 'show', 'create', 'edit', 'delete', 'export']

function actionPermissions(resources: string[], actions: string[] = actionSet): string[] {
  return resources.flatMap(resource => actions.map(action => `${resource}:${action}`))
}

const roles: Role[] = [
  { id: 1, name: 'Administrator', code: 'admin', permissions: actionPermissions(['products', 'categories', 'orders', 'customers', 'users', 'roles', 'articles', 'projects', 'activities', 'notes']) },
  { id: 2, name: 'Manager', code: 'manager', permissions: [
    ...actionPermissions(['products', 'categories', 'orders', 'customers'], ['list', 'show', 'edit']),
    'orders:create',
    'customers:create',
    'articles:list',
    'projects:list',
    'activities:list',
  ] },
  { id: 3, name: 'Support', code: 'support', permissions: ['orders:list', 'orders:show', 'orders:edit', 'customers:list', 'customers:show', 'articles:list', 'projects:list', 'activities:list'] },
]

const userSettings = {
  bio: 'Building better operations, one small improvement at a time.',
  emailUpdates: true,
  inApp: true,
  digest: false,
  orderUpdates: true,
  inventoryAlerts: true,
  language: 'English',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD',
  firstDay: 'Monday',
  rememberTabs: true,
  confirmLeave: true,
  signInAlerts: true,
  permissionAlerts: true,
  exportAlerts: false,
}

const hoursAgo = (hours: number): string => new Date(MOCK_NOW - hours * 3600000).toISOString()

const users: User[] = [
  { id: 1, ...userSettings, name: 'Ada Admin', email: 'ada@lumi.test', role: 'admin', active: true, phone: '+86 138 0013 8001', team: 'Operations', joinedAt: '2024-03-12', lastSignInAt: hoursAgo(2), lastSignInFrom: 'Chrome · macOS', twoFactor: true, sessions: 3, passwordChangedAt: '2026-06-02' },
  { id: 2, ...userSettings, name: 'Mina Manager', email: 'mina@lumi.test', role: 'manager', active: true, phone: '+86 139 1024 5566', team: 'Merchandising', joinedAt: '2024-09-03', lastSignInAt: hoursAgo(26), lastSignInFrom: 'Safari · iOS', twoFactor: true, sessions: 2, passwordChangedAt: '2026-04-18' },
  { id: 3, ...userSettings, name: 'Sam Support', email: 'sam@lumi.test', role: 'support', active: true, phone: '+86 137 2048 7788', team: 'Customer support', joinedAt: '2025-05-20', lastSignInAt: hoursAgo(0.5), lastSignInFrom: 'Edge · Windows', twoFactor: false, sessions: 1, passwordChangedAt: '2025-12-09' },
]

const categories: Category[] = [
  { id: 1, name: 'Electronics', parentId: undefined, visible: true },
  { id: 2, name: 'Cameras', parentId: 1, visible: true },
  { id: 3, name: 'Audio', parentId: 1, visible: true },
  { id: 4, name: 'Home', parentId: undefined, visible: true },
  { id: 5, name: 'Kitchen', parentId: 4, visible: true },
  { id: 6, name: 'Lighting', parentId: 4, visible: false },
  { id: 7, name: 'Phones', parentId: 1, visible: true },
  { id: 8, name: 'Headphones', parentId: 3, visible: true },
  { id: 9, name: 'Speakers', parentId: 3, visible: true },
  { id: 10, name: 'Mirrorless', parentId: 2, visible: true },
  { id: 11, name: 'Action cameras', parentId: 2, visible: true },
  { id: 12, name: 'Cookware', parentId: 5, visible: true },
  { id: 13, name: 'Small appliances', parentId: 5, visible: true },
  { id: 14, name: 'Outdoor', parentId: undefined, visible: true },
  { id: 15, name: 'Camping', parentId: 14, visible: true },
  { id: 16, name: 'Cycling', parentId: 14, visible: true },
  { id: 17, name: 'Tents', parentId: 15, visible: true },
  { id: 18, name: 'Lanterns', parentId: 15, visible: true },
]

const customers: Customer[] = [
  { id: 1, name: 'Northwind Studio', email: 'ops@northwind.test', tier: 'enterprise', spent: 18240 },
  { id: 2, name: 'Blue Pine Retail', email: 'buy@bluepine.test', tier: 'gold', spent: 7840 },
  { id: 3, name: 'Orchid Supply', email: 'team@orchid.test', tier: 'standard', spent: 2180 },
  { id: 4, name: 'Harbor Lights Co', email: 'hello@harborlights.test', tier: 'gold', spent: 5320 },
  { id: 5, name: 'Cedar & Twine', email: 'orders@cedartwine.test', tier: 'standard', spent: 3410 },
  { id: 6, name: 'Vega Market', email: 'buy@vegamarket.test', tier: 'standard', spent: 1260 },
  { id: 7, name: 'Juniper Goods', email: 'hello@junipergoods.test', tier: 'standard', spent: 900 },
  { id: 8, name: 'Atlas Outfitters', email: 'hello@atlasoutfitters.test', tier: 'gold', spent: 1270 },
  { id: 9, name: 'Maple & Moss', email: 'hello@maplemoss.test', tier: 'standard', spent: 1640 },
  { id: 10, name: 'Riverstone Cafe', email: 'hello@riverstonecafe.test', tier: 'standard', spent: 2010 },
  { id: 11, name: 'Kestrel Labs', email: 'hello@kestrellabs.test', tier: 'gold', spent: 2380 },
  { id: 12, name: 'Paper Lantern', email: 'hello@paperlantern.test', tier: 'standard', spent: 2750 },
  { id: 13, name: 'Copperleaf Home', email: 'hello@copperleafhome.test', tier: 'standard', spent: 3120 },
  { id: 14, name: 'Saltmarsh Supply', email: 'hello@saltmarshsupply.test', tier: 'gold', spent: 3490 },
  { id: 15, name: 'Fernhill Florist', email: 'hello@fernhillflorist.test', tier: 'standard', spent: 3860 },
  { id: 16, name: 'Ironbark Tools', email: 'hello@ironbarktools.test', tier: 'standard', spent: 4230 },
  { id: 17, name: 'Lumen Optics', email: 'hello@lumenoptics.test', tier: 'gold', spent: 4600 },
  { id: 18, name: 'Marigold Bakery', email: 'hello@marigoldbakery.test', tier: 'standard', spent: 4970 },
  { id: 19, name: 'Quarry Studio', email: 'hello@quarrystudio.test', tier: 'standard', spent: 5340 },
  { id: 20, name: 'Silverline Travel', email: 'hello@silverlinetravel.test', tier: 'gold', spent: 5710 },
  { id: 21, name: 'Tidewater Books', email: 'hello@tidewaterbooks.test', tier: 'standard', spent: 6080 },
  { id: 22, name: 'Upland Coffee', email: 'hello@uplandcoffee.test', tier: 'standard', spent: 6450 },
  { id: 23, name: 'Wren & Co', email: 'hello@wrenco.test', tier: 'gold', spent: 6820 },
  { id: 24, name: 'Zephyr Cycles', email: 'hello@zephyrcycles.test', tier: 'standard', spent: 7190 },
]

let productSeq = 0
const products: Product[] = Array.from({ length: 32 }, () => {
  const id = ++productSeq
  return {
    id,
    name: `Lumi Product ${id}`,
    sku: `SKU-${String(id).padStart(4, '0')}`,
    // Every node of the category tree, leaves included, holds at least one product.
    categoryId: (id % categories.length) + 1,
    price: 24 + id * 3,
    status: id % 5 === 0 ? 'archived' : id % 2 === 0 ? 'active' : 'draft',
    images: [`/uploads/product-${id}.jpg`],
    content: `<p>Product ${id} rich content</p>`,
    updatedAt: new Date(MOCK_NOW - id * 3600000).toISOString(),
  }
})

// A pipeline is read for where the work piles up, so the stages must not be the
// same size: cycling five statuses evenly draws five identical segments.
const ORDER_STATUS_CYCLE = ['paid', 'paid', 'shipped', 'pending', 'paid', 'packed', 'shipped', 'paid', 'pending', 'shipped', 'packed', 'cancelled', 'paid']

const WAREHOUSES = ['Hangzhou', 'Shenzhen', 'Chengdu']
const CARRIERS = ['SF Express Standard', 'JD Logistics', 'ZTO Express']
const STREETS = ['478 Wensan Road, Xihu District, Hangzhou', '12 Keyuan South Road, Nanshan District, Shenzhen', '88 Tianfu Avenue, Gaoxin District, Chengdu', '201 Huaihai Middle Road, Huangpu District, Shanghai']
const CUSTOMER_NOTES = ['It is a gift — please leave the invoice out of the parcel.', 'Please call before delivery.']
const ORDER_DAYS = 180
// The day the trend chart has something to say about: a payment outage, so
// revenue drops while the store is otherwise busy.
const INCIDENT_DAY = 9
// Paid orders promise dispatch within a day. Only one warehouse is behind —
// it lost pickers this week — so its last two days of orders are still waiting
// while every other paid order older than the promise has gone out.
const SHIP_BY_HOURS = 24
const BACKLOG_WAREHOUSE = 'Chengdu'
const BACKLOG_UNTIL_HOURS = 48
const RECENT_REFUND_MAX_ID = 40
// Orders somebody pinned to keep an eye on, behind the list's Watching view.
const WATCHED_ORDER_IDS = new Set([3, 17, 29, 64, 112])
// Stand-ins for product photos: one flat colour per variant, served inline.
const ITEM_VARIANTS: [string, string][] = [['Oat, standard', '#cfc3b3'], ['Sand, large', '#e2d7b8'], ['Slate, standard', '#b8c2cc'], ['Sage, large', '#a9b49e']]
const itemImage = (color: string): string => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="${color}"/></svg>`)}`
/** More than one unit ships as two variants, so the detail page has real lines to list. */
function orderLines(id: number, product: Product, qty: number): OrderLine[] {
  const line = (offset: number, units: number): OrderLine => {
    const [variant, color] = ITEM_VARIANTS[(id + offset) % ITEM_VARIANTS.length]!
    return { sku: `${product.sku}-${offset + 1}`, name: product.name, variant, image: itemImage(color), qty: units }
  }
  return qty > 1 ? [line(0, 1), line(1, qty - 1)] : [line(0, 1)]
}

let orderSeq = 0
// Two of the longest periods of history, so every dashboard delta compares
// against real data.
// Ids run newest first: ORD-00001 is today's latest order.
const orders: Order[] = Array.from({ length: ORDER_DAYS }, (_, daysAgo) => {
  // The store grows: more orders a day, and more of the customer book buying.
  const growth = Math.floor((ORDER_DAYS - daysAgo) / 30)
  const count = 2 + ((daysAgo * 7) % 4) + growth
  const buyers = Math.min(customers.length, 12 + growth * 2)
  return Array.from({ length: count }, (_, slot) => {
    const id = ++orderSeq
    const cycled = daysAgo === INCIDENT_DAY && slot > 0 ? 'pending' : ORDER_STATUS_CYCLE[id % ORDER_STATUS_CYCLE.length]!
    const warehouse = WAREHOUSES[id % WAREHOUSES.length]!
    const customerId = (id % buyers) + 1
    const qty = (id % 3) + 1
    const product = products[id % 12]!
    const minutes = 22 * 60 - slot * 113 - ((id * 41) % 60)
    const createdAt = new Date(MOCK_NOW - daysAgo * 86400000).toISOString().slice(0, 10)
    const placedAt = `${createdAt}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    const customer = customers.find(entry => entry.id === customerId)!.name
    const ageHours = Math.floor((MOCK_NOW - Date.parse(`${placedAt}:00.000Z`)) / 3600000)
    // Every status stays inside the paid/packed/shipped set it started in, so
    // revenue is the same whichever of them an order ends up with.
    const backlogged = warehouse === BACKLOG_WAREHOUSE && ageHours < BACKLOG_UNTIL_HOURS
    const status = cycled === 'packed' && ageHours < SHIP_BY_HOURS
      ? 'paid'
      : cycled === 'paid' && ageHours >= SHIP_BY_HOURS && !backlogged
        ? 'shipped'
        : cycled
    return {
      id,
      number: `ORD-${String(id).padStart(5, '0')}`,
      customerId,
      customer,
      // The list's one search box matches either identifier.
      searchText: `ORD-${String(id).padStart(5, '0')} ${customer}`,
      status,
      // A paid order past the ship-by promise. Only the current backlog can be
      // late, so the count stays a short list somebody can act on.
      overdueHours: status === 'paid' && ageHours >= SHIP_BY_HOURS ? ageHours : null,
      // A few recent cancellations are still waiting on their money back.
      refunding: status === 'cancelled' && id <= RECENT_REFUND_MAX_ID,
      watched: WATCHED_ORDER_IDS.has(id),
      paymentMethod: ['wechat', 'alipay', 'unionpay', 'cod'][id % 4]!,
      warehouse,
      product: qty > 1 ? `${product.name} × ${qty}` : product.name,
      // Newer orders are larger, so the dashboard's rising delta and the chart
      // describe the same movement; the second term is day-to-day noise, so no
      // two columns read the same.
      total: 220 + (ORDER_DAYS - daysAgo) * 2 + ((id * 37) % 11) * 38,
      // Already taken off `total`, which stays what the customer paid.
      discount: (id % 3) * 20,
      items: JSON.stringify(orderLines(id, product, qty)),
      carrier: CARRIERS[id % CARRIERS.length]!,
      recipient: customer,
      phone: `138 **** ${String(1000 + ((id * 7919) % 9000))}`,
      address: `Suite ${100 + (id % 40)}, ${STREETS[id % STREETS.length]!}`,
      customerNote: id % 3 === 2 ? CUSTOMER_NOTES[id % CUSTOMER_NOTES.length]! : null,
      // Two thirds of the late backlog has a support follow-up on file.
      internalNote: id % 3 !== 0 ? 'Address confirmed by phone with the customer.' : null,
      // Date-only so the dateRange filter's gte/lte string compare works against
      // 'YYYY-MM-DD'; order 1 lands on today so the Today preset has data.
      createdAt,
      placedAt,
    }
  })
}).flat()

const articleCategories = ['Operations', 'Growth', 'Support', 'Finance', 'Security']
const articleAuthors = ['Ada Admin', 'Mina Manager', 'Sam Support', 'Yuki Lead', 'Theo Ops']
let articleSeq = 0
const articles: Article[] = Array.from({ length: 24 }, () => {
  const id = ++articleSeq
  const category = articleCategories[id % articleCategories.length]!
  return {
    id,
    title: `${category} playbook ${String(id).padStart(2, '0')}`,
    summary: `Operational guidance for ${category.toLowerCase()} workflows, ownership, review cadence, and measurable follow-up.`,
    category,
    author: articleAuthors[id % articleAuthors.length]!,
    tags: ['runbook', category.toLowerCase(), id % 2 === 0 ? 'weekly' : 'priority'].join(', '),
    status: id % 5 === 0 ? 'draft' : 'published',
    updatedAt: new Date(MOCK_NOW - id * 43200000).toISOString().slice(0, 10),
  }
})

const projectNames = [
  'Atlas rollout',
  'Mercury billing',
  'Orion support',
  'Nova catalog',
  'Cedar logistics',
  'Harbor launch',
  'Summit renewal',
  'Vertex insights',
  'Signal risk',
  'Prism onboarding',
  'Beacon workflow',
  'Copper audit',
  'Juniper migration',
  'Falcon shipment',
  'Quartz pricing',
  'Keystone access',
  'Lagoon service',
  'Nimbus campaign',
  'Pioneer data',
  'Ridge fulfillment',
  'Anchor customer',
  'Helix inventory',
  'Willow finance',
  'Cobalt training',
]
let projectSeq = 0
const projects: Project[] = projectNames.map((name) => {
  const id = ++projectSeq
  return {
    id,
    name,
    description: `${name} coordinates product, support, and finance teams for the current operating cycle.`,
    status: ['active', 'review', 'blocked', 'planned'][id % 4]!,
    owner: articleAuthors[id % articleAuthors.length]!,
    progress: 34 + (id * 7) % 61,
    budget: 18000 + id * 1250,
    dueAt: new Date(MOCK_NOW + id * 86400000).toISOString().slice(0, 10),
  }
})

let activitySeq = 0
const activities: Activity[] = Array.from({ length: 22 }, () => {
  const id = ++activitySeq
  return {
    id,
    title: ['Capacity review', 'Catalog approval', 'Customer escalation', 'Billing reconciliation', 'Access audit'][id % 5]!,
    actor: articleAuthors[id % articleAuthors.length]!,
    project: projectNames[id % projectNames.length]!,
    description: `${articleAuthors[id % articleAuthors.length]!} updated ${projectNames[id % projectNames.length]!} with a concrete next action.`,
    tone: ['info', 'success', 'warning'][id % 3]!,
    createdAt: new Date(MOCK_NOW - id * 1800000).toISOString(),
  }
})

// Scratch records for the JSON request/mutation showcase; nothing else reads them.
const notes: Note[] = [
  { id: 1, title: 'Review the Chengdu backlog', priority: 'high' },
  { id: 2, title: 'Confirm courier pickup times', priority: 'normal' },
  { id: 3, title: 'Archive last quarter drafts', priority: 'low' },
]

/** Cascading options for the JSON watch showcase. */
const REGIONS: Readonly<Record<string, readonly { value: string, label: string }[]>> = {
  cn: [{ value: 'shanghai', label: 'Shanghai' }, { value: 'chengdu', label: 'Chengdu' }, { value: 'shenzhen', label: 'Shenzhen' }],
  us: [{ value: 'new-york', label: 'New York' }, { value: 'austin', label: 'Austin' }],
  de: [{ value: 'berlin', label: 'Berlin' }, { value: 'munich', label: 'Munich' }, { value: 'hamburg', label: 'Hamburg' }],
}

/** Page Specs the backend serves; GET /pages/:name returns them verbatim. Add new files from `pages/` here. */
const PAGE_SPECS: Readonly<Record<string, unknown>> = {
  'order-queue': orderQueue,
}

// Board and calendar showcase. `rank` orders cards inside a status column;
// event times are local wall-clock values around MOCK_NOW.
const tasks: DynamicRow[] = [
  { id: 1, status: 'backlog', rank: 1024, title: 'Audit warehouse barcode labels', description: 'Shelf labels in Chengdu still use the old SKU format', tags: [{ label: 'Ops', tone: 'neutral' }], priority: 'low', dueDate: '2026-08-21' },
  { id: 2, status: 'backlog', rank: 2048, title: 'Draft Q4 courier contract', tags: [{ label: 'Finance', tone: 'info' }], assignee: { name: 'Mia Chen' }, priority: 'medium' },
  { id: 3, status: 'backlog', rank: 3072, title: 'Collect feedback on return flow', description: 'Interview five support agents about refund edge cases', tags: [{ label: 'Research', tone: 'neutral' }], priority: 'low' },
  { id: 4, status: 'todo', rank: 1024, title: 'Refresh product photos for autumn', tags: [{ label: 'Catalog', tone: 'success' }], assignee: { name: 'Leo Wang' }, priority: 'medium', dueDate: '2026-08-14' },
  { id: 5, status: 'todo', rank: 2048, title: 'Fix VAT rounding on invoices', description: 'Totals drift by one cent on orders with more than ten lines', tags: [{ label: 'Bug', tone: 'danger' }, { label: 'Finance', tone: 'info' }], assignee: { name: 'Ava Lin' }, priority: 'urgent', dueDate: '2026-08-08' },
  { id: 6, status: 'todo', rank: 3072, title: 'Plan the Shenzhen pop-up stock', assignee: { name: 'Noah Zhou' }, priority: 'high', dueDate: '2026-08-18' },
  { id: 7, status: 'doing', rank: 1024, title: 'Migrate payment webhooks', description: 'Move callbacks to the signed endpoint and retire the legacy route', tags: [{ label: 'Backend', tone: 'warning' }], assignee: { name: 'Ava Lin' }, priority: 'high', dueDate: '2026-08-12' },
  { id: 8, status: 'doing', rank: 2048, title: 'Rewrite onboarding emails', tags: [{ label: 'Content', tone: 'success' }], assignee: { name: 'Mia Chen' }, priority: 'medium', dueDate: '2026-08-09' },
  { id: 9, status: 'doing', rank: 3072, title: 'Reconcile July refunds', assignee: { name: 'Leo Wang' }, priority: 'medium', dueDate: '2026-08-11' },
  { id: 10, status: 'doing', rank: 4096, title: 'Tune low-stock alerts', tags: [{ label: 'Ops', tone: 'neutral' }], priority: 'low' },
  { id: 11, status: 'review', rank: 1024, title: 'Customer tier badges', description: 'Design and copy review before the release on Thursday', tags: [{ label: 'Design', tone: 'info' }], assignee: { name: 'Noah Zhou' }, priority: 'medium', dueDate: '2026-08-13' },
  { id: 12, status: 'done', rank: 1024, title: 'Ship order export to CSV', tags: [{ label: 'Backend', tone: 'warning' }], assignee: { name: 'Ava Lin' }, priority: 'high', dueDate: '2026-08-05' },
  { id: 13, status: 'done', rank: 2048, title: 'Archive June campaigns', assignee: { name: 'Mia Chen' }, priority: 'low', dueDate: '2026-08-03' },
]

const events: DynamicRow[] = [
  { id: 1, title: 'Weekly operations sync', start: '2026-08-10T09:30', end: '2026-08-10T10:30', tone: 'primary' },
  { id: 2, title: 'Courier contract call', start: '2026-08-10T10:00', end: '2026-08-10T11:00', tone: 'info' },
  { id: 3, title: 'Webhook cut-over', start: '2026-08-10T14:00', end: '2026-08-10T16:30', tone: 'warning' },
  { id: 4, title: 'Autumn catalog shoot', start: '2026-08-12', end: '2026-08-14', allDay: true, tone: 'success' },
  { id: 5, title: 'Design review', start: '2026-08-13T15:00', end: '2026-08-13T16:00', tone: 'info' },
  { id: 6, title: 'Payment provider maintenance', start: '2026-08-15T01:00', end: '2026-08-15T03:00', tone: 'danger' },
  { id: 7, title: 'Support team lunch', start: '2026-08-11T12:00', end: '2026-08-11T13:00', tone: 'neutral' },
  { id: 8, title: 'Month-end close', start: '2026-08-31', allDay: true, tone: 'warning' },
  { id: 9, title: 'Inventory count', start: '2026-08-10', allDay: true, tone: 'neutral' },
  { id: 10, title: 'Release planning', start: '2026-08-17T10:00', end: '2026-08-17T11:30', tone: 'primary' },
  { id: 11, title: 'Shenzhen pop-up', start: '2026-08-20', end: '2026-08-23', allDay: true, tone: 'success' },
  { id: 12, title: 'Quarterly business review', start: '2026-08-04T13:00', end: '2026-08-04T15:00', tone: 'primary' },
  { id: 13, title: 'Refund backlog sweep', start: '2026-08-10T16:00', end: '2026-08-10T17:00', tone: 'danger' },
]

roles[0]!.permissions.push(...actionPermissions(['tasks', 'events']))
roles[1]!.permissions.push(...actionPermissions(['tasks', 'events'], ['list', 'show', 'edit']))
roles[2]!.permissions.push('tasks:list', 'events:list')

const stores = {
  'tasks': { rows: tasks, nextId: tasks.length },
  'events': { rows: events, nextId: events.length },
  'notes': { rows: notes, nextId: notes.length },
  'activities': { rows: activities, nextId: activitySeq },
  'articles': { rows: articles, nextId: articleSeq },
  'categories': { rows: categories, nextId: categories.length },
  'customers': { rows: customers, nextId: customers.length },
  'orders': { rows: orders, nextId: orderSeq },
  'products': { rows: products, nextId: productSeq },
  'projects': { rows: projects, nextId: projectSeq },
  'roles': { rows: roles, nextId: roles.length },
  'users': { rows: users, nextId: users.length },
  // Written by the client's audit log provider after each accepted write; the
  // server adds who and when. Read by anyone who can list the resource.
  'audit-logs': { rows: [] as DynamicRow[], nextId: 0 },
}
// The same object as `stores`: resource routes treat every store alike, whatever the client sent.
const dynamicStores = stores as unknown as DynamicStores
const initialStores = structuredClone(dynamicStores)

function resetState(): void {
  sessions.clear()
  passwords.clear()
  resetAgent()
  uploadSeq = 0
  for (const [name, initial] of Object.entries(initialStores)) {
    dynamicStores[name]!.rows = structuredClone(initial.rows)
    dynamicStores[name]!.nextId = initial.nextId
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,Accept-Language,X-Tenant,X-XSRF-TOKEN',
}

/** The cookie session (`api.auth.mode: "cookie"`): the session and its anti-forgery token. */
const SESSION_COOKIE = 'lumi_session'
const CSRF_COOKIE = 'XSRF-TOKEN'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function readCookies(req: Request): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index > 0)
      cookies.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()))
  }
  return cookies
}

/** Sign-in answers also open a cookie session, for a client in cookie mode. */
function withSessionCookies(response: Response, token: string | undefined): Response {
  const lifetime = token ? '' : '; Max-Age=0'
  response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token ?? ''}; Path=/; HttpOnly; SameSite=Lax${lifetime}`)
  response.headers.append('Set-Cookie', `${CSRF_COOKIE}=${token ? `csrf-${token}` : ''}; Path=/; SameSite=Lax${lifetime}`)
  return response
}

function send(status: number, body?: unknown): Response {
  return new Response(body === undefined || status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

// Field errors are shown as sent, so the backend answers in the locale the client asks for.
const FIELD_ERROR_TEXT = {
  invalid: { en: 'Validation failed', zh: '校验未通过' },
  taken: { en: 'A note with this title already exists', zh: '已有同名笔记' },
  mismatch: { en: 'The passwords do not match', zh: '两次输入的密码不一致' },
  customerTaken: { en: 'A customer with this name already exists', zh: '已有同名客户' },
} as const
const CHINESE_RE = /^zh\b/i

function fieldErrors(req: Request, errors: Array<{ path: string, code: keyof typeof FIELD_ERROR_TEXT }>): unknown {
  const lang = CHINESE_RE.test(req.headers.get('accept-language') ?? '') ? 'zh' : 'en'
  return {
    message: FIELD_ERROR_TEXT.invalid[lang],
    code: 'invalid',
    errors: errors.map(error => ({ ...error, message: FIELD_ERROR_TEXT[error.code][lang] })),
  }
}

async function readBody(req: Request): Promise<JsonBody> {
  const raw = await req.text()
  try {
    return raw ? JSON.parse(raw) as JsonBody : {}
  }
  catch {
    return {}
  }
}

function parseUpload(bytes: Uint8Array, headers: Headers): Upload {
  const text = new TextDecoder('latin1').decode(bytes)
  const timestamp = MOCK_NOW + ++uploadSeq
  const filename = MULTIPART_FILENAME_RE.exec(text)?.[1] ?? `upload-${timestamp}`
  const type = MULTIPART_TYPE_RE.exec(text)?.[1] ?? 'application/octet-stream'
  const safeName = filename.replace(SAFE_FILENAME_RE, '-')
  return {
    url: `/uploads/${timestamp}-${safeName}`,
    name: filename,
    size: bytes.length,
    type,
    field: MULTIPART_FIELD_RE.exec(text)?.[1] ?? 'file',
    contentType: headers.get('content-type') ?? undefined,
  }
}

function normalizeValue(value: string): FilterValue {
  if (value === 'true')
    return true
  if (value === 'false')
    return false
  if (value !== '' && !Number.isNaN(Number(value)))
    return Number(value)
  return value
}

function currentUser(req: Request): User | undefined {
  const token = currentToken(req)
  return token ? sessions.get(token) : undefined
}

/**
 * The bearer token, else the session cookie. A write signed only by the
 * cookie must echo the anti-forgery cookie in `X-XSRF-TOKEN`.
 */
function currentToken(req: Request): string | undefined {
  const bearer = req.headers.get('authorization')?.replace(BEARER_RE, '')
  if (bearer)
    return bearer
  const cookies = readCookies(req)
  const session = cookies.get(SESSION_COOKIE)
  if (!session)
    return undefined
  if (!SAFE_METHODS.has(req.method) && req.headers.get('x-xsrf-token') !== cookies.get(CSRF_COOKIE))
    return undefined
  return session
}

function permissionsFor(user: User | undefined): string[] {
  return roles.find(role => role.code === user?.role)?.permissions ?? []
}

function canAccess(user: User, resource: string, action: string): boolean {
  const permissions = permissionsFor(user)
  return permissions.includes(`${resource}:${action}`) || permissions.includes(`${resource}:*`) || permissions.includes('*:*')
}

function actionForRequest(req: Request, id: number | undefined): string | undefined {
  if (req.method === 'GET')
    return id === undefined ? 'list' : 'show'
  if (req.method === 'POST' && id === undefined)
    return 'create'
  if (req.method === 'PUT' && id !== undefined)
    return 'edit'
  if (req.method === 'DELETE' && id !== undefined)
    return 'delete'
  return undefined
}

/** Row fields are compared with JavaScript's own coercion, whatever a client stored in them. */
function fieldOf(row: object, field: string): FilterValue {
  return (row as Record<string, unknown>)[field] as FilterValue
}

function listRows<Row extends { id: number }>(store: Store<Row>, query: URLSearchParams): ListResult<Row> {
  let rows = store.rows.slice()
  const ids = query.getAll('ids[]').map(Number).filter(Number.isFinite)
  if (ids.length)
    rows = rows.filter(row => ids.includes(Number(row.id)))

  const appliedKeys = new Set<string>()
  for (const [key, raw] of query.entries()) {
    const filterKey = key.endsWith('[]') ? key.slice(0, -2) : key
    if (appliedKeys.has(filterKey))
      continue
    appliedKeys.add(filterKey)
    if (['page', 'pageSize', 'ids[]', 'sort'].includes(key))
      continue
    if (raw === '')
      continue
    const bracketed = FILTER_KEY_RE.exec(filterKey)
    const field = bracketed?.[1] ?? filterKey
    const op = bracketed?.[2] ?? 'eq'
    if (!rows.some(row => Object.hasOwn(row, field)))
      continue
    const expected = normalizeValue(raw)
    rows = rows.filter((row) => {
      const current = fieldOf(row, field)
      if (op === 'like')
        return String(current ?? '').toLowerCase().includes(String(raw).toLowerCase())
      if (op === 'nlike')
        return !String(current ?? '').toLowerCase().includes(String(raw).toLowerCase())
      if (op === 'in')
        return query.getAll(key).map(normalizeValue).includes(current)
      if (op === 'nin')
        return !query.getAll(key).map(normalizeValue).includes(current)
      if (op === 'between') {
        const [start, end] = query.getAll(key).map(normalizeValue)
        return current >= start! && current <= end!
      }
      if (op === 'null')
        return current === null || current === undefined
      if (op === 'nnull')
        return current !== null && current !== undefined
      if (op === 'ne')
        return current !== expected
      if (op === 'lt')
        return current < expected
      if (op === 'gte')
        return current >= expected
      if (op === 'lte')
        return current <= expected
      if (op === 'gt')
        return current > expected
      return current === expected
    })
  }

  const sorters = (query.get('sort') ?? '').split(',').flatMap((value) => {
    // `-field` sorts descending.
    const name = value.trim()
    const field = name.startsWith('-') ? name.slice(1) : name
    return field && rows.some(row => Object.hasOwn(row, field))
      ? [{ field, order: name.startsWith('-') ? 'desc' : 'asc' }]
      : []
  })
  if (sorters.length) {
    rows.sort((left, right) => {
      for (const sorter of sorters) {
        const leftValue = fieldOf(left, sorter.field)
        const rightValue = fieldOf(right, sorter.field)
        const result = leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0
        if (result)
          return result * (sorter.order === 'asc' ? 1 : -1)
      }
      return 0
    })
  }

  const total = rows.length
  const page = Number(query.get('page')) || 1
  const pageSize = Number(query.get('pageSize')) || 10
  const data = rows.slice((page - 1) * pageSize, page * pageSize)
  return { data, meta: { total, page, pageSize } }
}

function dashboard(user: User, days = 28): Dashboard {
  const day = 86400000
  const end = new Date(MOCK_NOW).toISOString().slice(0, 10)
  const start = new Date(MOCK_NOW - (days - 1) * day).toISOString().slice(0, 10)
  const priorStart = new Date(MOCK_NOW - (days * 2 - 1) * day).toISOString().slice(0, 10)
  const current = orders.filter(order => order.createdAt >= start && order.createdAt <= end)
  const prior = orders.filter(order => order.createdAt >= priorStart && order.createdAt < start)
  const paid = (rows: Order[]): Order[] => rows.filter(order => ['paid', 'packed', 'shipped'].includes(order.status))
  const revenue = (rows: Order[]): number => paid(rows).reduce((sum, order) => sum + order.total, 0)
  const active = (rows: Order[]): number => new Set(rows.map(order => order.customerId)).size
  const change = (value: number, previous: number): number | null => previous ? Math.round((value - previous) / previous * 1000) / 10 : null
  const revenueRows = Array.from({ length: days }, (_, index) => {
    const date = new Date(MOCK_NOW - (days - 1 - index) * day).toISOString().slice(0, 10)
    const placed = current.filter(order => order.createdAt === date)
    return { date, revenue: revenue(placed), orders: placed.length }
  })
  return {
    data: {
      period: { days, start, end },
      totals: { products: products.length, orders: current.length, customers: active(current), revenue: revenue(current) },
      deltas: { revenue: change(revenue(current), revenue(prior)), orders: change(current.length, prior.length), customers: change(active(current), active(prior)) },
      permissions: permissionsFor(user),
      charts: {
        revenue: revenueRows,
        annotations: INCIDENT_DAY < days
          ? [{ date: new Date(MOCK_NOW - INCIDENT_DAY * day).toISOString().slice(0, 10), note: 'Payment callback outage' }]
          : [],
        status: ['pending', 'paid', 'packed', 'shipped', 'cancelled'].map(status => ({ status, count: current.filter(order => order.status === status).length })),
        products: ['draft', 'active', 'archived'].map(status => ({ status, count: products.filter(product => product.status === status).length })),
      },
      recent: {
        // Late orders lead, so the ones the Agent flags are the ones in view;
        // the newest orders fill the rest.
        orders: [...current].sort((a, b) => (b.overdueHours ?? 0) - (a.overdueHours ?? 0) || b.placedAt.localeCompare(a.placedAt)).slice(0, 6).map(order => ({
          id: order.id,
          number: order.number,
          customer: order.customer,
          product: order.product,
          warehouse: order.warehouse,
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
          placedAt: order.placedAt,
          overdueHours: order.overdueHours,
        })),
        products: products.slice(0, 8).map(product => ({
          name: product.name,
          sku: product.sku,
          status: product.status,
          price: product.price,
        })),
      },
      rankings: {
        payments: ['wechat', 'alipay', 'unionpay', 'cod'].map(method => ({
          method,
          count: current.filter(order => order.paymentMethod === method).length,
          revenue: revenue(current.filter(order => order.paymentMethod === method)),
        })),
        customers: customers.map(customer => ({
          name: customer.name,
          tier: customer.tier,
          orders: current.filter(order => order.customerId === customer.id).length,
          spent: revenue(current.filter(order => order.customerId === customer.id)),
        })).sort((a, b) => b.spent - a.spent),
      },
    },
  }
}

/** The order queue at a glance. Deliberately ignores list filters: these are the work, not the view. */
function orderStats(): OrderStats {
  const rows = stores.orders.rows
  const today = new Date(MOCK_NOW).toISOString().slice(0, 10)
  const windowStart = new Date(MOCK_NOW - 27 * 86400000).toISOString().slice(0, 10)
  return {
    total: rows.length,
    last28Days: rows.filter(order => order.createdAt >= windowStart && order.createdAt <= today).length,
    awaitingPayment: rows.filter(order => order.status === 'pending').length,
    toShip: rows.filter(order => order.status === 'paid').length,
    overdue: rows.filter(order => (order.overdueHours ?? 0) >= 1).length,
    refunding: rows.filter(order => order.refunding === true).length,
    watching: rows.filter(order => order.watched === true).length,
    todayRevenue: rows
      .filter(order => order.createdAt === today && ['paid', 'packed', 'shipped'].includes(order.status))
      .reduce((sum, order) => sum + order.total, 0),
  }
}

/** Eight cumulative four-hour checkpoints over the currently matched catalog. */
function catalogSeries(rows: Product[], valueOf: (product: Product) => number): number[] {
  const step = 4 * 60 * 60 * 1000
  return Array.from({ length: 8 }, (_, index) => {
    const cutoff = MOCK_NOW - (7 - index) * step
    return rows.reduce((total, product) => {
      const parsed = Date.parse(product.updatedAt)
      const updatedAt = Number.isFinite(parsed) ? parsed : MOCK_NOW
      return updatedAt <= cutoff ? total + valueOf(product) : total
    }, 0)
  })
}

/**
 * Lookup resources behind the remote choice controls (async-select page):
 * a province → city → district tree, a long member directory with avatars
 * and a swatch catalogue with thumbnails. Read-only, so no permissions.
 */
interface Region { id: number, name: string, parentId: number, level: 'province' | 'city' | 'district' }
const REGION_TREE: Record<string, Record<string, string[]>> = {
  Zhejiang: { Hangzhou: ['Xihu District', 'Shangcheng District', 'Binjiang District', 'Yuhang District'], Ningbo: ['Haishu District', 'Yinzhou District'], Wenzhou: ['Lucheng District', 'Ouhai District'] },
  Guangdong: { Guangzhou: ['Tianhe District', 'Yuexiu District', 'Haizhu District'], Shenzhen: ['Nanshan District', 'Futian District', 'Bao\'an District', 'Longgang District'], Foshan: ['Chancheng District', 'Shunde District'] },
  Sichuan: { Chengdu: ['Wuhou District', 'Jinjiang District', 'Qingyang District', 'Chenghua District'], Mianyang: ['Fucheng District', 'Youxian District'] },
  Jiangsu: { Nanjing: ['Xuanwu District', 'Gulou District', 'Jianye District'], Suzhou: ['Gusu District', 'Wuzhong District', 'Huqiu District'] },
  Beijing: { Beijing: ['Chaoyang District', 'Haidian District', 'Dongcheng District', 'Xicheng District'] },
  Shanghai: { Shanghai: ['Pudong New Area', 'Huangpu District', 'Xuhui District', 'Jing\'an District'] },
}
const lookupRegions: Region[] = []
for (const [province, cities] of Object.entries(REGION_TREE)) {
  const provinceId = lookupRegions.push({ id: lookupRegions.length + 1, name: province, parentId: 0, level: 'province' })
  for (const [city, districts] of Object.entries(cities)) {
    const cityId = lookupRegions.push({ id: lookupRegions.length + 1, name: city, parentId: provinceId, level: 'city' })
    for (const district of districts)
      lookupRegions.push({ id: lookupRegions.length + 1, name: district, parentId: cityId, level: 'district' })
  }
}
const MEMBER_FIRST = ['Ada', 'Mina', 'Sam', 'Yuki', 'Theo', 'Lina', 'Omar', 'Iris', 'Kai', 'Nora', 'Leo', 'Maya']
const MEMBER_LAST = ['Chen', 'Lopez', 'Okafor', 'Tanaka', 'Novak', 'Haddad']
const MEMBER_ROLES = ['Operations lead', 'Support agent', 'Warehouse manager', 'Finance analyst', 'Product designer', 'Buyer']
const lookupMembers = Array.from({ length: MEMBER_FIRST.length * MEMBER_LAST.length }, (_, index) => ({
  first: MEMBER_FIRST[index % MEMBER_FIRST.length]!,
  last: MEMBER_LAST[(index % MEMBER_FIRST.length + Math.floor(index / MEMBER_FIRST.length)) % MEMBER_LAST.length]!,
})).map(({ first, last }, index) => ({
  id: index + 1,
  name: `${first} ${last}`,
  email: `${first}.${last}@lumi.test`.toLowerCase(),
  role: MEMBER_ROLES[index % MEMBER_ROLES.length]!,
  team: ['Hangzhou', 'Shenzhen', 'Chengdu'][index % 3]!,
  avatar: '',
}))
const SWATCH_COLORS: [string, string][] = [['Oat', '#cfc3b3'], ['Sand', '#e2d7b8'], ['Slate', '#b8c2cc'], ['Sage', '#a9b49e'], ['Clay', '#c9a08a'], ['Ink', '#5b6474']]
const lookupSwatches = ['Linen throw', 'Wool cushion', 'Cotton rug', 'Ceramic vase', 'Oak tray', 'Glass lamp'].flatMap(product => SWATCH_COLORS.map(([color, hex]) => ({ product, color, hex }))).map(({ product, color, hex }, index) => ({
  id: index + 1,
  name: `${product}, ${color.toLowerCase()}`,
  sku: `SW-${String(index + 1).padStart(3, '0')}`,
  image: itemImage(hex),
}))
const lookupStores: Record<string, Store<{ id: number }>> = {
  regions: { rows: lookupRegions, nextId: lookupRegions.length },
  members: { rows: lookupMembers, nextId: lookupMembers.length },
  swatches: { rows: lookupSwatches, nextId: lookupSwatches.length },
}

// Readers listening on `/live`: every change a request makes reaches them as
// `{ channel: 'resources/<name>', type, payload: { ids } }`, so their lists refetch.
const liveClients = new Set<ReadableStreamDefaultController<Uint8Array>>()
const LIVE_KEEPALIVE_MS = 15_000
const encoder = new TextEncoder()

function broadcast(resource: string, type: 'created' | 'updated' | 'deleted', ids: Array<string | number>): void {
  const frame = encoder.encode(`data: ${JSON.stringify({ channel: `resources/${resource}`, type, payload: { ids }, date: new Date().toISOString() })}\n\n`)
  for (const client of liveClients) {
    try {
      client.enqueue(frame)
    }
    catch {
      liveClients.delete(client)
    }
  }
}

/** `GET /live`: an event stream that stays open until the reader aborts or cancels it. */
function liveStream(req: Request): Response {
  let keepalive: ReturnType<typeof setInterval> | undefined
  let own: ReadableStreamDefaultController<Uint8Array> | undefined
  const stop = (): void => {
    clearInterval(keepalive)
    if (own)
      liveClients.delete(own)
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      own = controller
      controller.enqueue(encoder.encode(': connected\n\n'))
      liveClients.add(controller)
      keepalive = setInterval(() => controller.enqueue(encoder.encode(': keep-alive\n\n')), LIVE_KEEPALIVE_MS)
      req.signal.addEventListener('abort', () => {
        stop()
        try {
          controller.close()
        }
        catch {}
      }, { once: true })
    },
    cancel: stop,
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' } })
}

/**
 * Answers one request against the in-memory demo backend. A browser request
 * names its origin, which is echoed with credentials allowed, so a cookie
 * session works from another port.
 */
export async function handleMockRequest(req: Request): Promise<Response> {
  const response = await answer(req)
  const origin = req.headers.get('origin')
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.append('Vary', 'Origin')
  }
  return response
}

async function answer(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS')
    return send(204)

  const url = new URL(req.url)
  if (url.pathname === '/health')
    return send(200, { ok: true })
  if (url.pathname === '/live' && req.method === 'GET')
    return liveStream(req)
  // Stands in for another reader or a backend job changing data: `{ resource, type, ids }`.
  if (url.pathname === '/__live' && req.method === 'POST') {
    const body = (await readBody(req) ?? {}) as { resource?: string, type?: 'created' | 'updated' | 'deleted', ids?: number[], patch?: Record<string, unknown> }
    const store = dynamicStores[String(body.resource)]
    if (store && body.type === 'updated' && body.patch && body.ids?.length) {
      for (const row of store.rows) {
        if (body.ids.includes(row.id))
          Object.assign(row, body.patch)
      }
    }
    broadcast(String(body.resource), body.type ?? 'updated', body.ids ?? [])
    return send(200, { ok: true, listeners: liveClients.size })
  }
  if (url.pathname === '/__reset' && req.method === 'POST') {
    resetState()
    return send(200, { ok: true, now: new Date(MOCK_NOW).toISOString() })
  }

  if (url.pathname === '/login' && req.method === 'POST') {
    const body = await readBody(req)
    const user = stores.users.rows.find(item => item.role === body?.username || item.email === body?.username)
    // Every demo account shares the password `admin` until it sets its own.
    if (!user || body?.password !== (passwords.get(user.email) ?? 'admin'))
      return send(401, { message: 'Incorrect username or password' })
    const token = `lumi-admin-${user.role}`
    sessions.set(token, user)
    return withSessionCookies(send(200, { data: { token, user, permissions: permissionsFor(user) } }), token)
  }

  // Sign-up creates a support account and signs it in, the way login answers.
  if (url.pathname === '/register' && req.method === 'POST') {
    const body = await readBody(req) as { name?: string, email?: string, password?: string } | undefined
    const email = body?.email?.trim().toLowerCase()
    if (!body?.name?.trim() || !email || !body.password || body.password.length < 8)
      return send(422, { message: 'Enter a name, an email and a password of at least 8 characters' })
    if (stores.users.rows.some(item => item.email === email))
      return send(409, { message: 'An account already uses this email' })
    const created: User = { ...structuredClone(users[2]!), id: ++stores.users.nextId, name: body.name.trim(), email, role: 'support', joinedAt: new Date(MOCK_NOW).toISOString().slice(0, 10), lastSignInAt: new Date(MOCK_NOW).toISOString(), sessions: 1, twoFactor: false }
    stores.users.rows.push(created)
    passwords.set(email, body.password)
    const token = `lumi-admin-user-${created.id}`
    sessions.set(token, created)
    return send(201, { data: { token, user: created, permissions: permissionsFor(created) } })
  }

  // The answer is the same whether or not the address has an account. The demo
  // has no mail: its link carries `reset-<email>` as the token.
  if (url.pathname === '/forgot-password' && req.method === 'POST') {
    const body = await readBody(req) as { email?: string } | undefined
    if (!body?.email?.includes('@'))
      return send(422, { message: 'Enter a valid email address' })
    return send(200, { data: { success: true } })
  }

  if (url.pathname === '/reset-password' && req.method === 'POST') {
    const body = await readBody(req) as { token?: string, password?: string } | undefined
    const email = body?.token?.startsWith('reset-') ? body.token.slice('reset-'.length) : undefined
    if (!email || !stores.users.rows.some(item => item.email === email))
      return send(400, { message: 'This reset link has expired. Ask for a new one' })
    if (!body?.password || body.password.length < 8)
      return send(422, { message: 'Use at least 8 characters' })
    passwords.set(email, body.password)
    return send(200, { data: { success: true } })
  }

  const user = currentUser(req)
  if (!user)
    return send(401, { message: 'unauthorized' })

  if (url.pathname === '/logout' && req.method === 'POST') {
    const token = currentToken(req)
    if (token)
      sessions.delete(token)
    return withSessionCookies(send(200, { data: { success: true } }), undefined)
  }

  if (url.pathname === '/me')
    return send(200, { data: { user: stores.users.rows.find(record => record.id === user.id) ?? user, permissions: permissionsFor(user) } })

  if (url.pathname === '/dashboard')
    return send(200, dashboard(user, [7, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 28))

  if (url.pathname === '/upload' && req.method === 'POST') {
    const raw = new Uint8Array(await req.arrayBuffer())
    // Showcase switches: a slow upload exposes progress and cancel; fail returns a server rejection.
    if (url.searchParams.get('fail') === '1')
      return send(413, { message: 'File exceeds the 1 MB server limit' })
    if (url.searchParams.get('slow') === '1')
      await sleep(2000)
    return send(201, { data: parseUpload(raw, req.headers) })
  }

  if (url.pathname === '/products/aggregate' && req.method === 'GET') {
    if (!canAccess(user, 'products', 'list'))
      return send(403, { message: 'forbidden' })
    const filtered = listRows(stores.products, new URLSearchParams([...url.searchParams, ['page', '1'], ['pageSize', String(stores.products.rows.length || 1)]]))
    const productsSeries = catalogSeries(filtered.data, () => 1)
    const activeSeries = catalogSeries(filtered.data, product => product.status === 'active' ? 1 : 0)
    const draftSeries = catalogSeries(filtered.data, product => product.status === 'draft' ? 1 : 0)
    const valueSeries = catalogSeries(filtered.data, product => product.price)
    return send(200, {
      data: {
        products: filtered.meta.total,
        active: filtered.data.filter(product => product.status === 'active').length,
        draft: filtered.data.filter(product => product.status === 'draft').length,
        archived: filtered.data.filter(product => product.status === 'archived').length,
        value: filtered.data.reduce((sum, product) => sum + product.price, 0),
        productsSeries,
        activeSeries,
        draftSeries,
        valueSeries,
      },
    })
  }

  if (url.pathname.startsWith('/pages/') && req.method === 'GET') {
    const spec = PAGE_SPECS[url.pathname.slice('/pages/'.length)]
    return spec ? send(200, spec) : send(404, { message: 'page not found' })
  }

  if (url.pathname === '/regions' && req.method === 'GET' && url.searchParams.has('country'))
    return send(200, { data: REGIONS[url.searchParams.get('country') ?? ''] ?? [] })

  const [lookupName, lookupId] = url.pathname.split('/').filter(Boolean)
  const lookup = lookupName ? lookupStores[lookupName] : undefined
  if (lookup && req.method === 'GET') {
    // A short latency so the loading, searching and load-more states can be seen.
    await sleep(250)
    if (lookupId === undefined)
      return send(200, listRows(lookup, url.searchParams))
    const row = lookup.rows.find(item => item.id === Number(lookupId))
    return row ? send(200, { data: row }) : send(404, { message: `${lookupName} not found` })
  }

  if (url.pathname === '/orders/stats' && req.method === 'GET') {
    if (!canAccess(user, 'orders', 'list'))
      return send(403, { message: 'forbidden' })
    return send(200, { data: orderStats() })
  }

  if (url.pathname === '/agent/chat' && req.method === 'POST')
    return handleAgentChat(req, await readBody(req) ?? {})
  if (req.method === 'GET') {
    const sessionsReply = handleAgentSessions(url, send)
    if (sessionsReply)
      return sessionsReply
  }

  if (url.pathname === '/audit-logs') {
    const log = dynamicStores['audit-logs']!
    if (req.method === 'POST') {
      const body = await readBody(req) ?? {}
      if (!user || typeof body.resource !== 'string' || !canAccess(user, body.resource, 'list'))
        return send(403, { message: 'forbidden' })
      const id = ++log.nextId
      // A fixed clock keeps screenshots stable; each entry a minute later.
      const row = { ...body, id, author: { id: user.id, name: user.name }, createdAt: new Date(MOCK_NOW + id * 60_000).toISOString() }
      log.rows.push(row)
      return send(201, { data: row })
    }
    if (req.method === 'GET') {
      const target = url.searchParams.get('resource')
      if (!target || !canAccess(user, target, 'list'))
        return send(403, { message: 'forbidden' })
      // Matched here, as text: the generic filters read "11" as a number.
      const record = url.searchParams.get('recordId')
      const query = new URLSearchParams(url.searchParams)
      query.delete('resource')
      query.delete('recordId')
      const rows = log.rows.filter(row => row.resource === target && (record === null || row.recordId === record))
      return send(200, listRows({ rows, nextId: log.nextId }, query))
    }
  }

  const [resource, idRaw] = url.pathname.split('/').filter(Boolean)
  const store = resource ? dynamicStores[resource] : undefined
  const id = idRaw ? Number(idRaw) : undefined

  if (!store || !resource)
    return send(404, { message: 'not found' })
  const action = actionForRequest(req, id)
  if (action && !canAccess(user, resource, action))
    return send(403, { message: 'forbidden' })
  if (url.searchParams.get('__forbidden') === '1')
    return send(403, { message: 'forbidden', code: 'forbidden' })
  if (url.searchParams.get('__error') === '1')
    return send(500, { message: 'forced list error' })
  if (url.searchParams.get('__offline') === '1')
    return send(503, { message: 'service offline' })
  if (url.searchParams.get('__timeout') === '1')
    return send(504, { message: 'request timed out' })
  if (url.searchParams.get('__delay') === '1')
    await sleep(800)

  if (id === undefined) {
    if (req.method === 'GET')
      return send(200, url.searchParams.get('__empty') === '1' ? { data: [], meta: { total: 0, page: 1, pageSize: 10 } } : listRows(store, url.searchParams))
    if (req.method === 'POST') {
      const body = await readBody(req)
      if (body?.name === 'SERVER_ERROR' || body?.number === 'SERVER_ERROR' || body?.title === 'SERVER_ERROR')
        return send(422, { message: 'server rejected record' })
      // Structured field errors: the contract Lumi maps onto form fields.
      if (resource === 'notes' && store.rows.some(row => row.title === body?.title))
        return send(422, fieldErrors(req, [{ path: 'title', code: 'taken' }]))
      if (resource === 'customers' && store.rows.some(row => row.name === body?.name))
        return send(422, fieldErrors(req, [{ path: 'name', code: 'customerTaken' }]))
      const now = new Date(MOCK_NOW).toISOString()
      const row = { ...body, id: ++store.nextId, createdAt: now, updatedAt: now }
      store.rows.push(row)
      broadcast(resource, 'created', [row.id])
      return send(201, { data: row })
    }
    return send(405, { message: 'method not allowed' })
  }

  const idx = store.rows.findIndex(row => row.id === id)
  if (idx === -1)
    return send(404, { message: `${resource} not found` })

  if (req.method === 'GET')
    return send(200, { data: store.rows[idx] })
  if (req.method === 'PUT') {
    let body = await readBody(req)
    // Password changes are checked across fields on the server and never stored on the record.
    if (resource === 'users' && body && 'newPassword' in body) {
      const { currentPassword: _current, newPassword, confirmPassword, ...rest } = body
      if (newPassword !== confirmPassword)
        return send(422, fieldErrors(req, [{ path: 'confirmPassword', code: 'mismatch' }]))
      body = { ...rest, passwordChangedAt: new Date(MOCK_NOW).toISOString().slice(0, 10) }
    }
    if (resource === 'customers' && store.rows.some(row => row.id !== id && row.name === body?.name))
      return send(422, fieldErrors(req, [{ path: 'name', code: 'customerTaken' }]))
    store.rows[idx] = { ...store.rows[idx], ...body, id, updatedAt: new Date(MOCK_NOW).toISOString() }
    broadcast(resource, 'updated', [id])
    return send(200, { data: store.rows[idx] })
  }
  if (req.method === 'DELETE') {
    store.rows.splice(idx, 1)
    broadcast(resource, 'deleted', [id])
    return send(200, { data: { id } })
  }
  return send(405, { message: 'method not allowed' })
}
