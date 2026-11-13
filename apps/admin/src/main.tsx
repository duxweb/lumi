import { adminRegistry, mountAdmin, resolveAdminBaseConfig } from '@duxweb/lumi-admin'
import { adminCatalogDefinitions, adminConfigItems } from '@duxweb/lumi-admin/catalog'
import { createJsonSchemaValidator } from '@duxweb/lumi/validation-json-schema'
import { defineCatalog } from '@json-render/core'
import { defineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'
import { DemoCoverageCard } from './assistant'
import { CAPABILITIES } from './capabilities'
import { localDataProvider } from './local-provider'
import { createAdminManifest } from './manifest'
import { RoleEditDrawer, UserEditDrawer } from './pages/access'
import { NotificationsDrawer } from './pages/notifications'
import { CustomerEditDrawer, CustomerOrdersDrawer } from './pages/overlays'
import { adminRouteComponents } from './routes'
import { mountedAdmin, setMountedAdmin } from './session'
import '@duxweb/lumi-ui/style.css'
import '@duxweb/lumi-admin/style.css'

const TRAILING_SLASH_RE = /\/$/

const routeDefinitions = Object.fromEntries(Object.keys(adminRouteComponents).map(name => [name, { props: z.strictObject({}), slots: [], events: [] }]))
const routeCatalog = defineCatalog(schema, { components: routeDefinitions, actions: {} })
const catalog = defineCatalog(schema, { components: { ...adminCatalogDefinitions.components, ...routeDefinitions }, actions: adminCatalogDefinitions.actions })
const { registry: routes } = defineRegistry(routeCatalog, { components: Object.fromEntries(Object.entries(adminRouteComponents).map(([name, Component]) => [name, () => <Component />])) })
/**
 * A static host answers an inner route of the hosted demo with its 404 page,
 * which stores the path and reopens the demo's index; put that path back in
 * the address bar before the router reads it.
 */
function restoreRedirectedPath(): void {
  try {
    const path = sessionStorage.getItem('lumi-admin-redirect')
    sessionStorage.removeItem('lumi-admin-redirect')
    if (path?.startsWith(import.meta.env.BASE_URL))
      window.history.replaceState(null, '', path)
  }
  catch {}
}

// Like the prebuilt base: API, auth and translations come from public/config.json;
// the compiled demo adds its own React pages, drawers and the JSON validator.
async function boot(): Promise<void> {
  // Built under a sub-path (LUMI_ADMIN_BASE), the routes live under it as well.
  const basename = import.meta.env.BASE_URL.replace(TRAILING_SLASH_RE, '')
  // The demo's one panel takes its manifest from TypeScript.
  const config = await resolveAdminBaseConfig(`${import.meta.env.BASE_URL}config.json`, loaded => ({
    ...loaded,
    panels: { ...loaded.panels, manifest: createAdminManifest() },
    ...(basename ? { basename } : {}),
  }))
  const backend = adminConfigItems(config.data)[0]!
  const signIn = adminConfigItems(config.auth)[0]
  // A static build answers the backend in the page instead of from the Node mock.
  if (import.meta.env.VITE_LUMI_ADMIN_MOCK === 'browser') {
    restoreRedirectedPath()
    const { installBrowserMock } = await import('./browser-mock')
    await installBrowserMock(backend.url, signIn?.tokenKey)
    // The hosted demo greets each visitor in their browser's language.
    if (config.i18n && navigator.language.toLowerCase().startsWith('zh'))
      config.i18n = { ...config.i18n, locale: 'zh-CN' }
  }
  const admin = await mountAdmin(config, {
    validator: createJsonSchemaValidator(),
    // A second backend beside the config's, reached with `dataProviderName: 'local'`.
    dataProviders: { local: localDataProvider },
    catalog,
    registry: { ...adminRegistry, ...routes },
    // The assistant comes from the manifest's `app.assistant`; a module adds
    // its own / command, and one without a prompt reaches onEvent.
    assistantCommands: [{ value: 'open-orders', label: 'Open the order list', description: 'Goes to Filters & bulk actions', icon: 'shopping-cart' }],
    onEvent: ({ name, payload }) => {
      if (name === 'assistant.command' && payload.command === 'open-orders')
        void mountedAdmin()?.getRouter()?.navigate('/orders')
    },
    sidebarFooter: <DemoCoverageCard />,
    menuBadges: {
      orders: { label: 11, tone: 'warning' },
      workbench: { label: 5 },
      ...Object.fromEntries(CAPABILITIES.filter(item => item.status === 'planned').map(item => [item.name, { label: 'Planned' }])),
    },
    drawers: {
      'edit-customer': { title: 'Edit customer', size: 'md', component: CustomerEditDrawer },
      'customer-orders': { title: 'Orders', size: 'lg', component: CustomerOrdersDrawer },
      'notifications': { title: 'Notifications', size: 'md', component: NotificationsDrawer },
      'edit-user': { title: 'User', size: 'md', component: UserEditDrawer },
      'edit-role': { title: 'Role', size: 'lg', component: RoleEditDrawer },
    },
  })
  setMountedAdmin(admin)
}

boot().catch((error: unknown) => {
  console.error(error)
  document.querySelector('#app')!.textContent = error instanceof Error ? error.message : String(error)
})
