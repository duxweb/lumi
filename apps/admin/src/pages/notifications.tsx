import type { ReactElement } from 'react'
import { useCustom, useTranslate } from '@duxweb/lumi'
import { LumiRecordList } from '@duxweb/lumi-admin'
import { currencyExact, statusLabel } from '../shared.js'

interface ActivityFeed {
  recent: {
    orders: Array<{ number: string, customer: string, status: string, total: number, createdAt: string }>
    products: Array<{ name: string, sku: string, status: string, price: number }>
  }
}

const ORDER_TONES: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  pending: 'warning',
  paid: 'success',
  packed: 'info',
  shipped: 'success',
  cancelled: 'danger',
}

const PRODUCT_TONES: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  draft: 'warning',
  archived: 'neutral',
}

/**
 * No separate endpoint invents itself for this demo: the feed is the same
 * `/dashboard` activity the dashboard already reads, told as a stream. The
 * bell that opens it is declared in the manifest (`app.header.actions`), so
 * this drawer is the only piece the host owns.
 */
export function NotificationsDrawer(): ReactElement {
  const t = useTranslate()
  const query = useCustom<ActivityFeed>({ url: '/dashboard' })
  const feed = query.data?.data
  const orders = feed?.recent.orders ?? []
  const products = feed?.recent.products ?? []
  return (
    <>
      <LumiRecordList
        title={t('Orders')}
        loading={query.isLoading}
        emptyLabel={t('No new orders')}
        items={orders.map(order => ({
          key: order.number,
          title: order.number,
          description: order.customer,
          status: { label: t(statusLabel(order.status)), tone: ORDER_TONES[order.status] ?? 'neutral' },
          value: currencyExact.format(order.total),
          meta: order.createdAt,
        }))}
      />
      <LumiRecordList
        title={t('Catalog')}
        loading={query.isLoading}
        emptyLabel={t('No catalog changes')}
        items={products.map(product => ({
          key: product.sku,
          title: product.name,
          status: { label: t(statusLabel(product.status)), tone: PRODUCT_TONES[product.status] ?? 'neutral' },
          value: currencyExact.format(product.price),
        }))}
      />
    </>
  )
}
