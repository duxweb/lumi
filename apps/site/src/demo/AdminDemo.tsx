import type { AdminManifest } from '@duxweb/lumi-admin/catalog'
import type { Spec } from '@json-render/core'
import type { ReactElement } from 'react'
import type { Locale } from '../i18n'
import { adminRegistry, createAdmin } from '@duxweb/lumi-admin'
import { useEffect, useMemo } from 'react'
import { createMemoryRouter } from 'react-router'
// The same JSON pages the full admin demo serves from apps/admin/public/pages.
import boards from '../../../admin/public/pages/boards.json'
import sales from '../../../admin/public/pages/dashboard-sales.json'
import forms from '../../../admin/public/pages/form-elements.json'
import lists from '../../../admin/public/pages/lists.json'
import tables from '../../../admin/public/pages/tables.json'
import { COPY } from '../i18n'
import { demoContext } from './context'
import '@duxweb/lumi-admin/style.css'

function createManifest(locale: Locale): AdminManifest {
  const { app, menu } = COPY[locale].demo
  const group = { name: 'shop', label: app }
  return {
    app: { id: 'lumi-site-demo', title: app, subtitle: 'Lumi Admin', layout: 'single', search: 'none', documentTitle: false },
    routes: [
      { path: '/', redirect: '/dashboard' },
      { name: 'dashboard', path: '/dashboard', page: { spec: sales as Spec }, menu: { label: menu.dashboard, icon: 'chart-line', order: 10, group } },
      { name: 'boards', path: '/boards', page: { spec: boards as Spec }, menu: { label: menu.boards, icon: 'calendar', order: 20, group } },
      { name: 'tables', path: '/tables', page: { spec: tables as Spec }, menu: { label: menu.tables, icon: 'table', order: 30, group } },
      { name: 'forms', path: '/forms', page: { spec: forms as Spec }, menu: { label: menu.forms, icon: 'forms', order: 40, group } },
      { name: 'lists', path: '/lists', page: { spec: lists as Spec }, menu: { label: menu.lists, icon: 'list', order: 50, group } },
    ],
  }
}

/**
 * A real Lumi Admin, booted the way an application boots it, with its data
 * and session held in this tab and its routes in memory so the site's own
 * address never changes.
 */
export function AdminDemo({ locale }: { locale: Locale }): ReactElement {
  const admin = useMemo(() => {
    return createAdmin({
      context: demoContext(locale),
      manifest: createManifest(locale),
      registry: adminRegistry,
      shellStorageKey: `lumi-site-demo-${locale}`,
      createRouter: routes => createMemoryRouter(routes, { initialEntries: ['/dashboard'] }),
    })
  }, [locale])
  useEffect(() => () => admin.dispose(), [admin])
  return <admin.App />
}
