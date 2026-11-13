import type { LumiMatrixChartPoint } from '@duxweb/lumi-admin'
import type { Tone } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { DashboardData } from '../dashboard-data.js'
import { useCustom, useTranslate } from '@duxweb/lumi'
import { LumiBarChart, LumiDashboardCard, LumiDashboardPage, LumiMatrixChart, LumiPipeline, LumiProportionList, LumiRecordList, LumiSegmented } from '@duxweb/lumi-admin'
import { LumiButton as Button, LumiSelect as Select, LumiStack as Stack, LumiTable as Table } from '@duxweb/lumi-ui'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { currency, delta, statusLabel, tone } from '../shared.js'

const STATUS_TONES: Record<string, Tone> = { pending: 'warning', paid: 'info', packed: 'neutral', shipped: 'success', cancelled: 'neutral' }
const PERIODS = [7, 28, 90] as const
const STATUSES = ['pending', 'paid', 'packed', 'shipped', 'cancelled'] as const

const PIPELINE_TONES: Record<string, 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'info'> = { pending: 'warning', paid: 'info', packed: 'neutral', shipped: 'success', cancelled: 'muted' }
const PAYMENT_LABELS: Record<string, string> = { wechat: 'WeChat Pay', alipay: 'Alipay', unionpay: 'UnionPay', cod: 'Cash on delivery' }
const TIER_TONES: Record<string, Tone> = { vip: 'primary', gold: 'warning', standard: 'neutral' }

const thousands = (value: number): string => (value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`)
const currencyTick = (value: number): string => (value >= 1000 ? `$${value / 1000}k` : `$${value}`)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const shortDate = (date: string): string => `${date.slice(5, 7)}/${date.slice(8, 10)}`
const placedAt = (stamp: string): string => `${shortDate(stamp)} ${stamp.slice(11, 16)}`

export function AdminDashboardRoute(): ReactElement {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const t = useTranslate()
  const requested = Number(params.get('days'))
  const days = PERIODS.find(value => value === requested) ?? 28
  const [series, setSeries] = useState<'revenue' | 'orders'>('revenue')
  const [status, setStatus] = useState('all')
  const query = useCustom<DashboardData>({ url: '/dashboard', query: { days } })
  const dashboard = query.data?.data

  const totals = dashboard?.totals
  const paidOrders = dashboard ? dashboard.charts.status.filter(row => ['paid', 'packed', 'shipped'].includes(row.status)).reduce((sum, row) => sum + row.count, 0) : 0
  const change = (key: 'revenue' | 'orders' | 'customers'): { change?: string, tone: Tone } => {
    const value = dashboard?.deltas[key]
    return value === null || value === undefined ? { tone: 'neutral' as const } : { change: delta(value), tone: tone(value) }
  }
  const rows = dashboard?.charts.revenue ?? []
  const lastWeek = rows.slice(-7)
  const products = dashboard?.charts.products ?? []
  const productCount = (key: string): number => products.find(row => row.status === key)?.count ?? 0
  const metrics = totals
    ? [
        { key: 'revenue', icon: 'receipt', label: t('Revenue'), value: thousands(totals.revenue), description: t('Daily avg {amount}, net of refunds', { amount: currency.format(totals.revenue / days) }), series: lastWeek.map(row => row.revenue), ...change('revenue') },
        { key: 'orders', icon: 'store', label: t('Orders'), value: totals.orders.toLocaleString('en-US'), description: t('Average order {amount}', { amount: currency.format(paidOrders ? totals.revenue / paidOrders : 0) }), series: lastWeek.map(row => row.orders), ...change('orders') },
        { key: 'customers', icon: 'users', label: t('Buying customers'), value: totals.customers.toLocaleString('en-US'), description: t('Ordered at least once in {days} days', { days }), ...change('customers') },
        { key: 'products', icon: 'package', label: t('Products'), value: totals.products.toLocaleString('en-US'), description: t('{active} active, {draft} draft, {archived} archived', { active: productCount('active'), draft: productCount('draft'), archived: productCount('archived') }), tone: 'neutral' as const },
      ]
    : []

  const average = rows.length ? rows.reduce((sum, row) => sum + row.revenue, 0) / rows.length : 0
  const notes = new Map(dashboard?.charts.annotations.map(entry => [entry.date, entry.note]))
  const points: LumiMatrixChartPoint[] = rows.map((row) => {
    const value = series === 'revenue' ? row.revenue : row.orders
    const display = series === 'revenue' ? currency.format(row.revenue) : t('{count} orders', { count: row.orders })
    const note = notes.get(row.date)
    const below = average ? Math.round((1 - row.revenue / average) * 100) : 0
    return { key: row.date, label: shortDate(row.date), value, display: note && below > 0 ? t('{value}, {percent}% below average', { value: display, percent: below }) : display, note: note && t('Agent: {note}', { note: t(note) }) }
  })
  const weekPeak = lastWeek.reduce<(typeof lastWeek)[number] | undefined>((peak, row) => (!peak || row.revenue > peak.revenue ? row : peak), undefined)
  const weekday = (date: string): string => t(WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!)
  const statusOptions = [{ value: 'all', label: t('All statuses') }, ...STATUSES.map(value => ({ value, label: t(statusLabel(value)) }))]

  const recent = (dashboard?.recent.orders ?? []).filter(order => status === 'all' || order.status === status)
  return (
    <LumiDashboardPage
      title={t('Operations overview')}
      description={dashboard ? t('{start} to {end}, updated 22:30', { start: shortDate(dashboard.period.start), end: shortDate(dashboard.period.end) }) : t('Revenue, customers and order activity')}
      actions={(
        <Stack direction="horizontal" gap="sm" wrap>
          <LumiSegmented
            ariaLabel={t('Reporting period')}
            value={String(days)}
            options={PERIODS.map(value => ({ value: String(value), label: t('{count} days', { count: value }) }))}
            onChange={value => setParams((previous) => {
              const next = new URLSearchParams(previous)
              next.set('days', value)
              return next
            })}
          />
          <Button label={t('Export')} appearance="outline" icon="download" />
        </Stack>
      )}
      metrics={metrics}
      state={query.isPending ? { kind: 'loading', label: t('Loading dashboard') } : query.error ? { kind: 'error', title: t('Dashboard unavailable'), reason: query.error.message, nextStep: t('Retry to load your overview'), actionLabel: t('Retry'), onAction: () => { void query.refetch() } } : undefined}
    >
      <LumiDashboardCard
        span="full"
        title={t('Daily trend')}
        action={(
          <LumiSegmented
            ariaLabel={t('Series')}
            value={series}
            options={[{ value: 'revenue', label: t('Revenue') }, { value: 'orders', label: t('Orders') }]}
            onChange={value => setSeries(value as 'revenue' | 'orders')}
          />
        )}
      >
        <LumiMatrixChart
          ariaLabel={series === 'revenue' ? t('Daily revenue') : t('Daily orders')}
          points={points}
          formatTick={series === 'revenue' ? currencyTick : String}
          labelEvery={days > 28 ? 14 : days > 7 ? 7 : 1}
        />
      </LumiDashboardCard>
      <LumiDashboardCard title={t('Order pipeline')} description={t('Where the {count} orders of the period stand', { count: totals?.orders ?? '' })}>
        <LumiPipeline
          ariaLabel={t('Orders by status')}
          stages={(dashboard?.charts.status ?? []).map(row => ({ key: row.status, label: t(statusLabel(row.status)), value: row.count, tone: PIPELINE_TONES[row.status] }))}
        />
      </LumiDashboardCard>
      <LumiDashboardCard title={t('Payment methods')} description={t('Share of revenue by how customers paid')}>
        <LumiProportionList
          ariaLabel={t('Revenue by payment method')}
          tone="primary"
          showShare
          items={(dashboard?.rankings.payments ?? []).map(row => ({ key: row.method, label: t(PAYMENT_LABELS[row.method] ?? row.method), value: row.revenue, display: t('{amount} · {count} orders', { amount: currency.format(row.revenue), count: row.count }) }))}
        />
      </LumiDashboardCard>
      <LumiDashboardCard
        span="full"
        flush
        title={t('Recent orders')}
        action={(
          <Stack direction="horizontal" gap="sm">
            <Select ariaLabel={t('Filter by status')} size="sm" options={statusOptions} value={status} onChange={value => setStatus(String(value ?? 'all'))} />
            <Button label={t('View all')} appearance="outline" size="sm" href="/orders" />
          </Stack>
        )}
      >
        <Table
          aria-label={t('Recent orders')}
          rowKey="number"
          highlightField="overdue"
          empty={t('No orders match this status')}
          rows={recent.map(order => ({
            ...order,
            state: order.overdueHours ? 'overdue' : order.status,
            stateLabel: order.overdueHours ? t('Overdue {hours}h · flagged by Agent', { hours: order.overdueHours }) : t(statusLabel(order.status)),
            overdue: Boolean(order.overdueHours),
            placed: placedAt(order.placedAt),
          }))}
          columns={[
            { field: 'number', label: t('Order'), kind: 'code', width: '8rem' },
            { field: 'customer', label: t('Customer'), kind: 'entity', initials: true, truncate: true },
            { field: 'product', label: t('Product'), truncate: true },
            { field: 'state', label: t('Status'), kind: 'badge', labelField: 'stateLabel', toneMap: { ...STATUS_TONES, overdue: 'warning' } },
            { field: 'total', label: t('Amount'), kind: 'currency', currency: 'USD', align: 'right', width: '7rem' },
            { field: 'placed', label: t('Placed'), align: 'right', width: '7rem' },
          ]}
          onRowClick={row => void navigate(`/orders/${String(row.id)}`)}
        />
      </LumiDashboardCard>
      <LumiDashboardCard flush title={t('Top customers')} description={t('By spend in the period')} action={<Button label={t('All customers')} appearance="outline" size="sm" href="/customers" />}>
        <LumiRecordList
          ariaLabel={t('Top customers')}
          items={(dashboard?.rankings.customers ?? []).slice(0, 5).map(row => ({ key: row.name, title: row.name, description: t('{count} orders', { count: row.orders }), status: { label: t(row.tier.charAt(0).toUpperCase() + row.tier.slice(1)), tone: TIER_TONES[row.tier] ?? 'neutral' }, value: currency.format(row.spent) }))}
        />
      </LumiDashboardCard>
      <LumiDashboardCard title={t('Last 7 days')} description={t('Revenue per day')} action={<Button label={t('Orders')} appearance="outline" size="sm" href="/orders" />}>
        <LumiBarChart
          ariaLabel={t('Revenue in the last 7 days')}
          showValues
          formatTick={currencyTick}
          caption={weekPeak ? t('Best day: {day} {date}, {amount}', { day: weekday(weekPeak.date), date: shortDate(weekPeak.date), amount: currency.format(weekPeak.revenue) }) : undefined}
          points={lastWeek.map(row => ({ key: row.date, label: weekday(row.date), value: row.revenue, display: thousands(row.revenue) }))}
        />
      </LumiDashboardCard>
    </LumiDashboardPage>
  )
}
