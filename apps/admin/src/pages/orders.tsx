import type { TableProps, TimelineProps, Tone } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useList, useOne, useTranslate } from '@duxweb/lumi'
import { LumiDetailPage, useAdminDrawer } from '@duxweb/lumi-admin'
import { LumiAvatar as Avatar, LumiBadge as Badge, LumiButton as Button, LumiDescriptionList as DescriptionList, LumiFragment as Fragment } from '@duxweb/lumi-ui'
import { useParams } from 'react-router'
import { currencyExact } from '../shared.js'

interface OrderLine {
  sku: string
  name?: string
  variant?: string
  image?: string
  qty: number
}

interface OrderRecord {
  id: number
  number: string
  customer: string
  customerId: number
  status: 'pending' | 'paid' | 'packed' | 'shipped' | 'cancelled'
  paymentMethod: string
  warehouse: string
  carrier: string
  total: number
  discount: number
  items: string
  createdAt: string
  placedAt: string
  overdueHours: number | null
  recipient: string
  phone: string
  address: string
  customerNote: string | null
  internalNote: string | null
}

interface CustomerRecord {
  id: number
  name: string
  tier: string
  spent: number
}

const ORDER_TONES: Record<OrderRecord['status'], Tone> = { pending: 'neutral', paid: 'info', packed: 'neutral', shipped: 'success', cancelled: 'danger' }
const ORDER_LABELS: Record<OrderRecord['status'], string> = { pending: 'Unpaid', paid: 'To ship', packed: 'Packed', shipped: 'Shipped', cancelled: 'Cancelled' }
const PAYMENT_LABELS: Record<string, string> = { wechat: 'WeChat Pay', alipay: 'Alipay', unionpay: 'Card', cod: 'Cash on delivery' }
const TIER_LABELS: Record<string, string> = { enterprise: 'Enterprise account', gold: 'Gold member', standard: 'Standard member' }

function parseLines(raw: string | undefined): OrderLine[] {
  if (!raw)
    return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as OrderLine[] : []
  }
  catch {
    return []
  }
}

/** `2026-08-09T06:19` → `08/09 06:19`, the stamp every list in the demo uses. */
const stamp = (value: string): string => `${value.slice(5, 7)}/${value.slice(8, 10)} ${value.slice(11, 16)}`
function shift(value: string, minutes: number): string {
  const at = new Date(Date.parse(`${value}:00.000Z`) + minutes * 60000).toISOString()
  return at.slice(0, 16)
}
function ordinal(value: number): string {
  const tail = value % 100 >= 11 && value % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'
  return `${value}${tail}`
}

/**
 * The design draft's order record: the four figures a picker needs as a band,
 * line items with the invoice under the money column, who and where to ship,
 * and what has happened to the order in the 320px column.
 */
export function AdminOrderDetailRoute(): ReactElement {
  const t = useTranslate()
  const { id } = useParams()
  const drawer = useAdminDrawer()
  const query = useOne<OrderRecord>({ resource: 'orders', id })
  const order = query.data?.data
  const customer = useOne<CustomerRecord>({ resource: 'customers', id: order?.customerId, enabled: order !== undefined }).data?.data
  // Everything this customer has bought, and the order before this one.
  const history = useList<OrderRecord>({
    resource: 'orders',
    pagination: { page: 1, pageSize: 1 },
    filters: order ? [{ field: 'customerId', operator: 'eq', value: order.customerId }, { field: 'id', operator: 'gte', value: order.id + 1 }] : [],
    enabled: order !== undefined,
  }).data
  const lifetime = useList<OrderRecord>({
    resource: 'orders',
    pagination: { page: 1, pageSize: 1 },
    filters: order ? [{ field: 'customerId', operator: 'eq', value: order.customerId }] : [],
    enabled: order !== undefined,
  }).data
  const lines = parseLines(order?.items)
  const units = lines.reduce((sum, line) => sum + line.qty, 0) || 1
  // The stored total is what was paid; the demo derives a unit price from it so
  // the summary adds up to the number the list column shows.
  const discount = order?.discount ?? 0
  const subtotal = (order?.total ?? 0) + discount
  const unit = subtotal / units
  const overdue = order?.overdueHours ? order.overdueHours : undefined
  const tierLabel = customer ? t(TIER_LABELS[customer.tier] ?? customer.tier) : t('Customer')
  const payment = order ? t(PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod) : ''
  const table: TableProps = {
    rowKey: 'sku',
    columns: [
      { field: 'name', label: t('Product'), kind: 'entity', imageField: 'image', descriptionField: 'variant' },
      { field: 'unit', label: t('Unit price'), width: '120px', kind: 'currency', currency: 'USD' },
      { field: 'qty', label: t('Qty'), width: '72px', align: 'right' },
      { field: 'amount', label: t('Subtotal'), width: '120px', kind: 'currency', currency: 'USD' },
    ],
    rows: lines.map(line => ({ sku: line.sku, name: line.name ?? line.sku, variant: line.variant ?? line.sku, image: line.image, qty: line.qty, unit, amount: unit * line.qty })),
  }
  const events = order
    ? [
        ...(overdue ? [{ key: 'flagged', title: t('Agent flagged it as overdue'), timestamp: stamp(shift(order.placedAt, overdue * 60)), tone: 'primary' as const }] : []),
        ...(overdue ? [{ key: 'reminded', title: t('Warehouse has not picked it, reminder sent'), timestamp: stamp(shift(order.placedAt, 24 * 60)), tone: 'warning' as const }] : []),
        ...(order.internalNote ? [{ key: 'note', title: t('Support added an internal note'), timestamp: stamp(shift(order.placedAt, 14 * 60)), tone: 'neutral' as const }] : []),
        ...(order.status === 'shipped' ? [{ key: 'shipped', title: t('Shipped with {carrier}', { carrier: order.carrier }), timestamp: stamp(shift(order.placedAt, 20 * 60)), tone: 'success' as const }] : []),
        ...(order.status !== 'pending' && order.status !== 'cancelled' ? [{ key: 'paid', title: t('{payment} payment received', { payment }), timestamp: stamp(shift(order.placedAt, 1)), tone: 'success' as const }] : []),
        { key: 'created', title: t('Order created'), timestamp: stamp(order.placedAt), tone: 'neutral' as const },
      ]
    : []
  const timeline: TimelineProps = { items: events }
  return (
    <LumiDetailPage
      title={order?.number ?? t('Order')}
      description={order ? t('Placed {time} · {payment}', { time: stamp(order.placedAt), payment }) : undefined}
      status={order && (overdue
        ? <Badge dot label={t('Overdue {hours}h', { hours: overdue })} tone="warning" appearance="soft" />
        : <Badge dot label={t(ORDER_LABELS[order.status])} tone={ORDER_TONES[order.status]} appearance="soft" />)}
      actions={order && (
        <>
          <Button label={t('Print')} appearance="outline" icon="printer" />
          <Button label={t('Refund')} appearance="outline" icon="undo" />
          {order.status === 'paid' && <Button label={t('Ship')} icon="truck" />}
        </>
      )}
      state={query.isPending
        ? { kind: 'loading', label: t('Loading order') }
        : query.error
          ? { kind: 'error', title: t('Order could not load'), reason: query.error.message, nextStep: t('Retry the request'), actionLabel: t('Retry'), onAction: () => { void query.refetch() } }
          : undefined}
      fields={order
        ? [
            { key: 'paid', label: t('Paid'), value: currencyExact.format(order.total), hint: discount > 0 ? `${currencyExact.format(discount)} off` : payment },
            { key: 'items', label: t('Items'), value: `${units} ${units === 1 ? 'unit' : 'units'}`, hint: `${lines.length} ${lines.length === 1 ? 'product' : 'products'}` },
            { key: 'warehouse', label: t('Ships from'), value: order.warehouse, hint: overdue ? t('Behind on picking') : t('On schedule') },
            { key: 'carrier', label: t('Delivery'), value: order.carrier, hint: order.status === 'shipped' ? t('Shipped') : t('Not shipped') },
          ]
        : []}
      items={{
        table,
        title: t('Items'),
        summary: [
          { key: 'subtotal', label: t('Subtotal'), value: currencyExact.format(subtotal) },
          { key: 'shipping', label: t('Shipping'), value: currencyExact.format(0) },
          ...(discount > 0 ? [{ key: 'discount', label: t('Promotion'), value: `\u2212${currencyExact.format(discount)}` }] : []),
          { key: 'total', label: t('Paid'), value: currencyExact.format(order?.total ?? 0), total: true },
        ],
      }}
      sections={order
        ? [
            {
              key: 'shipping',
              title: t('Shipping'),
              action: <Button label={t('Edit address')} appearance="outline" size="sm" icon="edit" />,
              children: (
                <DescriptionList items={[
                  { label: t('Recipient'), value: order.recipient },
                  { label: t('Phone'), value: order.phone },
                  { label: t('Address'), value: order.address, span: 'full' },
                ]}
                />
              ),
            },
            ...(order.customerNote || order.internalNote
              ? [{
                  key: 'notes',
                  title: t('Notes'),
                  children: (
                    <DescriptionList items={[
                      ...(order.customerNote ? [{ label: t('From the customer'), value: order.customerNote, span: 'full' as const }] : []),
                      ...(order.internalNote ? [{ label: t('Internal note, Support'), value: order.internalNote, span: 'full' as const }] : []),
                    ]}
                    />
                  ),
                }]
              : []),
          ]
        : undefined}
      aside={order
        ? [{
            key: 'customer',
            title: t('Customer'),
            action: <Button label={t('View')} appearance="outline" size="sm" onClick={() => drawer.open('customer-orders', order.customerId)} />,
            children: (
              <Fragment layout="stack">
                <Avatar
                  showName
                  size="lg"
                  name={order.customer}
                  description={history ? t('{tier}, {ordinal} order', { tier: tierLabel, ordinal: ordinal(history.total + 1), count: history.total + 1 }) : tierLabel}
                />
                <DescriptionList
                  layout="rows"
                  items={[
                    { label: t('Lifetime spend'), value: customer ? currencyExact.format(customer.spent) : '—' },
                    { label: t('Last order'), value: history?.data[0] ? stamp(history.data[0].placedAt) : t('First order') },
                    { label: t('Orders'), value: lifetime?.total ?? '—' },
                  ]}
                />
              </Fragment>
            ),
          }]
        : undefined}
      timeline={order ? timeline : undefined}
      timelineTitle={t('Activity')}
    />
  )
}
